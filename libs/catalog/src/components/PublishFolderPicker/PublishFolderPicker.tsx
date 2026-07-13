import { Highlight, mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import {
  IconCheck,
  IconChevronRight,
  IconFolder,
  IconPlus,
  IconX,
} from '@tabler/icons-react';
import { FC, KeyboardEvent, ReactNode, useMemo, useRef, useState } from 'react';
import { PublishFolderNode } from '../../models/publish';
import {
  collectFolderKeys,
  filterFolderTree,
} from '../../utils/publish-folder-tree';

const INDENT_PX = 18;
// Matches the "Create new folder" button's px-3, aligning depth-0 chevrons with its "+" icon.
const BASE_INDENT_PX = 12;

const pathKey = (path: string[]) => path.join('/');

const ancestorKeys = (path: string[]): string[] =>
  path.map((_, i) => path.slice(0, i + 1).join('/'));

const findNodeByKey = (
  nodes: PublishFolderNode[],
  key: string,
): PublishFolderNode | undefined => {
  for (const node of nodes) {
    if (pathKey(node.path) === key) {
      return node;
    }
    if (node.children) {
      const found = findNodeByKey(node.children, key);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
};

/** Sibling nodes sharing `parentPath` (root nodes when `parentPath` is empty). */
const getSiblings = (
  items: PublishFolderNode[],
  parentPath: string[],
): PublishFolderNode[] => {
  if (parentPath.length === 0) {
    return items;
  }
  return findNodeByKey(items, pathKey(parentPath))?.children ?? [];
};

/** A single tree row in visible display order, used for arrow-key navigation. */
interface FlatNode {
  key: string;
  node: PublishFolderNode;
  parentKey: string | null;
}

const flattenVisible = (
  nodes: PublishFolderNode[],
  parentKey: string | null,
  isExpanded: (key: string) => boolean,
  out: FlatNode[],
): void => {
  for (const node of nodes) {
    const key = pathKey(node.path);
    out.push({ key, node, parentKey });
    if (node.children?.length && isExpanded(key)) {
      flattenVisible(node.children, key, isExpanded, out);
    }
  }
};

/** Props for {@link PublishFolderPicker}. */
export interface PublishFolderPickerProps {
  /** Root-level folder nodes. */
  items: PublishFolderNode[];
  /** Currently selected destination folder path, outermost first. */
  selectedPath?: string[];
  /** Called when the user selects a folder. */
  onSelectedPathChange: (path: string[]) => void;
  /**
   * Called when the user confirms a new folder name. The caller owns
   * persisting the new node into `items`; the picker only reports intent.
   */
  onCreateFolder: (parentPath: string[], name: string) => void;
  /**
   * Search query used to filter the tree; owned by the host so it can render
   * the search input in its own layout (e.g. above other controls).
   */
  searchQuery: string;
  /** Whether the whole picker is disabled, e.g. while a publish request is in flight. Default: `false`. */
  disabled?: boolean;
  /** Label for the trailing "create new folder" row. Default: `'Create new folder'`. */
  createFolderLabel?: string;
  /** Accessible label for the confirm (✓) button in the inline create-folder row. Default: `'Confirm folder name'`. */
  confirmCreateFolderAriaLabel?: string;
  /** Accessible label for the cancel (✕) button in the inline create-folder row. Default: `'Cancel'`. */
  cancelCreateFolderAriaLabel?: string;
  /** Accessible label for the inline create-folder name input. Default: `'New folder name'`. */
  newFolderNameAriaLabel?: string;
  /** Error shown when the entered name collides with a sibling folder; `{name}` is replaced. Default: `'A folder named "{name}" already exists here.'`. */
  duplicateFolderNameError?: string;
  /** Message shown when a search query matches no folders; `{query}` is replaced. Default: `'No folders match "{query}".'`. */
  noResultsText?: string;
  /** Builds the accessible label for a folder row's expand/collapse toggle. */
  getToggleAriaLabel?: (name: string, isExpanded: boolean) => string;
  /** Typography class for folder/row names. Default: `'dial-small-text text-primary'`. */
  nodeClassName?: string;
}

/**
 * Destination folder tree for the Publish flow: search-filtered (via
 * `searchQuery`), expand/collapse, single-folder selection with a
 * checkmark, and an inline "create new folder" row nested under the
 * currently selected folder. The search input itself is rendered by the
 * host so it can be positioned independently of this tree. Arrow keys
 * navigate the tree per the WAI-ARIA Tree View pattern: Up/Down move
 * between visible rows, Right expands (or moves into the first child),
 * Left collapses (or moves to the parent).
 */
export const PublishFolderPicker: FC<PublishFolderPickerProps> = ({
  items,
  selectedPath,
  onSelectedPathChange,
  onCreateFolder,
  searchQuery,
  disabled = false,
  createFolderLabel = 'Create new folder',
  confirmCreateFolderAriaLabel = 'Confirm folder name',
  cancelCreateFolderAriaLabel = 'Cancel',
  newFolderNameAriaLabel = 'New folder name',
  duplicateFolderNameError = 'A folder named "{name}" already exists here.',
  noResultsText = 'No folders match "{query}".',
  getToggleAriaLabel = (name, isExpanded) =>
    isExpanded ? `Collapse ${name}` : `Expand ${name}`,
  nodeClassName = 'dial-small-text text-primary',
}) => {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(
    () => new Set(selectedPath ? ancestorKeys(selectedPath) : []),
  );
  const [creatingParentKey, setCreatingParentKey] = useState<string | null>(
    null,
  );
  const [newFolderName, setNewFolderName] = useState('');
  const [duplicateError, setDuplicateError] = useState(false);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());

  const visibleItems = useMemo(
    () => filterFolderTree(items, searchQuery),
    [items, searchQuery],
  );
  const isSearching = searchQuery.trim().length > 0;
  const searchExpandedKeys = useMemo(
    () => new Set(collectFolderKeys(visibleItems)),
    [visibleItems],
  );

  const isExpanded = (key: string) =>
    isSearching ? searchExpandedKeys.has(key) : expandedKeys.has(key);

  const flatNodes = useMemo(() => {
    const out: FlatNode[] = [];
    flattenVisible(visibleItems, null, isExpanded, out);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isExpanded is derived from the same deps already listed.
  }, [visibleItems, isSearching, searchExpandedKeys, expandedKeys]);

  const flatNodeIndexByKey = useMemo(() => {
    const map = new Map<string, number>();
    flatNodes.forEach((flat, index) => map.set(flat.key, index));
    return map;
  }, [flatNodes]);

  const selectedKey = selectedPath ? pathKey(selectedPath) : undefined;

  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const focusRow = (key: string | null | undefined) => {
    if (key) {
      rowRefs.current.get(key)?.focus();
    }
  };

  const handleRowKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    flat: FlatNode,
  ) => {
    const hasChildren = Boolean(flat.node.children?.length);
    const key = flat.key;
    const index = flatNodeIndexByKey.get(key) ?? -1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusRow(flatNodes[index + 1]?.key);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusRow(flatNodes[index - 1]?.key);
    } else if (e.key === 'ArrowRight') {
      if (!hasChildren) {
        return;
      }
      e.preventDefault();
      if (!isExpanded(key)) {
        toggleExpanded(key);
      } else {
        focusRow(flatNodes[index + 1]?.key);
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (hasChildren && isExpanded(key)) {
        toggleExpanded(key);
      } else {
        focusRow(flat.parentKey);
      }
    }
  };

  const startCreatingFolder = (parentPath: string[]) => {
    const parentKey = pathKey(parentPath);
    setCreatingParentKey(parentKey);
    setNewFolderName('');
    setDuplicateError(false);
    if (parentKey) {
      setExpandedKeys((prev) => new Set(prev).add(parentKey));
    }
  };

  const cancelCreatingFolder = () => {
    setCreatingParentKey(null);
    setNewFolderName('');
    setDuplicateError(false);
  };

  const confirmCreatingFolder = (parentPath: string[]) => {
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      return;
    }
    const siblings = getSiblings(items, parentPath);
    const isDuplicate = siblings.some(
      (sibling) => sibling.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (isDuplicate) {
      setDuplicateError(true);
      return;
    }
    onCreateFolder(parentPath, trimmed);
    onSelectedPathChange([...parentPath, trimmed]);
    cancelCreatingFolder();
  };

  const renderCreatingRow = (parentPath: string[], depth: number) => (
    <div>
      <div
        className="flex items-center gap-2 py-2 pe-3"
        style={{ paddingInlineStart: BASE_INDENT_PX + depth * INDENT_PX }}
      >
        <IconFolder
          size={DIAL_ICON_SIZE.SM}
          className="shrink-0 text-tertiary"
        />
        <input
          autoFocus
          type="text"
          aria-label={newFolderNameAriaLabel}
          value={newFolderName}
          disabled={disabled}
          onChange={(e) => {
            setNewFolderName(e.target.value);
            setDuplicateError(false);
          }}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') {
              confirmCreatingFolder(parentPath);
            } else if (e.key === 'Escape') {
              cancelCreatingFolder();
            }
          }}
          className={mergeClasses(
            'min-w-0 flex-1 border-0 bg-transparent p-0 outline-none',
            nodeClassName,
          )}
        />
        <button
          type="button"
          aria-label={confirmCreateFolderAriaLabel}
          disabled={disabled}
          onClick={() => confirmCreatingFolder(parentPath)}
          className="text-accent-primary"
        >
          <IconCheck size={DIAL_ICON_SIZE.SM} />
        </button>
        <button
          type="button"
          aria-label={cancelCreateFolderAriaLabel}
          disabled={disabled}
          onClick={cancelCreatingFolder}
          className="text-secondary"
        >
          <IconX size={DIAL_ICON_SIZE.SM} />
        </button>
      </div>
      {duplicateError && (
        <p
          className="dial-tiny-text pb-2 text-error"
          style={{ paddingInlineStart: BASE_INDENT_PX + depth * INDENT_PX }}
        >
          {duplicateFolderNameError.replace('{name}', newFolderName.trim())}
        </p>
      )}
    </div>
  );

  const renderNode = (node: PublishFolderNode, depth: number): ReactNode => {
    const key = pathKey(node.path);
    const expanded = isExpanded(key);
    const isSelected = selectedKey === key;
    const hasChildren = Boolean(node.children?.length);
    const isCreatingHere = creatingParentKey === key;
    const flat = { key, node, parentKey: null } as FlatNode;

    return (
      <div key={key} role="none">
        <div
          role="treeitem"
          aria-selected={isSelected}
          aria-expanded={hasChildren ? expanded : undefined}
          className={mergeClasses(
            'flex items-center gap-2 rounded-lg border py-2 pe-3 hover:bg-layer-2',
            isSelected
              ? 'border-accent-primary bg-accent-primary-alpha'
              : 'border-transparent',
          )}
          style={{ paddingInlineStart: BASE_INDENT_PX + depth * INDENT_PX }}
        >
          <IconFolder
            size={DIAL_ICON_SIZE.SM}
            className="shrink-0 text-tertiary"
          />
          {hasChildren && (
            <button
              type="button"
              aria-label={getToggleAriaLabel(node.name, expanded)}
              disabled={disabled}
              onClick={() => toggleExpanded(key)}
              className="shrink-0 text-secondary"
            >
              <IconChevronRight
                size={DIAL_ICON_SIZE.SM}
                className={mergeClasses(
                  expanded ? 'rotate-90' : 'rtl:scale-x-[-1]',
                )}
              />
            </button>
          )}
          <button
            type="button"
            ref={(el) => {
              if (el) {
                rowRefs.current.set(key, el);
              } else {
                rowRefs.current.delete(key);
              }
            }}
            disabled={disabled}
            onClick={() => onSelectedPathChange(isSelected ? [] : node.path)}
            onKeyDown={(e) => {
              const index = flatNodeIndexByKey.get(key);
              handleRowKeyDown(
                e,
                index !== undefined ? flatNodes[index] : flat,
              );
            }}
            className={mergeClasses(
              'min-w-0 flex-1 truncate text-start',
              nodeClassName,
            )}
          >
            {isSearching ? (
              <Highlight text={node.name} query={searchQuery} />
            ) : (
              node.name
            )}
          </button>
          {isSelected && (
            <IconCheck
              size={DIAL_ICON_SIZE.SM}
              className="shrink-0 text-accent-primary"
              aria-hidden
            />
          )}
        </div>
        {expanded && (
          <div role="group">
            {node.children?.map((child) => renderNode(child, depth + 1))}
            {isCreatingHere && renderCreatingRow(node.path, depth + 1)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={mergeClasses(disabled && 'opacity-60')}>
      <div role="tree" aria-disabled={disabled}>
        {visibleItems.map((node) => renderNode(node, 0))}
        {creatingParentKey === '' && renderCreatingRow([], 0)}
      </div>
      {isSearching && visibleItems.length === 0 && (
        <p className="dial-small-text py-2 text-secondary">
          {noResultsText.replace('{query}', searchQuery.trim())}
        </p>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => startCreatingFolder(selectedPath ?? [])}
        className="dial-small-semi-text mt-2 flex w-full items-center gap-2 border-t border-tertiary px-3 py-3 text-accent-primary"
      >
        <IconPlus size={DIAL_ICON_SIZE.SM} />
        {createFolderLabel}
      </button>
    </div>
  );
};
