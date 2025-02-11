import { execSync } from 'child_process';

class ProcessManager {
    private mainPids: Set<number> = new Set();
    private childPids: Set<number> = new Set();
    private portsMap: Map<number, number[]> = new Map();

    public captureMainProcesses(): void {
        this.mainPids = new Set(this.getOpenFinProcesses());
        console.log('Main PIDs captured:', Array.from(this.mainPids));
    }

    public captureChildProcesses(): void {
        const currentPids = new Set(this.getOpenFinProcesses());
        this.childPids = new Set(
            [...currentPids].filter(pid => !this.mainPids.has(pid))
        );
        console.log('Child PIDs captured:', Array.from(this.childPids));
    }

    public getNonMainPids(): number[] {
        return Array.from(this.childPids);
    }

    public findPortsForPids(pids: number[]): void {
        this.portsMap.clear();
        pids.forEach(pid => {
            const ports = this.getPortsByPid(pid);
            if (ports.length > 0) {
                this.portsMap.set(pid, ports);
                console.log(`Found ports for PID ${pid}:`, ports);
            }
        });
    }

    private getOpenFinProcesses(): number[] {
        return process.platform === 'win32' 
            ? this.getWindowsProcesses() 
            : this.getUnixProcesses();
    }

    private getWindowsProcesses(): number[] {
        try {
            const output = execSync(
                `wmic process where "name='openfin.exe'" get ProcessId,CommandLine /format:csv`
            ).toString();

            return output
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

    private getUnixProcesses(): number[] {
        try {
            const output = execSync(
                `pgrep -f 'openfin.*--app='`
            ).toString();

            return output
                .split('\n')
                .map(pidStr => parseInt(pidStr))
                .filter(pid => !isNaN(pid));
        } catch (error) {
            console.error('Error getting Unix processes:', error);
            return [];
        }
    }

    private getPortsByPid(pid: number): number[] {
        try {
            return process.platform === 'win32' 
                ? this.getWindowsPorts(pid) 
                : this.getUnixPorts(pid);
        } catch (error) {
            console.error(`Error getting ports for PID ${pid}:`, error);
            return [];
        }
    }

    private getWindowsPorts(pid: number): number[] {
        const output = execSync(
            `netstat -ano | findstr ":92.*ESTABLISHED" | findstr "${pid}"`
        ).toString();

        return [...new Set(
            output.split('\r\n')
                .map(line => line.match(/:(\d+)\s/)?.[1])
                .filter(Boolean)
                .map(Number)
        )];
    }

    private getUnixPorts(pid: number): number[] {
        const output = execSync(
            `lsof -aPi -p ${pid} -sTCP:LISTEN`
        ).toString();

        return [...new Set(
            output.split('\n')
                .slice(1)
                .map(line => line.match(/:(\d+)/)?.[1])
                .filter(Boolean)
                .map(Number)
        )];
    }

    public getMainPids(): number[] {
        return Array.from(this.mainPids);
    }

    public getPortsMap(): Map<number, number[]> {
        return new Map(this.portsMap);
    }
}