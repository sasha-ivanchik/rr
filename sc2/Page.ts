import { Page, CDPSession } from 'playwright';

export class CDPHeartbeat {
  private intervalId?: NodeJS.Timeout;
  private stopped = false;

  constructor(private cdp: CDPSession, private intervalMs = 5000) {
    this.start();
  }

  private start() {
    this.intervalId = setInterval(async () => {
      if (this.stopped) return;
      try {
        await this.cdp.send('Runtime.evaluate', { expression: '1 + 1' });
        // console.debug('✅ CDP Heartbeat ping');
      } catch (err) {
        console.warn('❌ CDP Heartbeat failed:', err);
        this.stop();
      }
    }, this.intervalMs);
  }

  public stop() {
    if (this.stopped) return;
    this.stopped = true;
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}


import { chromium } from 'playwright';
import { CDPHeartbeat } from './CDPHeartbeat';

(async () => {
  const browser = await chromium.connectOverCDP({ wsEndpoint: 'ws://localhost:9222/devtools/browser/...' });

  const context = browser.contexts()[0];
  const page = context.pages()[0];

  const cdpSession = await context.newCDPSession(page);
  const heartbeat = new CDPHeartbeat(cdpSession, 3000);

  // ... твоя логика работы с app ...

  // heartbeat сам отключится через stop() или при ошибке
})();
