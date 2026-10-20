import {
  FILE_MANAGER_CANVAS_DEFAULT_MAX_WIDTH,
  FILE_MANAGER_CANVAS_MIN_WIDTH,
  FILE_MANAGER_CANVAS_WIDTH_RATIO,
  MIN_CONTENT_AREA_WIDTH,
} from '../constants/layout';

/** Inputs for {@link resolveCanvasWidth}. */
interface ResolveCanvasWidthParams {
  /** Whether the current route is the file manager page. */
  isFileManagerRoute: boolean;
  /** Whether the viewport is in the mobile breakpoint, where the panel fills it. */
  isMobile: boolean;
  /** Current viewport width in pixels. */
  viewportWidth: number;
  /** Widest the panel may be, leaving the main content its minimum width. */
  maxWidth: number;
}

/** Initial and minimum width, in pixels, for the attachment canvas panel. */
interface CanvasWidth {
  /** Initial width. */
  defaultWidth: number;
  /** Minimum width; `undefined` keeps the canvas's own minimum. */
  minWidth: number | undefined;
}

/**
 * Picks the attachment canvas panel's initial and minimum width. A conversation
 * opens it at half the viewport; the file manager page opens it narrower,
 * about a third of the viewport kept within its own bounds, so the grid beside
 * it stays usable. On mobile the panel fills the viewport.
 */
export const resolveCanvasWidth = ({
  isFileManagerRoute,
  isMobile,
  viewportWidth,
  maxWidth,
}: ResolveCanvasWidthParams): CanvasWidth => {
  const minWidth = isFileManagerRoute
    ? FILE_MANAGER_CANVAS_MIN_WIDTH
    : undefined;

  if (isMobile) {
    return { defaultWidth: viewportWidth, minWidth };
  }

  if (isFileManagerRoute) {
    const share = Math.round(viewportWidth * FILE_MANAGER_CANVAS_WIDTH_RATIO);
    const bounded = Math.max(
      FILE_MANAGER_CANVAS_MIN_WIDTH,
      Math.min(FILE_MANAGER_CANVAS_DEFAULT_MAX_WIDTH, share),
    );
    return { defaultWidth: Math.min(maxWidth, bounded), minWidth };
  }

  return {
    defaultWidth: Math.min(
      maxWidth,
      Math.round((maxWidth + MIN_CONTENT_AREA_WIDTH) * 0.5),
    ),
    minWidth,
  };
};
