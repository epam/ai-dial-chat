import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
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

/** Color overrides for the {@link TabRow} component, applied as CSS custom properties. */
export interface TabRowColors {
  /** Bottom border color of the tab row. Defaults to `--stroke-tertiary`. */
  rowBorder?: string;
  /** Underline color of the active tab. Defaults to `--stroke-info`. */
  activeTabBorder?: string;
  /** Label color of the active tab. Defaults to `--text-primary`. */
  activeTabText?: string;
  /** Label color of an inactive tab. Defaults to `--text-secondary`. */
  inactiveTabText?: string;
  /** Label color of an inactive tab on hover/focus. Defaults to `--text-primary`. */
  inactiveTabTextHover?: string;
  /** Background color of the badge on an active tab. Defaults to `--bg-accent-primary-alpha`. */
  activeBadgeBackground?: string;
  /** Text color of the badge on an active tab. Defaults to `--text-accent`. */
  activeBadgeText?: string;
  /** Background color of the badge on an inactive tab. Defaults to `--bg-layer-raised`. */
  inactiveBadgeBackground?: string;
  /** Text color of the badge on an inactive tab. Defaults to `--text-tertiary`. */
  inactiveBadgeText?: string;
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
    tabLabelClassName = 'dial-small-semi-text',
    badgeLabelClassName = 'dial-tiny-semi-text',
  } = typography ?? {};

  const cssVars = buildCssVars({
    '--tr-row-border': colors?.rowBorder,
    '--tr-active-tab-border': colors?.activeTabBorder,
    '--tr-active-tab-text': colors?.activeTabText,
    '--tr-inactive-tab-text': colors?.inactiveTabText,
    '--tr-inactive-tab-text-hover': colors?.inactiveTabTextHover,
    '--tr-active-badge-bg': colors?.activeBadgeBackground,
    '--tr-active-badge-text': colors?.activeBadgeText,
    '--tr-inactive-badge-bg': colors?.inactiveBadgeBackground,
    '--tr-inactive-badge-text': colors?.inactiveBadgeText,
  });

  return (
    <div
      role="tablist"
      style={cssVars}
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
                ? styles.activeTab
                : mergeClasses('border-transparent', styles.inactiveTab),
            )}
          >
            <span>{tab.label}</span>
            {tab.count != null && (
              <span
                className={mergeClasses(
                  badgeLabelClassName,
                  'rounded-full px-1.5 py-0.5',
                  isActive ? styles.activeBadge : styles.inactiveBadge,
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
