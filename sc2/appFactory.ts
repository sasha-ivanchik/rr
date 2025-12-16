import { spawn } from "child_process";

export async function launchGBAMDesktop(app: string, env: string) {
  const port = await findFreePort();

  const psCommand = `
$proc = Start-Process "${openFinFilePath}" `
  -ArgumentList '--config="${configUrl}"' `
  -PassThru
Write-Output $proc.Id
`;

  const ps = spawn(
    "powershell.exe",
    ["-NoProfile", "-Command", psCommand],
    {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    }
  );

  const pid = await new Promise<number>((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    ps.stdout.on("data", (d) => (stdout += d.toString()));
    ps.stderr.on("data", (d) => (stderr += d.toString()));

    ps.on("exit", () => {
      const parsed = Number.parseInt(stdout.trim(), 10);

      if (!Number.isFinite(parsed)) {
        reject(
          new Error(
            `Failed to get OpenFin PID from PowerShell.\nstdout: ${stdout}\nstderr: ${stderr}`
          )
        );
      } else {
        resolve(parsed);
      }
    });
  });

  await waitUntilReady(port);
  const wsEndpoint = await getWsEndpoint(port);

  return {
    pid,          // ✅ РЕАЛЬНЫЙ PID OPENFIN
    port,
    wsEndpoint,
  };
}
