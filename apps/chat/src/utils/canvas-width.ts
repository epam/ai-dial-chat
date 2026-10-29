import {
  CanvasWidthMode,
  resolveCanvasWidth as resolveWidth,
} from '@epam/ai-dial-chat-hooks/viewport-layout';
import {
  FILE_MANAGER_CANVAS_DEFAULT_MAX_WIDTH,
  FILE_MANAGER_CANVAS_MIN_WIDTH,
  FILE_MANAGER_CANVAS_WIDTH_RATIO,
  MIN_CONTENT_AREA_WIDTH,
  NAVIGATION_SIDEBAR_COLLAPSED_WIDTH,
  NAVIGATION_SIDEBAR_EXPANDED_WIDTH,
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
 * opens it at half the room the navigation sidebar leaves (`maxWidth` already
 * excludes the sidebar); the file manager page opens it narrower, about a third
 * of the viewport kept within its own bounds, so the grid beside it stays
 * usable. On mobile the panel fills the viewport.
 */
export const resolveCanvasWidth = ({
  isFileManagerRoute,
  ...params
}: ResolveCanvasWidthParams): CanvasWidth =>
  resolveWidth({
    ...params,
    mode: isFileManagerRoute
      ? CanvasWidthMode.BoundedPanel
      : CanvasWidthMode.Conversation,
    policy: {
      minWidth: FILE_MANAGER_CANVAS_MIN_WIDTH,
      defaultMaxWidth: FILE_MANAGER_CANVAS_DEFAULT_MAX_WIDTH,
      widthRatio: FILE_MANAGER_CANVAS_WIDTH_RATIO,
      minContentWidth: MIN_CONTENT_AREA_WIDTH,
    },
  });
/** Desktop navigation sidebar width in pixels for its expanded or collapsed state. */
export const getNavigationSidebarWidth = (isExpanded: boolean): number =>
  isExpanded
    ? NAVIGATION_SIDEBAR_EXPANDED_WIDTH
    : NAVIGATION_SIDEBAR_COLLAPSED_WIDTH;
