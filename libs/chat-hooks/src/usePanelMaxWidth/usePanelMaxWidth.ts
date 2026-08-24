import { useViewportWidth } from '../useViewportWidth/useViewportWidth';

/**
 * Returns the maximum pixel width a resizable side panel may occupy without
 * collapsing the main content area below `minContentAreaWidth`.
 */
export const usePanelMaxWidth = (minContentAreaWidth: number): number => {
  const viewportWidth = useViewportWidth();
  return Math.max(0, viewportWidth - minContentAreaWidth);
};
