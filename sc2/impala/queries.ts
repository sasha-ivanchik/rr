import { ImpalaClient } from "./client";

export interface UserRow {
  user_id: string;
  status: string;
  updated_at: string;
}

export function createImpalaQueries(client: ImpalaClient) {
  return {
    // example 1
    getUserById(userId: string) {
      return client.query<UserRow>(`
        SELECT user_id, status, updated_at
        FROM analytics.users
        WHERE user_id = '${userId}'
        LIMIT 1
      `);
    },

    // example 2
    waitForUserStatus(userId: string, status: string) {
      return client.poll<UserRow>(
        `
        SELECT user_id, status
        FROM analytics.users
        WHERE user_id = '${userId}'
      `,
        rows => rows.some(r => r.status === status),
        { timeoutMs: 30_000 }
      );
    },
  };
}
