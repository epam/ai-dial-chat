import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, DIAL_KIT_ICON_STROKE } from '@epam/ai-dial-ui-kit';
import { IconChevronDown } from '@tabler/icons-react';
import {
  FC,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { CatalogFolderNode } from '../../models/catalog-folders';
import type { CatalogFolderSelection } from '../../types/catalog-folders';
import { isSameFolderSelection } from '../../utils/catalog-folders';
import styles from './CatalogFolderTree.module.scss';

/** Color overrides for `CatalogFolderTree`, applied as CSS custom properties. */
export interface FolderTreeColors {
  /** Background of a hovered or focused row. Fallback: `--bg-control-accent-alpha-hover`. */
  rowHoverBackground?: string;
  /** Background of the selected row. Fallback: `--bg-control-accent-alpha-active`. */
  rowSelectedBackground?: string;
}

/** Props for CatalogFolderTree. */
export interface CatalogFolderTreeProps {
  /** Root nodes listed under "All entities". */
  tree: CatalogFolderNode[];
  /** Selected folder; its row carries `aria-selected` and takes focus on mount. */
  selection: CatalogFolderSelection;
  /** Called with the picked folder. */
  onSelect: (selection: CatalogFolderSelection) => void;
  /** Text of the first row. Default: 'All entities'. */
  allEntitiesLabel?: string;
  /** Accessible name of the tree. Default: 'Folders'. */
  ariaLabel?: string;
  /** Typography class of the row labels. Default: `'dial-small-text'`. */
  rowClassName?: string;
  /** Color overrides applied as CSS custom properties. */
  colors?: FolderTreeColors;
}

const ALL_ENTITIES_ID = '';

/* A row of the flattened tree; the All entities row has no `node`. */
interface VisibleRow {
  id: string;
  parentId?: string;
  selection: CatalogFolderSelection;
  hasChildren: boolean;
}

const toSelection = (node: CatalogFolderNode): CatalogFolderSelection => ({
  root: node.root,
  path: node.path,
});

const flatten = (
  nodes: CatalogFolderNode[],
  expanded: Set<string>,
  parentId: string,
): VisibleRow[] =>
  nodes.flatMap((node) => {
    const row: VisibleRow = {
      id: node.id,
      parentId,
      selection: toSelection(node),
      hasChildren: node.children.length > 0,
    };
    return expanded.has(node.id)
      ? [row, ...flatten(node.children, expanded, node.id)]
      : [row];
  });

/* Ids of the All entities row and every folder that contains the selection. */
const getAncestorIds = (
  tree: CatalogFolderNode[],
  selection: CatalogFolderSelection,
): string[] => {
  const ids = [ALL_ENTITIES_ID];
  if (selection.root == null) return ids;
  let level = tree;
  let node = level.find((n) => n.root === selection.root);
  for (const segment of selection.path) {
    if (node == null) break;
    ids.push(node.id);
    level = node.children;
    node = level.find((n) => n.label === segment);
  }
  return ids;
};

/** Accessible folder tree with "All entities" as its first row, one roving tab stop and keyboard expansion. */
export const CatalogFolderTree: FC<CatalogFolderTreeProps> = ({
  tree,
  selection,
  onSelect,
  allEntitiesLabel = 'All entities',
  ariaLabel = 'Folders',
  rowClassName = 'dial-small-text',
  colors,
}) => {
  const cssVars = buildCssVars({
    '--cat-folder-tree-row-hover-bg': colors?.rowHoverBackground,
    '--cat-folder-tree-row-selected-bg': colors?.rowSelectedBackground,
  });

  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(getAncestorIds(tree, selection)),
  );

  const rows = useMemo<VisibleRow[]>(() => {
    const allRow: VisibleRow = {
      id: ALL_ENTITIES_ID,
      selection: { path: [] },
      hasChildren: tree.length > 0,
    };
    return expanded.has(ALL_ENTITIES_ID)
      ? [allRow, ...flatten(tree, expanded, ALL_ENTITIES_ID)]
      : [allRow];
  }, [tree, expanded]);

  const selectedId =
    rows.find((row) => isSameFolderSelection(row.selection, selection))?.id ??
    ALL_ENTITIES_ID;

  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [focusedId, setFocusedId] = useState(selectedId);

  useEffect(() => {
    rowRefs.current[focusedId]?.focus();
    // Focus the selected row once, when the tree mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moveFocusTo = (id: string) => {
    setFocusedId(id);
    rowRefs.current[id]?.focus();
  };

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleExpandKey = (current: VisibleRow) => {
    if (!current.hasChildren) return;
    if (!expanded.has(current.id)) {
      toggle(current.id);
      return;
    }
    const index = rows.indexOf(current);
    const child = rows[index + 1];
    if (child?.parentId === current.id) moveFocusTo(child.id);
  };

  const handleCollapseKey = (current: VisibleRow) => {
    if (current.hasChildren && expanded.has(current.id)) {
      toggle(current.id);
    } else if (current.parentId != null) {
      moveFocusTo(current.parentId);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = rows.findIndex((row) => row.id === focusedId);
    if (index === -1) return;
    const current = rows[index];
    // Left and right follow the visual direction: in RTL, Left expands.
    const isRtl =
      event.currentTarget.closest('[dir]')?.getAttribute('dir') === 'rtl';
    const expandKey = isRtl ? 'ArrowLeft' : 'ArrowRight';
    const collapseKey = isRtl ? 'ArrowRight' : 'ArrowLeft';

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (rows[index + 1]) moveFocusTo(rows[index + 1].id);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (rows[index - 1]) moveFocusTo(rows[index - 1].id);
        break;
      case expandKey:
        event.preventDefault();
        handleExpandKey(current);
        break;
      case collapseKey:
        event.preventDefault();
        handleCollapseKey(current);
        break;
      case 'Home':
        event.preventDefault();
        moveFocusTo(rows[0].id);
        break;
      case 'End':
        event.preventDefault();
        moveFocusTo(rows[rows.length - 1].id);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        onSelect(current.selection);
        break;
      default:
        break;
    }
  };

  const renderRow = (
    id: string,
    label: string,
    level: number,
    rowSelection: CatalogFolderSelection,
    children: ReactNode[],
  ): ReactNode => {
    const hasChildren = children.length > 0;
    const isExpanded = hasChildren && expanded.has(id);
    const isSelected = id === selectedId;
    const isFocused = id === focusedId;

    const handleCaretClick = (event: MouseEvent<HTMLSpanElement>) => {
      event.stopPropagation();
      toggle(id);
    };

    return (
      <div key={id} role="none">
        {/* Keyboard activation bubbles into the tree's onKeyDown. */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
        <div
          ref={(el) => {
            rowRefs.current[id] = el;
          }}
          role="treeitem"
          aria-level={level}
          aria-expanded={hasChildren ? isExpanded : undefined}
          aria-selected={isSelected}
          tabIndex={isFocused ? 0 : -1}
          className={mergeClasses(
            'flex h-10 shrink-0 cursor-pointer items-center gap-1 rounded-lg pe-3 outline-hidden',
            styles.row,
            isSelected && styles.selectedRow,
          )}
          style={{ paddingInlineStart: `${(level - 1) * 16 + 4}px` }}
          onClick={() => onSelect(rowSelection)}
          onFocus={() => setFocusedId(id)}
        >
          {/* Pointer-only caret: keyboard users expand with the arrow keys. */}
          {}
          <span
            aria-hidden
            className={mergeClasses(
              'flex size-6 shrink-0 items-center justify-center',
              !hasChildren && 'invisible',
            )}
            onClick={hasChildren ? handleCaretClick : undefined}
          >
            <IconChevronDown
              size={DIAL_ICON_SIZE.SM}
              stroke={DIAL_KIT_ICON_STROKE}
              className={mergeClasses(
                'transition-transform',
                !isExpanded && '-rotate-90 rtl:scale-x-[-1]',
              )}
            />
          </span>
          <span
            className={mergeClasses('min-w-0 flex-1 truncate', rowClassName)}
          >
            {label}
          </span>
        </div>
        {isExpanded && <div role="group">{children}</div>}
      </div>
    );
  };

  const renderNode = (node: CatalogFolderNode, level: number): ReactNode =>
    renderRow(
      node.id,
      node.label,
      level,
      toSelection(node),
      node.children.map((child) => renderNode(child, level + 1)),
    );

  return (
    // Focus lives on the roving-tabIndex treeitem rows, not the tree root itself.
    // eslint-disable-next-line jsx-a11y/interactive-supports-focus
    <div
      role="tree"
      aria-label={ariaLabel}
      style={cssVars}
      className="flex flex-col gap-0.5"
      onKeyDown={handleKeyDown}
    >
      {renderRow(
        ALL_ENTITIES_ID,
        allEntitiesLabel,
        1,
        { path: [] },
        tree.map((node) => renderNode(node, 2)),
      )}
    </div>
  );
};
