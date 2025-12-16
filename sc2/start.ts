import "dotenv/config";
import { saveRegistry } from "../openfin/registry";

// TODO: заменить на твою реальную реализацию старта + поиска CDP
async function launchOpenFinAndGetCdp(app: string, env: string) {
  // 1) старт родительского апп
  // 2) дождаться готовности
  // 3) найти/стартануть тестовый апп
  // 4) получить CDP wsEndpoint (ВАЖНО: лучше один стабильный endpoint, без PID-скана в тестах)

  // Заглушка: здесь верни реальные значения
  return {
    pid: 12345,
    cdpEndpoint: "ws://127.0.0.1:9222/devtools/browser/<id>",
  };
}

async function main() {
  const app = process.env.APP;
  const env = process.env.ENV;

  if (!app || !env) {
    throw new Error(`APP and ENV must be set in .env (APP=..., ENV=...)`);
  }

  const { pid, cdpEndpoint } = await launchOpenFinAndGetCdp(app, env);

  saveRegistry({
    app,
    env,
    pid,
    cdpEndpoint,
    createdAt: new Date().toISOString(),
  });

  console.log(`✅ OpenFin ready: app=${app} env=${env}`);
  console.log(`✅ CDP: ${cdpEndpoint}`);
}

main().catch((e) => {
  console.error("❌ openfin-start failed");
  console.error(e);
  process.exit(1);
});
