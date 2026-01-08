import React, { ReactNode, useEffect, useMemo, useState } from 'react';

import classNames from 'classnames';

export interface TabOption<T extends string = string> {
  id: T;
  label: string;
  content: ReactNode | null;
  disabled?: boolean;
}

interface TabsProps<T extends string = string> {
  tabs: TabOption<T>[];
  defaultTabId?: T;
  onTabChange?: (tabId: T) => void;
  className?: string;
  tabListClassName?: string;
  tabButtonBaseClassName?: string;
  activeTabButtonClassName?: string;
  inactiveTabButtonClassName?: string;
  renderContent?: (activeTabId: T) => ReactNode;
}

export const Tabs = <T extends string = string>({
  tabs,
  defaultTabId,
  onTabChange,
  className,
  tabListClassName,
  tabButtonBaseClassName,
  activeTabButtonClassName,
  inactiveTabButtonClassName,
  renderContent,
}: TabsProps<T>) => {
  const validTabs = useMemo(() => tabs.filter(Boolean), [tabs]);

  const [activeTabId, setActiveTabId] = useState<T | undefined>(() => {
    if (defaultTabId && validTabs.find((tab) => tab.id === defaultTabId)) {
      return defaultTabId;
    }
    return validTabs[0]?.id;
  });

  useEffect(() => {
    if (defaultTabId && defaultTabId !== activeTabId) {
      const exists = validTabs.some((tab) => tab.id === defaultTabId);
      if (exists) {
        setActiveTabId(defaultTabId);
      }
    }
  }, [defaultTabId, activeTabId, validTabs]);

  const handleTabClick = (tabId: T) => {
    if (tabId === activeTabId) return;
    setActiveTabId(tabId);
    onTabChange?.(tabId);
  };

  const activeTab = validTabs.find((tab) => tab.id === activeTabId);
  if (!activeTab) return null;

  return (
    <div className={className}>
      <div
        className={classNames('flex items-center rounded', tabListClassName)}
        role="tablist"
      >
        {validTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === activeTabId}
            aria-controls={`tabpanel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => !tab.disabled && handleTabClick(tab.id)}
            disabled={tab.disabled}
            className={classNames(
              tabButtonBaseClassName,
              tab.id === activeTabId
                ? activeTabButtonClassName
                : inactiveTabButtonClassName,
              {
                'cursor-not-allowed opacity-50': tab.disabled,
              },
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        id={`tabpanel-${activeTab.id}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab.id}`}
      >
        {activeTab.content !== null
          ? activeTab.content
          : renderContent?.(activeTab.id)}
      </div>
    </div>
  );
};
