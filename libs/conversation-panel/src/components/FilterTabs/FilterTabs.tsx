import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialTag } from '@epam/ai-dial-ui-kit';
import { type FC, memo } from 'react';
import { type FilterLabels } from '../../models/panel-props';
import { FilterTab } from '../../types/filter-tab';
import styles from './FilterTabs.module.scss';

/** Props for `FilterTabs`. */
export interface FilterTabsProps {
  /** Currently active tab. */
  activeTab: FilterTab;
  /** Display labels for each tab (provided by the app for i18n). */
  labels: FilterLabels;
  /** Called when the user selects a different tab. */
  onChange: (tab: FilterTab) => void;
  /** Typography class applied to each tab label. Defaults to `'dial-tiny-semi-text'`. */
  tabClassName?: string;
}

const TABS: { value: FilterTab; labelKey: keyof FilterLabels }[] = [
  { value: FilterTab.All, labelKey: 'all' },
  { value: FilterTab.MyChats, labelKey: 'myChats' },
  { value: FilterTab.Shared, labelKey: 'shared' },
  { value: FilterTab.Organization, labelKey: 'organization' },
];

/** Segmented pill-tab control for filtering conversations by source. */
export const FilterTabs: FC<FilterTabsProps> = memo(
  ({ activeTab, labels, onChange, tabClassName = 'dial-tiny-semi-text' }) => (
    <div
      className={mergeClasses(
        'mx-3 my-2 flex flex-nowrap gap-1',
        styles.filterTabs,
      )}
    >
      {TABS.map(({ value, labelKey }) => (
        <DialTag
          key={value}
          label={labels[labelKey]}
          selected={activeTab === value}
          onClick={() => onChange(value)}
          className={mergeClasses(
            'box-border h-auto flex-1 justify-center rounded-full p-2 text-center',
            tabClassName,
            styles.tab,
            activeTab === value && styles.tabActive,
          )}
        />
      ))}
    </div>
  ),
);
