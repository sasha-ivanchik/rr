import { RuntimeInfo } from "../../core/registry/types";
import { tryFindChildInParent } from "./fromParent";
import { tryFindChildExternal } from "./fromExternal";

type Options = {
  parent: RuntimeInfo;
  appName: string;
  env: string;
  timeoutMs?: number;
  pollMs?: number;
};

export async function resolveChild(
  opts: Options
): Promise<RuntimeInfo> {
  const {
    parent,
    appName,
    env,
    timeoutMs = 60_000,
    pollMs = 500
  } = opts;

  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const fromParent = await tryFindChildInParent({
      parent,
      appName,
      env
    });
    if (fromParent) return fromParent;

    const fromExternal = await tryFindChildExternal({
      appName,
      env
    });
    if (fromExternal) return fromExternal;

    await delay(pollMs);
  }

  throw new Error(
    `Child not found (app=${appName}, env=${env})`
  );
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}
