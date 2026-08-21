/**
 * Cliente HTTP único. Las credenciales viajan en cookies httpOnly:
 * este módulo nunca ve tokens, solo gestiona el ciclo 401 → refresh → retry.
 */
const BASE = '/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const res = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  return res.ok;
}

async function request<T>(path: string, init: RequestInit = {}, allowRetry = true): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
    ...init,
  });

  if (res.status === 401 && allowRetry && !path.startsWith('/auth/')) {
    // single-flight: si llegan varios 401 en paralelo solo se refresca una vez
    refreshInFlight ??= tryRefresh();
    const refreshed = await refreshInFlight;
    refreshInFlight = null;
    if (refreshed) return request<T>(path, init, false);
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(res.status, body?.message ?? `Error ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
};
