import { execSync } from 'child_process';

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
    static async waitForProcess(processName: string, waitTime: number = 15_000, maxAttempts: number = 5): Promise<void> {
        for (let i = 0; i < maxAttempts; i++) {
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            if (ProcessManager.isProcessRunning(processName)) break;
        }
    }
}

export default ProcessManager;