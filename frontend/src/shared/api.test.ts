import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, request, setCsrf } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CSRF recovery', () => {
  it('refreshes a stale CSRF token and retries the rejected request once', async () => {
    setCsrf('stale-token');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: 'CSRF validation failed' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrf: 'fresh-token', user: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: 'Invalid email or password' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'missing@example.com', password: 'wrong-password' }),
      }),
    ).rejects.toMatchObject({ status: 401, message: 'Invalid email or password' });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][1]?.headers).toBeInstanceOf(Headers);
    expect((fetchMock.mock.calls[0][1]?.headers as Headers).get('X-CSRF-Token')).toBe(
      'stale-token',
    );
    expect(fetchMock.mock.calls[2][1]?.headers).toBeInstanceOf(Headers);
    expect((fetchMock.mock.calls[2][1]?.headers as Headers).get('X-CSRF-Token')).toBe(
      'fresh-token',
    );
  });

  it('does not retry authorization failures unrelated to CSRF', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Administrator access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(request('/admin/users', { method: 'PATCH', body: '{}' })).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
