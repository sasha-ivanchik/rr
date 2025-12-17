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
  timeoutMs = 40_000
): Promise<ExternalAppInfo> {

  const startedAt = Date.now();
  const pollIntervalMs = 2000;

  while (Date.now() - startedAt < timeoutMs) {

    let pids: number[] = [];

    // 1️⃣ Получаем ВСЕ openfin процессы
    try {
      pids = getOpenFinPids();
    } catch {
      pids = [];
    }

    // 2️⃣ Убираем parent PID
    pids = pids.filter(pid => pid !== parentPid);

    for (const pid of pids) {

      let ports: number[] = [];

      // 3️⃣ Ищем LISTENING порты процесса
      try {
        ports = findPortsByPid(pid);
      } catch {
        continue;
      }

      if (ports.length === 0) continue;

      for (const port of ports) {

        let wsEndpoint: string | null = null;

        // 4️⃣ Проверяем CDP endpoint
        try {
          wsEndpoint = await isCDPPort(port);
        } catch {
          continue;
        }

        if (!wsEndpoint) continue;

        // 5️⃣ НАШЛИ runtime с CDP
        return {
          pid,
          port,
          wsEndpoint,
          source: "external",
        };
      }
    }

    // 6️⃣ Пауза между попытками
    await new Promise(res => setTimeout(res, pollIntervalMs));
  }

  throw new Error(
    `External OpenFin runtime not found within ${timeoutMs}ms`
  );
}


