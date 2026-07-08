import { PillTabs } from '@epam/ai-dial-kit';
import { type FC, memo } from 'react';
import { type FilterLabels } from '../../models/panel-props';
import { FilterTab } from '../../types/filter-tab';

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
  ({ activeTab, labels, onChange, tabClassName }) => (
    <div className="mx-3 my-2">
      <PillTabs
        tabs={TABS.map(({ value, labelKey }) => ({
          id: value,
          label: labels[labelKey],
        }))}
        activeTabId={activeTab}
        onTabChange={(id: string) => onChange(id as FilterTab)}
        tabClassName={tabClassName}
      />
    </div>
  ),
);
