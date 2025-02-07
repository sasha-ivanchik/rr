import { homedir } from 'os';
import { join } from 'path';
import { Server } from 'net';
import { Page, Locator, chromium } from 'playwright';
import { execSync } from 'child_process';
import ProcessManager from './ProcessManager';
import Logger from './Logger';

interface AppPortInfo {
    [pid: string]: number;
}

class BrowserManager {
    private gbamDriver: Page | null = null;
    private appDriver: Page | null = null;
    private gbamPort: number | null = null;
    private logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    private getOpenFinPath(): string {
        return join(homedir(), 'AppData', 'Local', 'OpenFin');
    }

    async connect(url: string): Promise<Page | null> {
        try {
            const browser = await chromium.launch({ headless: false });
            const context = await browser.newContext();
            const page = await context.newPage();
            await page.goto(url, { waitUntil: 'networkidle' });
            this.logger.addComment(`Connected to ${url}`);
            return page;
        } catch (error) {
            this.logger.addComment(`Error connecting to ${url}: ${error}`);
            return null;
        }
    }

    async launchGBAMDesktop(showInProduction: boolean = true): Promise<Page | null> {
        try {
            ProcessManager.taskKill('openfin.exe');
            ProcessManager.taskKill('chromedriver.exe');

            const userPath = this.getOpenFinPath();
            this.gbamPort = await this.getFreePort();
            const appURL = `http://gbam-ui.bankofamerica.com:55555/tag/GBAM%20Desktop%20Launcher/PROD?devtools_port=${this.gbamPort}`;
            const supportMail = 'dg.ficc_qa_automation_horizontal@bofa.com';

            const batchScript = `cmd.exe /K "cd ${userPath} && ${userPath}\\OpenFinRVM.exe --config=${appURL} --support-email=${supportMail}"`;
            const batchFile = join(require('os').tmpdir(), 'run.bat');
            require('fs').writeFileSync(batchFile, batchScript);
            execSync(batchFile, { stdio: 'ignore' });

            await ProcessManager.waitForProcess('openfin.exe');

            const browser = await chromium.launch({ headless: false });
            const page = await browser.newPage();
            await page.goto(`http://localhost:${this.gbamPort}`);

            this.gbamDriver = page;
            await this.switchToApp('Global Market Desktop');

            const title = await page.title();
            if (title === 'Global Market Desktop') {
                this.logger.addComment('Launched GBAM Desktop successfully');
                return page;
            } else {
                this.logger.addComment('Failed to launch GBAM Desktop');
            }
        } catch (error) {
            this.logger.addComment(`Error launching GBAM Desktop: ${error}`);
        }
        return null;
    }

    async switchToApp(appName: string, openfinapp?: Locator): Promise<void> {
        const driver = appName === 'Environment' || appName === 'Global Markets Desktop' ? this.gbamDriver : this.appDriver;

        if (!driver) {
            this.logger.addComment('Driver is not initialized');
            return;
        }

        if (appName.includes('Environment')) {
            for (let i = 0; i < 35; i++) {
                await driver.waitForTimeout(10000);

                if (i === 10 && openfinapp) {
                    await openfinapp.click({ button: 'right' });
                }

                const pages = driver.context().pages();
                for (const page of pages) {
                    try {
                        await page.bringToFront();
                        const title = await page.title();
                        const url = page.url();

                        if (title === '' && !url.toLowerCase().includes('blank') && url.toLowerCase().includes('dependent-window.html')) {
                            this.logger.addComment(`Switched to app window: ${title}`);
                            return;
                        }
                    } catch (error) {
                        this.logger.addComment(`Error switching to window: ${error}`);
                    }
                }
            }
        }

        const pages = driver.context().pages();
        for (const page of pages) {
            try {
                await page.bringToFront();
                const title = await page.title();
                const url = page.url();

                if (title !== '' && !url.toLowerCase().includes('blank') && !url.toLowerCase().includes('html') && !url.toLowerCase().includes('devtools')) {
                    this.logger.addComment(`Switched to app window: ${title}`);
                    return;
                }
            } catch (error) {
                this.logger.addComment(`Error switching to window: ${error}`);
            }
        }

        const currentTitle = await driver.title();
        if (!currentTitle.toLowerCase().includes(appName.toLowerCase()) && !appName.toLowerCase().includes(currentTitle.toLowerCase())) {
            this.logger.addComment(`Could not switch to app window: ${currentTitle}`);
        }
    }

    private async getFreePort(): Promise<number> {
        return new Promise((resolve, reject) => {
            const server = new Server();
            server.listen(0, '127.0.0.1', () => {
                const address = server.address();
                if (address && typeof address === 'object') {
                    const port = address.port;
                    server.close(() => resolve(port));
                } else {
                    reject(new Error('Failed to get free port'));
                }
            });
            server.on('error', reject);
        });
    }

    async closeGBAMDesktop(): Promise<void> {
        try {
            if (this.gbamPort) {
                const netstatOutput = execSync('netstat -ano').toString();
                const lines = netstatOutput.split('\r\n');

                for (const line of lines) {
                    if (line.includes(`127.0.0.1:${this.gbamPort}`)) {
                        const parts = line.trim().split(/\s+/);
                        const portno = parts[parts.length - 1];
                        execSync(`taskkill /fi "pid eq ${portno}"`);
                        this.logger.addComment('GBAM Desktop closed successfully');
                        return;
                    }
                }
            }
            this.logger.addComment('GBAM Desktop close failed: Process not found');
        } catch (error) {
            this.logger.addComment(`Error closing GBAM Desktop: ${error}`);
        }
    }

    async saveScreenshot(filePath: string): Promise<void> {
        try {
            if (this.appDriver) {
                await this.appDriver.screenshot({ path: filePath });
                this.logger.addComment(`Screenshot saved successfully: ${filePath}`);
            } else {
                this.logger.addComment('Failed to save screenshot: App driver is not initialized');
            }
        } catch (error) {
            this.logger.addComment(`Error saving screenshot: ${error}`);
        }
    }

    private findGBAMAppPort(gbamPort?: number): { appDict: AppPortInfo; portValue: number[] } {
        const appDict: AppPortInfo = {};
        const portValue: number[] = [];
    
        try {
            const tasklistOutput = execSync('tasklist /fi "imagename eq openfin.exe"').toString();
            const lines = tasklistOutput.split('\r\n');
    
            for (const line of lines) {
                if (line.includes('openfin.exe')) {
                    const pid = line.split(/\s+/)[1];
                    if (pid) {
                        const netstatOutput = execSync(`netstat -ano | findstr :${pid}`).toString();
                        const connections = netstatOutput.split('\r\n');
                        for (const conn of connections) {
                            const parts = conn.trim().split(/\s+/);
                            if (parts.length >= 4) {
                                const localAddress = parts[1];
                                const port = parseInt(localAddress.split(':')[1], 10);
    
                                if ((port.toString().startsWith('9') || port.toString().startsWith('8')) &&
                                    port !== gbamPort && port !== 9696) {
                                    appDict[pid] = port;
                                    portValue.push(port);
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        } catch (error) {
            this.logger.addComment(`Error finding GBAM app port: ${error}`);
        }
        return { appDict, portValue };
    }

    
    async findApplicationPort(): Promise<string[]> {
        const pidList: string[] = [];
    
        try {
            const netstatOutput = execSync('netstat -ano').toString();
            const lines = netstatOutput.split('\r\n');
    
            for (const line of lines) {
                if (line.includes('LISTENING') && line.includes('127.0.0.1')) {
                    const parts = line.trim().split(/\s+/);
                    const address = parts[1];
                    const port = address.split(':')[1];
    
                    if (port && (port.startsWith('9') || port.startsWith('8')) && port !== '9696') {
                        pidList.push(port);
                    }
                }
            }
    
            this.logger.addComment(`Found application ports: ${pidList.join(', ')}`);
        } catch (error) {
            this.logger.addComment(`Error finding application ports: ${error}`);
        }
    
        return pidList;
    }

}

export default BrowserManager;