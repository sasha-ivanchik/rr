import { ImpalaClient } from "./client";
import { readImpalaEnv } from "./env";

let instance: ImpalaClient | null = null;

export function getImpalaClient(): ImpalaClient {
  if (!instance) {
    instance = new ImpalaClient(readImpalaEnv());
  }
  return instance;
}

export async function closeImpalaClient(): Promise<void> {
  if (instance) {
    await instance.close();
    instance = null;
  }
}
