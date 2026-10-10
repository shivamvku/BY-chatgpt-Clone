import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, request, setCsrf } from './api';

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
    const fetchMock = vi.fn(() => Promise.resolve(responses.shift()!));
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
