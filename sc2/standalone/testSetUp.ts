import { test as base } from "@playwright/test";
import { sessionManager } from "../core/session";

export const test = base.extend({});

test.beforeEach(async ({}, testInfo) => {
  try {
    // Гарантируем живую сессию
    await sessionManager.get();
  } catch (e) {
    console.warn(
      "Session recovery before test:",
      testInfo.title
    );

    // Жёсткий reset, если нужно
    await sessionManager.dispose();
    await sessionManager.get();
  }
});


test.afterEach(async ({}, testInfo) => {
  if (testInfo.status !== "passed") {
    console.warn("Test failed → cleaning up windows");
  }

  await sessionManager.cleanupWindows();
});


export { expect } from "@playwright/test";
