import { exec } from "child_process";

export function readRegistryValue(
  key: string,
  valueName: string
): Promise<string | null> {
  return new Promise((resolve) => {
    const cmd = `reg query "${key}" /v ${valueName}`;

    exec(cmd, { windowsHide: true }, (err, stdout) => {
      if (err || !stdout) {
        resolve(null);
        return;
      }

      const lines = stdout.split("\n");
      for (const line of lines) {
        if (line.includes(valueName)) {
          // пример строки:
          // wsEndpoint    REG_SZ    ws://127.0.0.1:9696/devtools/browser/...
          const parts = line.trim().split(/\s+/);
          const value = parts.slice(2).join(" ");
          resolve(value);
          return;
        }
      }

      resolve(null);
    });
  });
}



import { readRegistryValue } from "./readRegistryValue";

const WS_KEY = "HKCU\\Software\\OpenFin\\Runtime\\DevTools";
const WS_VALUE = "wsEndpoint";

export async function readWsEndpoint(): Promise<string | null> {
  const ws = await readRegistryValue(WS_KEY, WS_VALUE);
  return ws?.startsWith("ws://") ? ws : null;
}




export function createChildWsEndpointReader(
  parentWsEndpoint: string
) {
  let lastSeen: string | null = null;

  return async function readChildWsEndpoint(): Promise<string | null> {
    const ws = await readWsEndpoint();

    if (!ws) return null;

    // первый раз — запоминаем parent
    if (!lastSeen) {
      lastSeen = ws;
      return null;
    }

    // если endpoint изменился — это НОВЫЙ runtime (child)
    if (ws !== lastSeen && ws !== parentWsEndpoint) {
      return ws;
    }

    return null;
  };
}



import { Page, chromium } from "playwright";
import { createChildWsEndpointReader } from "./readChildWsEndpointFromRegistry";

export async function attachToChildApp(
  parentPage: Page,
  parentWsEndpoint: string
): Promise<Page> {
  const readChildWs = createChildWsEndpointReader(parentWsEndpoint);

  const start = Date.now();
  const timeout = 120_000;
  const poll = 1_000;

  const parentContext = parentPage.context();

  while (Date.now() - start < timeout) {
    // 1️⃣ тот же context
    for (const page of parentContext.pages()) {
      const url = page.url();
      if (
        page !== parentPage &&
        (url.startsWith("http://") || url.startsWith("https://"))
      ) {
        await page.waitForLoadState("domcontentloaded");
        return page;
      }
    }

    // 2️⃣ новый runtime
    const childWs = await readChildWs();
    if (childWs) {
      const browser = await chromium.connectOverCDP(childWs);
      const context = browser.contexts()[0];

      const page = await waitForHttpPage(context);
      await page.waitForLoadState("domcontentloaded");
      return page;
    }

    await sleep(poll);
  }

  throw new Error("Child app not found (timeout)");
}
