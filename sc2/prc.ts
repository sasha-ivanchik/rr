import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class ProcessManager {
    private mainPids: Set<number> = new Set();
    private childPids: Set<number> = new Set();
    private portsMap: Map<number, number[]> = new Map();

    public async captureMainProcesses(): Promise<void> {
        this.mainPids = new Set(await this.getOpenFinProcesses());
        console.log('Main PIDs captured:', Array.from(this.mainPids));
    }

    public async captureChildProcesses(): Promise<void> {
        const currentPids = new Set(await this.getOpenFinProcesses());
        this.childPids = new Set(
            [...currentPids].filter(pid => !this.mainPids.has(pid))
        );
        console.log('Child PIDs captured:', Array.from(this.childPids));
    }

    public getNonMainPids(): number[] {
        return Array.from(this.childPids);
    }

    public async findPortsForPids(pids: number[]): Promise<void> {
        this.portsMap.clear();
        
        for (const pid of pids) {
            const ports = await this.getPortsByPid(pid);
            if (ports.length > 0) {
                this.portsMap.set(pid, ports);
                console.log(`Found ports for PID ${pid}:`, ports);
            }
        }
    }

    private async getOpenFinProcesses(): Promise<number[]> {
        return process.platform === 'win32' 
            ? await this.getWindowsProcesses() 
            : await this.getUnixProcesses();
    }

    private async getWindowsProcesses(): Promise<number[]> {
        try {
            const { stdout } = await execAsync(
                `wmic process where "name='openfin.exe'" get ProcessId,CommandLine /format:csv`
            );

            return stdout
                .split('\r\n')
                .filter(line => line.includes('--app='))
                .map(line => {
                    const parts = line.split(',');
                    return parseInt(parts[parts.length - 2]);
                })
                .filter(pid => !isNaN(pid));
        } catch (error) {
            console.error('Error getting Windows processes:', error);
            return [];
        }
    }

    private async getUnixProcesses(): Promise<number[]> {
        try {
            const { stdout } = await execAsync(
                `pgrep -f 'openfin.*--app='`
            );

            return stdout
                .split('\n')
                .map(pidStr => parseInt(pidStr))
                .filter(pid => !isNaN(pid));
        } catch (error) {
            console.error('Error getting Unix processes:', error);
            return [];
        }
    }

    private async getPortsByPid(pid: number): Promise<number[]> {
        try {
            return process.platform === 'win32' 
                ? await this.getWindowsPorts(pid) 
                : await this.getUnixPorts(pid);
        } catch (error) {
            console.error(`Error getting ports for PID ${pid}:`, error);
            return [];
        }
    }

    private async getWindowsPorts(pid: number): Promise<number[]> {
        try {
            const { stdout } = await execAsync(
                `netstat -ano | findstr ":92.*ESTABLISHED" | findstr "${pid}"`
            );

            return [...new Set(
                stdout.split('\r\n')
                    .map(line => line.match(/:(\d+)\s/)?.[1])
                    .filter(Boolean)
                    .map(Number)
            )];
        } catch (error) {
            return [];
        }
    }

    private async getUnixPorts(pid: number): Promise<number[]> {
        try {
            const { stdout } = await execAsync(
                `lsof -aPi -p ${pid} -sTCP:LISTEN`
            );

            return [...new Set(
                stdout.split('\n')
                    .slice(1)
                    .map(line => line.match(/:(\d+)/)?.[1])
                    .filter(Boolean)
                    .map(Number)
            )];
        } catch (error) {
            return [];
        }
    }

    public getMainPids(): number[] {
        return Array.from(this.mainPids);
    }

    public getPortsMap(): Map<number, number[]> {
        return new Map(this.portsMap);
    }
}