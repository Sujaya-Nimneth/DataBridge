import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import client, { adminAPI, transfersAPI, monitoringAPI } from './client';

/** Verify the endpoints the redesigned screens depend on are wired correctly. */

let adapter;
beforeEach(() => {
  localStorage.clear();
  adapter = vi.fn().mockResolvedValue({ status: 200, data: [] });
  client.defaults.adapter = adapter;
});
afterEach(() => {
  delete client.defaults.adapter;
  vi.restoreAllMocks();
});

describe('redesigned-screen API calls', () => {
  it('loads the admin users route data', async () => {
    await adminAPI.listUsers();
    expect(adapter.mock.calls[0][0].url).toBe('/admin/users');
  });

  it('loads a single transfer and its logs with an abort signal', async () => {
    const controller = new AbortController();
    await transfersAPI.get('t1', controller.signal);
    await transfersAPI.getLogs('t1', controller.signal);
    expect(adapter.mock.calls[0][0].url).toBe('/transfers/t1');
    expect(adapter.mock.calls[1][0].url).toBe('/transfers/t1/logs');
    expect(adapter.mock.calls[0][0].signal).toBe(controller.signal);
  });

  it('passes the URL status filter through to the list request', async () => {
    await transfersAPI.list({ status: 'failed' });
    expect(adapter.mock.calls[0][0].params).toEqual({ status: 'failed' });
  });

  it('caps the dashboard activity feed at 5 items', async () => {
    await monitoringAPI.getActivity(5);
    expect(adapter.mock.calls[0][0].params).toEqual({ limit: 5 });
  });
});
