export type ImpalaRow = Record<string, any>;

export interface ImpalaQueryResult<T extends ImpalaRow = ImpalaRow> {
  rows: T[];
  rowCount: number;
  sql: string;
  durationMs: number;
}

export interface ImpalaPollOptions {
  timeoutMs?: number;
  intervalMs?: number;
}
