import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DialFile,
  DialFileNodeType,
  DialFoldersTree,
} from '@epam/ai-dial-react-file-manager';
import {
  CloseButton,
  DIAL_ICON_SIZE,
  DropdownItem,
  GhostButton,
} from '@epam/ai-dial-ui-kit';
import { IconFolderPlus, IconPlus } from '@tabler/icons-react';
import { FC, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PublishFolderNode } from '../../models/publish';
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

/** Color overrides for {@link PublishFoldersTree}, applied as CSS custom properties with app theme fallbacks. */
export interface PublishFoldersTreeColors {
  /** Divider color above the "create new folder" trigger. Fallback: `--stroke-tertiary`. */
  dividerColor?: string;
  /** Check icon color on the selected row. Fallback: `--stroke-info`. */
  selectedCheckColor?: string;
}

/** Props for {@link PublishFoldersTree}. */
export interface PublishFoldersTreeProps {
  /** Root-level folder nodes. */
  items: PublishFolderNode[];
  /**
   * Currently selected destination folder path, outermost first.
   * `undefined` means nothing is selected; `[]` means the bucket root
   * itself is selected (a distinct, valid destination).
   */
  selectedPath?: string[];
  /** Called when the user selects a folder or the root; `undefined` when deselected. */
  onSelectedPathChange: (path: string[] | undefined) => void;
  /**
   * Called when the user confirms a new folder name. The caller owns
   * persisting the new node into `items`; the tree only reports intent.
   */
  onCreateFolder: (parentPath: string[], name: string) => Promise<void>;
  /**
   * Search query used to filter the tree; owned by the host so it can render
   * the search input in its own layout (e.g. above other controls). Filtering
   * is suspended while the inline create-folder row is open.
   */
  searchQuery: string;
  /** Whether the whole tree is disabled, e.g. while a publish request is in flight. Default: `false`. */
  disabled?: boolean;
  /** Label for the trailing "create new folder" trigger. Default: `'Create new folder'`. */
  createFolderLabel?: string;
  /** Accessible label for the button that cancels the in-progress "create new folder" row. Default: `'Cancel creating folder'`. */
  cancelCreatingFolderLabel?: string;
  /** Label for the per-row context menu action that creates a folder alongside the clicked folder. Default: `'Add sibling'`. */
  addSiblingFolderLabel?: string;
  /** Label for the per-row context menu action that creates a folder inside the clicked folder. Default: `'Add child'`. */
  addChildFolderLabel?: string;
  /** Default name pre-filled for a new folder before the user edits it, unless `searchQuery` matched no folder and is itself a valid name, in which case the query is used. Default: `'New folder'`. */
  newFolderDefaultName?: string;
  /** Message shown when a search query matches no folders; `{query}` is replaced. Default: `'No folders match "{query}".'`. */
  noResultsLabel?: string;
  /** Inline error shown while creating a folder with an empty name. Default: `'Folder name cannot be empty.'`. */
  emptyFolderNameError?: string;
  /** Inline error shown while creating a folder whose name contains `..` or a forbidden character. Default: `'Folder name contains invalid characters.'`. */
  invalidFolderNameError?: string;
  /** Inline error shown while creating a folder whose name duplicates a sibling. Default: `'A folder with this name already exists.'`. */
  duplicateFolderNameError?: string;
  /**
   * Label for the tree node representing the bucket root itself as a
   * selectable publish destination (`selectedPath: []`); rendered as the
   * top-level, always-expanded node that wraps `items`. Default: `'Organization'`.
   */
  rootLabel?: string;
  /**
   * Externally-controlled set of expanded folder path keys (`path.join('/')`).
   * Pass this together with `onExpandedPathsChange` when the host needs to
   * know which folders were expanded (e.g. to lazily fetch their children).
   * When omitted, the tree manages expand state internally.
   */
  expandedPaths?: Set<string>;
  /** Called when the set of expanded folders changes; required to control `expandedPaths`. */
  onExpandedPathsChange?: (paths: Set<string>) => void;
  /** Folder path keys currently being fetched by the host; shows a loading affordance on those rows. */
  loadingPaths?: Set<string>;
  /** Color overrides. */
  colors?: PublishFoldersTreeColors;
}

/** Destination folder tree for the Publish flow, ordered by folder name at every level, with search, folder creation (trailing button and context menu), and a disabled state. */
export const PublishFoldersTree: FC<PublishFoldersTreeProps> = ({
  items,
  selectedPath,
  onSelectedPathChange,
  onCreateFolder,
  searchQuery,
  disabled = false,
  createFolderLabel = 'Create new folder',
  cancelCreatingFolderLabel = 'Cancel creating folder',
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
  colors,
}) => {
  const cssVars = buildCssVars({
    '--pft-divider': colors?.dividerColor,
    '--pft-selected-check': colors?.selectedCheckColor,
  });

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
  // The root node's own path key ('') is always kept expanded so its
  // children stay visible; it is stripped before the set reaches the host,
  // since '' is not a real folder path the host can fetch children for.
  const updateExpandedPaths = (next: Set<string>) => {
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
  // Resolved once when creation starts so the inline editor never defaults to
  // an already-existing sibling name such as "New folder".
  const [creatingFolderName, setCreatingFolderName] =
    useState(newFolderDefaultName);
  /*
   * The host `DialFoldersTree` component shows `onRenameValidate`'s result
   * inline but does not reliably block its own confirm callback on it (the
   * error can still be visible when the folder gets created — see #7968).
   * Track the last live-typed validation result ourselves so `confirmCreatingFolder`
   * can refuse to create even when the value it receives no longer reflects
   * that error.
   */
  const lastLiveValidationErrorRef = useRef<string | null>(null);

  const trimmedQuery = searchQuery.trim();
  const isCreatingFolder = creatingParentPath != null;

  /*
   * `DialFoldersTree` owns the create-row markup and exposes no prop to add a
   * trailing cancel control to it, but it does mark that row's editor with
   * `data-editable-container` — a stable hook. Every row (editing or not)
   * also carries an `aria-selected` attribute, so walking up from that
   * marker to the nearest `[aria-selected]` finds the row's own element —
   * the same one the selected-state check icon anchors to (see
   * `[aria-selected='true']::after` below) — letting us portal a real,
   * clickable cross into that row's end-of-row slot instead of an
   * absolutely-positioned guess at its location.
   */
  const treeContainerRef = useRef<HTMLDivElement>(null);
  const [creatingRow, setCreatingRow] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!isCreatingFolder) {
      setCreatingRow(null);
      return;
    }
    const editableContainer = treeContainerRef.current?.querySelector(
      '[data-editable-container]',
    );
    const row = editableContainer?.closest<HTMLElement>('[aria-selected]');
    setCreatingRow(row ?? null);
    // Re-queries whenever creation starts/stops or targets a different
    // parent; the DOM node found in between stays valid for that session.
  }, [isCreatingFolder, creatingParentPath]);

  /*
   * New folders are inserted alphabetically, so the created folder can land
   * anywhere in a long sibling list — well outside the visible scroll area.
   * `onCreateFolder` is host-owned and its result isn't reflected in `items`
   * until the host re-renders with it, so scrolling can't happen synchronously
   * inside `confirmCreatingFolder`; this flag defers it to the render where
   * the newly-selected row (there's only ever one) actually exists.
   */
  const pendingScrollToSelectionRef = useRef(false);

  useLayoutEffect(() => {
    if (!pendingScrollToSelectionRef.current) {
      return;
    }
    const row = treeContainerRef.current?.querySelector(
      '[aria-selected="true"]',
    );
    if (!row) {
      return;
    }
    pendingScrollToSelectionRef.current = false;
    const prefersReducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    row.scrollIntoView({
      block: 'nearest',
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  }, [items, selectedPath]);

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
      updateExpandedPaths(new Set(expandedPaths).add(parentKey));
    }
  };

  const startCreatingFolder = () => beginCreatingFolder(selectedPath ?? []);

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

  const confirmCreatingFolder = (rawValue: string) => {
    if (!creatingParentPath) {
      return;
    }
    const trimmed = rawValue.trim();
    const priorLiveError = lastLiveValidationErrorRef.current;
    const error = validateNewFolderName(rawValue) ?? priorLiveError;
    if (!error) {
      void onCreateFolder(creatingParentPath, trimmed);
      onSelectedPathChange([...creatingParentPath, trimmed]);
      pendingScrollToSelectionRef.current = true;
    }
    setCreatingParentPath(null);
  };

  const cancelCreatingFolder = () => setCreatingParentPath(null);

  const handleItemClick = (file: DialFile) => {
    const isSelected =
      selectedPath != null && toFolderPathKey(selectedPath) === file.path;
    onSelectedPathChange(isSelected ? undefined : fromFolderPathKey(file.path));
  };

  return (
    <div className={mergeClasses(disabled && 'pointer-events-none opacity-60')}>
      {/*
       * `DialFoldersTree` sizes the create/rename input to its row's natural
       * width, which — combined with deep indentation — can exceed the
       * dialog's width. Scoping the overflow to this wrapper keeps the input
       * reachable via horizontal scroll instead of the whole dialog
       * overflowing the viewport.
       */}
      <div
        ref={treeContainerRef}
        style={cssVars}
        className={mergeClasses('w-full min-w-0 overflow-x-auto', styles.tree)}
      >
        <DialFoldersTree
          items={dialFiles}
          showFiles={false}
          selectedPath={
            selectedPath != null ? toFolderPathKey(selectedPath) : undefined
          }
          expandedPaths={treeExpandedPaths}
          onExpandedPathsChange={updateExpandedPaths}
          loadingPaths={loadingPaths}
          onItemClick={handleItemClick}
          getContextMenuItems={getFolderContextMenuItems}
          createdFolderPath={createdFolderPath}
          newFolderDefaultName={creatingFolderName}
          onCreateFolderSave={confirmCreatingFolder}
          onCreateFolderCancel={cancelCreatingFolder}
          onRenameValidate={(value) => validateNewFolderName(value)}
          emptyStateTitle={
            isFiltering
              ? noResultsLabel.replace('{query}', trimmedQuery)
              : undefined
          }
        />

        {creatingRow &&
          createPortal(
            <CloseButton
              ariaLabel={cancelCreatingFolderLabel}
              onClose={cancelCreatingFolder}
              className={styles.cancelCreatingButton}
            />,
            creatingRow,
          )}
      </div>

      <div
        role="separator"
        style={cssVars}
        className={mergeClasses('my-2 h-px', styles.divider)}
        aria-hidden
      />

      {/*
       * Plain `GhostButton` stands in for a tertiary button: the installed
       * kit declares `ButtonVariant.Tertiary` but ships no CSS for it yet on
       * the real Button/GhostButton, so it would silently render as
       * primary-solid. Switch to `variant={ButtonVariant.Tertiary}` once the
       * kit adds the style.
       */}
      <GhostButton
        onClick={startCreatingFolder}
        label={createFolderLabel}
        iconBefore={<IconPlus size={DIAL_ICON_SIZE.SM} aria-hidden />}
        disabled={disabled}
        className="mb-4"
      />
    </div>
  );
};
