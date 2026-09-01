import {
  DialFileManagerTabs,
  DialFileNodeType,
  type DialFile,
  type DialFileAcceptType,
  type FileManagerGridRow,
  type ToolbarOptions,
} from '@epam/ai-dial-react-file-manager';
import { Popup, PopupSize, PrimaryButton } from '@epam/ai-dial-ui-kit';
import { memo, useCallback, useMemo, type FC } from 'react';
import type { AttachResult } from '../attach-result';
import { DialFileManagerShell } from '../DialFileManagerShell/DialFileManagerShell';
import type { FileManagerController } from '../file-manager-controller';
import {
  type DialFileManagerActionProfile,
  type DialFileManagerVariant,
} from '../file-manager-variant';
import type { DialFileManagerShellLabels } from '../labels';
import { isHiddenPath } from '../path';

/** Labels for `FileManagerAttachModal`. Extends the shell labels with attach-specific strings. */
export interface FileManagerAttachModalLabels extends DialFileManagerShellLabels {
  /** Title displayed in the Popup header. */
  title: string;
  /** Label for the primary Attach button. */
  attachLabel: string;
  /** Optional subtitle shown below the title (e.g. allowed types / size). Pass `null` to hide. */
  headerDescription?: string | null;
}

/** Props accepted by `FileManagerAttachModal`. */
export interface FileManagerAttachModalProps {
  /** Whether the modal is open. */
  isOpen: boolean;
  /** Called when the modal requests to be closed. */
  onClose: () => void;
  /** Called with the confirmed selection when the user presses Attach. */
  onAttach: (result: AttachResult) => void;
  /** Called when one or more selected files were filtered out due to an unsupported type. */
  onSkippedUnsupportedFiles?: () => void;
  /** Called when the total attachment count would exceed the limit. */
  onCountLimitExceeded?: (totalCount: number, limit: number) => void;

  /** Live file-manager state driving the grid. */
  controller: FileManagerController;
  /**
   * True while any mutating operation is in progress (upload, delete, rename, etc.).
   * Disables the Attach button alongside `isLoading`.
   */
  isAnyOperationInProgress: boolean;
  /** Currently active tab. */
  activeTab: DialFileManagerTabs;
  /** Tab configuration for the toolbar. */
  tabs: ToolbarOptions['tabs'];
  /**
   * Called when the user switches tabs.
   * The host is responsible for resetting `selectedPaths` to an empty set.
   */
  onTabChange: (tab: DialFileManagerTabs) => void;

  /** All user-visible strings. */
  labels: FileManagerAttachModalLabels;

  /** File-manager variant (controls which toolbar entries are shown). */
  variant: DialFileManagerVariant;
  /** Action profile controlling toolbar entry visibility. */
  actionProfile: DialFileManagerActionProfile;

  /**
   * Current set of selected virtual paths, managed by the host.
   * The host must reset this to an empty set when the active tab changes.
   */
  selectedPaths: Set<string>;
  /** Called when the user changes the grid selection. */
  onSelectedPathsChange: (paths: Set<string>) => void;

  /**
   * Resolves a folder `DialFile` to its DIAL Core path string for inclusion in
   * `AttachResult.folderPaths`. Return `null` to skip the folder.
   * Path normalization and bucket resolution are the host's responsibility.
   */
  resolveFolderPath: (file: DialFile) => string | null;

  /**
   * Returns `false` for file content-types that must be filtered out on attach.
   * When absent, all content types are accepted.
   */
  isFileTypeAllowed?: (contentType: string) => boolean;
  /** Maximum size in bytes a selectable file may have. */
  maxSelectableFileSize?: number;
  /** Maximum total attachments (already-attached plus newly selected). */
  maximumAttachmentsAmount?: number;
  /** Count of attachments already present before this modal opens. Defaults to `0`. */
  existingAttachmentsAmount?: number;

  /** Row selectability predicate forwarded to the grid. */
  isRowSelectable?: (node: { data?: FileManagerGridRow | null }) => boolean;
  /** Returns a tooltip for disabled rows; forwarded to the grid. */
  getDisabledTooltip?: (row: FileManagerGridRow) => string | undefined;
  /** Tooltip shown on files with an unsupported type; forwarded to the grid. */
  unsupportedFileTypeTooltip?: string;

  /** Accepted file types for the upload file input. */
  allowedFileTypes?: DialFileAcceptType[];
  /** Whether to auto-select items immediately after upload. Defaults to `false`. */
  autoSelectUploadedItems?: boolean;
}

/** File-manager modal with Popup chrome and an Attach footer. Selection and tab state are controlled by the host. */
export const FileManagerAttachModal: FC<FileManagerAttachModalProps> = memo(
  ({
    isOpen,
    onClose,
    onAttach,
    onSkippedUnsupportedFiles,
    onCountLimitExceeded,
    controller,
    isAnyOperationInProgress,
    activeTab,
    tabs,
    onTabChange,
    labels,
    variant,
    actionProfile,
    selectedPaths,
    onSelectedPathsChange,
    resolveFolderPath,
    isFileTypeAllowed,
    maxSelectableFileSize,
    maximumAttachmentsAmount,
    existingAttachmentsAmount = 0,
    isRowSelectable,
    getDisabledTooltip,
    unsupportedFileTypeTooltip,
    allowedFileTypes,
    autoSelectUploadedItems = false,
  }) => {
    const { items, isLoading, searchResults } = controller;

    const filesByPath = useMemo(() => {
      const result = new Map<string, DialFile>();
      const collect = (nodes: DialFile[]) => {
        nodes.forEach((item) => {
          if (
            item.nodeType === DialFileNodeType.ITEM ||
            item.nodeType === DialFileNodeType.FOLDER
          ) {
            result.set(item.path, item);
            if (item.id) result.set(item.id, item);
          }
          if (item.items) collect(item.items);
        });
      };
      collect(items);
      searchResults?.forEach((file) => {
        result.set(file.path, file);
        if (file.id) result.set(file.id, file);
      });
      return result;
    }, [items, searchResults]);

    const selectedFiles = useMemo(
      () =>
        Array.from(selectedPaths)
          .map((selectedPath) => filesByPath.get(selectedPath))
          .filter((file): file is DialFile => file != null),
      [filesByPath, selectedPaths],
    );

    const handleAttach = useCallback(() => {
      const selectedFolderPaths: string[] = [];
      const selectedFileNodes: DialFile[] = [];

      for (const file of selectedFiles) {
        if (isHiddenPath(file.path)) continue;

        if (file.nodeType === DialFileNodeType.FOLDER) {
          selectedFolderPaths.push(file.path);
        } else {
          selectedFileNodes.push(file);
        }
      }

      const dedupedFolderPaths = selectedFolderPaths.filter(
        (fp) =>
          !selectedFolderPaths.some(
            (other) => other !== fp && fp.startsWith(`${other}/`),
          ),
      );

      const validFiles = selectedFileNodes.filter((file) => {
        if (isHiddenPath(file.path)) return false;
        if (
          isFileTypeAllowed != null &&
          file.contentType != null &&
          !isFileTypeAllowed(file.contentType)
        ) {
          return false;
        }
        return true;
      });

      const dedupedFiles = validFiles.filter(
        (file) =>
          !dedupedFolderPaths.some((fp) => file.path.startsWith(`${fp}/`)),
      );

      const skippedCount = selectedFileNodes.length - validFiles.length;
      if (skippedCount > 0) {
        onSkippedUnsupportedFiles?.();
      }

      const dialCoreFolderPaths = dedupedFolderPaths.flatMap((virtualPath) => {
        const file = filesByPath.get(virtualPath);
        if (file == null) return [];
        const resolved = resolveFolderPath(file);
        return resolved != null ? [resolved] : [];
      });

      const totalCount =
        existingAttachmentsAmount +
        dedupedFiles.length +
        dialCoreFolderPaths.length;
      if (
        maximumAttachmentsAmount != null &&
        maximumAttachmentsAmount > 0 &&
        totalCount > maximumAttachmentsAmount
      ) {
        onCountLimitExceeded?.(totalCount, maximumAttachmentsAmount);
        return;
      }

      onAttach({ files: dedupedFiles, folderPaths: dialCoreFolderPaths });
    }, [
      onAttach,
      onSkippedUnsupportedFiles,
      onCountLimitExceeded,
      selectedFiles,
      isFileTypeAllowed,
      maximumAttachmentsAmount,
      existingAttachmentsAmount,
      filesByPath,
      resolveFolderPath,
    ]);

    const { title, attachLabel, headerDescription, ...shellLabels } = labels;

    return (
      <Popup
        open={isOpen}
        header={
          <div className="flex flex-col gap-1">
            <span>{title}</span>
            {headerDescription != null && (
              <p className="dial-small-text text-start">{headerDescription}</p>
            )}
          </div>
        }
        ariaLabel={title}
        size={PopupSize.Lg}
        className="flex !h-[min(800px,100dvh)] w-full flex-col !bg-layer-sunken"
        onClose={onClose}
        footer={
          <div className="flex justify-end px-6 py-4">
            <PrimaryButton
              label={attachLabel}
              disabled={
                selectedFiles.length === 0 ||
                isLoading ||
                isAnyOperationInProgress
              }
              onClick={handleAttach}
            />
          </div>
        }
      >
        <div className="flex min-h-0 flex-col">
          <DialFileManagerShell
            controller={controller}
            labels={shellLabels}
            activeTab={activeTab}
            tabs={tabs}
            onTabChange={onTabChange}
            selectedPaths={selectedPaths}
            onSelectedPathsChange={onSelectedPathsChange}
            variant={variant}
            actionProfile={actionProfile}
            autoSelectUploadedItems={autoSelectUploadedItems}
            allowedFileTypes={allowedFileTypes}
            maxSelectableFileSize={maxSelectableFileSize}
            isRowSelectable={isRowSelectable}
            getDisabledTooltip={getDisabledTooltip}
            unsupportedFileTypeTooltip={unsupportedFileTypeTooltip}
          />
        </div>
      </Popup>
    );
  },
);

FileManagerAttachModal.displayName = 'FileManagerAttachModal';
