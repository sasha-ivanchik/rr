import { RuntimeInfo } from "../registry/types";

export type ResolveChildOptions = {
  app: string;
  env: string;

  parent?: RuntimeInfo;  
  timeoutMs?: number;
  pollIntervalMs?: number;
};
