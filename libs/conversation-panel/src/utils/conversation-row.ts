import {
  FIRST_GROUP_HEADER_ROW_HEIGHT,
  GROUP_HEADER_ROW_HEIGHT,
  ITEM_ROW_HEIGHT,
} from '../constants/virtual-list';
import { type RowRendererData, VirtualRowKind } from '../models/virtual-row';

export const SKELETON_ROW_COUNT = 15;

export const getSkeletonWidth = (i: number) => `${60 + ((i * 23) % 35)}%`;

/** Returns the inline-end padding Tailwind class for the row's ghost button based on action state. */
export const getButtonPaddingEnd = (
  hasActions: boolean,
  isMenuOpen: boolean,
): string => {
  if (!hasActions) return 'pe-3';
  if (isMenuOpen) return 'pe-9';
  return 'pe-2 group-hover/conversation:pe-9';
};

/**
 * Returns the pixel height for a virtual list row.
 *
 * Items use `ITEM_ROW_HEIGHT` (32px content + 4px top gap).
 * The first group header uses `FIRST_GROUP_HEADER_ROW_HEIGHT` (24px, no gap above).
 * Subsequent group headers use `GROUP_HEADER_ROW_HEIGHT` (24px + 8px top gap).
 */
export const getRowHeight = (
  index: number,
  rowProps: RowRendererData,
): number => {
  const row = rowProps.rows[index];
  if (row.kind === VirtualRowKind.Item) return ITEM_ROW_HEIGHT;
  return index === 0 ? FIRST_GROUP_HEADER_ROW_HEIGHT : GROUP_HEADER_ROW_HEIGHT;
};
