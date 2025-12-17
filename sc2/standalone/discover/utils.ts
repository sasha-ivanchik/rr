import { execSync } from "child_process";

export function getOpenFinPids(): number[] {
  try {
    const out = execSync(
      `tasklist /FI "IMAGENAME eq openfin.exe" /FO CSV /NH`,
      { encoding: "utf-8" }
    );

    return out
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const cols = l.split('","').map((c) => c.replace(/"/g, ""));
        return Number(cols[1]); // PID
      })
      .filter((pid) => Number.isInteger(pid));
  } catch {
    return [];
  }
}


export function findPortsByPid(pid: number): number[] {
  try {
    const out = execSync(`netstat -ano`, { encoding: "utf-8" });

    const ports = new Set<number>();

    for (const line of out.split("\n")) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 5) continue;

      const local = parts[1];       // 127.0.0.1:49685
      const owningPid = Number(parts[4]);

      if (owningPid !== pid) continue;

      const match = local.match(/:(\d+)$/);
      if (!match) continue;

      ports.add(Number(match[1]));
    }

    return [...ports];
  } catch {
    return [];
  }
}



