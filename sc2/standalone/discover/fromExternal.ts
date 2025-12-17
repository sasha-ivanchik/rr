export interface ExternalAppInfo {
  pid: number;
  port: number;
  wsEndpoint: string;
  source: "external";
}



export async function resolveChild(
  name: string,
  env: string,
  parentPid: number,
  timeoutMs = 30_000
): Promise<{
  pid: number;
  port: number;
  wsEndpoint: string;
}> {

  const startedAt = Date.now();
  const pollIntervalMs = 1000;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const pids = getOpenFinPids().filter(pid => pid !== parentPid);

      for (const pid of pids) {
        let ports: number[];

        try {
          ports = findPortsByPid(pid);
        } catch {
          continue; // pid ещё не готов
        }

        for (const port of ports) {
          let wsEndpoint: string | null;

          try {
            wsEndpoint = await getWsEndpointFromPort(port);
          } catch {
            continue; // порт не CDP
          }

          if (!wsEndpoint) continue;

          let isMatch = false;

          try {
            isMatch = await matchesApp(wsEndpoint, name, env);
          } catch {
            continue; // CDP нестабилен — это НОРМА
          }

          if (!isMatch) continue;

          // ✅ НАЙДЕНО
          return {
            pid,
            port,
            wsEndpoint,
          };
        }
      }
    } catch {
      // глобальная ошибка сканирования — подавляем
    }

    await sleep(pollIntervalMs);
  }

  throw new Error(
    `resolveChild timeout: name=${name}, env=${env}, timeout=${timeoutMs}ms`
  );
}

