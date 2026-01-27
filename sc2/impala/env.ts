import "dotenv/config";

export interface ImpalaEnvConfig {
  host: string;
  port: number;
  user?: string;
  password?: string;
  timeoutMs: number;
}

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function opt(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v : undefined;
}

function num(name: string, def: number): number {
  const v = process.env[name];
  if (!v) return def;
  const n = Number(v);
  if (!Number.isFinite(n)) {
    throw new Error(`Env var ${name} must be a number`);
  }
  return n;
}

export function readImpalaEnv(): ImpalaEnvConfig {
  return {
    host: req("IMPALA_HOST"),
    port: num("IMPALA_PORT", 21000),
    user: opt("IMPALA_USER"),
    password: opt("IMPALA_PASSWORD"),
    timeoutMs: num("IMPALA_TIMEOUT_MS", 60_000),
  };
}
