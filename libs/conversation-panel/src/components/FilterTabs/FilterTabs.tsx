import { FilterTab } from '@epam/ai-dial-chat-shared';
import {
  FilterChips,
  type FilterChipItem,
  mergeClasses,
} from '@epam/ai-dial-ui-kit';
import { type FC, memo, useMemo } from 'react';
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
  /** Tab values to omit from the row entirely (see `ConversationPanelProps.hiddenSources`). */
  hiddenSources?: FilterTab[];
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
 *
 * The chips themselves come from the ui kit's `FilterChips`; this component
 * only maps the panel's conversation vocabulary onto it — `FilterTab` values,
 * the host's `FilterLabels`, and `hiddenSources` as an exclusion list rather
 * than a prop the kit has to know about.
 */
export const FilterTabs: FC<FilterTabsProps> = memo(
  ({
    activeTab,
    labels,
    onChange,
    tabClassName = 'dial-tiny-semi-text',
    hiddenSources,
  }) => {
    const items = useMemo<FilterChipItem<FilterTab>[]>(
      () =>
        TABS.filter(({ value }) => !hiddenSources?.includes(value)).map(
          ({ value, labelKey }) => ({ value, label: labels[labelKey] }),
        ),
      [labels, hiddenSources],
    );

    return (
      <FilterChips
        items={items}
        value={activeTab}
        onChange={onChange}
        stretch
        aria-label={labels.groupAriaLabel ?? 'Filter chats'}
        className="px-3 py-2"
        /* !px-2 overrides the chip's own px-3 to fit four tabs in the panel */
        chipClassName={mergeClasses('!px-2', tabClassName)}
      />
    );
  },
);
