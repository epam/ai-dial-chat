import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DialFile,
  DialFileNodeType,
  DialFoldersTree,
} from '@epam/ai-dial-ui-kit';
import { IconPlus } from '@tabler/icons-react';
import { FC, useMemo, useState } from 'react';
import { PublishFolderNode } from '../../models/publish';
import {
  collectFolderKeys,
  filterFolderTree,
  fromFolderPathKey,
  getSiblingFolderNames,
  insertPlaceholderDialFile,
  toDialFileTree,
  toFolderPathKey,
} from '../../utils/publish-folder-tree';

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
  onCreateFolder: (parentPath: string[], name: string) => void;
  /**
   * Search query used to filter the tree; owned by the host so it can render
   * the search input in its own layout (e.g. above other controls).
   */
  searchQuery: string;
  /** Whether the whole tree is disabled, e.g. while a publish request is in flight. Default: `false`. */
  disabled?: boolean;
  /** Label for the trailing "create new folder" trigger. Default: `'Create new folder'`. */
  createFolderLabel?: string;
  /** Default name pre-filled for a new folder before the user edits it. Default: `'New folder'`. */
  newFolderDefaultName?: string;
  /** Message shown when a search query matches no folders; `{query}` is replaced. Default: `'No folders match "{query}".'`. */
  noResultsText?: string;
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
}

/**
 * Destination folder tree for the Publish flow, built on ui-kit's
 * `DialFoldersTree` (`showFiles={false}`, no context menu). Search filters
 * `items` before conversion to `DialFile[]` since `DialFoldersTree` has no
 * built-in search. Folder creation is triggered by the trailing button,
 * which renders a placeholder node so `DialFoldersTree` shows its inline
 * create-folder row; only the confirmed name is reported via
 * `onCreateFolder`.
 */
export const PublishFoldersTree: FC<PublishFoldersTreeProps> = ({
  items,
  selectedPath,
  onSelectedPathChange,
  onCreateFolder,
  searchQuery,
  disabled = false,
  createFolderLabel = 'Create new folder',
  newFolderDefaultName = 'New folder',
  noResultsText = 'No folders match "{query}".',
  rootLabel = 'Organization',
  expandedPaths: controlledExpandedPaths,
  onExpandedPathsChange,
  loadingPaths,
}) => {
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

  const visibleItems = useMemo(
    () => filterFolderTree(items, searchQuery),
    [items, searchQuery],
  );
  const isSearching = searchQuery.trim().length > 0;

  const searchExpandedPaths = useMemo(
    () => new Set(['', ...collectFolderKeys(visibleItems)]),
    [visibleItems],
  );
  const treeExpandedPaths = useMemo(
    () => new Set(['', ...(isSearching ? searchExpandedPaths : expandedPaths)]),
    [isSearching, searchExpandedPaths, expandedPaths],
  );

  const childFiles = useMemo<DialFile[]>(() => {
    const files = toDialFileTree(visibleItems);
    return creatingParentPath
      ? insertPlaceholderDialFile(
          files,
          creatingParentPath,
          newFolderDefaultName,
        )
      : files;
  }, [visibleItems, creatingParentPath, newFolderDefaultName]);

  /**
   * The bucket root is a real, always-expanded top-level tree node (matching
   * the file manager's own root-node pattern) so it is selectable exactly
   * like any folder — `path: ''` maps to `selectedPath: []` via
   * `fromFolderPathKey`/`toFolderPathKey`. Omitted while a search matches
   * nothing so `emptyStateDescription` can render instead.
   */
  const dialFiles = useMemo<DialFile[]>(() => {
    if (isSearching && childFiles.length === 0) {
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
  }, [childFiles, rootLabel, isSearching]);

  const createdFolderPath = creatingParentPath
    ? toFolderPathKey([...creatingParentPath, newFolderDefaultName])
    : null;

  const startCreatingFolder = () => {
    const parentPath = selectedPath ?? [];
    setCreatingParentPath(parentPath);
    const parentKey = toFolderPathKey(parentPath);
    if (parentKey) {
      updateExpandedPaths(new Set(expandedPaths).add(parentKey));
    }
  };

  const confirmCreatingFolder = (rawValue: string) => {
    if (!creatingParentPath) {
      return;
    }
    const trimmed = rawValue.trim();
    const isDuplicate = getSiblingFolderNames(items, creatingParentPath).some(
      (name) => name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (trimmed && !isDuplicate) {
      onCreateFolder(creatingParentPath, trimmed);
      onSelectedPathChange([...creatingParentPath, trimmed]);
    }
    setCreatingParentPath(null);
  };

  const handleItemClick = (file: DialFile) => {
    const isSelected =
      selectedPath != null && toFolderPathKey(selectedPath) === file.path;
    onSelectedPathChange(isSelected ? undefined : fromFolderPathKey(file.path));
  };

  return (
    <div className={mergeClasses(disabled && 'pointer-events-none opacity-60')}>
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
        createdFolderPath={createdFolderPath}
        newFolderDefaultName={newFolderDefaultName}
        onCreateFolderSave={confirmCreatingFolder}
        onCreateFolderCancel={() => setCreatingParentPath(null)}
        emptyStateDescription={
          isSearching
            ? noResultsText.replace('{query}', searchQuery.trim())
            : undefined
        }
      />
      <button
        type="button"
        disabled={disabled}
        onClick={startCreatingFolder}
        className="dial-small-semi-text mt-2 flex w-full items-center gap-2 border-t border-tertiary px-3 py-3 text-accent-primary"
      >
        <IconPlus size={DIAL_ICON_SIZE.SM} />
        {createFolderLabel}
      </button>
    </div>
  );
};
