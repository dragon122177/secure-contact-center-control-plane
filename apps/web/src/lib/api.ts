const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8080';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type ErrorEnvelope = { error?: { code?: string; message?: string } };

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    let envelope: ErrorEnvelope = {};
    try {
      envelope = (await response.json()) as ErrorEnvelope;
    } catch {
      // Preserve the HTTP status when the server does not return JSON.
    }
    throw new ApiError(
      response.status,
      envelope.error?.message ?? `Request failed with status ${response.status}`,
      envelope.error?.code,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function websocketUrl(token: string): string {
  const configured = import.meta.env.VITE_WS_URL as string | undefined;
  const base =
    configured ||
    `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/live`;
  const url = new URL(base, window.location.href);
  url.searchParams.set('token', token);
  return url.toString();
}
