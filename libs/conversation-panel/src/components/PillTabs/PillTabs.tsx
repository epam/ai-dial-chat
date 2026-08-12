import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialTag } from '@epam/ai-dial-ui-kit';
import { type FC, memo } from 'react';
import styles from './PillTabs.module.scss';

/** A single tab entry rendered by {@link PillTabs}. */
export interface PillTab {
  /** Unique identifier used to match against `activeTabId`. */
  id: string;
  /** Visible label text for the pill. */
  label: string;
}

/** Typography overrides for the {@link PillTabs} component. */
export interface PillTabsTypography {
  /** Typography class applied to each tab label. Defaults to `'dial-tiny-semi-text'`. */
  tabClassName?: string;
}

/** Color overrides for the {@link PillTabs} component, applied as CSS custom properties. */
export interface PillTabsColors {
  /** Label color of an inactive tab. Defaults to `--text-tertiary`. */
  tabText?: string;
  /** Label color of a tab on hover. Defaults to `--text-secondary`. */
  tabTextHover?: string;
  /** Label color of the active tab. Defaults to `--text-secondary`. */
  activeTabText?: string;
}

/** Style overrides for the {@link PillTabs} component. */
export interface PillTabsStyles {
  /** Typography overrides for the tab label. */
  typography?: PillTabsTypography;
  /** Color overrides applied as CSS custom properties. */
  colors?: PillTabsColors;
}

/** Props for the {@link PillTabs} component. */
export interface PillTabsProps {
  /** Ordered list of tabs to render. */
  tabs: PillTab[];
  /** ID of the currently selected tab. */
  activeTabId: string;
  /** Called when the user clicks a tab. */
  onTabChange: (tabId: string) => void;
  /** Style overrides. */
  styles?: PillTabsStyles;
}

/** Segmented pill-tab control, e.g. the conversation panel's chat-source filter. */
export const PillTabs: FC<PillTabsProps> = memo(
  ({ tabs, activeTabId, onTabChange, styles: pillTabsStyles }) => {
    const { tabClassName = 'dial-tiny-semi-text' } =
      pillTabsStyles?.typography ?? {};
    const cssVars = buildCssVars({
      '--pt-tab-text': pillTabsStyles?.colors?.tabText,
      '--pt-tab-text-hover': pillTabsStyles?.colors?.tabTextHover,
      '--pt-tab-active-text': pillTabsStyles?.colors?.activeTabText,
    });

    return (
      <div className="flex flex-nowrap gap-1" role="tablist" style={cssVars}>
        {tabs.map((tab) => {
          const isActive = activeTabId === tab.id;
          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              className="contents"
            >
              <DialTag
                label={tab.label}
                selected={isActive}
                onClick={() => onTabChange(tab.id)}
                className={mergeClasses(
                  'box-border h-auto shrink-0 justify-center rounded-full p-2 text-center',
                  tabClassName,
                  styles.tabContainer,
                  isActive && styles.tabActive,
                )}
              />
            </div>
          );
        })}
      </div>
    );
  },
);
