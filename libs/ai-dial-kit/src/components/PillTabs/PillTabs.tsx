import { mergeClasses } from '@epam/ai-dial-chat-shared';
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

/** Props for the {@link PillTabs} component. */
export interface PillTabsProps {
  /** Ordered list of tabs to render. */
  tabs: PillTab[];
  /** ID of the currently selected tab. */
  activeTabId: string;
  /** Called when the user clicks a tab. */
  onTabChange: (tabId: string) => void;
  /** Typography class applied to each tab label. Defaults to `'dial-tiny-semi-text'`. */
  tabClassName?: string;
}

/** Segmented pill-tab control, e.g. the conversation panel's chat-source filter. */
export const PillTabs: FC<PillTabsProps> = memo(
  ({
    tabs,
    activeTabId,
    onTabChange,
    tabClassName = 'dial-tiny-semi-text',
  }) => (
    <div className="flex flex-nowrap gap-1">
      {tabs.map((tab) => {
        const isActive = activeTabId === tab.id;
        return (
          <DialTag
            key={tab.id}
            label={tab.label}
            selected={isActive}
            onClick={() => onTabChange(tab.id)}
            className={mergeClasses(
              'box-border h-auto shrink-0 justify-center rounded-full p-2 text-center',
              tabClassName,
              styles.tab,
              isActive && styles.tabActive,
            )}
          />
        );
      })}
    </div>
  ),
);
