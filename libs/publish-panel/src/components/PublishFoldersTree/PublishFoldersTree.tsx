import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DialFile,
  DialFileNodeType,
  DialFoldersTree,
} from '@epam/ai-dial-react-file-manager';
import {
  DIAL_ICON_SIZE,
  DropdownItem,
  GhostButton,
} from '@epam/ai-dial-ui-kit';
import { IconFolderPlus, IconPlus } from '@tabler/icons-react';
import { FC, useMemo, useRef, useState } from 'react';
import type { PublishFoldersTreeProps } from '../../models/publish-folders-tree';
import {
  collectFolderKeys,
  filterFolderTree,
  fromFolderPathKey,
  getSiblingFolderNames,
  getUniqueFolderName,
  sortFolderTree,
  toDialFileTree,
  toFolderPathKey,
  validateFolderName,
} from '../../utils/publish-folder-tree';
import styles from './PublishFoldersTree.module.scss';

/** Destination folder tree for the Publish flow, ordered by folder name at every level, with search, folder creation (trailing button and context menu), and a disabled state. */
export const PublishFoldersTree: FC<PublishFoldersTreeProps> = ({
  items,
  selectedPath,
  onSelectedPathChange,
  onCreateFolder,
  searchQuery,
  disabled = false,
  createFolderLabel = 'Create new folder',
  cancelCreatingFolderLabel = 'Cancel',
  addSiblingFolderLabel = 'Add sibling',
  addChildFolderLabel = 'Add child',
  newFolderDefaultName = 'New folder',
  noResultsLabel = 'No folders match "{query}".',
  emptyFolderNameError = 'Folder name cannot be empty.',
  invalidFolderNameError = 'Folder name contains invalid characters.',
  duplicateFolderNameError = 'A folder with this name already exists.',
  rootLabel = 'Organization',
  expandedPaths: controlledExpandedPaths,
  onExpandedPathsChange,
  loadingPaths,
  styles: stylesProp = {},
}) => {
  const cssVars = {
    ...buildCssVars({
      '--pft-divider': stylesProp.colors?.divider,
    }),
    ...stylesProp.cssVars,
  };

  const [internalExpandedPaths, setInternalExpandedPaths] = useState<
    Set<string>
  >(
    () =>
      new Set(
        selectedPath?.map((_, i) =>
          toFolderPathKey(selectedPath.slice(0, i + 1)),
        ) ?? [],
      ),
  );
  const expandedPaths = controlledExpandedPaths ?? internalExpandedPaths;
  /*
   * The root node's own path key ('') is always kept expanded so its
   * children stay visible. It is stripped before the set reaches the host
   * because '' is not a real folder path the host can fetch children for.
   */
  const handleExpandedPathsChange = (next: Set<string>) => {
    const withoutRoot = new Set(next);
    withoutRoot.delete('');
    if (onExpandedPathsChange) {
      onExpandedPathsChange(withoutRoot);
    } else {
      setInternalExpandedPaths(withoutRoot);
    }
  };
  const [creatingParentPath, setCreatingParentPath] = useState<string[] | null>(
    null,
  );
  /* Resolved once per creation session to avoid an existing sibling name. */
  const [creatingFolderName, setCreatingFolderName] =
    useState(newFolderDefaultName);
  /*
   * The host `DialFoldersTree` component shows `onRenameValidate`'s result
   * inline but does not reliably block its own confirm callback on it (the
   * error can still be visible when the folder gets created — see #7968).
   * Track the last live-typed validation result ourselves so `handleConfirmCreatingFolder`
   * can refuse to create even when the value it receives no longer reflects
   * that error.
   */
  const lastLiveValidationErrorRef = useRef<string | null>(null);

  const trimmedQuery = searchQuery.trim();
  const isCreatingFolder = creatingParentPath != null;

  const matchingItems = useMemo(
    () => filterFolderTree(items, searchQuery),
    [items, searchQuery],
  );
  const hasNoSearchMatches =
    trimmedQuery.length > 0 && matchingItems.length === 0;
  /*
   * The filter is suspended while the inline create-folder row is open: the
   * row is rendered by `DialFoldersTree` underneath its parent node, so a
   * query that filters that parent out (a query matching nothing at all, in
   * particular) would otherwise hide the editor the user just opened.
   */
  const isFiltering = !isCreatingFolder && trimmedQuery.length > 0;

  const visibleItems = useMemo(
    () => sortFolderTree(isFiltering ? matchingItems : items),
    [isFiltering, matchingItems, items],
  );

  const searchExpandedPaths = useMemo(
    () => new Set(['', ...collectFolderKeys(visibleItems)]),
    [visibleItems],
  );
  const treeExpandedPaths = useMemo(
    () => new Set(['', ...(isFiltering ? searchExpandedPaths : expandedPaths)]),
    [isFiltering, searchExpandedPaths, expandedPaths],
  );

  const childFiles = useMemo<DialFile[]>(
    () => toDialFileTree(visibleItems),
    [visibleItems],
  );

  /**
   * The bucket root is a real, always-expanded top-level tree node (matching
   * the file manager's own root-node pattern) so it is selectable exactly
   * like any folder — `path: ''` maps to `selectedPath: []` via
   * `fromFolderPathKey`/`toFolderPathKey`. Omitted while a search matches
   * nothing so `emptyStateDescription` can render instead.
   */
  const dialFiles = useMemo<DialFile[]>(() => {
    if (isFiltering && childFiles.length === 0) {
      return [];
    }
    return [
      {
        path: '',
        name: rootLabel,
        folderId: '',
        nodeType: DialFileNodeType.FOLDER,
        items: childFiles,
      },
    ];
  }, [childFiles, rootLabel, isFiltering]);

  const createdFolderPath = creatingParentPath
    ? toFolderPathKey(creatingParentPath)
    : null;

  const folderNameErrors = {
    empty: emptyFolderNameError,
    invalid: invalidFolderNameError,
    duplicate: duplicateFolderNameError,
  };

  /*
   * A query that matched no folder reads as "the folder I want doesn't exist
   * yet", so creating from that state pre-fills the editor with the query —
   * which also keeps the confirmed folder visible once the filter resumes.
   */
  const resolveNewFolderName = (parentPath: string[]): string => {
    const isQueryUsableAsName =
      hasNoSearchMatches &&
      validateFolderName(trimmedQuery, [], folderNameErrors) == null;
    return getUniqueFolderName(
      isQueryUsableAsName ? trimmedQuery : newFolderDefaultName,
      getSiblingFolderNames(items, parentPath),
    );
  };

  const beginCreatingFolder = (parentPath: string[]) => {
    setCreatingParentPath(parentPath);
    setCreatingFolderName(resolveNewFolderName(parentPath));
    lastLiveValidationErrorRef.current = null;
    const parentKey = toFolderPathKey(parentPath);
    if (parentKey) {
      handleExpandedPathsChange(new Set(expandedPaths).add(parentKey));
    }
  };

  const handleStartCreatingFolder = () =>
    beginCreatingFolder(selectedPath ?? []);

  /**
   * Per-row context menu, mirroring the file manager's "Add sibling" /
   * "Add child" folder-creation actions (see
   * `useFolderCreation`/`startTreeSiblingFolderCreation`/
   * `startTreeChildFolderCreation` in `@epam/ai-dial-react-file-manager`'s `FileManager`
   * — not exported from the package, so reimplemented here against the
   * public `getContextMenuItems` prop instead). "Add sibling" is omitted for
   * the root node, which has no parent to create a sibling under.
   */
  const getFolderContextMenuItems = (file: DialFile): DropdownItem[] => {
    const childPath = fromFolderPathKey(file.path);
    const items: DropdownItem[] = [
      {
        key: 'add-child',
        label: addChildFolderLabel,
        icon: <IconFolderPlus size={DIAL_ICON_SIZE.SM} aria-hidden />,
        onClick: () => beginCreatingFolder(childPath),
      },
    ];
    if (file.path !== '') {
      items.push({
        key: 'add-sibling',
        label: addSiblingFolderLabel,
        icon: <IconPlus size={DIAL_ICON_SIZE.SM} aria-hidden />,
        onClick: () => beginCreatingFolder(childPath.slice(0, -1)),
      });
    }
    return items;
  };

  const validateNewFolderName = (rawValue: string): string | null => {
    if (!creatingParentPath) {
      return null;
    }
    const error = validateFolderName(
      rawValue,
      getSiblingFolderNames(items, creatingParentPath),
      folderNameErrors,
    );
    lastLiveValidationErrorRef.current = error;
    return error;
  };

  const handleConfirmCreatingFolder = (rawValue: string) => {
    if (!creatingParentPath) {
      return;
    }
    const trimmed = rawValue.trim();
    const priorLiveError = lastLiveValidationErrorRef.current;
    const error = validateNewFolderName(rawValue) ?? priorLiveError;
    if (!error) {
      void onCreateFolder(creatingParentPath, trimmed);
      onSelectedPathChange([...creatingParentPath, trimmed]);
    }
    setCreatingParentPath(null);
  };

  const handleCancelCreatingFolder = () => setCreatingParentPath(null);

  const handleItemClick = (file: DialFile) => {
    const isSelected =
      selectedPath != null && toFolderPathKey(selectedPath) === file.path;
    onSelectedPathChange(isSelected ? undefined : fromFolderPathKey(file.path));
  };

  return (
    <div
      style={cssVars}
      className={mergeClasses(
        disabled && 'pointer-events-none opacity-60',
        stylesProp.className,
      )}
    >
      <div className="w-full min-w-0 max-w-full">
        <DialFoldersTree
          items={dialFiles}
          showFiles={false}
          selectedPath={
            selectedPath != null ? toFolderPathKey(selectedPath) : undefined
          }
          expandedPaths={treeExpandedPaths}
          onExpandedPathsChange={handleExpandedPathsChange}
          loadingPaths={loadingPaths}
          onItemClick={handleItemClick}
          getContextMenuItems={getFolderContextMenuItems}
          createdFolderPath={createdFolderPath}
          newFolderDefaultName={creatingFolderName}
          onCreateFolderSave={handleConfirmCreatingFolder}
          onCreateFolderCancel={handleCancelCreatingFolder}
          onRenameValidate={(value) => validateNewFolderName(value)}
          emptyStateTitle={
            isFiltering
              ? noResultsLabel.replace('{query}', trimmedQuery)
              : undefined
          }
        />
      </div>

      <div className={mergeClasses('my-2 h-px', styles.divider)} aria-hidden />

      {/*
       * Plain `GhostButton` stands in for a tertiary button: the installed
       * kit declares `ButtonVariant.Tertiary` but ships no CSS for it yet on
       * the real Button/GhostButton, so it would silently render as
       * primary-solid. Switch to `variant={ButtonVariant.Tertiary}` once the
       * kit adds the style.
       */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <GhostButton
          onClick={handleStartCreatingFolder}
          label={createFolderLabel}
          iconBefore={<IconPlus size={DIAL_ICON_SIZE.SM} aria-hidden />}
          disabled={disabled || isCreatingFolder}
        />
        {isCreatingFolder && (
          <GhostButton
            label={cancelCreatingFolderLabel}
            onClick={handleCancelCreatingFolder}
            disabled={disabled}
          />
        )}
      </div>
    </div>
  );
};
