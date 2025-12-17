import { Page } from "playwright";
import { sleep } from "../utils/sleep";
import { OpenFinRuntimeDetector } from "./OpenFinRuntimeDetector";
import { OpenFinAttach } from "./OpenFinAttach";
import { ChildAttachResult } from "./OpenFinTypes";

export class OpenFinChildFinder {
  static async attachChildUniversal(params: {
    parentPage: Page;
    parentPid: number;
    timeoutMs?: number;
  }): Promise<ChildAttachResult> {
    const {
      parentPage,
      parentPid,
      timeoutMs = 120_000,
    } = params;

    const start = Date.now();
    const context = parentPage.context();

    while (Date.now() - start < timeoutMs) {
      // 1️⃣ same runtime
      for (const page of context.pages()) {
        if (
          page !== parentPage &&
          page.url().startsWith("http")
        ) {
          await page.waitForLoadState("domcontentloaded");
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

      // 2️⃣ separate runtime
      const runtime =
        await OpenFinRuntimeDetector.detectNewRuntime(parentPid);

      if (runtime) {
        const page =
          await OpenFinAttach.attachToRuntime(runtime.wsEndpoint);

        return { page, runtime };
      }

      await sleep(1000);
    }

    throw new Error("Child app not found");
  }
}
