export async function findExternalOpenFin(
  appName: string,
  env: string,
  timeoutMs = 30_000
): Promise<ExternalAppInfo> {

  const openFinPids = getOpenFinPids();
  const endpoints = await findOpenFinCDP(openFinPids, timeoutMs);

  for (const ep of endpoints) {
    const browser = await chromium.connectOverCDP(ep.ws);
    const context = browser.contexts()[0] ?? await browser.newContext();

    const page =
      context.pages()[0] ??
      await context.waitForEvent("page", { timeout: 5_000 });

    const title = await page.title();
    const url = page.url();

    if (
      title.includes(appName) &&
      url.includes(env) &&
      /^https?:\/\//.test(url)
    ) {
      return {
        pid: ep.pid,
        port: ep.port,
        wsEndpoint: ep.ws,
        source: "external",
      };
    }

    await browser.close();
  }

  throw new Error(`External OpenFin app not found`);
}
