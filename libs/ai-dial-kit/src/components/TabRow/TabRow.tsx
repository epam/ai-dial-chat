import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { type FC } from 'react';
import styles from './TabRow.module.scss';

/** A single tab entry rendered by {@link TabRow}. */
export interface TabRowTab {
  /** Unique identifier used to match against `activeTabId`. */
  id: string;
  /** Visible label text for the tab button. */
  label: string;
  /** Optional numeric badge rendered alongside the label. */
  count?: number;
}

/** Props for the {@link TabRow} component. */
export interface TabRowProps {
  /** Ordered list of tabs to render. */
  tabs: TabRowTab[];
  /** ID of the currently selected tab. */
  activeTabId: string;
  /** Called when the user clicks a tab. */
  onTabChange: (tabId: string) => void;
  /** Additional class applied to the container element. */
  className?: string;
  /** Class applied to an active tab button. Defaults to `'text-primary'`. */
  activeTabClassName?: string;
  /** Class applied to an inactive tab button. Defaults to `'text-secondary hover:text-primary border-transparent'`. */
  inactiveTabClassName?: string;
  /** Class applied to the badge when the tab is active. Defaults to `'bg-accent-primary-alpha text-accent-primary'`. */
  activeBadgeClassName?: string;
  /** Class applied to the badge when the tab is inactive. Defaults to `'bg-layer-3 text-tertiary'`. */
  inactiveBadgeClassName?: string;
  /** Class applied to the tab label text. Defaults to `'dial-small-semi-text'`. */
  tabLabelClassName?: string;
  /** Class applied to the badge text. Defaults to `'dial-tiny-semi-text'`. */
  badgeLabelClassName?: string;
}

/** Tab row with gradient underline on the active tab and optional count badges. */
export const TabRow: FC<TabRowProps> = ({
  tabs,
  activeTabId,
  onTabChange,
  className,
  activeTabClassName = 'text-primary',
  inactiveTabClassName = 'text-secondary hover:text-primary border-transparent',
  activeBadgeClassName = 'bg-accent-primary-alpha text-accent-primary',
  inactiveBadgeClassName = 'bg-layer-3 text-tertiary',
  tabLabelClassName = 'dial-small-semi-text',
  badgeLabelClassName = 'dial-tiny-semi-text',
}) => (
  <div
    role="tablist"
    className={mergeClasses(
      'flex justify-start gap-1 border-b',
      styles.tabsRow,
      className,
    )}
  >
    {tabs.map((tab) => {
      const isActive = activeTabId === tab.id;
      return (
        <button
          key={tab.id}
          role="tab"
          aria-selected={isActive}
          onClick={() => onTabChange(tab.id)}
          // Inline style guarantees this wins over the Tailwind preflight
          // reset (`border-color: currentcolor`) regardless of stylesheet
          // cascade/load order — a plain CSS-module class rule proved
          // unreliable here across dev-server rebuilds.
          style={
            isActive
              ? { borderBottomColor: 'var(--stroke-accent-primary, #7da4ff)' }
              : undefined
          }
          className={mergeClasses(
            tabLabelClassName,
            '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-start transition-colors',
            isActive
              ? mergeClasses(styles.activeTab, activeTabClassName)
              : inactiveTabClassName,
          )}
        >
          <span>{tab.label}</span>
          {tab.count != null && (
            <span
              className={mergeClasses(
                badgeLabelClassName,
                'rounded-full px-1.5 py-0.5',
                isActive ? activeBadgeClassName : inactiveBadgeClassName,
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);
