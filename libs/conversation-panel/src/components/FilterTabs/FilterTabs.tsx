import { DialRoundedButton } from '@epam/ai-dial-ui-kit';
import { type FC, memo } from 'react';
import {
  ConversationSource,
  type FilterLabels,
  type FilterTab,
} from '../../models/ConversationPanel.js';

/** Props for `FilterTabs`. */
export interface FilterTabsProps {
  /** Currently active tab. */
  activeTab: FilterTab;
  /** Display labels for each tab (provided by the app for i18n). */
  labels: FilterLabels;
  /** Called when the user selects a different tab. */
  onChange: (tab: FilterTab) => void;
}

const TABS: { value: FilterTab; labelKey: keyof FilterLabels }[] = [
  { value: 'all', labelKey: 'all' },
  { value: ConversationSource.MyChats, labelKey: 'myChats' },
  { value: ConversationSource.Shared, labelKey: 'shared' },
  { value: ConversationSource.Organization, labelKey: 'organization' },
];

/** Segmented pill-tab control for filtering conversations by source. */
export const FilterTabs: FC<FilterTabsProps> = memo(
  ({ activeTab, labels, onChange }) => (
    <div role="tablist" className="flex flex-wrap gap-1 px-2 pb-2">
      {TABS.map(({ value, labelKey }) => (
        <DialRoundedButton
          key={value}
          label={labels[labelKey]}
          selected={activeTab === value}
          role="tab"
          aria-selected={activeTab === value}
          onClick={() => onChange(value)}
        />
      ))}
    </div>
  ),
);
