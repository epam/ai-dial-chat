/** Default width of the editor's left column, in px. */
export const DEFAULT_LEFT_COLUMN_WIDTH = 400;
/** Smallest width the left column can be dragged to, in px. */
export const MIN_LEFT_COLUMN_WIDTH = 280;
/** Largest width the left column can be dragged to, in px. */
export const MAX_LEFT_COLUMN_WIDTH = 640;
/** Width the center column always keeps, in px. */
export const MIN_CENTER_COLUMN_WIDTH = 360;
/** Width change of one arrow-key press, in px. */
export const LEFT_COLUMN_KEY_STEP = 16;

export interface ClampLeftColumnWidthOptions {
  min?: number;
  max?: number;
  /** Width of the body container; when known, the center column keeps `MIN_CENTER_COLUMN_WIDTH`. */
  containerWidth?: number;
}

/** Limits the left column width to `[min, max]` and to what leaves the center column its minimum. */
export const clampLeftColumnWidth = (
  width: number,
  {
    min = MIN_LEFT_COLUMN_WIDTH,
    max = MAX_LEFT_COLUMN_WIDTH,
    containerWidth,
  }: ClampLeftColumnWidthOptions = {},
): number => {
  const containerMax =
    containerWidth != null && containerWidth > 0
      ? containerWidth - MIN_CENTER_COLUMN_WIDTH
      : max;
  const upper = Math.max(min, Math.min(max, containerMax));
  const value = Number.isFinite(width) ? width : min;

  return Math.round(Math.min(upper, Math.max(min, value)));
};
