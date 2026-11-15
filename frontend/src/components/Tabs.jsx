/**
 * Accessible tab list, backed by the Astryx TabList/Tab.
 *
 * With role="tablist", Astryx implements the WAI-ARIA tabs pattern: roving
 * tabindex, Left/Right (and Up/Down) arrows, Home/End, aria-selected and
 * aria-controls via panelId — the behavior the old hand-rolled component
 * provided. The wrapper preserves the app's { tabs, activeId, onChange, label,
 * idPrefix } contract and keeps the 1px accent line through the theme's tab
 * component overrides (colour is never the only selected-state indicator).
 */

import { TabList as AstryxTabList, Tab } from '@astryxdesign/core/TabList';

export function TabList({ tabs, activeId, onChange, label, idPrefix = 'tab' }) {
  // Astryx uses manual activation (arrows move focus; selection follows on
  // Enter/Space). The committed DataBridge pattern is automatic activation:
  // arrows change the view as focus moves. Compute the target from the tab
  // that currently holds focus (data-tab-value), falling back to activeId, so
  // it stays correct even if a parent has not yet re-rendered with the new
  // selection. Do not preventDefault — Astryx still moves focus itself.
  const handleKeyDown = (event) => {
    const focusedValue = event.target?.getAttribute?.('data-tab-value');
    const current = tabs.findIndex((tab) => tab.id === (focusedValue ?? activeId));
    if (current < 0) return;
    let next = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % tabs.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
      next = (current - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    if (next !== null) onChange(tabs[next].id);
  };

  return (
    <AstryxTabList
      value={activeId}
      onChange={onChange}
      role="tablist"
      aria-label={label}
      hasDivider
      onKeyDown={handleKeyDown}
    >
      {tabs.map((tab) => (
        <Tab
          key={tab.id}
          value={tab.id}
          label={tab.label}
          id={`${idPrefix}-${tab.id}`}
          panelId={`${idPrefix}-panel-${tab.id}`}
        />
      ))}
    </AstryxTabList>
  );
}

export default TabList;
