import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class ProcessManager {
    private mainPids: Set<number> = new Set();
    private childPids: Set<number> = new Set();
    private portsMap: Map<number, number[]> = new Map();

    // 1. Сбор всех PID по имени процесса
    public async captureMainProcesses(): Promise<void> {
        this.mainPids = new Set(await this.getProcessesByName());
        console.log('Main PIDs captured:', Array.from(this.mainPids));
    }

    // 2. Поиск новых PID после запуска дочернего приложения
    public async captureChildProcesses(): Promise<void> {
        const currentPids = new Set(await this.getProcessesByName());
        this.childPids = new Set(
            [...currentPids].filter(pid => !this.mainPids.has(pid))
        );
        console.log('Child PIDs captured:', Array.from(this.childPids));
    }

    // 3. Получение списка новых PID
    public getNonMainPids(): number[] {
        return Array.from(this.childPids);
    }

    // 4. Поиск портов для PID
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

    private async getProcessesByName(): Promise<number[]> {
        return process.platform === 'win32' 
            ? this.getWindowsProcesses() 
            : this.getUnixProcesses();
    }

    private async getWindowsProcesses(): Promise<number[]> {
        try {
            const { stdout } = await execAsync(
                'wmic process where "name=\'openfin.exe\'" get ProcessId'
            );

            return stdout
                .split('\r\n')
                .slice(1) // Пропускаем заголовок
                .map(line => parseInt(line.trim()))
                .filter(pid => !isNaN(pid));
        } catch (error) {
            console.error('Error getting Windows processes:', error);
            return [];
        }
    }

    private async getUnixProcesses(): Promise<number[]> {
        try {
            const { stdout } = await execAsync('pgrep openfin');
            return stdout
                .split('\n')
                .map(pidStr => parseInt(pidStr))
                .filter(pid => !isNaN(pid));
        } catch (error) {
            // pgrep возвращает код ошибки 1 если процессов не найдено
            if (error.code === 1) return [];
            console.error('Error getting Unix processes:', error);
            return [];
        }
    }

    private async getPortsByPid(pid: number): Promise<number[]> {
        try {
            return process.platform === 'win32' 
                ? this.getWindowsPorts(pid) 
                : this.getUnixPorts(pid);
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
        } catch {
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
        } catch {
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

// Пример использования
async function main() {
    const manager = new AsyncProcessManager();
    
    // 1. Собираем текущие процессы
    await manager.captureMainProcesses();
    
    // 2. Запускаем дочернее приложение...
    
    // 3. Собираем новые процессы
    await manager.captureChildProcesses();
    
    // 4. Ищем порты для новых процессов
    await manager.findPortsForPids(manager.getNonMainPids());
    
    console.log('Результат:');
    console.log('Основные PID:', manager.getMainPids());
    console.log('Дочерние PID:', manager.getNonMainPids());
    console.log('Порты:', manager.getPortsMap());
}

main().catch(console.error);