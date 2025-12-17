import { useMemo } from 'react';

import { TranslationOptions } from '@/src/types/translation';

import {
  DialFileManagerActions,
  DialFileManagerTabs,
} from '@epam/ai-dial-ui-kit';

type TranslationFn = (key: string, options?: TranslationOptions) => string;

const ACTION_LABELS = {
  duplicate: (t: TranslationFn) => t('Duplicate'),
  copy: (t: TranslationFn) => t('Copy to'),
  move: (t: TranslationFn) => t('Move to'),
  delete: (t: TranslationFn) => t('Delete'),
  download: (t: TranslationFn) => t('Download'),
  rename: (t: TranslationFn) => t('Rename'),
  unshare: (t: TranslationFn) => t('Unshare'),
  info: (t: TranslationFn) => t('Info'),
} as const;

type FileAction = keyof typeof ACTION_LABELS;

const TAB_ACTIONS: Record<DialFileManagerTabs, FileAction[]> = {
  my_files: [
    DialFileManagerActions.Duplicate,
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
    DialFileManagerActions.Info,
  ],
  organization: [DialFileManagerActions.Download, DialFileManagerActions.Info],
};

const buildLabelMap = (actions: FileAction[], t: TranslationFn) =>
  Object.fromEntries(actions.map((a) => [a, ACTION_LABELS[a](t)]));

/**
 * Returns translated action label maps for bulk, grid, and tree views.
 */
export function useFileManagerActionLabels(
  activeTab: DialFileManagerTabs,
  t: TranslationFn,
) {
  const baseActions = useMemo<FileAction[]>(
    () => TAB_ACTIONS[activeTab],
    [activeTab],
  );

  const bulkActionLabels = useMemo(
    () => buildLabelMap(baseActions, t),
    [baseActions, t],
  );

  const gridActionLabels = bulkActionLabels;

  const treeActions = useMemo<FileAction[]>(
    () =>
      activeTab === DialFileManagerTabs.MyFiles
        ? [...baseActions, 'rename']
        : baseActions,
    [activeTab, baseActions],
  );

  const treeActionLabels = useMemo(
    () => buildLabelMap(treeActions, t),
    [treeActions, t],
  );

  return { bulkActionLabels, gridActionLabels, treeActionLabels };
}
