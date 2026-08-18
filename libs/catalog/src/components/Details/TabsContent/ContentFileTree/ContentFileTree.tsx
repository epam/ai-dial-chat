import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import { IconChevronDown, IconFolder } from '@tabler/icons-react';
import {
  FC,
  KeyboardEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { CatalogContentTreeNode } from '../../../../models/item-details-data';
import { CatalogContentNodeType } from '../../../../types/catalog-content-node-type';

/** Props for {@link ContentFileTree}. */
export interface ContentFileTreeProps {
  /** Root-level folder and file nodes to render. */
  nodes: CatalogContentTreeNode[];
  /** Id of the file currently displayed; its row carries `aria-selected` and receives initial focus. */
  selectedFileId?: string;
  /** Ids of folders currently expanded. */
  expandedFolderIds: ReadonlySet<string>;
  /** Called with a folder's id when its disclosure control is toggled. */
  onToggleFolder: (folderId: string) => void;
  /** Called with a file's id when it is picked. */
  onSelectFile: (fileId: string) => void;
  /** Called on Escape, without changing the selection. */
  onClose: () => void;
  /** Accessible name for the root `role="tree"` element. */
  ariaLabel?: string;
  /** Typography class applied to every row's name text. Defaults to `'dial-small-text'`. */
  rowNameClassName?: string;
}

interface FlatRow {
  node: CatalogContentTreeNode;
  parentId: string | undefined;
}

const flattenVisible = (
  nodes: CatalogContentTreeNode[],
  expandedFolderIds: ReadonlySet<string>,
  parentId: string | undefined = undefined,
): FlatRow[] =>
  nodes.flatMap((node) => {
    const row: FlatRow = { node, parentId };
    if (node.type === CatalogContentNodeType.File) return [row];
    if (!expandedFolderIds.has(node.id)) return [row];
    return [row, ...flattenVisible(node.items, expandedFolderIds, node.id)];
  });

/**
 * Recursive, read-only folder/file tree rendered inside the Content tab's
 * selector overlay. Owns roving-tabIndex keyboard navigation over its own
 * DOM; expand/collapse and selection state are fully controlled by the host.
 */
export const ContentFileTree: FC<ContentFileTreeProps> = ({
  nodes,
  selectedFileId,
  expandedFolderIds,
  onToggleFolder,
  onSelectFile,
  onClose,
  ariaLabel = 'Select file',
  rowNameClassName = 'dial-small-text',
}) => {
  const rows = useMemo(
    () => flattenVisible(nodes, expandedFolderIds),
    [nodes, expandedFolderIds],
  );
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [focusedId, setFocusedId] = useState<string | undefined>(
    () => selectedFileId ?? rows[0]?.node.id,
  );

  useEffect(() => {
    if (focusedId != null) rowRefs.current[focusedId]?.focus();
    // Focus the currently displayed file's row once, when the tree mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moveFocusTo = (id: string) => {
    setFocusedId(id);
    rowRefs.current[id]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = rows.findIndex((row) => row.node.id === focusedId);
    if (currentIndex === -1) return;
    const current = rows[currentIndex];

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        const next = rows[currentIndex + 1];
        if (next) moveFocusTo(next.node.id);
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        const prev = rows[currentIndex - 1];
        if (prev) moveFocusTo(prev.node.id);
        break;
      }
      case 'ArrowRight': {
        event.preventDefault();
        if (
          current.node.type === CatalogContentNodeType.Folder &&
          !expandedFolderIds.has(current.node.id)
        ) {
          onToggleFolder(current.node.id);
        }
        break;
      }
      case 'ArrowLeft': {
        event.preventDefault();
        if (
          current.node.type === CatalogContentNodeType.Folder &&
          expandedFolderIds.has(current.node.id)
        ) {
          onToggleFolder(current.node.id);
        } else if (current.parentId != null) {
          moveFocusTo(current.parentId);
        }
        break;
      }
      case 'Enter':
      case ' ': {
        event.preventDefault();
        if (current.node.type === CatalogContentNodeType.Folder) {
          onToggleFolder(current.node.id);
        } else {
          onSelectFile(current.node.id);
        }
        break;
      }
      case 'Escape': {
        event.preventDefault();
        onClose();
        break;
      }
      default:
        break;
    }
  };

  const rowClassName = (isFocused: boolean) =>
    mergeClasses(
      'flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-2 px-3 outline-none',
      'hover:bg-control-accent-alpha-hover focus-visible:bg-control-accent-alpha-hover',
      isFocused && 'bg-control-accent-alpha-hover',
    );

  const renderNode = (node: CatalogContentTreeNode): ReactNode => {
    const isFocused = node.id === focusedId;

    if (node.type === CatalogContentNodeType.File) {
      const isSelected = node.id === selectedFileId;
      return (
        // Keyboard activation (Enter/Space) is handled by the root's onKeyDown,
        // which every row's keydown bubbles into.
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events
        <div
          key={node.id}
          ref={(el) => {
            rowRefs.current[node.id] = el;
          }}
          role="treeitem"
          aria-selected={isSelected}
          tabIndex={isFocused ? 0 : -1}
          className={mergeClasses(
            rowClassName(isFocused),
            isSelected && 'bg-control-accent-alpha-active',
          )}
          onClick={() => onSelectFile(node.id)}
          onFocus={() => setFocusedId(node.id)}
        >
          <span
            className={mergeClasses(
              'min-w-0 flex-1 truncate',
              rowNameClassName,
            )}
          >
            {node.name}
          </span>
        </div>
      );
    }

    const isExpanded = expandedFolderIds.has(node.id);
    return (
      <div key={node.id}>
        {/*
         * Folders are not selectable in this single-select file tree, so
         * `aria-selected` is deliberately omitted — only file rows carry it.
         * Keyboard activation bubbles into the root's onKeyDown.
         */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
        <div
          ref={(el) => {
            rowRefs.current[node.id] = el;
          }}
          // eslint-disable-next-line jsx-a11y/role-has-required-aria-props
          role="treeitem"
          aria-expanded={isExpanded}
          tabIndex={isFocused ? 0 : -1}
          className={rowClassName(isFocused)}
          onClick={() => onToggleFolder(node.id)}
          onFocus={() => setFocusedId(node.id)}
        >
          <IconFolder
            size={DIAL_ICON_SIZE.SM}
            className="shrink-0"
            aria-hidden
          />
          <span
            className={mergeClasses(
              'min-w-0 flex-1 truncate',
              rowNameClassName,
            )}
          >
            {node.name}
          </span>
          <IconChevronDown
            size={DIAL_ICON_SIZE.SM}
            className={mergeClasses(
              'shrink-0 transition-transform',
              !isExpanded && '-rotate-90 rtl:rotate-90',
            )}
            aria-hidden
          />
        </div>
        {isExpanded && node.items.length > 0 && (
          <div role="group" className="ps-6">
            {node.items.map((child) => renderNode(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    // Focus lives on the roving-tabIndex treeitem rows, not the tree root itself.
    // eslint-disable-next-line jsx-a11y/interactive-supports-focus
    <div role="tree" aria-label={ariaLabel} onKeyDown={handleKeyDown}>
      {nodes.map((node) => renderNode(node))}
    </div>
  );
};
