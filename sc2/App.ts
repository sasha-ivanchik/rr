import { Page } from 'playwright';
import BrowserManager from './BrowserManager';
import UIManager from './UIManager';

class App {
    private browserManager: BrowserManager;
    private uiManager: UIManager | null = null;

    private constructor() {
        this.browserManager = new BrowserManager();
    }

    static async connect(): Promise<App> {
        const app = new App();
        await app.launchGBAMDesktop();
        return app;
    }

    private initUIManager(page: Page): void {
        this.uiManager = new UIManager(page);
    }

    private async launchGBAMDesktop(): Promise<void> {
        const page = await this.browserManager.launchGBAMDesktop();
        if (page) {
            this.initUIManager(page);
        } else {
            throw new Error('Failed to start GBAM Desktop');
        }
    }

    async disconnect(): Promise<void> {
        await this.browserManager.closeGBAMdesktop();
    }

    get browser(): BrowserManager {
        return this.browserManager;
    }

    get ui(): UIManager {
        if (!this.uiManager) {
            throw new Error('UIManager is not initialized. Make sure the browser is running.');
        }
        return this.uiManager;
    }
}

export default App;