import http from "http";

export async function getWsEndpoint(port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: "/json/version",
        method: "GET",
        timeout: 3000,
      },
      (res) => {
        let data = "";

        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            const ws = json.webSocketDebuggerUrl;

            if (!ws) {
              reject(
                new Error("webSocketDebuggerUrl not found in /json/version")
              );
              return;
            }

            resolve(ws);
          } catch (e) {
            reject(e);
          }
        });
      }
    );

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("HTTP timeout while reading /json/version"));
    });

    req.end();
  });
}
