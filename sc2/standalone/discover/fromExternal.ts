export interface ExternalAppInfo {
  pid: number;
  port: number;
  wsEndpoint: string;
  source: "external";
}


export async function findExternalOpenFin(
  parentPid: number,
  appName: string,
  env: string,
  timeoutMs = 30_000
): Promise<ExternalAppInfo> {

  const start = Date.now();
  const pollIntervalMs = 1000;

  while (Date.now() - start < timeoutMs) {

    try {
      const pids = excludeParent(
        getOpenFinPids(),
        parentPid
      );

      for (const pid of pids) {
        let ports: number[] = [];

        try {
          ports = findPortsByPid(pid);
        } catch {
          // процесс есть, но порты ещё не готовы
          continue;
        }

        for (const port of ports) {
          let ws: string | null = null;

          try {
            ws = await isCDPPort(port);
          } catch {
            // порт есть, но CDP ещё не поднялся
            continue;
          }

          if (!ws) continue;

          let ok = false;

          try {
            ok = await matchesApp(ws, appName, env);
          } catch {
            // CDP нестабилен / вкладки ещё не готовы
            continue;
          }

          if (!ok) continue;

          // ✅ НАЙДЕНО
          return {
            pid,
            port,
            wsEndpoint: ws,
            source: "external",
          };
        }
      }
    } catch {
      // глобальная ошибка цикла — не валим процесс
    }

    await new Promise(r => setTimeout(r, pollIntervalMs));
  }

  throw new Error(
    `External OpenFin app not found (name=${appName}, env=${env}, timeout=${timeoutMs}ms)`
  );
}

