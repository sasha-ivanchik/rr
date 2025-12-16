import "dotenv/config";
import { loadRegistry, saveRegistry } from "../openfin/registry";
import { launchGBAMDesktop } from "../openfin/launchGBAMDesktop";
import process from "process";
import { chromium } from "@playwright/test";

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// (опционально, но очень полезно) проверяем, что по wsEndpoint реально можно подключиться
async function canAttach(wsEndpoint: string): Promise<boolean> {
  try {
    const browser = await chromium.connectOverCDP(wsEndpoint);
    await browser.close();
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const app = process.env.APP;
  const env = process.env.ENV;

  if (!app || !env) {
    throw new Error("APP and ENV must be set in .env");
  }

  // 1) Пытаемся reuse registry (если уже живо)
  const existing = loadRegistry();
  if (existing && existing.app === app && existing.env === env) {
    if (isProcessAlive(existing.pid) && (await canAttach(existing.cdpEndpoint))) {
      console.log("✅ Reusing existing parent from registry");
      return;
    }
    console.log("⚠️ Existing registry is stale. Will start parent again.");
  }

  // 2) Стартуем родителя через твой готовый метод
  const res = await launchGBAMDesktop(app, env);

  // 3) Пишем только сериализуемые вещи
  saveRegistry({
    app,
    env,
    pid: res.pid,
    cdpEndpoint: res.wsEndpoint,
    createdAt: new Date().toISOString(),
  });

  console.log("✅ Parent started and registered");
  console.log("PID:", res.pid);
  console.log("CDP:", res.wsEndpoint);
}

main().catch((e) => {
  console.error("❌ openfin:parent:start failed");
  console.error(e);
  process.exit(1);
});
