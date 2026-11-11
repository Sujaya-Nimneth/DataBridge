import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SkeletonBlock, SkeletonRows, Freshness, EmptyState, InlineError, Value } from './States';

describe('States primitives', () => {
  it('renders flat skeleton bars that are hidden from assistive tech', () => {
    const { container } = render(<SkeletonBlock width="50%" height={24} />);
    const bar = container.querySelector('.skeleton');
    expect(bar).toHaveAttribute('aria-hidden', 'true');
    expect(bar).toHaveStyle({ width: '50%', height: '24px' });
  });

  it('renders the requested number of skeleton rows', () => {
    const { container } = render(<SkeletonRows rows={3} />);
    expect(container.querySelectorAll('.skeleton')).toHaveLength(3);
  });

  it('states an explicit stale state and still offers a refresh', async () => {
    const onRefresh = vi.fn();
    render(<Freshness updatedAt={new Date('2026-01-01T09:14:00Z')} onRefresh={onRefresh} stale />);
    expect(screen.getByText(/showing last good data/i)).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Refresh data' });
    await userEvent.click(button);
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it('keeps the frame and the first action in an empty state', () => {
    render(
      <EmptyState title="No transfers yet" action={<button type="button">Add a connection</button>}>
        Move your first table.
      </EmptyState>,
    );
    expect(screen.getByRole('heading', { name: 'No transfers yet' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a connection' })).toBeInTheDocument();
  });

  it('names the failure, the last good time and a retry in an inline error', async () => {
    const onRetry = vi.fn();
    render(<InlineError message="Could not load deployments" lastGood="09:14" onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/last updated 09:14/i);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('prints a real zero and a grey dash for a missing value', () => {
    const { rerender } = render(<Value value={0} unit="rows" />);
    expect(screen.getByText('0')).toBeInTheDocument();
    rerender(<Value value={null} />);
    expect(screen.getByText('–')).toHaveClass('value-missing');
  });
});
