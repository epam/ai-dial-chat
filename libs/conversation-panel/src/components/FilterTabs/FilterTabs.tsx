import { mergeClasses } from '@epam/ai-dial-ui-kit';
import { type FC, memo } from 'react';
import { type FilterLabels } from '../../models/panel-props';
import { FilterTab } from '../../types/conversation-classification';
import { PillTabs, type PillTabsColors } from '../PillTabs/PillTabs';

/** Props for `FilterTabs`. */
export interface FilterTabsProps {
  /** Currently active tab. */
  activeTab: FilterTab;
  /** Display labels for each tab (provided by the app for i18n). */
  labels: FilterLabels;
  /** Called when the user selects a different tab. */
  onChange: (tab: FilterTab) => void;
  /** Class applied to each tab. Defaults to `'dial-tiny-semi-text'`. */
  tabClassName?: string;
  /** Color overrides forwarded to the underlying pill tabs. */
  colors?: PillTabsColors;
}

const TABS: { value: FilterTab; labelKey: keyof FilterLabels }[] = [
  { value: FilterTab.All, labelKey: 'all' },
  { value: FilterTab.MyChats, labelKey: 'myChats' },
  { value: FilterTab.Shared, labelKey: 'shared' },
  { value: FilterTab.Organization, labelKey: 'organization' },
];

/** Segmented pill-tab control for filtering conversations by source. */
export const FilterTabs: FC<FilterTabsProps> = memo(
  ({
    activeTab,
    labels,
    onChange,
    tabClassName = 'dial-tiny-semi-text',
    colors,
  }) => (
    <div className="px-3 py-2">
      <PillTabs
        tabs={TABS.map(({ value, labelKey }) => ({
          id: value,
          label: labels[labelKey],
        }))}
        activeTabId={activeTab}
        onTabChange={(id: string) => onChange(id as FilterTab)}
        styles={{
          typography: {
            tabClassName: mergeClasses(tabClassName, 'flex-1'),
          },
          colors,
        }}
      />
    </div>
  ),
);
