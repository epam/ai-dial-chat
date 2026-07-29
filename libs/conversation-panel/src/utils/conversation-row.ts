import {
  FIRST_GROUP_HEADER_ROW_HEIGHT,
  GROUP_HEADER_ROW_HEIGHT,
  ITEM_ROW_HEIGHT,
} from '../constants/virtual-list';
import { type RowRendererData, VirtualRowKind } from '../models/virtual-row';

/** Number of skeleton placeholder rows shown while conversations are loading. */
export const SKELETON_ROW_COUNT = 15;

/** Returns a pseudo-randomised width percentage for the skeleton title bar at index `i`. */
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

/** Returns the pixel height for a virtual list row (item, first group header, or subsequent group header). */
export const getRowHeight = (
  index: number,
  rowProps: RowRendererData,
): number => {
  const row = rowProps.rows[index];
  if (row.kind === VirtualRowKind.Item) return ITEM_ROW_HEIGHT;
  return index === 0 ? FIRST_GROUP_HEADER_ROW_HEIGHT : GROUP_HEADER_ROW_HEIGHT;
};
