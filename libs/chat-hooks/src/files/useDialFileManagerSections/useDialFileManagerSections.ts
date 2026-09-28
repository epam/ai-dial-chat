import type {
  DialCopiedItem,
  DialDeletedItem,
  DialFile,
  DialUploadFileItem,
} from '@epam/ai-dial-react-file-manager';
import { DialFileManagerTabs } from '@epam/ai-dial-react-file-manager';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { useCallback, useMemo, useState } from 'react';
import {
  hasSamePaths,
  resolveSectionByPath,
  unionPathSets,
} from '../dial-file-manager-path.util';
import type { DialFileManagerSection } from '../dial-file-manager.model';
import {
  FileManagerNotificationReason,
  type UseDialFileManagerOptions,
  type UseDialFileManagerResult,
} from '../dial-file-manager.types';
import { useDialFileManager } from '../useDialFileManager/useDialFileManager';

/** Options accepted by `useDialFileManagerSections`. */
export interface UseDialFileManagerSectionsOptions extends Omit<
  UseDialFileManagerOptions,
  'activeTab' | 'rootLabel' | 'isActive' | 'sessionKey'
> {
  /** Active tab, including `DialFileManagerTabs.All`. */
  activeTab: DialFileManagerTabs;
  /** Enabled source tabs in display order, each with its translated top-level folder name. */
  sections: DialFileManagerSection[];
}

/** Values returned by `useDialFileManagerSections`. */
export interface UseDialFileManagerSectionsResult extends UseDialFileManagerResult {
  /** Source tab of the browsed folder; never `DialFileManagerTabs.All`. */
  sectionTab: DialFileManagerTabs;
}

const SECTION_TABS = [
  DialFileManagerTabs.MyFiles,
  DialFileManagerTabs.Shared,
  DialFileManagerTabs.Organization,
];

/**
 * Composes one `useDialFileManager` per source tab (My files, Shared,
 * Organization) so the File storage page can offer an All tab without a
 * second copy of the per-tab rules. On a single tab it returns that section's
 * result; on All it merges the section roots into one tree and routes every
 * callback to the section owning the path. Section availability and names
 * arrive through `sections` — the hook reads no config, i18n, or context.
 */
export const useDialFileManagerSections = ({
  activeTab,
  sections,
  ...managerOptions
}: UseDialFileManagerSectionsOptions): UseDialFileManagerSectionsResult => {
  const enabledSections = useMemo(
    () => sections.filter((section) => SECTION_TABS.includes(section.tab)),
    [sections],
  );
  const isAll = activeTab === DialFileManagerTabs.All;

  const getSectionOptions = (
    tab: DialFileManagerTabs,
  ): UseDialFileManagerOptions => {
    const section = enabledSections.find((s) => s.tab === tab);
    return {
      ...managerOptions,
      activeTab: tab,
      rootLabel: section?.rootLabel ?? tab,
      isActive: section != null && (isAll || activeTab === tab),
      sessionKey: activeTab,
    };
  };

  /* Always three calls in a fixed order, so hook order never depends on `sections`. */
  const myFiles = useDialFileManager(
    getSectionOptions(DialFileManagerTabs.MyFiles),
  );
  const shared = useDialFileManager(
    getSectionOptions(DialFileManagerTabs.Shared),
  );
  const organization = useDialFileManager(
    getSectionOptions(DialFileManagerTabs.Organization),
  );

  const resultsByTab = useMemo(
    (): Partial<Record<DialFileManagerTabs, UseDialFileManagerResult>> => ({
      [DialFileManagerTabs.MyFiles]: myFiles,
      [DialFileManagerTabs.Shared]: shared,
      [DialFileManagerTabs.Organization]: organization,
    }),
    [myFiles, shared, organization],
  );

  const [browsed, setBrowsed] = useState<DialFileManagerTabs | null>(null);
  const [infoSection, setInfoSection] = useState<DialFileManagerTabs | null>(
    null,
  );
  /* Every tab switch starts a new session: forget the previously browsed section. */
  const [sessionTab, setSessionTab] = useState(activeTab);
  if (sessionTab !== activeTab) {
    setSessionTab(activeTab);
    setBrowsed(null);
    setInfoSection(null);
  }

  const firstEnabledTab =
    enabledSections[0]?.tab ?? DialFileManagerTabs.MyFiles;
  const isEnabled = useCallback(
    (tab: DialFileManagerTabs): boolean =>
      enabledSections.some((section) => section.tab === tab),
    [enabledSections],
  );
  /* A section that has since been disabled falls back to the first enabled one. */
  const browsedTab =
    browsed != null && isEnabled(browsed) ? browsed : firstEnabledTab;
  const infoTab =
    infoSection != null && isEnabled(infoSection) ? infoSection : browsedTab;

  const resultFor = useCallback(
    (tab: DialFileManagerTabs): UseDialFileManagerResult =>
      resultsByTab[tab] ?? myFiles,
    [resultsByTab, myFiles],
  );
  const sectionTabOf = useCallback(
    (path: string | undefined): DialFileManagerTabs | undefined =>
      path == null
        ? undefined
        : resolveSectionByPath(path, enabledSections)?.tab,
    [enabledSections],
  );
  const routedResult = useCallback(
    (path: string | undefined): UseDialFileManagerResult =>
      resultFor(sectionTabOf(path) ?? browsedTab),
    [resultFor, sectionTabOf, browsedTab],
  );

  const { onNotification } = managerOptions;
  const refuseCrossSectionTransfer = useCallback((): void => {
    onNotification?.({
      variant: NotificationVariant.Warning,
      reason: FileManagerNotificationReason.CrossSectionTransferUnsupported,
    });
  }, [onNotification]);
  /* An empty destination means the source section's root. */
  const isSameSectionTransfer = useCallback(
    (sourcePath: string | undefined, destinationFolder: string): boolean => {
      const sourceTab = sectionTabOf(sourcePath);
      const destinationTab = destinationFolder
        ? sectionTabOf(destinationFolder)
        : sourceTab;
      return sourceTab != null && sourceTab === destinationTab;
    },
    [sectionTabOf],
  );

  const onPathChange = useCallback(
    (nextPath?: string): void => {
      if (nextPath == null) {
        resultFor(browsedTab).onPathChange();
        return;
      }
      const tab = sectionTabOf(nextPath);
      if (tab == null) return;
      setBrowsed(tab);
      resultFor(tab).onPathChange(nextPath);
    },
    [browsedTab, resultFor, sectionTabOf],
  );

  const onExpandedPathsChange = useCallback(
    (paths: Set<string>): void => {
      enabledSections.forEach(({ tab }) => {
        const section = resultFor(tab);
        const sectionPaths = new Set(
          [...paths].filter((path) => sectionTabOf(path) === tab),
        );
        if (!hasSamePaths(sectionPaths, section.expandedPaths)) {
          section.onExpandedPathsChange(sectionPaths);
        }
      });
    },
    [enabledSections, resultFor, sectionTabOf],
  );

  const onFolderPopupPathChange = useCallback(
    (nextPath?: string): void =>
      routedResult(nextPath).onFolderPopupPathChange(nextPath),
    [routedResult],
  );

  const onUploadFiles = useCallback(
    (files: DialUploadFileItem[], destinationFolder: string): void =>
      routedResult(destinationFolder).onUploadFiles(files, destinationFolder),
    [routedResult],
  );
  const onUploadArchive = useCallback(
    (file: File, name: string, destinationFolder: string): void =>
      routedResult(destinationFolder).onUploadArchive(
        file,
        name,
        destinationFolder,
      ),
    [routedResult],
  );
  const onValidateUpload = useCallback<
    UseDialFileManagerResult['onValidateUpload']
  >(
    (files, existingFiles, destinationFolder) =>
      routedResult(destinationFolder).onValidateUpload(
        files,
        existingFiles,
        destinationFolder,
      ),
    [routedResult],
  );
  const onCreateFolder = useCallback(
    (
      file: DialUploadFileItem,
      folderPath: string,
      fileId: string,
    ): Promise<void> =>
      routedResult(folderPath).onCreateFolder(file, folderPath, fileId),
    [routedResult],
  );
  const onCreateFolderValidate = useCallback(
    (name: string, parentFolder: DialFile): string | null =>
      routedResult(parentFolder.path).onCreateFolderValidate(
        name,
        parentFolder,
      ),
    [routedResult],
  );
  const onDownloadFiles = useCallback(
    (files: DialFile[]): void =>
      routedResult(files[0]?.path).onDownloadFiles(files),
    [routedResult],
  );
  const onDeleteFiles = useCallback(
    (items: DialDeletedItem[], sourceFolder: string): void =>
      routedResult(items[0]?.sourceUrl ?? sourceFolder).onDeleteFiles(
        items,
        sourceFolder,
      ),
    [routedResult],
  );
  const onRenameValidate = useCallback(
    (value: string, item: DialFile): string | null =>
      routedResult(item.path).onRenameValidate(value, item),
    [routedResult],
  );
  const onUnshareFiles = useCallback(
    (files: DialFile[]): void =>
      routedResult(files[0]?.path).onUnshareFiles(files),
    [routedResult],
  );
  const onRemoveFilesAccess = useCallback(
    (files: DialFile[]): void =>
      routedResult(files[0]?.path).onRemoveFilesAccess(files),
    [routedResult],
  );
  const onGetInfo = useCallback(
    (file: DialFile): void => {
      const tab = sectionTabOf(file.path) ?? browsedTab;
      setInfoSection(tab);
      resultFor(tab).onGetInfo(file);
    },
    [browsedTab, resultFor, sectionTabOf],
  );

  const onCopyFiles = useCallback(
    (items: DialCopiedItem[], destinationFolder: string): void => {
      const sourcePath = items[0]?.sourceUrl;
      if (!isSameSectionTransfer(sourcePath, destinationFolder)) {
        refuseCrossSectionTransfer();
        return;
      }
      routedResult(sourcePath).onCopyFiles(items, destinationFolder);
    },
    [isSameSectionTransfer, refuseCrossSectionTransfer, routedResult],
  );
  const onMoveToFiles = useCallback(
    (
      items: DialCopiedItem[],
      sourceFolder: string,
      destinationFolder: string,
    ): void => {
      const sourcePath = items[0]?.sourceUrl ?? sourceFolder;
      if (!isSameSectionTransfer(sourcePath, destinationFolder)) {
        refuseCrossSectionTransfer();
        return;
      }
      routedResult(sourcePath).onMoveToFiles(
        items,
        sourceFolder,
        destinationFolder,
      );
    },
    [isSameSectionTransfer, refuseCrossSectionTransfer, routedResult],
  );

  const singleTabResult = useMemo((): UseDialFileManagerSectionsResult => {
    const sectionTab = SECTION_TABS.includes(activeTab)
      ? activeTab
      : DialFileManagerTabs.MyFiles;
    return { ...resultFor(sectionTab), sectionTab };
  }, [activeTab, resultFor]);

  const allViewResult = useMemo((): UseDialFileManagerSectionsResult => {
    const enabledResults = enabledSections.map(({ tab }) => resultFor(tab));
    const browsedResult = resultFor(browsedTab);
    const infoResult = resultFor(infoTab);
    /* The upload queue stays with whichever section holds a batch, even after navigating away. */
    const uploadResult =
      [browsedResult, ...enabledResults].find(
        (result) => result.uploadBatchState != null,
      ) ?? browsedResult;
    const isAnySection = (
      pick: (result: UseDialFileManagerResult) => boolean,
    ): boolean => enabledResults.some(pick);
    const sharedWithMeIdLists = enabledResults
      .map((result) => result.sharedWithMeIds)
      .filter((ids): ids is string[] => ids != null);

    return {
      ...browsedResult,
      items: enabledResults
        .map((result) => result.items[0])
        .filter((item): item is DialFile => item != null),
      onPathChange,
      expandedPaths: unionPathSets(
        enabledResults.map((result) => result.expandedPaths),
      ),
      loadedPaths: unionPathSets(
        enabledResults.map((result) => result.loadedPaths),
      ),
      onExpandedPathsChange,
      onFolderPopupPathChange,
      folderPopupLoadingPaths: unionPathSets(
        enabledResults.map((result) => result.folderPopupLoadingPaths),
      ),
      onUploadFiles,
      onUploadArchive,
      onValidateUpload,
      uploadBatchState: uploadResult.uploadBatchState,
      cancelUpload: uploadResult.cancelUpload,
      cancelUploadFile: uploadResult.cancelUploadFile,
      clearUploadBatch: uploadResult.clearUploadBatch,
      onCreateFolder,
      onCreateFolderValidate,
      isCreatingFolder: isAnySection((result) => result.isCreatingFolder),
      onDownloadFiles,
      isDownloading: isAnySection((result) => result.isDownloading),
      onDeleteFiles,
      isDeleting: isAnySection((result) => result.isDeleting),
      onRenameValidate,
      onMoveToFiles,
      isRenaming: isAnySection((result) => result.isRenaming),
      onCopyFiles,
      isCopying: isAnySection((result) => result.isCopying),
      isMoving: isAnySection((result) => result.isMoving),
      cancelCopyMove: () =>
        enabledResults.forEach((result) => result.cancelCopyMove()),
      sharedWithMeIds:
        sharedWithMeIdLists.length > 0 ? sharedWithMeIdLists.flat() : undefined,
      sharedByMePaths: unionPathSets(
        enabledResults.map((result) => result.sharedByMePaths),
      ),
      onUnshareFiles,
      isUnsharing: isAnySection((result) => result.isUnsharing),
      onRemoveFilesAccess,
      isRemovingAccess: isAnySection((result) => result.isRemovingAccess),
      fileMetadata: infoResult.fileMetadata,
      isFileMetadataLoading: infoResult.isFileMetadataLoading,
      onGetInfo,
      clearMetadata: infoResult.clearMetadata,
      isAnyOperationInProgress: isAnySection(
        (result) => result.isAnyOperationInProgress,
      ),
      sectionTab: browsedTab,
    };
  }, [
    enabledSections,
    resultFor,
    browsedTab,
    infoTab,
    onPathChange,
    onExpandedPathsChange,
    onFolderPopupPathChange,
    onUploadFiles,
    onUploadArchive,
    onValidateUpload,
    onCreateFolder,
    onCreateFolderValidate,
    onDownloadFiles,
    onDeleteFiles,
    onRenameValidate,
    onMoveToFiles,
    onCopyFiles,
    onUnshareFiles,
    onRemoveFilesAccess,
    onGetInfo,
  ]);

  return isAll ? allViewResult : singleTabResult;
};
