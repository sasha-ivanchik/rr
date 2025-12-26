import { chromium } from "playwright-core";
import { Registry } from "../registry/Registry";

/* =======================
 * Types
 * ======================= */

export type AppKind = "parent" | "child";

export type HealthStatus =
  | "OK"
  | "DEAD"
  | "UNRESPONSIVE"
  | "MISSING";

export interface HealthResult {
  app: AppKind;
  status: HealthStatus;
  step: string;
  reason?: string;
}

/* =======================
 * HealthChecker
 * ======================= */

export class HealthChecker {
  async checkApp(app: AppKind): Promise<HealthResult> {
    /* ---- Level 1: Registry ---- */
    const info = Registry.get(app);

    if (!info) {
      return this.fail(app, "MISSING", "registry", "No registry entry");
    }

    const { pid, cdp, name, env } = info;

    if (!pid || !cdp?.wsEndpoint) {
      return this.fail(
        app,
        "DEAD",
        "registry",
        "Incomplete registry data"
      );
    }

    /* ---- Level 2: Process ---- */
    try {
      process.kill(pid, 0);
    } catch {
      return this.fail(
        app,
        "DEAD",
        "process",
        `PID ${pid} not alive`
      );
    }

    /* ---- Level 3: CDP + Logical (atomic, most reliable) ---- */
    try {
      const browser = await chromium.connectOverCDP(cdp.wsEndpoint);

      const contexts = browser.contexts();
      if (!contexts.length) {
        await browser.close();
        return this.fail(
          app,
          "UNRESPONSIVE",
          "cdp",
          "No browser contexts"
        );
      }

      const pages = contexts[0].pages();
      if (!pages.length) {
        await browser.close();
        return this.fail(
          app,
          "UNRESPONSIVE",
          "cdp",
          "No active pages"
        );
      }

      const page = pages[0];

      const url = page.url();
      const title = await page.title();

      await browser.close();

      if (!/^https?:\/\//.test(url)) {
        return this.fail(
          app,
          "UNRESPONSIVE",
          "logical",
          `Invalid URL: ${url}`
        );
      }

      if (!title.includes(name) || !title.includes(env)) {
        return this.fail(
          app,
          "UNRESPONSIVE",
          "logical",
          `Unexpected title: ${title}`
        );
      }

      return {
        app,
        status: "OK",
        step: "ok"
      };

    } catch (err: any) {
      return this.fail(
        app,
        "UNRESPONSIVE",
        "cdp",
        err?.message ?? "CDP connection failed"
      );
    }
  }

  /* =======================
   * Helper
   * ======================= */

  private fail(
    app: AppKind,
    status: HealthStatus,
    step: string,
    reason: string
  ): HealthResult {
    return { app, status, step, reason };
  }
}
