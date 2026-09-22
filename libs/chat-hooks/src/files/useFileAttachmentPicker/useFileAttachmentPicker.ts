import { isMimeTypeAllowed } from '@epam/ai-dial-attachment-input';
import {
  isHiddenPath,
  type FileManagerSelectableNode,
} from '@epam/ai-dial-chat-shared';
import {
  DialFileManagerTabs,
  DialFileNodeType,
  useDialFileManagerTabs,
  type DialFileAcceptType,
  type ToolbarOptions,
} from '@epam/ai-dial-react-file-manager';
import { useCallback, useMemo, useState } from 'react';
import { mimeTypesToDialFileAcceptTypes } from '../attachment-types';
import type {
  UseDialFileManagerOptions,
  UseDialFileManagerResult,
} from '../dial-file-manager.types';
import { DialFileManagerVariant } from '../file-manager-variant';
import { useDialFileManager } from '../useDialFileManager/useDialFileManager';
import { useDialFileManagerTabConfig } from '../useDialFileManagerTabConfig/useDialFileManagerTabConfig';

/** Options accepted by {@link useFileAttachmentPicker}. */
export interface UseFileAttachmentPickerOptions {
  /**
   * Configured `useDialFileManager` options besides the values this hook derives:
   * `bucket`, `activeTab`, `rootLabel`, `variant`, and `forbiddenSymbolsRegExp`.
   */
  fileManagerOptions: Omit<
    UseDialFileManagerOptions,
    'bucket' | 'activeTab' | 'rootLabel' | 'variant' | 'forbiddenSymbolsRegExp'
  >;
  /** DIAL Core bucket to browse. */
  bucket: string;
  /** Regexp of characters forbidden in file/folder names, forwarded to `useDialFileManager`. */
  forbiddenSymbolsRegExp?: RegExp;
  /** Host-translated label per tab; also supplies the active tab's root-folder label. */
  tabLabels: Record<DialFileManagerTabs, string>;
  /** Tab ids the host's configuration allows. `undefined` allows every tab. */
  allowedTabs?: string[];
  /** Initial active tab. Defaults to `DialFileManagerTabs.MyFiles`. */
  initialTab?: DialFileManagerTabs;
  /** MIME types eligible for selection/upload. Empty or absent allows every type. */
  allowedTypes?: string[];
  /** Files at or below this size (bytes) remain eligible; absent allows any size. */
  maxSelectableFileSize?: number;
  /** Whether folder rows are eligible for selection. Defaults to `false`. */
  canAttachFolders?: boolean;
}

/** Result returned by {@link useFileAttachmentPicker}. */
export interface UseFileAttachmentPickerResult {
  /** The composed file-manager controller; forward to `FileManagerAttachModal`'s `controller` prop. */
  controller: UseDialFileManagerResult;
  /** Active tab. */
  activeTab: DialFileManagerTabs;
  /** Tab list filtered to `allowedTabs`; forward to `FileManagerAttachModal`'s `tabs` prop. */
  tabs: ToolbarOptions['tabs'];
  /** Switches the active tab and clears the current selection. */
  onTabChange: (tab: DialFileManagerTabs) => void;
  /** Currently selected paths. */
  selectedPaths: Set<string>;
  /** Replaces the selection with a defensive copy of the given set. */
  onSelectedPathsChange: (paths: Set<string>) => void;
  /** Row eligibility predicate; forward to `FileManagerAttachModal`'s `isRowSelectable` prop. */
  isRowSelectable: (node: {
    data?: FileManagerSelectableNode | null;
  }) => boolean;
  /** MIME eligibility predicate; forward to `FileManagerAttachModal`'s `isFileTypeAllowed` prop. */
  isFileTypeAllowed: (contentType: string) => boolean;
  /** Accepted upload MIME types; forward to `FileManagerAttachModal`'s `allowedFileTypes` prop. */
  allowedFileTypes: DialFileAcceptType[] | undefined;
}

/**
 * Composes the file-manager tab/listing hooks into the stateful part of an attachment picker:
 * active tab, selected paths, and hidden-path/MIME/size/folder row eligibility. Returns the
 * existing `useDialFileManager` controller unchanged and the selection/tab/eligibility fields
 * `FileManagerAttachModal` already consumes — it composes that modal, it does not replace it.
 * Final attachment filtering, deduplication, and count enforcement stay owned by the modal.
 */
export const useFileAttachmentPicker = ({
  fileManagerOptions,
  bucket,
  forbiddenSymbolsRegExp,
  tabLabels,
  allowedTabs,
  initialTab,
  allowedTypes,
  maxSelectableFileSize,
  canAttachFolders = false,
}: UseFileAttachmentPickerOptions): UseFileAttachmentPickerResult => {
  const {
    activeTab,
    handleTabChange: handleTabChangeRaw,
    tabs: allTabs,
  } = useDialFileManagerTabs(tabLabels, initialTab);

  const [selectedPaths, setSelectedPaths] = useState(() => new Set<string>());

  /*
   * A plain passthrough: FileManagerAttachModal already re-applies isRowSelectable to every
   * selection change, so non-selectable items (e.g. a folder auto-selected on creation when the
   * host cannot attach folders) never reach this handler. Cloned defensively because the
   * no-predicate branch of FileManagerAttachModal forwards the upstream package's Set reference
   * unchanged.
   */
  const onSelectedPathsChange = useCallback((paths: Set<string>) => {
    setSelectedPaths(new Set(paths));
  }, []);

  const onTabChange = useCallback(
    (tab: DialFileManagerTabs) => {
      setSelectedPaths(new Set());
      handleTabChangeRaw(tab);
    },
    [handleTabChangeRaw],
  );

  const { tabs } = useDialFileManagerTabConfig(
    activeTab,
    onTabChange,
    allTabs,
    allowedTabs,
  );

  const rootLabel =
    tabLabels[activeTab] || tabLabels[DialFileManagerTabs.MyFiles];

  const controller = useDialFileManager({
    ...fileManagerOptions,
    bucket,
    activeTab,
    rootLabel,
    variant: DialFileManagerVariant.Attach,
    forbiddenSymbolsRegExp,
  });

  const isFileTypeAllowed = useCallback(
    (contentType: string): boolean => {
      if (allowedTypes == null || allowedTypes.length === 0) return true;
      return isMimeTypeAllowed(contentType, allowedTypes);
    },
    [allowedTypes],
  );

  const isRowSelectable = useCallback(
    (node: { data?: FileManagerSelectableNode | null }): boolean => {
      const row = node.data;
      if (row == null) return false;

      if (isHiddenPath(row.path)) return false;

      if (row.nodeType === DialFileNodeType.FOLDER) {
        return canAttachFolders;
      }

      if (row.nodeType === DialFileNodeType.ITEM) {
        if (row.contentType != null && !isFileTypeAllowed(row.contentType)) {
          return false;
        }

        if (
          maxSelectableFileSize != null &&
          row.contentLength != null &&
          row.contentLength > maxSelectableFileSize
        ) {
          return false;
        }

        return true;
      }

      return false;
    },
    [canAttachFolders, isFileTypeAllowed, maxSelectableFileSize],
  );

  const allowedFileTypes = useMemo(
    () => mimeTypesToDialFileAcceptTypes(allowedTypes),
    [allowedTypes],
  );

  return {
    controller,
    activeTab,
    tabs,
    onTabChange,
    selectedPaths,
    onSelectedPathsChange,
    isRowSelectable,
    isFileTypeAllowed,
    allowedFileTypes,
  };
};
