import {
  DialFileManagerTabs,
  NOT_ALLOWED_SYMBOLS_REGEXP,
  useDialFileManagerTabs,
} from '@epam/ai-dial-ui-kit';
import { memo, useCallback, useMemo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import DialFileManagerShell from '../../components/DialFileManagerShell/DialFileManagerShell';
import type { DialFileManagerShellLabels } from '../../components/DialFileManagerShell/types/labels';
import {
  BasicI18nKeys,
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
      [DialFileManagerTabs.Organization]: t(BasicI18nKeys.Organization),
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
    forbiddenSymbolsRegExp: NOT_ALLOWED_SYMBOLS_REGEXP,
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
      [DialFileManagerTabs.Shared]: t(DialFileManagerI18nKeys.TabShared),
      [DialFileManagerTabs.Organization]: t(BasicI18nKeys.Organization),
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
      downloadLabel: t(ButtonsI18nKeys.Download),
      downloadingLabel: t(DialFileManagerI18nKeys.Downloading),
      deleteLabel: t(ButtonsI18nKeys.Delete),
      deletingLabel: t(DialFileManagerI18nKeys.DeletingLabel),
      renameLabel: t(ButtonsI18nKeys.Rename),
      renamingLabel: t(DialFileManagerI18nKeys.RenamingLabel),
      copyLabel: t(DialFileManagerI18nKeys.CopyAction),
      moveLabel: t(DialFileManagerI18nKeys.MoveAction),
      duplicateLabel: t(DialFileManagerI18nKeys.DuplicateAction),
      addFolderLabel: t(DialFileManagerI18nKeys.FolderPickerAddFolderLabel),
      hiddenFilesSwitcherLabel: t(DialFileManagerI18nKeys.ShowHiddenFiles),
      getCopyHeader: (count, name) =>
        count === 1
          ? t(DialFileManagerI18nKeys.CopyHeaderSingle, { name })
          : t(DialFileManagerI18nKeys.CopyHeaderMultiple, { count }),
      getMoveHeader: (count, name) =>
        count === 1
          ? t(DialFileManagerI18nKeys.MoveHeaderSingle, { name })
          : t(DialFileManagerI18nKeys.MoveHeaderMultiple, { count }),
      moveSourceDisabledTooltip: t(
        DialFileManagerI18nKeys.MoveSourceDisabledTooltip,
      ),
      folderPickerEmptyStateTitle: t(
        DialFileManagerI18nKeys.FolderPickerEmptyStateTitle,
      ),
      folderPickerEmptyStateDescription: t(
        DialFileManagerI18nKeys.FolderPickerEmptyStateDescription,
      ),
      copyingLabel: t(DialFileManagerI18nKeys.CopyingLabel),
      movingLabel: t(DialFileManagerI18nKeys.MovingLabel),
      operationLoaderCopyTitle: t(
        DialFileManagerI18nKeys.OperationLoaderCopyTitle,
      ),
      operationLoaderMoveTitle: t(
        DialFileManagerI18nKeys.OperationLoaderMoveTitle,
      ),
      operationLoaderCancelLabel: t(ButtonsI18nKeys.Cancel),
      deleteConfirmTitle: (names) =>
        names.length === 1
          ? t(DialFileManagerI18nKeys.DeleteConfirmTitleSingle)
          : t(DialFileManagerI18nKeys.DeleteConfirmTitleMultiple),
      deleteConfirmBody: (names) => (
        <div className="px-6 py-3 text-sm">
          <p className="mb-3 text-secondary">
            {names.length === 1 ? (
              <>
                {t(BasicI18nKeys.DeleteConfirmDescription)}{' '}
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
      deleteConfirmLabel: t(ButtonsI18nKeys.Delete),
      deleteCancelLabel: t(ButtonsI18nKeys.Cancel),
      uploadProgressTitle: t(DialFileManagerI18nKeys.UploadProgressTitle),
      cancelLabel: t(ButtonsI18nKeys.Cancel),
      getUploadProgressText: (done, total) =>
        t(DialFileManagerI18nKeys.UploadProgressSummary, { done, total }),
      searchEmptyStateTitle: t(BasicI18nKeys.NoResults),
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
        autoSelectUploadedItems={false}
      />
    </div>
  );
};

export default memo(DialFileManagerPage);
