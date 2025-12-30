import { chromium } from "playwright-core";
import { Registry } from "../registry/Registry";

export type HealthStatus =
  | "OK"
  | "DEAD"
  | "UNRESPONSIVE"
  | "MISSING";

export interface HealthResult {
  status: HealthStatus;
  reason?: string;
}

export class ChildHealthChecker {
  async check(): Promise<HealthResult> {
    const info = Registry.getChild();

    if (!info) {
      return { status: "MISSING", reason: "No child in registry" };
    }

    const { pid, cdp, name, env } = info;

    /* --- process --- */
    try {
      process.kill(pid, 0);
    } catch {
      return {
        status: "DEAD",
        reason: `Child PID ${pid} not alive`
      };
    }

    /* --- CDP + logical --- */
    try {
      const browser = await chromium.connectOverCDP(cdp.wsEndpoint);

      const context = browser.contexts()[0];
      const page = context?.pages()[0];

      if (!page) {
        await browser.close();
        return {
          status: "UNRESPONSIVE",
          reason: "No active page"
        };
      }

      const title = await page.title();
      await browser.close();

      if (!title.includes(name) || !title.includes(env)) {
        return {
          status: "UNRESPONSIVE",
          reason: `Unexpected title: ${title}`
        };
      }

      return { status: "OK" };
    } catch (err: any) {
      return {
        status: "UNRESPONSIVE",
        reason: err?.message ?? "CDP attach failed"
      };
    }
  }
}
