import { execSync } from "child_process";
import { ImpalaEnvConfig } from "./env";
import { ImpalaLogger } from "./logger";


export type ImpalaAuthMode =
  | "USER_PASSWORD"
  | "KERBEROS";

export interface ResolvedAuth {
  mode: ImpalaAuthMode;
  user?: string;
  password?: string;
  kerberosPrincipal?: string;
}

function hasKerberosTicket(): string | null {
  try {
    const out = execSync("klist", {
      stdio: ["ignore", "pipe", "ignore"],
    }).toString();

    const line = out
      .split("\n")
      .find(l => l.toLowerCase().includes("default principal"));

    return line ? line.split(":")[1].trim() : "UNKNOWN";
  } catch {
    return null;
  }
}

export function resolveImpalaAuth(
  env: ImpalaEnvConfig
): ResolvedAuth {

  const hasUserPass = !!env.user && !!env.password;

  if (hasUserPass) {
    ImpalaLogger.info("auth mode: USER_PASSWORD (from .env)");
    return {
      mode: "USER_PASSWORD",
      user: env.user,
      password: env.password,
    };
  }

  const principal = hasKerberosTicket();
  if (principal) {
    ImpalaLogger.info(`auth mode: KERBEROS (${principal})`);
    return {
      mode: "KERBEROS",
      kerberosPrincipal: principal,
    };
  }

  ImpalaLogger.error("auth mode: NONE");
  ImpalaLogger.error(
    "no IMPALA_USER/IMPALA_PASSWORD and no Kerberos ticket found"
  );
  ImpalaLogger.info("hint: run `kinit user@REALM`");

  throw new Error("Impala authentication is not configured");
}
