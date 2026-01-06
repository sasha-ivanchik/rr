export async function withRetries<T>(
  fn: () => Promise<T>,
  opts: { retries: number; retryTimeoutMs: number; label?: string }
): Promise<T> {
  const { retries, retryTimeoutMs } = opts;
  const attempts = Math.max(1, retries);

  let lastErr: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, retryTimeoutMs));
      }
    }
  }

  throw lastErr;
}
