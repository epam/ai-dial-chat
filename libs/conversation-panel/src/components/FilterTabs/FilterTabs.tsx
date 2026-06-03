import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialTag } from '@epam/ai-dial-ui-kit';
import { type FC, memo } from 'react';
import {
  FilterTab,
  type FilterLabels,
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
  /** Typography class applied to each tab label. Defaults to `'dial-tiny-semi-text'`. */
  tabClassName?: string;
  /** Text color class applied to each tab label. Defaults to `'text-primary'`. */
  tabColorClassName?: string;
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
    tabColorClassName = 'text-primary',
  }) => (
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
          className={mergeClasses(
            'border border-primary px-2 py-1',
            tabClassName,
            tabColorClassName,
            activeTab === value &&
              'border-accent-secondary bg-accent-secondary-alpha',
          )}
        />
      ))}
    </div>
  ),
);
