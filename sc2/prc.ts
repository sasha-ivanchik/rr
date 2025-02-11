import { execSync } from 'child_process';

class ProcessManager {
    private mainPids: Set<number> = new Set();
    private childPids: Set<number> = new Set();
    private portsMap: Map<number, number[]> = new Map();

    // 1. Определить все PID для основного процесса
    public captureMainProcesses(): void {
        const processes = this.getOpenFinProcesses();
        this.mainPids = new Set(processes.map(p => p.pid));
        console.log('Main PIDs captured:', Array.from(this.mainPids));
    }

    // 2. Повторный вызов для дочерних процессов
    public captureChildProcesses(): void {
        const currentProcesses = this.getOpenFinProcesses();
        const newPids = currentProcesses
            .filter(p => !this.mainPids.has(p.pid))
            .map(p => p.pid);

        this.childPids = new Set(newPids);
        console.log('Child PIDs captured:', Array.from(this.childPids));
    }

    // 3. Определить неосновные PIDs (дочерние)
    public getNonMainPids(): number[] {
        return Array.from(this.childPids);
    }

    // 4. Найти порты по PIDs
    public findPortsForPids(pids: number[]): void {
        this.portsMap.clear();
        
        for (const pid of pids) {
            const ports = this.getPortsByPid(pid);
            if (ports.length > 0) {
                this.portsMap.set(pid, ports);
                console.log(`Found ports for PID ${pid}:`, ports);
            }
        }
    }

    private getOpenFinProcesses(): Array<{pid: number, cmd: string}> {
        try {
            if (process.platform === 'win32') {
                return this.getWindowsProcesses();
            }
            return this.getUnixProcesses();
        } catch (error) {
            console.error('Error getting processes:', error);
            return [];
        }
    }

    private getWindowsProcesses(): Array<{pid: number, cmd: string}> {
        const output = execSync(
            `wmic process where "name='openfin.exe'" get ProcessId,CommandLine /format:csv`
        ).toString();

        return output.split('\r\n')
            .slice(1)
            .filter(line => line.includes('--app='))
            .map(line => {
                const parts = line.split(',');
                return {
                    pid: parseInt(parts[parts.length - 2]),
                    cmd: parts[parts.length - 1]
                };
            });
    }

    private getUnixProcesses(): Array<{pid: number, cmd: string}> {
        const output = execSync(
            `ps -eo pid,args | grep 'openfin.*--app='`
        ).toString();

        return output.split('\n')
            .filter(Boolean)
            .map(line => {
                const match = line.match(/^\s*(\d+)\s+(.*)/);
                return match ? {
                    pid: parseInt(match[1]),
                    cmd: match[2]
                } : null;
            })
            .filter(Boolean) as Array<{pid: number, cmd: string}>;
    }

    private getPortsByPid(pid: number): number[] {
        try {
            if (process.platform === 'win32') {
                return this.getWindowsPorts(pid);
            }
            return this.getUnixPorts(pid);
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
                .filter(Boolean)
                .map(line => {
                    const match = line.match(/:(\d+)\s/);
                    return match ? parseInt(match[1]) : null;
                })
                .filter(Boolean)
        )] as number[];
    }

    private getUnixPorts(pid: number): number[] {
        const output = execSync(
            `lsof -aPi -p ${pid} -sTCP:LISTEN`
        ).toString();

        return [...new Set(
            output.split('\n')
                .slice(1)
                .map(line => {
                    const match = line.match(/:(\d+)/);
                    return match ? parseInt(match[1]) : null;
                })
                .filter(Boolean)
        )] as number[];
    }

    // Дополнительные методы для доступа к данным
    public getMainPids(): number[] {
        return Array.from(this.mainPids);
    }

    public getPortsMap(): Map<number, number[]> {
        return new Map(this.portsMap);
    }
}

// Пример использования
const manager = new ProcessManager();

// 1. Захватить основные процессы
manager.captureMainProcesses();

// 2. После запуска дочернего приложения
manager.captureChildProcesses();

// 3. Получить дочерние PIDs
const childPids = manager.getNonMainPids();

// 4. Найти порты для дочерних процессов
manager.findPortsForPids(childPids);

// Получить результат
console.log('Final ports mapping:', manager.getPortsMap());