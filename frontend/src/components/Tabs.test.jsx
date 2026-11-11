import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TabList } from './Tabs';

const tabs = [
  { id: 'all', label: 'All' },
  { id: 'running', label: 'Running' },
  { id: 'failed', label: 'Failed' },
];

describe('TabList (WAI-ARIA tabs pattern)', () => {
  it('uses a roving tabindex: only the selected tab is tabbable', () => {
    render(<TabList tabs={tabs} activeId="running" onChange={() => {}} label="Filter" />);
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('tab', { name: 'Running' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Running' })).toHaveAttribute('aria-selected', 'true');
  });

  it('wires aria-controls to a matching panel id', () => {
    render(
      <TabList tabs={tabs} activeId="all" onChange={() => {}} label="Filter" idPrefix="status" />,
    );
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute(
      'aria-controls',
      'status-panel-all',
    );
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('id', 'status-all');
  });

  it('moves selection and focus with arrow keys and Home/End', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TabList tabs={tabs} activeId="all" onChange={onChange} label="Filter" />);

    const all = screen.getByRole('tab', { name: 'All' });
    all.focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('running');
    expect(screen.getByRole('tab', { name: 'Running' })).toHaveFocus();

    await user.keyboard('{End}');
    expect(onChange).toHaveBeenLastCalledWith('failed');

    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('all');
  });

  it('selects a tab on click', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TabList tabs={tabs} activeId="all" onChange={onChange} label="Filter" />);
    await user.click(screen.getByRole('tab', { name: 'Failed' }));
    expect(onChange).toHaveBeenCalledWith('failed');
  });
});
