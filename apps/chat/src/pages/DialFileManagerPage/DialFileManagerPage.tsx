import {
  DialFileManagerTabs,
  useDialFileManagerTabs,
} from '@epam/ai-dial-ui-kit';
import { memo, useCallback, useMemo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import DialFileManagerShell from '../../components/DialFileManagerShell/DialFileManagerShell';
import type { DialFileManagerShellLabels } from '../../components/DialFileManagerShell/types/labels';
import {
  ButtonsI18nKeys,
  DialFileManagerI18nKeys,
} from '../../constants/translation-keys';
import { useUser } from '../../context/auth/UserContext';
import { useNotification } from '../../context/NotificationContext';
import { useDialFileManager } from '../../hooks/files/useDialFileManager';
import {
  DialFileManagerActionProfile,
  DialFileManagerVariant,
} from '../../types/file-manager-variant';

const DialFileManagerPage: FC = () => {
  const { t } = useTranslation();
  const { showNotification } = useNotification();
  const { user } = useUser();
  // bucket is the authenticated user's DIAL Core storage bucket from their profile
  const bucket = user?.bucket ?? '';

  const tabLabels = useMemo(
    () => ({
      [DialFileManagerTabs.MyFiles]: t(DialFileManagerI18nKeys.TabMyFiles),
      [DialFileManagerTabs.Shared]: t(DialFileManagerI18nKeys.TabShared),
      [DialFileManagerTabs.Organization]: t(
        DialFileManagerI18nKeys.TabOrganization,
      ),
      [DialFileManagerTabs.Review]: '',
    }),
    [t],
  );

  const {
    activeTab,
    handleTabChange,
    tabs: allTabs,
  } = useDialFileManagerTabs(tabLabels, DialFileManagerTabs.MyFiles);

  const rootLabel =
    tabLabels[activeTab] || tabLabels[DialFileManagerTabs.MyFiles];

  const tabs = useMemo(
    () => allTabs?.filter((tab) => tab.id !== DialFileManagerTabs.Review),
    [allTabs],
  );

  const hookResult = useDialFileManager({
    bucket,
    activeTab,
    rootLabel,
    onNotification: showNotification,
    variant: DialFileManagerVariant.Standalone,
    actionProfile: DialFileManagerActionProfile.Browse,
  });

  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(
    () => new Set(),
  );

  const handleTabChangeWithReset = useCallback(
    (tab: DialFileManagerTabs) => {
      setSelectedPaths(new Set());
      handleTabChange(tab);
    },
    [handleTabChange],
  );

  const emptyStateByTab = useMemo(
    () => ({
      [DialFileManagerTabs.MyFiles]: {
        title: t(DialFileManagerI18nKeys.MyFilesEmptyStateTitle),
        description: t(DialFileManagerI18nKeys.MyFilesEmptyStateDescription),
      },
      [DialFileManagerTabs.Shared]: {
        title: t(DialFileManagerI18nKeys.SharedEmptyStateTitle),
        description: t(DialFileManagerI18nKeys.SharedEmptyStateDescription),
      },
      [DialFileManagerTabs.Organization]: {
        title: t(DialFileManagerI18nKeys.OrganizationEmptyStateTitle),
        description: t(
          DialFileManagerI18nKeys.OrganizationEmptyStateDescription,
        ),
      },
      [DialFileManagerTabs.Review]: { title: '', description: '' },
    }),
    [t],
  );

  const treeHeaderByTab: Record<DialFileManagerTabs, string> = useMemo(
    () => ({
      [DialFileManagerTabs.MyFiles]: t(
        DialFileManagerI18nKeys.MyFilesTreeHeader,
      ),
      [DialFileManagerTabs.Shared]: t(DialFileManagerI18nKeys.SharedTreeHeader),
      [DialFileManagerTabs.Organization]: t(
        DialFileManagerI18nKeys.OrganizationTreeHeader,
      ),
      [DialFileManagerTabs.Review]: '',
    }),
    [t],
  );

  const renameValidationMessages = useMemo(
    () => ({
      emptyName: t(DialFileManagerI18nKeys.RenameNameEmpty),
      duplicateName: t(DialFileManagerI18nKeys.RenameDuplicateName),
    }),
    [t],
  );

  const conflictResolutionPopupOptions = useMemo(
    () => ({
      singleFileTitle: t(DialFileManagerI18nKeys.ConflictSingleTitle),
      multipleFilesTitle: t(DialFileManagerI18nKeys.ConflictMultipleTitle),
      actionLabels: {
        replace: t(DialFileManagerI18nKeys.ConflictReplace),
        duplicate: t(DialFileManagerI18nKeys.ConflictDuplicate),
        cancel: t(ButtonsI18nKeys.Cancel),
      },
      strategyLabels: {
        replaceAll: t(DialFileManagerI18nKeys.ConflictReplaceAll),
        duplicateAll: t(DialFileManagerI18nKeys.ConflictDuplicateAll),
        decideForEach: t(DialFileManagerI18nKeys.ConflictDecideForEach),
      },
      confirmLabel: t(ButtonsI18nKeys.Confirm),
      cancelLabel: t(ButtonsI18nKeys.Cancel),
    }),
    [t],
  );

  const labels: DialFileManagerShellLabels = useMemo(
    () => ({
      errorMessage: t(DialFileManagerI18nKeys.Error),
      retryLabel: t(DialFileManagerI18nKeys.Retry),
      hiddenFilesLabel: t(DialFileManagerI18nKeys.HiddenFiles),
      showHiddenFilesLabel: t(DialFileManagerI18nKeys.ShowHiddenFiles),
      hideHiddenFilesLabel: t(DialFileManagerI18nKeys.HideHiddenFiles),
      getSelectionLabel: (count) =>
        t(DialFileManagerI18nKeys.ItemsSelected, { count }),
      uploadFilesLabel: t(DialFileManagerI18nKeys.Upload),
      newFolderLabel: t(DialFileManagerI18nKeys.NewFolder),
      downloadLabel: t(DialFileManagerI18nKeys.Download),
      downloadingLabel: t(DialFileManagerI18nKeys.Downloading),
      deleteLabel: t(DialFileManagerI18nKeys.DeleteAction),
      deletingLabel: t(DialFileManagerI18nKeys.DeletingLabel),
      renameLabel: t(DialFileManagerI18nKeys.RenameAction),
      renamingLabel: t(DialFileManagerI18nKeys.RenamingLabel),
      deleteConfirmTitle: (names) =>
        names.length === 1
          ? t(DialFileManagerI18nKeys.DeleteConfirmTitleSingle)
          : t(DialFileManagerI18nKeys.DeleteConfirmTitleMultiple),
      deleteConfirmBody: (names) => (
        <div className="px-6 py-3 text-sm">
          <p className="mb-3 text-secondary">
            {names.length === 1 ? (
              <>
                {t(DialFileManagerI18nKeys.DeleteConfirmBodySingle)}{' '}
                <span className="break-all text-primary">
                  &quot;{names[0].split('/').pop()}&quot;?
                </span>
              </>
            ) : (
              <>
                {t(DialFileManagerI18nKeys.DeleteConfirmBodyMultiple)}{' '}
                <span className="text-primary">
                  {names.length}{' '}
                  {t(DialFileManagerI18nKeys.DeleteConfirmBodyItems)}
                </span>
              </>
            )}
          </p>
        </div>
      ),
      deleteConfirmLabel: t(DialFileManagerI18nKeys.DeleteConfirmButton),
      deleteCancelLabel: t(ButtonsI18nKeys.Cancel),
      uploadProgressTitle: t(DialFileManagerI18nKeys.UploadProgressTitle),
      cancelLabel: t(ButtonsI18nKeys.Cancel),
      getUploadProgressText: (done, total) =>
        t(DialFileManagerI18nKeys.UploadProgressSummary, { done, total }),
      searchEmptyStateTitle: t(DialFileManagerI18nKeys.SearchEmptyStateTitle),
      forbiddenSymbolsTooltip: t(
        DialFileManagerI18nKeys.ForbiddenSymbolsTooltip,
      ),
      emptyStateByTab,
      treeHeaderByTab,
      renameValidationMessages,
      conflictResolutionPopupOptions,
    }),
    [
      t,
      emptyStateByTab,
      treeHeaderByTab,
      renameValidationMessages,
      conflictResolutionPopupOptions,
    ],
  );

  return (
    <div className="flex size-full min-h-0 flex-col">
      <DialFileManagerShell
        hookResult={hookResult}
        labels={labels}
        activeTab={activeTab}
        tabs={tabs}
        onTabChange={handleTabChangeWithReset}
        selectedPaths={selectedPaths}
        onSelectedPathsChange={setSelectedPaths}
        autoSelectUploadedItems={true}
      />
    </div>
  );
};

export default memo(DialFileManagerPage);
