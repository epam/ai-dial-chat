import type { BrowseSettingsSheetLabels } from '../models/toolbar-props';

/** English defaults for the mobile browse-settings sheet. */
export const DEFAULT_BROWSE_SETTINGS_LABELS: BrowseSettingsSheetLabels = {
  title: 'Browse settings',
  view: 'View',
  sorting: 'Sorting',
  filtering: 'Filtering',
  gridView: 'Cards',
  listView: 'List',
  myApps: 'My',
  topics: 'Topics',
  clear: 'Clear',
  apply: 'Apply',
  back: 'Back',
  close: 'Close',
  formatFilterCount: (selected, total) => `${selected} of ${total}`,
};
