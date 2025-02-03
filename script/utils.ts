import { execSync } from 'child_process';
import psList from 'ps-list';
import { setTimeout } from 'timers/promises';
import * as log from 'console';

interface AMPSClient {
    connect_and_log(): Promise<void>;
    sow(topic: string, options: { filter?: string }): Promise<any[]>;
    disconnect(): Promise<void>;
}

interface AMPSMessage {
    get_data(): any;
}

interface ProcessInfo {
    name: string;
    instances: number;
}

class ProcessUtil {
    private static readonly DEFAULT_WAIT_TIME = 15_000;
    private static readonly DEFAULT_MAX_ATTEMPTS = 5;
    private static readonly MAX_SOW_RESULTS = 50;

    /**
     * Forcefully terminates a process by name
     * @throws Error if process termination fails
     */
    static async taskKill(processName: string): Promise<void> {
        try {
            const isProcessRunning = await this.findProcess(processName);
            if (!isProcessRunning) {
                log.warn(`Process ${processName} is not running.`);
                return;
            }

            execSync(`taskkill /F /IM "${processName}"`);
            log.info(`Successfully killed process: ${processName}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            log.error(`Error killing process ${processName}: ${errorMessage}`);
            throw new Error(`Failed to kill process ${processName}: ${errorMessage}`);
        }
    }

    /**
     * Checks if a process is currently running
     */
    static async findProcess(processName: string): Promise<boolean> {
        const processes = await psList();
        return processes.some(p => p.name === processName);
    }

    /**
     * Counts the number of instances of a specific process
     */
    static async processInstanceCount(processName: string): Promise<number> {
        const processes = await psList();
        return processes.filter(p => p.name === processName).length;
    }

    /**
     * Waits for a process to have at least 3 instances running
     * @returns Promise that resolves when condition is met or max attempts reached
     */
    static async waitForProcess(
        processName: string,
        waitTime: number = this.DEFAULT_WAIT_TIME,
        maxAttempts: number = this.DEFAULT_MAX_ATTEMPTS
    ): Promise<void> {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            log.info(`Waiting for process ${processName} (Attempt ${attempt}/${maxAttempts})...`);

            await setTimeout(waitTime);
            const found = await this.findProcess(processName);

            if (found) {
                const instanceCount = await this.processInstanceCount(processName);
                if (instanceCount >= 3) {
                    log.info(`Process ${processName} found with ${instanceCount} instances.`);
                    return;
                }
            }
        }

        log.warn(`Process ${processName} not found after ${maxAttempts} attempts.`);
    }

    /**
     * Retrieves data from AMPS server with proper error handling and resource cleanup
     */
    static async getDataFromAmps(
        serverName: string,
        service: string,
        clientName: string,
        topic: string,
        filter: string | null = null
    ): Promise<any[]> {
        let client: AMPSClient | undefined;

        try {
            const qz = await import('qz.core.amps_servers');
            const chooserModule = await import('qz.amps.server_chooser');

            const server = qz.default.lookup(serverName);
            const chooser = new chooserModule.default.AMPSSingleServerChooser(server, service, {
                maxRetries: 5
            });

            client = server.client(clientName, { serverChooser: chooser });
            await client.connect_and_log();

            const sowData: any[] = [];
            const messages = await client.sow(topic, { filter });

            for (const msg of messages) {
                const data = msg.get_data();
                if (data) {
                    sowData.push(data);
                }
                if (sowData.length >= this.MAX_SOW_RESULTS) break;
            }

            return sowData;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            log.error(`Error while collecting data from AMPS: ${errorMessage}`);
            return [];
        } finally {
            if (client) {
                try {
                    await client.disconnect();
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    log.error(`Error disconnecting AMPS client: ${errorMessage}`);
                }
            }
        }
    }

    /**
     * Executes an AutoIt script file
     * @throws Error if file doesn't exist or execution fails
     */
    static async executeAu3File(fileLocation: string): Promise<void> {
        try {
            const fs = await import('fs');
            if (!fs.existsSync(fileLocation)) {
                throw new Error(`File not found: ${fileLocation}`);
            }

            const win32com = await import('winax');
            const autoit = new win32com.Object('AutoItX3.Control');
            autoit.Run(fileLocation);
            log.info(`Successfully executed AU3 file: ${fileLocation}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            log.error(`Error while executing AU3 file: ${errorMessage}`);
            throw new Error(`Failed to execute AU3 file: ${errorMessage}`);
        }
    }
}

export default ProcessUtil;