import { spawn } from "child_process";

export function killAllOpenFin(): Promise<void> {
  return new Promise((resolve) => {
    spawn(
      "taskkill",
      ["/IM", "OpenFin*", "/T", "/F"],
      { stdio: "ignore", windowsHide: true }
    ).once("close", () => resolve());
  });
}



import { spawn } from "child_process";

export function killAllOpenFin(): Promise<void> {
  return new Promise((resolve) => {
    const ps = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `
          Get-Process OpenFin* -ErrorAction SilentlyContinue |
          Stop-Process -Force
        `
      ],
      { stdio: "ignore", windowsHide: true }
    );

    // ⛔ НЕ ждём stdout
    // ⛔ НЕ ждём exit-код
    ps.once("close", () => resolve());
  });
}
