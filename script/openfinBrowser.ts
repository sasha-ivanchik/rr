import { Browser, Page, chromium, Locator } from 'playwright';
import { execSync } from 'child_process';
import { setTimeout } from 'timers/promises';

class OpenFinBrowser {
    private gbamDriver: Page | null = null;
    private appDriver: Page | null = null;
    private gbamPort: number | null = null;
    private comments: string = '';
    private supportMail: string | null = null;
    private globalSyncTime: number = 30;

    constructor() {}

    // Set global synchronization time
    setGlobalSyncTime(syncTime: number = 30): void {
        this.globalSyncTime = syncTime;
    }

    // Kill a process by name
    taskKill(processName: string): void {
        try {
            execSync(`taskkill /F /IM "${processName}"`);
        } catch (error) {
            this.comments += `<br>Error killing process ${processName}: ${error}`;
        }
    }

    // Start ChromeDriver process
    startChromeDriverProcess(port: number, driverPath?: string): boolean {
        try {
            execSync(`${driverPath || 'chromedriver'} --port=${port}`, { stdio: 'ignore' });
            return true;
        } catch (error) {
            this.comments += `<br>Error starting ChromeDriver: ${error}`;
            return false;
        }
    }

    // Launch GBAM Desktop
    async launchGBAMDesktop(
        binaryLocation?: string,
        driverPath?: string,
        showInProduction: boolean = true,
        supportMail?: string
    ): Promise<Page | null> {
        try {
            this.taskKill('openfin.exe');
            this.taskKill('chromedriver.exe');

            const tempPath = require('os').tmpdir();
            const userPath = 'C:/Users/{User}/AppData/Local/OpenFin'; // Replace {User} with the actual user

            if (!driverPath) {
                driverPath = 'D:/Temp/chromedriver/chromedriver.exe';
            }

            this.gbamPort = this.freePort();
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

            await this.waitForProcess('openfin.exe');

            const port = this.freePort();
            this.startChromeDriverProcess(port, driverPath);

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
                this.comments += '<br>Launched GBAM Desktop successfully';
                return page;
            } else {
                this.comments += '<br>Failed to launch GBAM Desktop';
            }
        } catch (error) {
            this.comments += `<br>Error launching GBAM Desktop: ${error}`;
        }
        return null;
    }

    // Switch to an application window
    async switchToApp(appName: string): Promise<void> {
        if (!this.gbamDriver) return;

        const handles = await this.gbamDriver.context().pages();
        for (const handle of handles) {
            const title = await handle.title();
            if (title.includes(appName)) {
                this.appDriver = handle;
                this.comments += `<br>Switched to app window: ${title}`;
                return;
            }
        }
        this.comments += `<br>Could not switch to app window: ${appName}`;
    }

    // Refresh the current page
    async refresh(): Promise<void> {
        if (this.appDriver) {
            await this.appDriver.reload();
        }
    }

    // Get the title of the current window
    async getCurrentWindow(): Promise<string> {
        if (this.appDriver) {
            return await this.appDriver.title();
        }
        return '';
    }

    // Find an element by locator
    async findElement(locatorName: string, locatorValue: string): Promise<Locator | null> {
        if (!this.appDriver) return null;

        const locator = this.appDriver.locator(`${locatorName}=${locatorValue}`);
        if (await locator.isVisible()) {
            this.comments += `<br>Found ${locatorName} ${locatorValue}`;
            return locator;
        } else {
            this.comments += `<br>Not found ${locatorName} ${locatorValue}`;
            return null;
        }
    }

    // Wait for a process to start
    private async waitForProcess(processName: string, waitTime: number = 15_000, maxAttempts: number = 5): Promise<void> {
        for (let i = 0; i < maxAttempts; i++) {
            await setTimeout(waitTime);
            const isRunning = this.isProcessRunning(processName);
            if (isRunning) break;
        }
    }

    // Check if a process is running
    private isProcessRunning(processName: string): boolean {
        try {
            const output = execSync(`tasklist /FI "IMAGENAME eq ${processName}"`).toString();
            return output.includes(processName);
        } catch (error) {
            return false;
        }
    }

    // Get a free port
    private freePort(): number {
        const freeSocket = require('net').createServer();
        freeSocket.listen(0);
        const port = freeSocket.address().port;
        freeSocket.close();
        return port;
    }
}

export default OpenFinBrowser;