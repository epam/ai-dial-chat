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

/** Color overrides for the {@link TabRow} component. */
export interface TabRowColors {
  /** Class applied to an active tab button. Defaults to `'text-primary'`. */
  activeTabClassName?: string;
  /** Class applied to an inactive tab button. Defaults to `'text-secondary hover:text-primary border-transparent'`. */
  inactiveTabClassName?: string;
  /** Class applied to the badge when the tab is active. Defaults to `'bg-accent-primary-alpha text-accent-primary'`. */
  activeBadgeClassName?: string;
  /** Class applied to the badge when the tab is inactive. Defaults to `'bg-layer-raised text-tertiary'`. */
  inactiveBadgeClassName?: string;
}

/** Typography overrides for the {@link TabRow} component. */
export interface TabRowTypography {
  /** Class applied to the tab label text. Defaults to `'dial-small-semi-text'`. */
  tabLabelClassName?: string;
  /** Class applied to the badge text. Defaults to `'dial-tiny-semi-text'`. */
  badgeLabelClassName?: string;
}

/** Style overrides for the {@link TabRow} component. */
export interface TabRowStyles {
  /** Additional class applied to the container element. */
  className?: string;
  /** Color overrides for the tab/badge classes. */
  colors?: TabRowColors;
  /** Typography overrides for the tab/badge label text. */
  typography?: TabRowTypography;
}

/** Props for the {@link TabRow} component. */
export interface TabRowProps {
  /** Ordered list of tabs to render. */
  tabs: TabRowTab[];
  /** ID of the currently selected tab. */
  activeTabId: string;
  /** Called when the user clicks a tab. */
  onTabChange: (tabId: string) => void;
  /** Style overrides. */
  styles?: TabRowStyles;
}

/** Tab row with gradient underline on the active tab and optional count badges. */
export const TabRow: FC<TabRowProps> = ({
  tabs,
  activeTabId,
  onTabChange,
  styles: tabRowStyles,
}) => {
  const { className, colors, typography } = tabRowStyles ?? {};
  const {
    activeTabClassName = 'text-primary',
    inactiveTabClassName = 'text-secondary hover:text-primary border-transparent',
    activeBadgeClassName = 'bg-accent-primary-alpha text-accent-primary',
    inactiveBadgeClassName = 'bg-layer-raised text-tertiary',
  } = colors ?? {};
  const {
    tabLabelClassName = 'dial-small-semi-text',
    badgeLabelClassName = 'dial-tiny-semi-text',
  } = typography ?? {};

  return (
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
};
