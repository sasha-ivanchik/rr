import { RuntimeInfo } from "../registry/types";

type Options = {
  app: string;
  env: string;
  parent: RuntimeInfo;
};

export async function tryFindChildInParent(
  _opts: Options
): Promise<RuntimeInfo | null> {
  // 1. connectOverCDP(parent.cdp.wsEndpoint)
  // 2. получить pages / targets
  // 3. фильтр по app/env/http
  // 4. вернуть RuntimeInfo

  return null;
}
