import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import client from './client';

/**
 * The interceptors are unit-tested directly through their handler functions,
 * with the transport mocked, so no network access happens.
 */

describe('api client interceptors', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('attaches the bearer token to outgoing requests', () => {
    localStorage.setItem('access_token', 'tok-123');
    const handler = client.interceptors.request.handlers[0].fulfilled;

    const config = handler({ headers: {} });
    expect(config.headers.Authorization).toBe('Bearer tok-123');
  });

  it('omits the header when no token is stored', () => {
    const handler = client.interceptors.request.handlers[0].fulfilled;

    const config = handler({ headers: {} });
    expect(config.headers.Authorization).toBeUndefined();
  });

  it('refreshes the access token once and replays the original request', async () => {
    localStorage.setItem('access_token', 'expired');
    localStorage.setItem('refresh_token', 'refresh-1');

    const refreshPost = vi.spyOn(axios, 'post').mockResolvedValue({
      data: { access_token: 'fresh-token', refresh_token: 'refresh-2' },
    });
    const adapter = vi.fn().mockResolvedValue({ status: 200, data: { ok: true } });
    client.defaults.adapter = adapter;

    const handler = client.interceptors.response.handlers[0].rejected;
    const original = { headers: {}, _retry: false, url: '/connections' };
    const error = { response: { status: 401 }, config: original };

    const response = await handler(error);

    expect(refreshPost).toHaveBeenCalledWith('/api/auth/refresh', {
      refresh_token: 'refresh-1',
    });
    expect(localStorage.getItem('access_token')).toBe('fresh-token');
    expect(localStorage.getItem('refresh_token')).toBe('refresh-2');
    expect(original.headers.Authorization).toBe('Bearer fresh-token');
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(response.data).toEqual({ ok: true });

    delete client.defaults.adapter;
  });

  it('clears the session and redirects when the refresh fails', async () => {
    localStorage.setItem('access_token', 'expired');
    localStorage.setItem('refresh_token', 'stale');
    localStorage.setItem('user', '{"id":"u1"}');

    vi.spyOn(axios, 'post').mockRejectedValue(new Error('refresh rejected'));

    const originalLocation = window.location;
    delete window.location;
    window.location = { href: '' };

    try {
      const handler = client.interceptors.response.handlers[0].rejected;
      const error = {
        response: { status: 401 },
        config: { headers: {}, _retry: false, url: '/connections' },
      };

      await expect(handler(error)).rejects.toThrow('refresh rejected');
      expect(localStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('refresh_token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
      expect(window.location.href).toBe('/login');
    } finally {
      window.location = originalLocation;
    }
  });
});
