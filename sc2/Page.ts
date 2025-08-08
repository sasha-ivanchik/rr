import { chromium, CDPSession, Page, BrowserContext } from 'playwright';

function autoKeepAlive(page: Page, context: BrowserContext, intervalMs = 3000) {
  context.newCDPSession(page).then((session: CDPSession) => {
    let active = true;

    const loop = async () => {
      while (active) {
        try {
          await session.send('Runtime.evaluate', { expression: 'void 0' });
        } catch (e) {
          console.warn('[keep-alive] CDP ping failed. Stopping.');
          break;
        }
        await new Promise(res => setTimeout(res, intervalMs));
      }
    };

    page.on('close', () => (active = false));
    context.browser()?.on('disconnected', () => (active = false));

    loop().catch((e) => console.error('[keep-alive] Unexpected error:', e));
  });
}

(async () => {
  const browser = await chromium.connectOverCDP(cdpUrl);
  const context = browser.contexts()[0];
  const page = await context.newPage();

  autoKeepAlive(page, context); // 🔁 keep-alive здесь

  // дальше твоя логика
})();
