import {
  DialFileManagerTabs,
  type ToolbarOptions,
} from '@epam/ai-dial-react-file-manager';
import type { TabModel } from '@epam/ai-dial-ui-kit';
import { useCallback, useEffect, useMemo } from 'react';

/** Values returned by `useDialFileManagerTabConfig`. */
export interface UseDialFileManagerTabConfigResult {
  tabs: ToolbarOptions['tabs'];
}

/*
 * Both DialFileManagerModal and DialFileManagerPage need identical tab-filtering and
 * active-tab-reset behavior, so this hook owns both instead of duplicating the reset
 * useEffect (with its dependency array and priority logic) in each host.
 */
const TAB_PRIORITY_ORDER = [
  DialFileManagerTabs.MyFiles,
  DialFileManagerTabs.Shared,
  DialFileManagerTabs.Organization,
];

/**
 * Filters the file-manager's tab list down to the host's configured set and
 * resets `activeTab` to the highest-priority still-enabled tab when the
 * current one becomes excluded. A `fileManagerTabs` of `undefined` means no
 * restriction — every tab in `allTabs` stays enabled and no reset ever fires.
 */
export const useDialFileManagerTabConfig = (
  activeTab: DialFileManagerTabs,
  onTabChange: (tab: DialFileManagerTabs) => void,
  allTabs: TabModel[] | undefined,
  fileManagerTabs: string[] | undefined,
): UseDialFileManagerTabConfigResult => {
  const isTabEnabled = useCallback(
    (tabId: string): boolean =>
      fileManagerTabs == null || fileManagerTabs.includes(tabId),
    [fileManagerTabs],
  );

  const tabs = useMemo(
    () =>
      allTabs
        ?.filter((tab) => isTabEnabled(tab.id))
        .flatMap(({ id, label, disabled }) =>
          typeof label === 'string' ? [{ id, label, disabled }] : [],
        ),
    [allTabs, isTabEnabled],
  );

  useEffect(() => {
    if (isTabEnabled(activeTab)) return;

    const fallbackTab =
      TAB_PRIORITY_ORDER.find((tab) => isTabEnabled(tab)) ??
      DialFileManagerTabs.MyFiles;

    onTabChange(fallbackTab);
  }, [isTabEnabled, activeTab, onTabChange]);

  return { tabs };
};
