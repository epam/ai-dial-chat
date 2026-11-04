import { mergeClasses } from '@epam/ai-dial-chat-shared';
import projectStyles from '../components/ProjectRow/ProjectRow.module.scss';
import {
  FIRST_GROUP_HEADER_ROW_HEIGHT,
  GROUP_HEADER_ROW_HEIGHT,
  INDICATOR_FIRST_GROUP_HEADER_ROW_HEIGHT,
  INDICATOR_GROUP_HEADER_ROW_HEIGHT,
  INDICATOR_ITEM_ROW_HEIGHT,
  ITEM_ROW_HEIGHT,
} from '../constants/virtual-list';
import type {
  NestedRowPosition,
  NestedRowProps,
  PinnedProjectGroup,
} from '../models/pinned-projects';
import type { RowRendererData, VirtualRow } from '../models/virtual-row';
import { ConversationRowVariant } from '../types/conversation-row-variant';
import { VirtualRowKind } from '../types/virtual-row';

/** Number of skeleton placeholder rows shown while conversations are loading. */
export const SKELETON_ROW_COUNT = 15;

/** Returns a pseudo-randomised width percentage for the skeleton title bar at index `i`. */
export const getSkeletonWidth = (i: number) => `${60 + ((i * 23) % 35)}%`;

/**
 * Returns the inline-end padding Tailwind class for the row's ghost button based
 * on action state and row variant. The reserved gutter has to cover every state in which the
 * actions trigger is actually visible — hover *and* focus-within (see the
 * trigger's own visibility classes in `ConversationRow`). A row keeps focus
 * after it is clicked or dragged, so reserving on hover alone left the trigger
 * painted on top of the title's ellipsis once the pointer moved away.
 */
export const getButtonPaddingEnd = (
  hasActions: boolean,
  isMenuOpen: boolean,
  variant: ConversationRowVariant = ConversationRowVariant.Avatar,
): string => {
  if (!hasActions) {
    return variant === ConversationRowVariant.Indicator ? 'pe-2' : 'pe-3';
  }
  if (isMenuOpen) return 'pe-9';
  return 'pe-2 group-focus-within/conversation:pe-9 group-hover/conversation:pe-9';
};

/** Returns the level-2 ARIA position and the indent and guide-line classes of a row nested under a project row. */
export const getNestedRowProps = (
  position: NestedRowPosition,
): NestedRowProps => ({
  'aria-level': 2,
  'aria-posinset': position.posInSet,
  'aria-setsize': position.setSize,
  className: mergeClasses(
    'ps-7',
    projectStyles.guideLine,
    position.isFirstNested && projectStyles.guideLineFirst,
    position.isLastNested && projectStyles.guideLineLast,
  ),
});

/** Returns the pixel height for a virtual list row (item, first group header, or subsequent group header) in the active row variant; pinned project rows take the `Indicator` item height, except chats nested under a project in the `Avatar` variant. */
export const getRowHeight = (
  index: number,
  rowProps: RowRendererData,
): number => {
  const row = rowProps.rows[index];
  if (
    row.kind === VirtualRowKind.ProjectConversation &&
    rowProps.projectConversationVariant === ConversationRowVariant.Avatar
  ) {
    return ITEM_ROW_HEIGHT;
  }
  if (
    row.kind === VirtualRowKind.Project ||
    row.kind === VirtualRowKind.ProjectConversation ||
    row.kind === VirtualRowKind.ProjectSeeAll
  ) {
    return INDICATOR_ITEM_ROW_HEIGHT;
  }
  if (rowProps.rowVariant === ConversationRowVariant.Indicator) {
    if (row.kind === VirtualRowKind.Item) return INDICATOR_ITEM_ROW_HEIGHT;
    return index === 0
      ? INDICATOR_FIRST_GROUP_HEADER_ROW_HEIGHT
      : INDICATOR_GROUP_HEADER_ROW_HEIGHT;
  }
  if (row.kind === VirtualRowKind.Item) return ITEM_ROW_HEIGHT;
  return index === 0 ? FIRST_GROUP_HEADER_ROW_HEIGHT : GROUP_HEADER_ROW_HEIGHT;
};

/* Fewest rows kept mounted beyond each edge of the viewport, even for a tiny list. */
const MIN_OVERSCAN_COUNT = 5;

/** Returns how many rows to render beyond each edge of a viewport `height` pixels tall: half a viewport, at least 5. */
export const getOverscanCount = (height: number): number =>
  Math.max(
    MIN_OVERSCAN_COUNT,
    Math.ceil(Math.ceil(height / ITEM_ROW_HEIGHT) / 2),
  );

/** Returns the distinct conversation IDs of item rows in the inclusive `startIndex`–`stopIndex` range, in row order. */
export const getConversationIdsInRange = (
  rows: VirtualRow[],
  { startIndex, stopIndex }: { startIndex: number; stopIndex: number },
): string[] => {
  const ids = new Set<string>();
  for (
    let index = Math.max(0, startIndex);
    index <= Math.min(stopIndex, rows.length - 1);
    index++
  ) {
    const row = rows[index];
    if (row.kind === VirtualRowKind.Item) ids.add(row.item.id);
  }
  return [...ids];
};

/** Returns true when both ID sequences hold the same IDs in the same order. */
export const isSameIdSequence = (left: string[], right: string[]): boolean =>
  left.length === right.length &&
  left.every((id, index) => id === right[index]);

/** Returns a pinned project's rows: the project row, one row per conversation and the See all row when `hasMore` is set. */
export const buildProjectRows = (project: PinnedProjectGroup): VirtualRow[] => {
  const setSize = project.conversations.length + (project.hasMore ? 1 : 0);
  const rows: VirtualRow[] = [{ kind: VirtualRowKind.Project, project }];
  project.conversations.forEach((item, index) => {
    rows.push({
      kind: VirtualRowKind.ProjectConversation,
      item,
      projectId: project.id,
      posInSet: index + 1,
      setSize,
      isFirstNested: index === 0,
      isLastNested: index + 1 === setSize,
    });
  });
  if (project.hasMore) {
    rows.push({
      kind: VirtualRowKind.ProjectSeeAll,
      project,
      projectId: project.id,
      posInSet: setSize,
      setSize,
      isFirstNested: setSize === 1,
      isLastNested: true,
    });
  }
  return rows;
};
