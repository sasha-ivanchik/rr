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

  while (Date.now() - start < timeoutMs) {
    const pids = excludeParent(
      getOpenFinPids(),
      parentPid
    );

    for (const pid of pids) {
      const ports = findPortsByPid(pid);

      for (const port of ports) {
        const ws = await isCDPPort(port);
        if (!ws) continue;

        const ok = await matchesApp(ws, appName, env);
        if (!ok) continue;

        return {
          pid,
          port,
          wsEndpoint: ws,
          source: "external",
        };
      }
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  throw new Error("External OpenFin app not found");
}
