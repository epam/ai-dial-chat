import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DialFile,
  DialFileNodeType,
  DialFoldersTree,
} from '@epam/ai-dial-react-file-manager';
import {
  DIAL_ICON_SIZE,
  DropdownItem,
  NeutralButton,
} from '@epam/ai-dial-ui-kit';
import { IconFolderPlus, IconPlus } from '@tabler/icons-react';
import { FC, useMemo, useState } from 'react';
import { PublishFolderNode } from '../../models/publish';
import {
  collectFolderKeys,
  filterFolderTree,
  fromFolderPathKey,
  getSiblingFolderNames,
  getUniqueFolderName,
  toDialFileTree,
  toFolderPathKey,
  validateFolderName,
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
  onCreateFolder: (parentPath: string[], name: string) => Promise<void>;
  /**
   * Search query used to filter the tree; owned by the host so it can render
   * the search input in its own layout (e.g. above other controls).
   */
  searchQuery: string;
  /** Whether the whole tree is disabled, e.g. while a publish request is in flight. Default: `false`. */
  disabled?: boolean;
  /** Label for the trailing "create new folder" trigger. Default: `'Create new folder'`. */
  createFolderLabel?: string;
  /** Label for the per-row context menu action that creates a folder alongside the clicked folder. Default: `'Add sibling'`. */
  addSiblingFolderLabel?: string;
  /** Label for the per-row context menu action that creates a folder inside the clicked folder. Default: `'Add child'`. */
  addChildFolderLabel?: string;
  /** Default name pre-filled for a new folder before the user edits it. Default: `'New folder'`. */
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
}

/** Destination folder tree for the Publish flow with search, folder creation (trailing button and context menu), and a disabled state. */
export const PublishFoldersTree: FC<PublishFoldersTreeProps> = ({
  items,
  selectedPath,
  onSelectedPathChange,
  onCreateFolder,
  searchQuery,
  disabled = false,
  createFolderLabel = 'Create new folder',
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
  // Resolved once when creation starts so the inline editor never defaults to
  // an already-existing sibling name such as "New folder".
  const [creatingFolderName, setCreatingFolderName] =
    useState(newFolderDefaultName);

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
    ? toFolderPathKey(creatingParentPath)
    : null;

  const beginCreatingFolder = (parentPath: string[]) => {
    setCreatingParentPath(parentPath);
    setCreatingFolderName(
      getUniqueFolderName(
        newFolderDefaultName,
        getSiblingFolderNames(items, parentPath),
      ),
    );
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
    return validateFolderName(
      rawValue,
      getSiblingFolderNames(items, creatingParentPath),
      {
        empty: emptyFolderNameError,
        invalid: invalidFolderNameError,
        duplicate: duplicateFolderNameError,
      },
    );
  };

  const confirmCreatingFolder = (rawValue: string) => {
    if (!creatingParentPath) {
      return;
    }
    const trimmed = rawValue.trim();
    if (!validateNewFolderName(rawValue)) {
      void onCreateFolder(creatingParentPath, trimmed);
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
        getContextMenuItems={getFolderContextMenuItems}
        createdFolderPath={createdFolderPath}
        newFolderDefaultName={creatingFolderName}
        onCreateFolderSave={confirmCreatingFolder}
        onCreateFolderCancel={() => setCreatingParentPath(null)}
        onRenameValidate={(value: string) => validateNewFolderName(value)}
        emptyStateTitle={
          isSearching
            ? noResultsLabel.replace('{query}', searchQuery.trim())
            : undefined
        }
      />

      <NeutralButton
        onClick={startCreatingFolder}
        label={createFolderLabel}
        iconBefore={<IconPlus size={DIAL_ICON_SIZE.SM} aria-hidden />}
        disabled={disabled}
      />
    </div>
  );
};
