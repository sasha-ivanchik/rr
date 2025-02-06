import Logger from './Logger';
import BrowserManager from './BrowserManager';
import UIManager from './UIManager';
import GridControls from './GridControls';
import { Page as PlaywrightPage } from 'playwright';


class BasePage {
    private logger: Logger;
    private browserManager: BrowserManager;
    private uiManager: UIManager;
    private gridControls: GridControls;
    private page: PlaywrightPage | null = null;

    constructor() {
        this.logger = new Logger();
        this.browserManager = new BrowserManager(this.logger);
        this.uiManager = new UIManager(this.logger);
        this.gridControls = new GridControls(this.logger);
    };

    async connect(url: string): Promise<void> {
        this.page = await this.browserManager.connect(url);
        if (this.page) {
            this.uiManager.setPage(this.page);
            await this.page.waitForLoadState('load');

            this.gridControls.setPage(this.page);
        }
    };

    async getComment(): Promise<string> {
        return await this.logger.getComments()
    };

    // browserManager API
    get browser() {
        return this.browserManager;
    };

    // uiManager API
    get ui() {
        return this.uiManager;
    };

    // gridControls API
    get grid() {
        return this.gridControls;
    };

}

export default BasePage;