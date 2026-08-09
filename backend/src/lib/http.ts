export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 8000,
): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

export function now(): string {
  return new Date().toISOString();
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
