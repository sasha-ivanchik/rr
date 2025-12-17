import { RuntimeInfo } from "../registry/types";

type Options = {
  app: string;
  env: string;
};

export async function tryFindChildExternal(
  _opts: Options
): Promise<RuntimeInfo | null> {
  // 1. проверить известные порты (range или конфиг)
  // 2. попытаться подключиться по CDP
  // 3. проверить targets по app/env
  // 4. вернуть RuntimeInfo

  return null;
}
