import { execSync } from 'child_process';
import { promisify } from 'util';
import { createConnection, Socket } from 'net';


class ProcessManager {
    // Kill a process by name
    static taskKill(processName: string): void {
        try {
            execSync(`taskkill /F /IM "${processName}"`);
        } catch (error) {
            console.error(`Error killing process ${processName}:`, error);
        }
    }

    // Check if a process is running
    static isProcessRunning(processName: string): boolean {
        try {
            const output = execSync(`tasklist /FI "IMAGENAME eq ${processName}"`).toString();
            return output.includes(processName);
        } catch (error) {
            return false;
        }
    }

    
    // Wait for a process to start
    async waitForProcess(processName: string, waitTime: number = 15_000, maxAttempts: number = 5): Promise<void> {
        const execAsync = promisify(exec);
        let attempts: number = 0;
        while (attempts < maxAttempts) {
            try {
                const {stdout} = execAsync(`tasklist /FI "IMAGENAME eq ${processName}"`);
                if (stdout.includes(processName)) {
                    // TODO check port!
                    return;
                }
            } catch(e) {
                console.log(`error`);
            }
            attempts++;
            console.log('waiting');
            await new Promise((resolve) => setTimeout(resolve, waitTime))
        }
    }

    private async isPortAvailable(port: number, timeout: number): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const socket: Socket = createConnection({ port, timeout });
        
            const cleanup = () => {
                socket.removeAllListeners();
                socket.destroy();
            };
        
            const timer = setTimeout(() => {
                cleanup();
                resolve(false);
            }, timeout);
        
            socket
                .once('connect', () => {
                clearTimeout(timer);
                cleanup();
                resolve(true); // The port is available (there is a connection)
                })
                .once('error', (err: NodeJS.ErrnoException) => {
                clearTimeout(timer);
                cleanup();
                if (err.code === 'ECONNREFUSED') {
                    resolve(false); // The port is not listening
                } else {
                    reject(err); // Other errors
                }
            });
        });
    }
}

export default ProcessManager;