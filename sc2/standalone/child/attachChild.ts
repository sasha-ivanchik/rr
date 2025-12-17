import "dotenv/config";
import { readRegistry, writeChild } from "../core/registry/registry";
import { resolveChild } from "./discover/resolveChild";
import { launchChild } from "./child/launchChild";

async function main() {
  const registry = readRegistry();
  const parent = registry.parent;

  const appName = process.env.APP!;
  const env = process.env.ENV!;

  let child;
  try {
    child = await resolveChild({
      parent,
      appName,
      env,
      timeoutMs: 30_000
    });
  } catch {
    // если не нашли — пробуем запустить
    await launchChild();

    child = await resolveChild({
      parent,
      appName,
      env,
      timeoutMs: 60_000
    });
  }

  writeChild(child);

  console.log("✅ Child attached");
  console.log("CDP:", child.cdp.wsEndpoint);
}

main().catch(e => {
  console.error("❌ attach-child failed", e);
  process.exit(1);
});
