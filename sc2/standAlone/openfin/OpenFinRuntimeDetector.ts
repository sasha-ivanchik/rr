import { getOpenFinPids, getListeningPorts } from "../utils/process";
import { getWsFromPort } from "../utils/net";
import { RuntimeInfo } from "./OpenFinTypes";

export class OpenFinRuntimeDetector {
  static async detectNewRuntime(
    excludePid: number
  ): Promise<RuntimeInfo | null> {
    const pids = await getOpenFinPids();

    for (const pid of pids) {
      if (pid === excludePid) continue;

      const ports = await getListeningPorts(pid);

      for (const port of ports) {
        const ws = await getWsFromPort(port);
        if (ws) {
          return { pid, port, wsEndpoint: ws };
        }
      }
    }

    return null;
  }
}
