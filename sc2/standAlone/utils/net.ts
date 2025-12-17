import * as http from "http";

export async function getWsFromPort(
  port: number
): Promise<string | null> {
  return new Promise((resolve) => {
    const req = http.get(
      { host: "127.0.0.1", port, path: "/json/version", timeout: 1000 },
      (res) => {
        let data = "";
        res.on("data", (d) => (data += d));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            resolve(json.webSocketDebuggerUrl ?? null);
          } catch {
            resolve(null);
          }
        });
      }
    );

    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
  });
}
