let csrf = '';
export const setCsrf = (value: string) => {
  csrf = value;
};
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && typeof init.body === 'string') headers.set('Content-Type', 'application/json');
  if (init.method && !['GET', 'HEAD'].includes(init.method)) headers.set('X-CSRF-Token', csrf);
  const response = await fetch(`/api${path}`, {
    ...init,
    headers,
    credentials: 'same-origin',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      typeof body?.detail === 'string' ? body.detail : 'Check your input and try again.';
    // 401 errors are now handled by WebSocket, no need to dispatch events
    throw new ApiError(response.status, message);
  }
  return response;
}
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await request(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return response.status === 204 ? (undefined as T) : response.json();
}
export async function streamResponse(
  id: string,
  signal: AbortSignal,
  onEvent: (kind: string, data: Record<string, string>) => void,
) {
  const response = await request(`/generations/${id}/stream`, {
    method: 'POST',
    signal,
  });
  if (!response.body) throw new Error('Streaming is not supported by this browser');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '',
    completed = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const kind = block
          .split('\n')
          .find((line) => line.startsWith('event: '))
          ?.slice(7);
        const payload = block
          .split('\n')
          .filter((line) => line.startsWith('data: '))
          .map((line) => line.slice(6))
          .join('\n');
        if (kind && payload) {
          onEvent(kind, JSON.parse(payload));
          if (kind === 'done' || kind === 'error') completed = true;
        }
      }
    }
    if (!completed) throw new Error('Connection interrupted. Reload to see the saved response.');
  } finally {
    reader.releaseLock();
  }
}
