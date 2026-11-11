/**
 * Accessible tab list following the WAI-ARIA tabs pattern: roving tabindex,
 * Left/Right (and Up/Down) arrow movement, Home/End, and aria-controls.
 *
 * The visual treatment is the 1px accent line in index.css (.tabs / .tab).
 */

import { useRef } from 'react';

export function TabList({ tabs, activeId, onChange, label, idPrefix = 'tab' }) {
  const refs = useRef({});

  const onKeyDown = (e, index) => {
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % tabs.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
      next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next === null) return;
    e.preventDefault();
    onChange(tabs[next].id);
    refs.current[tabs[next].id]?.focus();
  };

  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, index) => {
        const selected = activeId === tab.id;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[tab.id] = el;
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-${tab.id}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            className={`tab ${selected ? 'active' : ''}`}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => onKeyDown(e, index)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export default TabList;
