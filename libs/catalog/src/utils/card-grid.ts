import {
  DESKTOP_BREAKPOINT,
  DESKTOP_COLUMNS,
  MOBILE_COLUMNS,
  TABLET_BREAKPOINT,
  TABLET_COLUMNS,
  XLARGE_BREAKPOINT,
  XLARGE_COLUMNS,
} from '../constants/virtual-grid';

/** Returns the number of card columns based on the container's pixel width. */
export const getColumnCount = (containerWidth: number): number => {
  if (containerWidth >= XLARGE_BREAKPOINT) return XLARGE_COLUMNS;
  if (containerWidth >= TABLET_BREAKPOINT) return DESKTOP_COLUMNS;
  if (containerWidth >= DESKTOP_BREAKPOINT) return TABLET_COLUMNS;
  return MOBILE_COLUMNS;
};
