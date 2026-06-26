import { useMemo } from 'react';

import { TranslationOptions } from '@/src/types/translation';

import { SideBarI18nKeys } from '@/src/constants/i18n';

import {
  DialFileManagerActions,
  DialFileManagerTabs,
} from '@epam/ai-dial-ui-kit';

type TranslationFn = (key: string, options?: TranslationOptions) => string;

const ACTION_LABELS = {
  duplicate: (t: TranslationFn) => t(SideBarI18nKeys.Duplicate),
  copy: (t: TranslationFn) => t(SideBarI18nKeys.CopyTo),
  move: (t: TranslationFn) => t(SideBarI18nKeys.MoveTo),
  delete: (t: TranslationFn) => t(SideBarI18nKeys.Delete),
  download: (t: TranslationFn) => t(SideBarI18nKeys.Download),
  rename: (t: TranslationFn) => t(SideBarI18nKeys.Rename),
  unshare: (t: TranslationFn) => t(SideBarI18nKeys.Unshare),
  info: (t: TranslationFn) => t(SideBarI18nKeys.Info),
  removeAccess: (t: TranslationFn) => t(SideBarI18nKeys.RemoveAccess),
} as const;

type FileAction = keyof typeof ACTION_LABELS;

type ActionsByTab = Record<DialFileManagerTabs, FileAction[]>;

const DEFAULT_TAB_ACTIONS: ActionsByTab = {
  my_files: [
    DialFileManagerActions.Duplicate,
    DialFileManagerActions.RemoveAccess,
    DialFileManagerActions.Copy,
    DialFileManagerActions.Move,
    DialFileManagerActions.Delete,
    DialFileManagerActions.Download,
    DialFileManagerActions.Rename,
    DialFileManagerActions.Info,
  ],
  shared: [
    DialFileManagerActions.Download,
    DialFileManagerActions.Unshare,
    DialFileManagerActions.Delete,
    DialFileManagerActions.Info,
  ],
  organization: [DialFileManagerActions.Download, DialFileManagerActions.Info],
  review: [DialFileManagerActions.Download, DialFileManagerActions.Info],
};

const buildLabelMap = (actions: FileAction[], t: TranslationFn) =>
  Object.fromEntries(actions.map((a) => [a, ACTION_LABELS[a](t)]));

export interface UseFileManagerActionLabelsOptions {
  actionsByTab?: ActionsByTab;
  withTreeRename?: boolean;
}

/**
 * Returns translated action label maps for bulk, grid, and tree views.
 */
export function useFileManagerActionLabels(
  activeTab: DialFileManagerTabs,
  t: TranslationFn,
  {
    actionsByTab = DEFAULT_TAB_ACTIONS,
    withTreeRename = true,
  }: UseFileManagerActionLabelsOptions = {},
) {
  const baseActions = useMemo<FileAction[]>(
    () => actionsByTab[activeTab] ?? [],
    [actionsByTab, activeTab],
  );

  const bulkActionLabels = useMemo(
    () => buildLabelMap(baseActions, t),
    [baseActions, t],
  );

  const gridActionLabels = bulkActionLabels;

  const treeActions = useMemo<FileAction[]>(
    () =>
      withTreeRename && activeTab === DialFileManagerTabs.MyFiles
        ? [...baseActions, DialFileManagerActions.Rename]
        : baseActions,
    [withTreeRename, activeTab, baseActions],
  );

  const treeActionLabels = useMemo(
    () => buildLabelMap(treeActions, t),
    [treeActions, t],
  );

  return {
    bulkActionLabels,
    gridActionLabels,
    treeActionLabels,
  };
}
