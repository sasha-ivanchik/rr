// BrowserManager.ts
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { ProcessManager } from './ProcessManager';

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private processManager: ProcessManager;

  constructor(processManager: ProcessManager) {
    this.processManager = processManager;
  }

  async launchBrowser(binaryLocation: string | null = null, debugPort: number): Promise<void> {
    this.browser = await chromium.launch({
      executablePath: binaryLocation || undefined,
      args: [`--remote-debugging-port=${debugPort}`]
    });
    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();
  }

  async navigateTo(url: string): Promise<void> {
    if (!this.page) throw new Error('Browser not launched');
    await this.page.goto(url);
  }

  async getTitle(): Promise<string> {
    if (!this.page) throw new Error('Browser not launched');
    return await this.page.title();
  }

  async switchToApp(appName: string): Promise<void> {
    if (!this.browser) throw new Error('Browser not launched');
    const pages = await this.browser.pages();
    for (const page of pages) {
      const title = await page.title();
      if (title === appName) {
        this.page = page;
        console.log(`Switched to app window ${title}`);
        return;
      }
    }
    throw new Error(`App window ${appName} not found`);
  }

  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }

  getPage(): Page {
    if (!this.page) throw new Error('Browser not launched');
    return this.page;
  }

  async launchGBAMDesktop(binaryLocation: string | null = null, showInProduction: boolean = true): Promise<void> {
    const gbamPort = await this.processManager.getFreePort();
    const appURL = `http://gbam-ui.bankofamerica.com:55555/tag/GBAM%20Desktop%20Launcher/PROD?devtools_port=${gbamPort}`;

    await this.processManager.launchOpenFin(appURL);
    await this.processManager.waitForProcess('openfin.exe');

    await this.launchBrowser(binaryLocation, gbamPort);
    await this.navigateTo('http://localhost:' + gbamPort);
    await this.switchToApp('Global Market Desktop');

    const title = await this.getTitle();
    if (title === 'Global Market Desktop') {
      console.log('Launching GBAM Desktop successfully');
      if (!showInProduction) {
        await this.toggleShowInProduction();
      }
    } else {
      throw new Error('Launching GBAM Desktop failed');
    }
  }

  private async toggleShowInProduction(): Promise<void> {
    const showInProductionCheckbox = await this.page?.$$("//input[@type='checkbox' and ../text()='Show In Production Only']");
    if (showInProductionCheckbox && showInProductionCheckbox.length > 0) {
      await showInProductionCheckbox[0].click();
    }
  }
}
