import { chromium, Browser } from 'playwright';
import { OpenFinBrowser } from './script/openfinBrowser';

(async () => {
    const browser: Browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    const openFin = new OpenFinBrowser(page);

    await openFin.launchGBAMDesktop();
    await openFin.switchToApp('Global Market Desktop');

    await browser.close();
})();