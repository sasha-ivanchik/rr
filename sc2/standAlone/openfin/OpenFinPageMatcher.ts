import { Page } from "playwright";
import { OpenFinEnv } from "./OpenFinEnv";

export class OpenFinPageMatcher {
  static async matchesByEnv(
    page: Page,
    env: OpenFinEnv
  ): Promise<boolean> {
    const url = page.url();

    if (
      !url.startsWith("http://") &&
      !url.startsWith("https://")
    ) {
      return false;
    }

    let title = "";
    try {
      title = await page.title();
    } catch {
      return false;
    }

    const urlLc = url.toLowerCase();
    const titleLc = title.toLowerCase();

    const appFound =
      urlLc.includes(env.app) || titleLc.includes(env.app);

    const envFound =
      urlLc.includes(env.env) || titleLc.includes(env.env);

    return appFound && envFound;
  }
}
