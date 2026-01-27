import Impala from "node-impala";
import { ImpalaEnvConfig } from "./env";
import { ImpalaQueryResult, ImpalaPollOptions } from "./types";
import { sleep, withTiming } from "./utils";
import { ImpalaLogger } from "./logger";
import { resolveImpalaAuth } from "./auth";


export class ImpalaClient {
  private client: any;
  private connected = false;

  constructor(private readonly cfg: ImpalaEnvConfig) {
    const auth = resolveImpalaAuth(cfg);
    
    this.client = new Impala({
      host: cfg.host,
      port: cfg.port,
      timeout: cfg.timeoutMs,
      resultType: "json",

      user: auth.mode === "USER_PASSWORD" ? auth.user : undefined,
      password: auth.mode === "USER_PASSWORD" ? auth.password : undefined,
    });
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    ImpalaLogger.info(
      `connect to ${this.cfg.host}:${this.cfg.port}`
    );

    await new Promise<void>((resolve, reject) => {
      this.client.connect((err: any) => {
        if (err) {
          ImpalaLogger.error(`connect failed: ${err.message}`);
          return reject(err);
        }
        this.connected = true;
        resolve();
      });
    });
  }

  async close(): Promise<void> {
    if (!this.connected) return;

    ImpalaLogger.info("connection closed");
    this.client.close();
    this.connected = false;
  }

  async query<T extends Record<string, any> = any>(
    sql: string
  ): Promise<ImpalaQueryResult<T>> {
    await this.connect();

    ImpalaLogger.sql(sql);

    const { result, durationMs } = await withTiming<T[]>(() =>
      new Promise((resolve, reject) => {
        this.client.query(sql, (err: any, rows: T[]) => {
          if (err) {
            ImpalaLogger.error(`query failed: ${err.message}`);
            return reject(err);
          }
          resolve(rows ?? []);
        });
      })
    );

    ImpalaLogger.info(
      `query (${durationMs}ms, rows=${result.length})`
    );

    return {
      rows: result,
      rowCount: result.length,
      sql,
      durationMs,
    };
  }

  async poll<T extends Record<string, any> = any>(
    sql: string,
    predicate: (rows: T[]) => boolean,
    options: ImpalaPollOptions = {}
  ): Promise<ImpalaQueryResult<T>> {
    const timeoutMs = options.timeoutMs ?? 30_000;
    const intervalMs = options.intervalMs ?? 1_000;

    const start = Date.now();
    let attempt = 0;

    ImpalaLogger.info(
      `poll started (timeout=${timeoutMs}ms, interval=${intervalMs}ms)`
    );

    while (Date.now() - start < timeoutMs) {
      attempt++;

      const res = await this.query<T>(sql);

      if (predicate(res.rows)) {
        ImpalaLogger.info(
          `poll success after ${attempt} attempt(s)`
        );
        return res;
      }

      ImpalaLogger.debug(
        `poll attempt ${attempt}: condition not met`
      );

      await sleep(intervalMs);
    }

    ImpalaLogger.error(
      `poll timeout after ${timeoutMs}ms`
    );
    ImpalaLogger.sql(sql);

    throw new Error(
      `Impala poll timeout after ${timeoutMs}ms`
    );
  }
}
