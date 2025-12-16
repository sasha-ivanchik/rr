import { exec } from "child_process";

export async function killProcessTree(pid: number): Promise<void> {
  if (!pid) return;

  console.log(`🛑 Killing OpenFin process tree. PID=${pid}`);

  await new Promise<void>((resolve) => {
    // /T  — убить дочерние процессы
    // /F  — принудительно
    exec(`taskkill /PID ${pid} /T /F`, () => {
      resolve();
    });
  });
}
