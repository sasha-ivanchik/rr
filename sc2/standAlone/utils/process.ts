import { exec } from "child_process";

export function getOpenFinPids(): Promise<number[]> {
  return new Promise((resolve) => {
    exec(
      `powershell -NoProfile -Command "Get-Process OpenFin* | Select-Object -ExpandProperty Id"`,
      { windowsHide: true },
      (_e, stdout) => {
        resolve(
          stdout
            .split(/\r?\n/)
            .map((l) => Number(l.trim()))
            .filter(Boolean)
        );
      }
    );
  });
}

export function getListeningPorts(pid: number): Promise<number[]> {
  return new Promise((resolve) => {
    exec(
      `powershell -NoProfile -Command "Get-NetTCPConnection -OwningProcess ${pid} -State Listen | Select-Object -ExpandProperty LocalPort"`,
      { windowsHide: true },
      (_e, stdout) => {
        resolve(
          stdout
            .split(/\r?\n/)
            .map((l) => Number(l.trim()))
            .filter(Boolean)
        );
      }
    );
  });
}
