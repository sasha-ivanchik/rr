import { chromium } from "@playwright/test";
import { RuntimeInfo } from "../../core/registry/types";

type Options = {
  parent: RuntimeInfo;
  appName: string;
  env: string;
};

export async function tryFindChildInParent(
  opts: Options
): Promise<RuntimeInfo | null> {
  const { parent, appName, env } = opts;

  const browser = await chromium.connectOverCDP(
    parent.cdp.wsEndpoint
  );

  for (const ctx of browser.contexts()) {
    for (const page of ctx.pages()) {
      const url = page.url();
      if (!/^https?:\/\//i.test(url)) continue;

      let title = "";
      try {
        title = await page.title();
      } catch {}

      const hay = (url + " " + title).toLowerCase();
      if (
        hay.includes(appName.toLowerCase()) &&
        hay.includes(env.toLowerCase())
      ) {
        const wsEndpoint = 

        if (!wsEndpoint) continue;

        return {
          name: appName,
          env,
          pid: parent.pid, // embedded child
          cdp: {
            port: parent.cdp.port,
            wsEndpoint
          }
        };
      }
    }
  }

  await browser.close();
  return null;
}
