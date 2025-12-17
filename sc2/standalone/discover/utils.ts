export async function isCDPPort(port: number): Promise<string | null> {
  try {
    const res = await fetch(
      `http://127.0.0.1:${port}/json/version`,
      { signal: AbortSignal.timeout(800) }
    );

    if (!res.ok) return null;

    const json = await res.json();
    return json.webSocketDebuggerUrl ?? null;
  } catch {
    return null;
  }
}
