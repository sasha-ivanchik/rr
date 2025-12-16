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


import http from "http";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitUntilReady(
  port: number,
  timeoutMs = 120_000,
  pollIntervalMs = 300
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const ok = await new Promise<boolean>((resolve) => {
      const req = http.request(
        {
          host: "127.0.0.1",
          port,
          path: "/json/version",
          method: "GET",
          timeout: 1500,
        },
        (res) => {
          // CDP готов, если сервер отвечает 200
          resolve(res.statusCode === 200);
        }
      );

      req.on("error", () => resolve(false));
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    });

    if (ok) {
      return;
    }

    await sleep(pollIntervalMs);
  }

  throw new Error(
    `CDP was not ready on port ${port} within ${timeoutMs}ms`
  );
}

