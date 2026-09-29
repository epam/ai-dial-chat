import type {
  DialCopiedItem,
  DialDeletedItem,
  DialFile,
  DialUploadFileItem,
} from '@epam/ai-dial-react-file-manager';
import { DialFileManagerTabs } from '@epam/ai-dial-react-file-manager';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  hasSamePaths,
  resolveSectionByPath,
  unionPathSets,
  withRoutableRootLabels,
} from '../dial-file-manager-path.util';
import {
  DIAL_FILE_MANAGER_SECTION_TABS,
  type DialFileManagerSection,
} from '../dial-file-manager.model';
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
  /* Paths are routed by their first segment, so every root label must be a unique, slash-free segment. */
  const enabledSections = useMemo(
    () =>
      withRoutableRootLabels(
        sections.filter((section) =>
          DIAL_FILE_MANAGER_SECTION_TABS.includes(section.tab),
        ),
      ),
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

  /*
   * No memoization below: each section result is a fresh object on every
   * render, so memoizing on it would change nothing.
   */
  const resultFor = (tab: DialFileManagerTabs): UseDialFileManagerResult => {
    switch (tab) {
      case DialFileManagerTabs.MyFiles:
        return myFiles;
      case DialFileManagerTabs.Shared:
        return shared;
      case DialFileManagerTabs.Organization:
        return organization;
      default:
        throw new Error(`Not a file-manager section tab: ${tab}`);
    }
  };

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

  const isEnabled = (tab: DialFileManagerTabs): boolean =>
    enabledSections.some((section) => section.tab === tab);
  const firstEnabledTab =
    enabledSections[0]?.tab ?? DialFileManagerTabs.MyFiles;
  /* A section that has since been disabled falls back to the first enabled one. */
  const browsedTab =
    browsed != null && isEnabled(browsed) ? browsed : firstEnabledTab;
  const infoTab =
    infoSection != null && isEnabled(infoSection) ? infoSection : browsedTab;

  const sectionTabOf = (
    path: string | undefined,
  ): DialFileManagerTabs | undefined =>
    path == null ? undefined : resolveSectionByPath(path, enabledSections)?.tab;
  const routedResult = (path: string | undefined): UseDialFileManagerResult =>
    resultFor(sectionTabOf(path) ?? browsedTab);
  /* Splits a batch by owning section, so a selection spanning sections never reaches another section's bucket. */
  const groupBySection = <T>(
    items: T[],
    pathOf: (item: T) => string | undefined,
  ): [DialFileManagerTabs, T[]][] => {
    const groups = new Map<DialFileManagerTabs, T[]>();
    items.forEach((item) => {
      const tab = sectionTabOf(pathOf(item)) ?? browsedTab;
      groups.set(tab, [...(groups.get(tab) ?? []), item]);
    });
    return [...groups];
  };

  const { onNotification } = managerOptions;

  /*
   * A section's root listing can fail while another section is browsed; the
   * shell only shows the browsed section's error panel, so report the others
   * once. Browsing into the failed section then shows its panel and Retry.
   */
  const reportedErrorTabsRef = useRef(new Set<DialFileManagerTabs>());
  const sectionErrorKey = enabledSections
    .map(({ tab }) => `${tab}:${resultFor(tab).error ?? ''}`)
    .join('|');
  useEffect(() => {
    const reported = reportedErrorTabsRef.current;
    if (!isAll) {
      reported.clear();
      return;
    }
    enabledSections.forEach(({ tab }) => {
      const hasError = resultFor(tab).error != null;
      if (!hasError) {
        reported.delete(tab);
        return;
      }
      if (reported.has(tab)) return;
      reported.add(tab);
      if (tab !== browsedTab) {
        onNotification?.({
          variant: NotificationVariant.Error,
          reason: FileManagerNotificationReason.FolderLoadFailed,
        });
      }
    });
    // `sectionErrorKey` stands in for the per-section `error` values it is built from.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionErrorKey, isAll, browsedTab, onNotification]);

  const refuseCrossSectionTransfer = (): void => {
    onNotification?.({
      variant: NotificationVariant.Warning,
      reason: FileManagerNotificationReason.CrossSectionTransferUnsupported,
    });
  };
  /* A copy/move stays in one section: every item and the destination (empty = the source root) must share it. */
  const transferSectionOf = (
    sourcePaths: (string | undefined)[],
    destinationFolder: string,
  ): DialFileManagerTabs | undefined => {
    const sourceTabs = new Set(sourcePaths.map(sectionTabOf));
    if (sourceTabs.size !== 1) return undefined;
    const [sourceTab] = sourceTabs;
    if (sourceTab == null) return undefined;
    const destinationTab = destinationFolder
      ? sectionTabOf(destinationFolder)
      : sourceTab;
    return destinationTab === sourceTab ? sourceTab : undefined;
  };

  const onPathChange = (nextPath?: string): void => {
    if (nextPath == null) {
      resultFor(browsedTab).onPathChange();
      return;
    }
    const tab = sectionTabOf(nextPath);
    if (tab == null) return;
    setBrowsed(tab);
    resultFor(tab).onPathChange(nextPath);
  };

  const onExpandedPathsChange = (paths: Set<string>): void => {
    enabledSections.forEach(({ tab }) => {
      const section = resultFor(tab);
      const sectionPaths = new Set(
        [...paths].filter((path) => sectionTabOf(path) === tab),
      );
      if (!hasSamePaths(sectionPaths, section.expandedPaths)) {
        section.onExpandedPathsChange(sectionPaths);
      }
    });
  };

  const onFolderPopupPathChange = (nextPath?: string): void =>
    routedResult(nextPath).onFolderPopupPathChange(nextPath);

  const onUploadFiles = (
    files: DialUploadFileItem[],
    destinationFolder: string,
  ): void =>
    routedResult(destinationFolder).onUploadFiles(files, destinationFolder);
  const onUploadArchive = (
    file: File,
    name: string,
    destinationFolder: string,
  ): void =>
    routedResult(destinationFolder).onUploadArchive(
      file,
      name,
      destinationFolder,
    );
  const onValidateUpload: UseDialFileManagerResult['onValidateUpload'] = (
    files,
    existingFiles,
    destinationFolder,
  ) =>
    routedResult(destinationFolder).onValidateUpload(
      files,
      existingFiles,
      destinationFolder,
    );
  const onCreateFolder = (
    file: DialUploadFileItem,
    folderPath: string,
    fileId: string,
  ): Promise<void> =>
    routedResult(folderPath).onCreateFolder(file, folderPath, fileId);
  const onCreateFolderValidate = (
    name: string,
    parentFolder: DialFile,
  ): string | null =>
    routedResult(parentFolder.path).onCreateFolderValidate(name, parentFolder);
  const onDownloadFiles = (files: DialFile[]): void =>
    groupBySection(files, (file) => file.path).forEach(([tab, slice]) =>
      resultFor(tab).onDownloadFiles(slice),
    );
  const onDeleteFiles = (
    items: DialDeletedItem[],
    sourceFolder: string,
  ): void => {
    const sourceTab = sectionTabOf(sourceFolder);
    groupBySection(items, (item) => item.sourceUrl ?? sourceFolder).forEach(
      ([tab, slice]) =>
        /* `sourceFolder` names a folder of one section only; the others report their own root. */
        resultFor(tab).onDeleteFiles(
          slice,
          tab === sourceTab ? sourceFolder : '',
        ),
    );
  };
  const onRenameValidate = (value: string, item: DialFile): string | null =>
    routedResult(item.path).onRenameValidate(value, item);
  const onUnshareFiles = (files: DialFile[]): void =>
    groupBySection(files, (file) => file.path).forEach(([tab, slice]) =>
      resultFor(tab).onUnshareFiles(slice),
    );
  const onRemoveFilesAccess = (files: DialFile[]): void =>
    groupBySection(files, (file) => file.path).forEach(([tab, slice]) =>
      resultFor(tab).onRemoveFilesAccess(slice),
    );
  const onGetInfo = (file: DialFile): void => {
    const tab = sectionTabOf(file.path) ?? browsedTab;
    setInfoSection(tab);
    resultFor(tab).onGetInfo(file);
  };

  const onCopyFiles = (
    items: DialCopiedItem[],
    destinationFolder: string,
  ): void => {
    if (items.length === 0) return;
    const tab = transferSectionOf(
      items.map((item) => item.sourceUrl),
      destinationFolder,
    );
    if (tab == null) {
      refuseCrossSectionTransfer();
      return;
    }
    resultFor(tab).onCopyFiles(items, destinationFolder);
  };
  const onMoveToFiles = (
    items: DialCopiedItem[],
    sourceFolder: string,
    destinationFolder: string,
  ): void => {
    if (items.length === 0) return;
    const tab = transferSectionOf(
      items.map((item) => item.sourceUrl ?? sourceFolder),
      destinationFolder,
    );
    if (tab == null) {
      refuseCrossSectionTransfer();
      return;
    }
    resultFor(tab).onMoveToFiles(items, sourceFolder, destinationFolder);
  };

  const cancelCopyMove = (): void =>
    enabledSections.forEach(({ tab }) => resultFor(tab).cancelCopyMove());

  if (!isAll) {
    const sectionTab = DIAL_FILE_MANAGER_SECTION_TABS.includes(activeTab)
      ? activeTab
      : DialFileManagerTabs.MyFiles;
    return { ...resultFor(sectionTab), sectionTab };
  }

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
  /* A section still loading outside the browsed one shows its spinner on the folder being fetched. */
  const backgroundLoadingPaths = new Set(
    enabledSections
      .filter(({ tab }) => tab !== browsedTab && resultFor(tab).isLoading)
      .map(({ tab }) => resultFor(tab).path),
  );

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
    folderPopupLoadingPaths: unionPathSets([
      ...enabledResults.map((result) => result.folderPopupLoadingPaths),
      backgroundLoadingPaths,
    ]),
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
    cancelCopyMove,
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
};
