import { Page } from "@playwright/test";

export async function isSessionAlive(
  page: Page
): Promise<boolean> {
  try {
    await page.title({ timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}
