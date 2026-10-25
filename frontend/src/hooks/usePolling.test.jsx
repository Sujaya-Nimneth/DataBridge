import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import usePolling from './usePolling';

function Probe({ fetchFn, interval, shouldPoll }) {
  const { data, error, loading } = usePolling(fetchFn, interval, shouldPoll);
  return <div data-testid="state">{JSON.stringify({ data, error: error?.message, loading })}</div>;
}

const state = () => JSON.parse(screen.getByTestId('state').textContent);

describe('usePolling', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches immediately and repeats on the interval', async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');

    render(<Probe fetchFn={fetchFn} interval={1000} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(state().data).toBe('first');
    expect(fetchFn).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(state().data).toBe('second');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('passes an abort signal to the fetch callback', async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn().mockImplementation((_signal) => 'ok');

    render(<Probe fetchFn={fetchFn} interval={1000} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchFn.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
  });

  it('captures errors and clears them on the next success', async () => {
    vi.useFakeTimers();
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('recovered');

    render(<Probe fetchFn={fetchFn} interval={500} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(state().error).toBe('boom');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    // JSON.stringify omits null; a cleared error round-trips as undefined.
    expect(state().error ?? null).toBeNull();
    expect(state().data).toBe('recovered');
  });

  it('does not poll when shouldPoll is false', async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn().mockResolvedValue('never');

    render(<Probe fetchFn={fetchFn} interval={1000} shouldPoll={false} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(state().loading).toBe(false);
  });

  it('stops polling after unmount', async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn().mockResolvedValue('x');

    const { unmount } = render(<Probe fetchFn={fetchFn} interval={1000} />);
    await vi.advanceTimersByTimeAsync(0);
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
