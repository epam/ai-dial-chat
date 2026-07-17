import { DialFileManagerTabs, type TabModel } from '@epam/ai-dial-ui-kit';
import { useEffect, useMemo } from 'react';
import { useAppConfig } from '../../context/AppConfigContext';

export interface UseDialFileManagerTabConfigResult {
  tabs: TabModel[] | undefined;
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

export const useDialFileManagerTabConfig = (
  activeTab: DialFileManagerTabs,
  onTabChange: (tab: DialFileManagerTabs) => void,
  allTabs: TabModel[] | undefined,
): UseDialFileManagerTabConfigResult => {
  const {
    config: { fileManagerTabs },
  } = useAppConfig();

  const tabs = useMemo(
    () => allTabs?.filter((tab) => fileManagerTabs.includes(tab.id)),
    [allTabs, fileManagerTabs],
  );

  useEffect(() => {
    if (fileManagerTabs.includes(activeTab)) return;

    const fallbackTab =
      TAB_PRIORITY_ORDER.find((tab) => fileManagerTabs.includes(tab)) ??
      DialFileManagerTabs.MyFiles;

    onTabChange(fallbackTab);
  }, [fileManagerTabs, activeTab, onTabChange]);

  return { tabs };
};
