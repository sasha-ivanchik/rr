export function sleep(ms: number): Promise<void> {
  return new Promise(res => setTimeout(res, ms));
}

export async function withTiming<T>(
  fn: () => Promise<T>
): Promise<{ result: T; durationMs: number }> {
  const start = Date.now();
  const result = await fn();
  return { result, durationMs: Date.now() - start };
}
