import { chromium } from "playwright-core";
import WebSocket from "ws";
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
 * Config
 * ======================= */

const CDP_TIMEOUT_MS = 3_000;

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

    /* ---- Level 3: CDP transport ---- */
    const cdpFail = await this.checkCDP(app, cdp.wsEndpoint);
    if (cdpFail) return cdpFail;

    /* ---- Level 4: Logical ---- */
    const logicalFail = await this.checkLogical(
      app,
      cdp.wsEndpoint,
      name,
      env
    );
    if (logicalFail) return logicalFail;

    return {
      app,
      status: "OK",
      step: "ok"
    };
  }

  /* =======================
   * Helpers
   * ======================= */

  private async checkCDP(
    app: AppKind,
    wsEndpoint: string
  ): Promise<HealthResult | null> {
    return new Promise((resolve) => {
      const ws = new WebSocket(wsEndpoint, {
        handshakeTimeout: CDP_TIMEOUT_MS
      });

      const timer = setTimeout(() => {
        ws.terminate();
        resolve(
          this.fail(app, "UNRESPONSIVE", "cdp", "CDP timeout")
        );
      }, CDP_TIMEOUT_MS);

      ws.on("open", () => {
        clearTimeout(timer);
        ws.terminate();
        resolve(null);
      });

      ws.on("error", (err) => {
        clearTimeout(timer);
        resolve(
          this.fail(app, "UNRESPONSIVE", "cdp", err.message)
        );
      });
    });
  }

  private async checkLogical(
    app: AppKind,
    wsEndpoint: string,
    name: string,
    env: string
  ): Promise<HealthResult | null> {
    try {
      const browser = await chromium.connectOverCDP(wsEndpoint);
      const context = browser.contexts()[0];
      const page = context?.pages()[0];

      if (!page) {
        await browser.close();
        return this.fail(
          app,
          "UNRESPONSIVE",
          "logical",
          "No active page"
        );
      }

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

      return null;
    } catch (err: any) {
      return this.fail(
        app,
        "UNRESPONSIVE",
        "logical",
        err.message
      );
    }
  }

  private fail(
    app: AppKind,
    status: HealthStatus,
    step: string,
    reason: string
  ): HealthResult {
    return { app, status, step, reason };
  }
}
