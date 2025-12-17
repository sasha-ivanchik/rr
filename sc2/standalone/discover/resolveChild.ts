import { ResolveChildOptions } from "./types";
import { tryFindChildInParent } from "./fromParent";
import { tryFindChildExternal } from "./fromExternal";
import { RuntimeInfo } from "../registry/types";

export async function resolveChild(
  options: ResolveChildOptions
): Promise<RuntimeInfo> {
  const {
    app,
    env,
    parent,
    timeoutMs = 60_000,
    pollIntervalMs = 500
  } = options;

  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    // 1️⃣ пробуем найти внутри parent
    if (parent) {
      const fromParent = await tryFindChildInParent({ app, env, parent });
      if (fromParent) return fromParent;
    }

    // 2️⃣ пробуем найти как отдельный процесс
    const fromExternal = await tryFindChildExternal({ app, env });
    if (fromExternal) return fromExternal;

    await delay(pollIntervalMs);
  }

  throw new Error(`Child not found within ${timeoutMs}ms`);
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}
