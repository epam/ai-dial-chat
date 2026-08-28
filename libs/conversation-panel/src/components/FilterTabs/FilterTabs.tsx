import { FilterTab } from '@epam/ai-dial-chat-shared';
import { Tag, TagAppearance, mergeClasses } from '@epam/ai-dial-ui-kit';
import { type FC, memo } from 'react';
import { type FilterLabels } from '../../models/panel-props';

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
}

/** Keys of `FilterLabels` that name a tab (i.e. all but the group's own label). */
type FilterTabLabelKey = Exclude<keyof FilterLabels, 'groupAriaLabel'>;

const TABS: { value: FilterTab; labelKey: FilterTabLabelKey }[] = [
  { value: FilterTab.All, labelKey: 'all' },
  { value: FilterTab.MyChats, labelKey: 'myChats' },
  { value: FilterTab.Shared, labelKey: 'shared' },
  { value: FilterTab.Organization, labelKey: 'organization' },
];

/**
 * Row of selectable filter chips for filtering conversations by source.
 */
export const FilterTabs: FC<FilterTabsProps> = memo(
  ({ activeTab, labels, onChange, tabClassName = 'dial-tiny-semi-text' }) => (
    <div
      role="group"
      aria-label={labels.groupAriaLabel ?? 'Filter chats'}
      className="flex flex-nowrap gap-1 px-3 py-2"
    >
      {TABS.map(({ value, labelKey }) => (
        <Tag
          key={value}
          label={labels[labelKey]}
          appearance={TagAppearance.Selectable}
          selected={activeTab === value}
          onClick={() => onChange(value)}
          className={mergeClasses(
            /* The filter row splits its width evenly and keeps the pill silhouette. */
            'flex-1 justify-center rounded-full',
            tabClassName,
          )}
        />
      ))}
    </div>
  ),
);
