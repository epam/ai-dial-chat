import {
  DESKTOP_BREAKPOINT,
  DESKTOP_COLUMNS,
  MOBILE_COLUMNS,
} from '../constants/virtual-grid';

/** Returns the number of card columns based on the container's pixel width. */
export const getColumnCount = (containerWidth: number): number =>
  containerWidth >= DESKTOP_BREAKPOINT ? DESKTOP_COLUMNS : MOBILE_COLUMNS;
