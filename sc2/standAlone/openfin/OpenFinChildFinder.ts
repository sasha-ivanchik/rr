import { Page } from "playwright";
import { sleep } from "../utils/sleep";
import { OpenFinRuntimeDetector } from "./OpenFinRuntimeDetector";
import { OpenFinAttach } from "./OpenFinAttach";
import { ChildAttachResult } from "./OpenFinTypes";
import { readOpenFinEnv } from "./OpenFinEnv";
import { OpenFinPageMatcher } from "./OpenFinPageMatcher";

export class OpenFinChildFinder {
  static async attachChildByEnv(params: {
    parentPage: Page;
    parentPid: number;
    timeoutMs?: number;
  }): Promise<ChildAttachResult> {
    const { parentPage, parentPid } = params;
    const timeoutMs = params.timeoutMs ?? 120_000;

    const env = readOpenFinEnv();
    const start = Date.now();
    const parentContext = parentPage.context();

    console.log("[child]", "attach start", env);

    while (Date.now() - start < timeoutMs) {
      // 1️⃣ SAME RUNTIME
      for (const page of parentContext.pages()) {
        if (page === parentPage) continue;

        if (await OpenFinPageMatcher.matchesByEnv(page, env)) {
          await page.waitForLoadState("domcontentloaded");
          await page.bringToFront();

          console.log("[child]", "found in same runtime:", page.url());

          return {
            page,
            runtime: {
              pid: parentPid,
              port: -1,
              wsEndpoint: "same-runtime",
            },
          };
        }
      }

      // 2️⃣ SEPARATE RUNTIME
      const runtime =
        await OpenFinRuntimeDetector.detectNewRuntime(parentPid);

      if (runtime) {
        console.log("[child]", "candidate runtime:", runtime);

        const page =
          await OpenFinAttach.attachToRuntime(runtime.wsEndpoint);

        if (await OpenFinPageMatcher.matchesByEnv(page, env)) {
          await page.waitForLoadState("domcontentloaded");
          await page.bringToFront();

          console.log("[child]", "found in separate runtime:", page.url());

          return { page, runtime };
        }

        console.log("[child]", "runtime page did not match env, continue");
      }

      await sleep(1_000);
    }

    throw new Error(
      `[child] attach timeout: APP=${env.app}, ENV=${env.env}`
    );
  }
}
