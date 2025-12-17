import { execSync } from "child_process";

export function getOpenFinPids(): number[] {
  const output = execSync(
    `wmic process where "name='openfin.exe'" get ProcessId`,
    { encoding: "utf-8" }
  );

  return output
    .split("\n")
    .map(l => l.trim())
    .filter(l => /^\d+$/.test(l))
    .map(Number);
}



export function excludeParent(
  pids: number[],
  parentPid: number
): number[] {
  return pids.filter(pid => pid !== parentPid);
}


export function findPortsByPid(pid: number): number[] {
  const output = execSync(
    `netstat -ano | findstr ${pid}`,
    { encoding: "utf-8" }
  );

  const ports = new Set<number>();

  for (const line of output.split("\n")) {
    const match = line.match(/:(\d+)\s+.*\s+${pid}$/);
    if (match) {
      ports.add(Number(match[1]));
    }
  }

  return [...ports];
}


import http from "http";

export async function isCDPPort(port: number): Promise<string | null> {
  return new Promise(resolve => {
    const req = http.get(
      `http://127.0.0.1:${port}/json/version`,
      res => {
        let data = "";
        res.on("data", d => (data += d));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (json.webSocketDebuggerUrl) {
              resolve(json.webSocketDebuggerUrl);
            } else {
              resolve(null);
            }
          } catch {
            resolve(null);
          }
        });
      }
    );

    req.on("error", () => resolve(null));
    req.setTimeout(500, () => {
      req.destroy();
      resolve(null);
    });
  });
}


import { chromium } from "playwright-core";

export async function matchesApp(
  wsEndpoint: string,
  appName: string,
  env: string
): Promise<boolean> {
  const browser = await chromium.connectOverCDP(wsEndpoint);

  try {
    for (const context of browser.contexts()) {
      for (const page of context.pages()) {
        try {
          const url = page.url();
          if (!/^https?:\/\//.test(url)) continue;

          const title = await page.title();

          if (
            title.includes(appName) &&
            url.includes(env)
          ) {
            return true;
          }
        } catch {
          // страница могла закрыться — это нормально
        }
      }
    }

    return false;
  } finally {
    await browser.close();
  }
}
