import {
  buildCssVars,
  ItemHeader,
  mergeClasses,
  useIsPhone,
} from '@epam/ai-dial-chat-shared';
import { Breadcrumbs, BreadcrumbsItem } from '@epam/ai-dial-ui-kit';
import { FC, useMemo } from 'react';
import type {
  CatalogFolderLabels,
  CatalogFolderNode,
} from '../../../models/catalog-folders';
import type { ToolbarStyles } from '../../../models/toolbar-props';
import type { CatalogFolderSelection } from '../../../types/catalog-folders';
import styles from '../Toolbar.module.scss';

/** Props for CatalogFolderHeader. */
export interface CatalogFolderHeaderProps {
  /** Root nodes; the selected root's label heads the trail. */
  tree: CatalogFolderNode[];
  /** Selected folder. */
  selection: CatalogFolderSelection;
  /** Called when a trail segment is activated. */
  onChange: (selection: CatalogFolderSelection) => void;
  /** Count shown after the heading or the trail. */
  totalCount?: number;
  /** Text of the folder navigation; `allEntities` is the heading. */
  labels: CatalogFolderLabels;
  /** Toolbar typography and colors shared with the heading. */
  styles?: ToolbarStyles;
}

/* Segments drawn on a phone before the middle collapses (the kit minimum):
   the root, the ellipsis and the current folder. */
const PHONE_MAX_VISIBLE_SEGMENTS = 3;

/** "All entities" heading with its count, or the breadcrumb trail of the selected folder. */
export const CatalogFolderHeader: FC<CatalogFolderHeaderProps> = ({
  tree,
  selection,
  onChange,
  totalCount,
  labels,
  styles: toolbarStyles,
}) => {
  const isPhone = useIsPhone();
  const titleClassName =
    toolbarStyles?.typography?.titleClassName ?? 'dial-body-semi-text';
  const countClassName =
    toolbarStyles?.typography?.countClassName ?? 'dial-tiny-semi-text';

  const items = useMemo<BreadcrumbsItem[]>(() => {
    if (selection.root == null) return [];
    const root = tree.find((node) => node.root === selection.root);
    const trail: BreadcrumbsItem[] = [
      { label: labels.allEntities, onClick: () => onChange({ path: [] }) },
      {
        label: root?.label ?? selection.root,
        onClick: () => onChange({ root: selection.root, path: [] }),
      },
      ...selection.path.map((segment, i) => ({
        label: segment,
        onClick: () =>
          onChange({
            root: selection.root,
            path: selection.path.slice(0, i + 1),
          }),
      })),
    ];
    // The last segment is the current folder, never a control.
    const last = trail[trail.length - 1];
    trail[trail.length - 1] = { label: last.label };
    return trail;
  }, [tree, selection, labels.allEntities, onChange]);

  if (items.length === 0) {
    return (
      <ItemHeader
        title={labels.allEntities}
        postfix={totalCount}
        titleClassName={titleClassName}
        postfixClassName={countClassName}
        className="shrink-0"
        shouldTruncateTitle={false}
        colors={{
          title: toolbarStyles?.colors?.titleText,
          count: toolbarStyles?.colors?.countText,
        }}
      />
    );
  }

  return (
    <div
      className="flex min-w-0 items-center gap-2"
      style={buildCssVars({
        '--cat-toolbar-count': toolbarStyles?.colors?.countText,
      })}
    >
      <Breadcrumbs
        items={items}
        ariaLabel={labels.breadcrumb}
        overflowAriaLabel={labels.showHiddenSegments}
        maxVisibleItems={isPhone ? PHONE_MAX_VISIBLE_SEGMENTS : undefined}
        className="min-w-0"
      />
      {totalCount != null && (
        <span
          className={mergeClasses(
            'shrink-0 whitespace-nowrap',
            countClassName,
            styles.folderCount,
          )}
        >
          {totalCount}
        </span>
      )}
    </div>
  );
};
