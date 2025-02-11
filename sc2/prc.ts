import { chromium, Browser } from 'playwright';
import { execSync } from 'child_process';

interface ProcessInfo {
    pid: number;
    ports: number[];
}

async function findNewOpenFinProcesses(initialPids: Set<number>): Promise<ProcessInfo[]> {
    const currentProcesses = getOpenFinProcesses();
    const newProcesses = currentProcesses.filter(p => !initialPids.has(p.pid));
    
    return Promise.all(
        newProcesses.map(async p => ({
            pid: p.pid,
            ports: await getProcessPorts(p.pid)
        }))
    );
}

function getOpenFinProcesses(): { pid: number }[] {
    // Для Windows
    if (process.platform === 'win32') {
        const output = execSync(
            `wmic process where "name='openfin.exe'" get processid,commandline /format:csv`
        ).toString();
        
        return output.split('\n')
            .slice(1)
            .filter(line => line.includes('--app='))
            .map(line => ({
                pid: parseInt(line.match(/,(\d+),/)?.[1] || '0'))
            }))
            .filter(p => !isNaN(p.pid));
    }

    // Для Linux/MacOS
    const output = execSync(
        `pgrep -f 'openfin.*--app='`
    ).toString();
    
    return output.split('\n')
        .filter(Boolean)
        .map(pidStr => ({ pid: parseInt(pidStr) }));
}

async function getProcessPorts(pid: number): Promise<number[]> {
    try {
        // Для Windows
        if (process.platform === 'win32') {
            const output = execSync(
                `netstat -ano | findstr :92 | findstr ${pid}`
            ).toString();
            
            return [...new Set(
                output.split('\n')
                    .map(line => line.match(/:(\d+)/)?.[1])
                    .filter(Boolean)
                    .map(Number)
            )];
        }

        // Для Linux/MacOS
        const output = execSync(
            `lsof -aPi -p ${pid} -sTCP:LISTEN -nP`
        ).toString();
        
        return [...new Set(
            output.split('\n')
                .slice(1)
                .map(line => line.match(/:(\d+)/)?.[1])
                .filter(Boolean)
                .map(Number)
        )];
    } catch {
        return [];
    }
}

async function connectToChildApp() {
    let mainBrowser: Browser;
    let childBrowser: Browser;

    try {
        // 1. Получаем начальный список процессов
        const initialProcesses = getOpenFinProcesses();
        const initialPids = new Set(initialProcesses.map(p => p.pid));

        // 2. Запускаем главное приложение через Playwright
        mainBrowser = await chromium.launch();
        const mainPage = await mainBrowser.newPage();
        await mainPage.goto('your-app://launcher');

        // 3. Запускаем дочернее приложение
        await mainPage.click('#launch-child-app');
        await mainPage.waitForTimeout(5000);

        // 4. Ищем новые процессы
        const newProcesses = await findNewOpenFinProcesses(initialPids);
        
        // 5. Фильтруем порты разработчика (92xx)
        const debugPorts = newProcesses
            .flatMap(p => p.ports)
            .filter(port => port >= 9200 && port <= 9299);

        // 6. Пробуем подключиться ко всем найденным портам
        for (const port of debugPorts) {
            try {
                childBrowser = await chromium.connectOverCDP(`http://localhost:${port}`);
                const contexts = childBrowser.contexts();
                
                if (contexts.length > 0) {
                    const childPage = contexts[0].pages()[0];
                    console.log('Successfully connected to port:', port);
                    return { mainBrowser, childBrowser };
                }
            } catch (error) {
                console.log(`Failed to connect to port ${port}:`, error.message);
            }
        }

        throw new Error('No valid debug ports found');

    } catch (error) {
        console.error('Error:', error);
        throw error;
    } finally {
        await mainBrowser?.close();
        await childBrowser?.close();
    }
}

// Запуск
connectToChildApp()
    .then(() => console.log('Connection successful'))
    .catch(() => process.exit(1));