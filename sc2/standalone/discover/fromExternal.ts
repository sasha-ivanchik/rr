export async function findExternalOpenFin(
  appName: string,
  env: string,
  retries = 3,
  delayMs = 10_000
): Promise<FoundOpenFinApp> {

  for (let attempt = 1; attempt <= retries; attempt++) {
    console.log(`🔁 Attempt ${attempt}/${retries}`);

    const pids = getOpenFinPids();
    console.log("PIDs:", pids);

    for (const pid of pids) {
      const ports = findPortsByPid(pid);
      console.log(`PID ${pid} ports:`, ports);

      for (const port of ports) {
        const ws = await isCDPPort(port);
        if (!ws) continue;

        const ok = await matchesApp(ws, appName, env);
        if (!ok) continue;

        return { pid, port, wsEndpoint: ws };
      }
    }

    if (attempt < retries) {
      console.log(`⏳ wait ${delayMs}ms`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  throw new Error("OpenFin app not found");
}
