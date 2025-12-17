export function getAllTcpPorts(): { pid: number; port: number }[] {
  const out = execSync(`netstat -ano -p tcp`, { encoding: "utf-8" });

  const lines = out.split("\n");

  const result: { pid: number; port: number }[] = [];

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) continue;

    const local = parts[1]; // 127.0.0.1:9222
    const pid = Number(parts[4]);

    if (!Number.isInteger(pid)) continue;

    const m = local.match(/:(\d+)$/);
    if (!m) continue;

    result.push({ pid, port: Number(m[1]) });
  }

  return result;
}



export function getChildPids(parentPid: number): number[] {
  const out = execSync(
    `wmic process where (ParentProcessId=${parentPid}) get ProcessId`,
    { encoding: "utf-8" }
  );

  return out
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^\d+$/.test(l))
    .map(Number);
}



export function expandPids(pids: number[]): Set<number> {
  const all = new Set<number>(pids);

  for (const pid of pids) {
    const children = getChildPids(pid);
    for (const c of children) all.add(c);
  }

  return all;
}



export async function isCDPPort(port: number): Promise<string | null> {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/json/version`, {
      timeout: 500,
    });
    if (!r.ok) return null;

    const j = await r.json();
    return j.webSocketDebuggerUrl ?? null;
  } catch {
    return null;
  }
}


export async function findOpenFinCDP(
  openFinPids: number[],
  timeoutMs = 30_000
) {
  const start = Date.now();
  const found = new Map<number, { pid: number; port: number; ws: string }>();

  const pidSet = expandPids(openFinPids);

  while (Date.now() - start < timeoutMs) {
    const allPorts = getAllTcpPorts();

    for (const { pid, port } of allPorts) {
      if (!pidSet.has(pid)) continue;
      if (found.has(port)) continue;

      const ws = await isCDPPort(port);
      if (!ws) continue;

      found.set(port, { pid, port, ws });
    }

    if (found.size > 0) break;
    await new Promise((r) => setTimeout(r, 500));
  }

  return [...found.values()];
}
