const PREFIX = "[Impala]";

function enabled(): boolean {
  return process.env.IMPALA_LOGGING === "true";
}

function now(): string {
  return new Date().toISOString();
}

export const ImpalaLogger = {
  info(message: string) {
    if (!enabled()) return;
    console.log(`${PREFIX} ${message}`);
  },

  debug(message: string) {
    if (!enabled()) return;
    console.debug(`${PREFIX} ${message}`);
  },

  warn(message: string) {
    if (!enabled()) return;
    console.warn(`${PREFIX} ${message}`);
  },

  error(message: string) {
    if (!enabled()) return;
    console.error(`${PREFIX} ${message}`);
  },

  sql(sql: string) {
    if (!enabled()) return;
    const compact = sql.replace(/\s+/g, " ").trim();
    console.log(`${PREFIX} sql: ${compact}`);
  },
};
