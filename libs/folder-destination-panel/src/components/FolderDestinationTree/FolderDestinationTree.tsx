import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DialFile,
  DialFileNodeType,
  DialFoldersTree,
} from '@epam/ai-dial-react-file-manager';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  DropdownItem,
  GhostButton,
} from '@epam/ai-dial-ui-kit';
import { IconFolderPlus, IconPlus } from '@tabler/icons-react';
import { FC, useEffect, useMemo, useRef, useState } from 'react';
import type { FolderDestinationTreeProps } from '../../models/folder-destination-tree';
import type { FolderNode } from '../../models/folder-tree';
import {
  buildRootedFolderTree,
  fromRootedPath,
  getRootTokenKeys,
  joinRootedKeys,
  splitRootedKeys,
  toRootedPath,
} from '../../utils/folder-destination';
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
} from '../../utils/folder-tree';
import styles from './FolderDestinationTree.module.scss';

const CANCEL_CREATING_FOLDER_ATTRIBUTE = 'data-cancel-creating-folder';

/* The single-root tree's root node path key. */
const SINGLE_ROOT_KEY = '';

const EMPTY_ITEMS: FolderNode[] = [];

/** Destination folder tree ordered by folder name at every level, with search, folder creation (trailing button and context menu), a disabled state, and an optional multi-root mode. */
export const FolderDestinationTree: FC<FolderDestinationTreeProps> = ({
  items = EMPTY_ITEMS,
  selectedPath: selectedPathProp,
  onSelectedPathChange,
  onCreateFolder,
  roots,
  destination,
  onDestinationChange,
  onCreateDestinationFolder,
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
  sameAsParentFolderNameError = 'A folder cannot have the same name as its parent folder.',
  rootLabel = 'Root',
  collapsibleRoots = false,
  expandedPaths: controlledExpandedPaths,
  onExpandedPathsChange,
  loadingPaths: loadingPathsProp,
  styles: stylesProp = {},
}) => {
  const cssVars = {
    ...buildCssVars({
      '--fdt-divider': stylesProp.colors?.divider,
    }),
    ...stylesProp.cssVars,
  };

  const isMultiRoot = roots != null;
  /* Every node in multi-root mode lives under a root token (see `folder-destination.ts`). */
  const treeItems = useMemo(
    () => (roots ? buildRootedFolderTree(roots) : items),
    [roots, items],
  );
  /*
   * "Add child" expands a parent whose children may still be loading. The
   * inline editor can hold on to the validate/confirm callbacks from when it
   * opened, so they read the tree through this ref: a sibling that lands
   * after the editor opened still counts as a duplicate.
   */
  const treeItemsRef = useRef(treeItems);
  useEffect(() => {
    treeItemsRef.current = treeItems;
  }, [treeItems]);
  const rootKeys = useMemo(
    () => (roots ? getRootTokenKeys(roots) : [SINGLE_ROOT_KEY]),
    [roots],
  );
  let selectedPath = selectedPathProp;
  if (isMultiRoot) {
    selectedPath = destination ? toRootedPath(destination) : undefined;
  }

  const selectPath = (path: string[] | undefined) => {
    if (isMultiRoot) {
      onDestinationChange?.(path ? fromRootedPath(path) : undefined);
    } else {
      onSelectedPathChange?.(path);
    }
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
  const multiRootExpandedPaths = useMemo(
    () =>
      roots
        ? new Set([
            ...internalExpandedPaths,
            ...joinRootedKeys(roots, (root) => root.expandedPaths),
          ])
        : undefined,
    [roots, internalExpandedPaths],
  );
  const expandedPaths =
    multiRootExpandedPaths ?? controlledExpandedPaths ?? internalExpandedPaths;
  const loadingPaths = useMemo(
    () =>
      roots
        ? joinRootedKeys(roots, (root) => root.loadingPaths)
        : loadingPathsProp,
    [roots, loadingPathsProp],
  );

  /* Roots the user collapsed; only tracked when roots are collapsible. */
  const [collapsedRootKeys, setCollapsedRootKeys] = useState<Set<string>>(
    () => new Set(),
  );

  /*
   * Root nodes stay expanded unless the tree lets the user collapse them. Their
   * keys are stripped before the set reaches the host, because a root is not
   * a real folder path the host can fetch children for.
   */
  const handleExpandedPathsChange = (next: Set<string>) => {
    /* A search forces every root open, so a toggle during one is not the user collapsing a root. */
    if (collapsibleRoots && !isFiltering) {
      setCollapsedRootKeys(new Set(rootKeys.filter((key) => !next.has(key))));
    }
    const withoutRoots = new Set(next);
    for (const key of rootKeys) withoutRoots.delete(key);
    if (roots) {
      setInternalExpandedPaths(withoutRoots);
      const byRoot = splitRootedKeys(roots, withoutRoots);
      for (const root of roots) {
        root.onExpandedPathsChange?.(byRoot.get(root.key) ?? new Set());
      }
    } else if (onExpandedPathsChange) {
      onExpandedPathsChange(withoutRoots);
    } else {
      setInternalExpandedPaths(withoutRoots);
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
   * error can still be visible when the folder gets created — see [#7968](https://github.com/epam/ai-dial-chat/issues/7968)).
   * Track the last live-typed validation result ourselves so `handleConfirmCreatingFolder`
   * can refuse to create even when the value it receives no longer reflects
   * that error.
   */
  const lastLiveValidationErrorRef = useRef<string | null>(null);
  /*
   * The inline editor (`useEditableItem` in the ui-kit) commits on any press
   * outside it, which includes the Cancel button, and again on the blur raised
   * when the editor is removed. Both run before this component's own cancel
   * handler. A native capture listener registered on mount runs ahead of the
   * hook's (added once the editor opens), so it flags a press on Cancel and
   * `handleConfirmCreatingFolder` drops the commits that follow, until the next
   * creation starts.
   */
  const isCancellingRef = useRef(false);
  useEffect(() => {
    const flagCancelPress = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest(`[${CANCEL_CREATING_FOLDER_ATTRIBUTE}]`)
      ) {
        isCancellingRef.current = true;
      }
    };
    document.addEventListener('pointerdown', flagCancelPress, true);
    return () =>
      document.removeEventListener('pointerdown', flagCancelPress, true);
  }, []);

  const trimmedQuery = searchQuery.trim();
  const isCreatingFolder = creatingParentPath != null;

  const matchingItems = useMemo(
    () => filterFolderTree(treeItems, searchQuery),
    [treeItems, searchQuery],
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

  const visibleItems = useMemo(() => {
    const shown = isFiltering ? matchingItems : treeItems;
    // Multi-root items are already sorted inside each root; the roots keep the host's order.
    return isMultiRoot ? shown : sortFolderTree(shown);
  }, [isFiltering, matchingItems, treeItems, isMultiRoot]);

  const searchExpandedPaths = useMemo(
    () => new Set([...rootKeys, ...collectFolderKeys(visibleItems)]),
    [rootKeys, visibleItems],
  );
  const treeExpandedPaths = useMemo(
    () =>
      new Set([
        ...(collapsibleRoots && !isFiltering
          ? rootKeys.filter((key) => !collapsedRootKeys.has(key))
          : rootKeys),
        ...(isFiltering ? searchExpandedPaths : expandedPaths),
      ]),
    [
      collapsibleRoots,
      collapsedRootKeys,
      rootKeys,
      isFiltering,
      searchExpandedPaths,
      expandedPaths,
    ],
  );

  const childFiles = useMemo<DialFile[]>(
    () => toDialFileTree(visibleItems),
    [visibleItems],
  );

  /**
   * The bucket root is a real, always-expanded top-level tree node (matching
   * the file manager's own root-node pattern) so it is selectable exactly
   * like any folder — `path: ''` maps to `selectedPath: []` via
   * `fromFolderPathKey`/`toFolderPathKey`. In multi-root mode the roots
   * themselves are the top-level nodes. Omitted while a search matches
   * nothing so `emptyStateDescription` can render instead.
   */
  const dialFiles = useMemo<DialFile[]>(() => {
    if (isFiltering && childFiles.length === 0) {
      return [];
    }
    if (isMultiRoot) {
      return childFiles;
    }
    return [
      {
        path: SINGLE_ROOT_KEY,
        name: rootLabel,
        folderId: SINGLE_ROOT_KEY,
        nodeType: DialFileNodeType.FOLDER,
        items: childFiles,
      },
    ];
  }, [childFiles, rootLabel, isFiltering, isMultiRoot]);

  const createdFolderPath = creatingParentPath
    ? toFolderPathKey(creatingParentPath)
    : null;

  const folderNameErrors = {
    empty: emptyFolderNameError,
    invalid: invalidFolderNameError,
    duplicate: duplicateFolderNameError,
    sameAsParent: sameAsParentFolderNameError,
  };

  /* The name a new folder under `parentPath` may not take; a root (single-root `[]` or a multi-root token) has none. */
  const getParentFolderName = (parentPath: string[]): string | undefined =>
    rootKeys.includes(toFolderPathKey(parentPath))
      ? undefined
      : parentPath.at(-1);

  const canCreateUnder = (parentPath: string[]): boolean => {
    if (!roots) return true;
    const target = fromRootedPath(parentPath);
    const root = roots.find((candidate) => candidate.key === target?.rootKey);
    return root != null && root.canCreateFolders !== false;
  };

  /* The parent the trailing "Create new folder" button creates under, or `undefined` when none accepts new folders. */
  const resolveTrailingCreateParent = (): string[] | undefined => {
    if (!roots) return selectedPath ?? [];
    if (selectedPath && canCreateUnder(selectedPath)) return selectedPath;
    const firstCreatable = roots.find(
      (root) => root.canCreateFolders !== false,
    );
    return firstCreatable
      ? toRootedPath({ rootKey: firstCreatable.key, path: [] })
      : undefined;
  };
  const trailingCreateParent = resolveTrailingCreateParent();

  /*
   * A query that matched no folder reads as "the folder I want doesn't exist
   * yet", so creating from that state pre-fills the editor with the query —
   * which also keeps the confirmed folder visible once the filter resumes.
   */
  const resolveNewFolderName = (parentPath: string[]): string => {
    const isQueryUsableAsName =
      hasNoSearchMatches &&
      validateFolderName(trimmedQuery, [], folderNameErrors) == null;
    const parentName = getParentFolderName(parentPath);
    return getUniqueFolderName(
      isQueryUsableAsName ? trimmedQuery : newFolderDefaultName,
      [
        ...getSiblingFolderNames(treeItems, parentPath),
        ...(parentName ? [parentName] : []),
      ],
    );
  };

  /*
   * "Add child" on a folder whose children are not listed yet expands it,
   * which makes the host fetch them. Opening the editor right away would let
   * a name be confirmed before that listing lands, when the parent still
   * looks empty — so a duplicate of an existing child passed the check. The
   * editor therefore opens once the parent is no longer loading (the parent
   * row shows the host's loading indicator meanwhile), with a default name
   * that is unique among the children that actually exist.
   */
  const [pendingCreateParentPath, setPendingCreateParentPath] = useState<
    string[] | null
  >(null);
  if (
    pendingCreateParentPath != null &&
    !loadingPaths?.has(toFolderPathKey(pendingCreateParentPath))
  ) {
    setPendingCreateParentPath(null);
    setCreatingParentPath(pendingCreateParentPath);
    setCreatingFolderName(resolveNewFolderName(pendingCreateParentPath));
  }

  const beginCreatingFolder = (parentPath: string[]) => {
    setCreatingParentPath(null);
    setPendingCreateParentPath(parentPath);
    lastLiveValidationErrorRef.current = null;
    isCancellingRef.current = false;
    const parentKey = toFolderPathKey(parentPath);
    if (parentKey) {
      handleExpandedPathsChange(new Set(expandedPaths).add(parentKey));
    }
  };

  const handleStartCreatingFolder = () => {
    if (trailingCreateParent) beginCreatingFolder(trailingCreateParent);
  };

  /**
   * Per-row context menu, mirroring the file manager's "Add sibling" /
   * "Add child" folder-creation actions (see
   * `useFolderCreation`/`startTreeSiblingFolderCreation`/
   * `startTreeChildFolderCreation` in `@epam/ai-dial-react-file-manager`'s `FileManager`
   * — not exported from the package, so reimplemented here against the
   * public `getContextMenuItems` prop instead). "Add sibling" is omitted for
   * a root node, which has no parent to create a sibling under, and a root
   * that does not accept new folders offers neither action.
   */
  const getFolderContextMenuItems = (file: DialFile): DropdownItem[] => {
    const childPath = fromFolderPathKey(file.path);
    if (!canCreateUnder(childPath)) {
      return [];
    }
    const items: DropdownItem[] = [
      {
        key: 'add-child',
        label: addChildFolderLabel,
        icon: (
          <IconFolderPlus
            size={DIAL_ICON_SIZE.SM}
            aria-hidden
            stroke={DIAL_KIT_ICON_STROKE}
          />
        ),
        onClick: () => beginCreatingFolder(childPath),
      },
    ];
    if (!rootKeys.includes(file.path)) {
      items.push({
        key: 'add-sibling',
        label: addSiblingFolderLabel,
        icon: (
          <IconPlus
            size={DIAL_ICON_SIZE.SM}
            aria-hidden
            stroke={DIAL_KIT_ICON_STROKE}
          />
        ),
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
      getSiblingFolderNames(treeItemsRef.current, creatingParentPath),
      folderNameErrors,
      getParentFolderName(creatingParentPath),
    );
    lastLiveValidationErrorRef.current = error;
    return error;
  };

  const handleConfirmCreatingFolder = (rawValue: string) => {
    if (!creatingParentPath || isCancellingRef.current) {
      return;
    }
    const trimmed = rawValue.trim();
    const priorLiveError = lastLiveValidationErrorRef.current;
    const error = validateNewFolderName(rawValue) ?? priorLiveError;
    if (!error) {
      const parent = roots ? fromRootedPath(creatingParentPath) : undefined;
      if (parent) {
        void onCreateDestinationFolder?.(parent.rootKey, parent.path, trimmed);
      } else {
        void onCreateFolder?.(creatingParentPath, trimmed);
      }
      selectPath([...creatingParentPath, trimmed]);
    }
    setCreatingParentPath(null);
  };

  const handleCancelCreatingFolder = () => setCreatingParentPath(null);

  const handleItemClick = (file: DialFile) => {
    const isSelected =
      selectedPath != null && toFolderPathKey(selectedPath) === file.path;
    selectPath(isSelected ? undefined : fromFolderPathKey(file.path));
  };

  return (
    <div
      style={cssVars}
      className={mergeClasses(
        disabled && 'pointer-events-none opacity-60',
        stylesProp.className,
      )}
    >
      <div className={mergeClasses('w-full max-w-full min-w-0', styles.tree)}>
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
          searchQuery={isFiltering ? trimmedQuery : undefined}
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
          iconBefore={
            <IconPlus
              size={DIAL_ICON_SIZE.SM}
              aria-hidden
              stroke={DIAL_KIT_ICON_STROKE}
            />
          }
          disabled={disabled || isCreatingFolder || !trailingCreateParent}
        />
        {isCreatingFolder && (
          <GhostButton
            label={cancelCreatingFolderLabel}
            onClick={handleCancelCreatingFolder}
            disabled={disabled}
            {...{ [CANCEL_CREATING_FOLDER_ATTRIBUTE]: '' }}
          />
        )}
      </div>
    </div>
  );
};
