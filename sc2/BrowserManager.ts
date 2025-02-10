import { homedir } from 'os';
import os from 'os';
import fs from 'fs';
import { join } from 'path';
import { Server } from 'net';
// import { Browser, Page, chromium } from 'playwright';
import { Page, Locator, chromium } from 'playwright';
import { execSync } from 'child_process';
import ProcessManager from './ProcessManager';
import Logger from './Logger';


interface AppPortInfo {
    [pid: string]: number; // PID -> порт
}

class BrowserManager {
    private gbamDriver: Page | null = null;
    private appDriver: Page | null = null;
    private gbamPort: number | null = null;
    private logger: Logger;
    private page: Page | null = null;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    private getOpenFinPath(): string {
        const userHomeDir = homedir();
        return join(userHomeDir, 'AppData', 'Local', 'OpenFin');
    };

    async connect(url: string): Promise<Page | null> {
        try {
            const browser = await chromium.launch({headless: false});
            const context = await browser.newContext();
            this.page = await context.newPage()
            await this.page.goto(url, {waitUntil: 'networkidle'});
            this.logger.addComment(`Conected to ${url}`);
            return this.page
        } catch(error) {
            this.logger.addComment(`Error conecting to ${url} : ${error}`);
            return null;
        }
    };

    async launchGBAMDesktop(
        binaryLocation?: string,
        driverPath?: string,
        showInProduction: boolean = true,
        supportMail?: string
    ): Promise<Page | null> {
        try {
            ProcessManager.taskKill('openfin.exe');
            ProcessManager.taskKill('chromedriver.exe');

            const tempPath = require('os').tmpdir();
            const userPath = this.getOpenFinPath();

            if (!driverPath) {
                driverPath = 'D:/Temp/chromedriver/chromedriver.exe';
            }

            this.gbamPort =  await this.freePort();
            const appURL = `http://gbam-ui.bankofamerica.com:55555/tag/GBAM%20Desktop%20Launcher/PROD?devtools_port=${this.gbamPort}`;

            if (!supportMail) {
                supportMail = 'dg.ficc_qa_automation_horizontal@bofa.com';
            }

            const batchScript = `
                cmd.exe /K "cd ${userPath} && ${userPath}/OpenFinRVM.exe --config=${appURL} --support-email=${supportMail}"
            `;

            const batchFile = `${tempPath}/run.bat`;
            require('fs').writeFileSync(batchFile, batchScript);
            execSync(batchFile, { stdio: 'ignore' });

            await ProcessManager.waitForProcess('openfin.exe');

            const port = await this.freePort();
            execSync(`${driverPath} --port=${port}`, { stdio: 'ignore' });

            const browser = await chromium.launch({
                headless: false,
                executablePath: binaryLocation || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
            });
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
            this.logger.addComment(`Error launching GBAM Desktop:${error}`,);
        }
        return null;
    };

    async switchToApp(appName: string, openfinapp?: Locator): Promise<void> {
        const driver = (appName === "Environment" || appName === "Global Markets Desktop") 
            ? this.gbamDriver
            : this.appDriver;

        if (!driver) {
            console.error('Driver is not initialized');
            return;
        }

        if (appName.includes("Environment")) {
            for (let i = 0; i < 35; i++) {
                console.log(`Count of dependent windows: ${i}`);
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

                if (title !== '' &&
                    !url.toLowerCase().includes('blank') &&
                    !url.toLowerCase().includes('html') &&
                    !url.toLowerCase().includes('devtools')) {
                    this.logger.addComment(`Switched to app window: ${title}`);
                    return;
                }
            } catch (error) {
                this.logger.addComment(`Error switching to window: ${error}`);
            }
        }

        const currentTitle = await driver.title();
        if (!currentTitle.toLowerCase().includes(appName.toLowerCase()) &&
            !appName.toLowerCase().includes(currentTitle.toLowerCase())) {
            this.logger.addComment(`Could not switch to app window: ${currentTitle}`);
        }
    };

    async freePort(): Promise<number> {
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

            server.on('error', (err) => {
                reject(err);
            });
        });
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
    };

    async closeGBAMdesktop(): Promise<void> {
        try {
            const netstatOutput = execSync('netstat -ano').toString();
            const lines = netstatOutput.split('\r\n');

            let portno: string | null = null;

            for (const line of lines) {
                if (line.includes(`127.0.0.1:${this.gbamPort}`)) {
                    const parts = line.trim().split(/\s+/);
                    portno = parts[parts.length - 1];
                    break;
                }
            }

            if (portno) {
                const result = execSync(`taskkill /fi "pid eq ${portno}"`).toString();
                this.logger.addComment('GBAM Desktop closed successfully');
            } else {
                this.logger.addComment('GBAM Desktop closed failed: Process not found');
            }
        } catch (error) {
            this.logger.addComment(`Error closing GBAM Desktop: ${error}`);
        }
    };

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
    };

    async openApp(
        appName: string,
        env: string,
        binaryLocation?: string,
        driverPath?: string,
        // appDriverPath?: string,
        appPort?: number,
        showInProduction: boolean = true,
        supportMail?: string,
    ): Promise<Page | null> {
        try {

            if (!this.gbamDriver) {
                await this.launchGBAMDesktop(binaryLocation, driverPath, showInProduction, supportMail);
                await ProcessManager.waitForProcess('openfin.exe');
            }

            if (this.gbamDriver) {
                this.logger.addComment(`Opening application: ${appName}`);
                await this.switchToApp('Global Markets Desktop');

                const searchBar = this.gbamDriver.locator('//input[contains(@class, "SearchBar")]');
                await searchBar.click();
                await searchBar.fill(appName);

                const appElement = this.gbamDriver.locator(`//div[contains(text(), "${appName}")]/..`);
                await appElement.hover();
                await this.gbamDriver.waitForTimeout(5000);

                await appElement.click({ button: 'right' });
                await this.gbamDriver.waitForTimeout(10000);

                const pages = this.gbamDriver.context().pages();
                const lastPage = pages[pages.length - 1];
                await lastPage.bringToFront();
                this.logger.addComment(`Switched to window: ${await lastPage.title()}, URL: ${lastPage.url()}`);

                const uatIcon = this.gbamDriver.locator(`//*[text()="${env}"]`);
                await uatIcon.hover();
                await uatIcon.click();

                await ProcessManager.waitForProcess('openfin.exe');
                await this.gbamDriver.waitForTimeout(10000);

                const browser = await chromium.launch({
                    headless: false,
                    executablePath: binaryLocation || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
                });
                const context = await browser.newContext();
                const appPage = await context.newPage();

                await appPage.goto(`http://localhost:${appPort}`);

                for (const page of context.pages()) {
                    await page.bringToFront();
                    const title = await page.title();

                    if (title === '' || title.includes(appName) || appName.includes(title)) {
                        this.logger.addComment(`Application "${appName}" opened successfully`);
                        return page;
                    }
                }

                this.logger.addComment(`Application "${appName}" failed to open: Window not found`);
                return null;
            }
        } catch (error) {
            this.logger.addComment(`Error while opening app from GBAM: ${error}`);
            throw new Error(`Error while opening app from GBAM: ${error}`);
        }
        return null;
    };

    async refresh(): Promise<void> {
        try {
            if (this.appDriver) {
                await this.appDriver.reload();
                this.logger.addComment('Page refreshed successfully');
            } else {
                this.logger.addComment('Failed to refresh: App driver is not initialized');
            }
        } catch (error) {
            this.logger.addComment(`Error refreshing page: ${error}`);
        }
    };

    async getCurrentWindow(): Promise<string> {
        try {
            if (this.appDriver) {
                const title = await this.appDriver.title();
                this.logger.addComment(`Current window title: ${title}`);
                return title;
            } else {
                this.logger.addComment('Failed to get current window: App driver is not initialized');
                return '';
            }
        } catch (error) {
            this.logger.addComment(`Error getting current window title: ${error}`);
            return '';
        }
    };

    async getUserName(): Promise<string> {
        return require('os').userInfo().username;
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
    };

    public async launchGBAMDesktop2(options: {
        showInProduction?: boolean;
        supportMail?: string;
    } = {}): Promise<Page> {
        const {
            showInProduction = true,
            supportMail = 'dg.ficc_qa_automation_horizontal@bofa.com'
        } = options;

        try {
            // Kill existing processes
            ProcessManager.taskKill('openfin.exe');
            ProcessManager.taskKill('chromedriver.exe');

            // Determine installation path
            const username = os.userInfo().username;
            const cdrivePath = join('C:\\Users', username, 'AppData', 'Local', 'OpenFin');
            const ddrivePath = 'D:\\Apps\\OpenFin';
            const userPath = fs.existsSync(ddrivePath) ? ddrivePath : cdrivePath;

            // Get free port for DevTools
            this.gbamPort = await this.freePort();

            // Prepare application URL
            const appURL = `http://gbam-ui.bankofamerica.com:55555/tag/GBAM%20Desktop%20Launcher/PROD?devtools_port=${this.gbamPort}`;

            // Create batch script
            const batchScript = `cmd.exe /K "cd /D "${userPath}" && start OpenFinRVM.exe --config="${appURL}" --support-email="${supportMail}"`;
            
            const batchFile = join(os.tmpdir(), 'run.bat');
            fs.writeFileSync(batchFile, batchScript);

            // Execute batch file
            execSync(batchFile, { stdio: 'ignore' });

            // Wait for OpenFin process
            await ProcessManager.waitForProcess('openfin.exe');

            // Connect to browser using CDP
            const browser = await chromium.connectOverCDP(`http://localhost:${this.gbamPort}`);
            const context = browser.contexts()[0];
            
            // Find correct page
            this.page = context.pages().find(p => p.url().includes('gbam-ui')) || context.pages()[0];
            await this.page.waitForLoadState('domcontentloaded');

            // Verify application title
            const title = await this.page.title();
            if (title === "Global Market Desktop") {
                this.logger.addComment('GBAM Desktop launched successfully');

                // Toggle production checkbox
                if (!showInProduction) {
                    const checkbox = await this.page.$(
                        '//*[text()="Show In Production Only"]/..//input[@type="checkbox"]'
                    );
                    if (checkbox) {
                        await checkbox.click();
                    }
                }

                return this.page;
            }

            throw new Error('Failed to verify application title');
        } catch (e) {
            this.logger.addComment(`Launch failed: ${e}`);
            await this.closeGBAMdesktop();
            throw e;
        }
    }

}

export default BrowserManager;