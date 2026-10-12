import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, request, setCsrf, streamResponse } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CSRF recovery', () => {
  it('refreshes a stale CSRF token and retries the rejected request once', async () => {
    setCsrf('stale-token');
    const responses = [
      new Response(JSON.stringify({ detail: 'CSRF validation failed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
      new Response(JSON.stringify({ csrf: 'fresh-token', user: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
      new Response(JSON.stringify({ detail: 'Invalid email or password' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    ];
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(responses.shift()!));
    vi.stubGlobal('fetch', fetchMock);

    const login = request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'missing@example.com', password: 'wrong-password' }),
    });
    await expect(login).rejects.toMatchObject({
      status: 401,
      message: 'Invalid email or password',
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const firstHeaders = fetchMock.mock.calls[0][1]?.headers as Headers;
    const retryHeaders = fetchMock.mock.calls[2][1]?.headers as Headers;
    expect(firstHeaders.get('X-CSRF-Token')).toBe('stale-token');
    expect(retryHeaders.get('X-CSRF-Token')).toBe('fresh-token');
  });

  it('does not retry authorization failures unrelated to CSRF', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Administrator access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const adminRequest = request('/admin/users', { method: 'PATCH', body: '{}' });
    await expect(adminRequest).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('SSE streaming parser', () => {
  it('handles CRLF split across chunks and a final frame without a blank terminator', async () => {
    const chunks = [
      'event: delta\r',
      '\ndata: {"text":"hello"}\r\n\r',
      '\nevent: done\r\ndata: {"status":"complete"}',
    ];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
        controller.close();
      },
    });
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(body, { status: 200 })),
    );
    vi.stubGlobal('fetch', fetchMock);

    const events: Array<{ kind: string; data: Record<string, string> }> = [];
    await streamResponse('message-id', new AbortController().signal, (kind, data) => {
      events.push({ kind, data });
    });

    expect(events).toEqual([
      { kind: 'delta', data: { text: 'hello' } },
      { kind: 'done', data: { status: 'complete' } },
    ]);
  });

  it('rejects malformed event payloads instead of silently treating them as valid data', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('event: delta\ndata: {not-json}\n\n'));
        controller.close();
      },
    });
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(body, { status: 200 })),
    );
    vi.stubGlobal('fetch', fetchMock);

    const received: Array<{ kind: string; data: Record<string, string> }> = [];
    await expect(
      streamResponse('message-id', new AbortController().signal, (kind, data) => {
        received.push({ kind, data });
      }),
    ).rejects.toThrow();
    expect(received).toEqual([]);
  });
});
