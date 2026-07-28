import useViewportWidth from './use-viewport-width';

/* Minimum pixel width the main content area must retain when a side panel is open. */
export const MIN_CONTENT_AREA_WIDTH = 400;

/* Returns the maximum pixel width a resizable side panel may occupy without collapsing the content area below MIN_CONTENT_AREA_WIDTH. */
const usePanelMaxWidth = (): number => {
  const viewportWidth = useViewportWidth();
  return Math.max(0, viewportWidth - MIN_CONTENT_AREA_WIDTH);
};

export default usePanelMaxWidth;
