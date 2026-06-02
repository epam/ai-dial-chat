import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialTag } from '@epam/ai-dial-ui-kit';
import { type FC, memo } from 'react';
import {
  ConversationSource,
  type FilterLabels,
  type FilterTab,
} from '../../models/ConversationPanel.js';
import panelStyles from '../ConversationPanel/ConversationPanel.module.scss';

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
    <div
      className={mergeClasses(
        'flex flex-wrap gap-2 border-b px-5 py-3',
        panelStyles.divider,
      )}
    >
      {TABS.map(({ value, labelKey }) => (
        <DialTag
          key={value}
          label={labels[labelKey]}
          selected={activeTab === value}
          onClick={() => onChange(value)}
        />
      ))}
    </div>
  ),
);
