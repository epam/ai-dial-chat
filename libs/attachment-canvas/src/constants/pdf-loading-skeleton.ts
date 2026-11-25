import { SKELETON_BAR_WIDTHS } from '@epam/ai-dial-ui-kit';

/** Width of the skeleton title line in pixels. */
export const PDF_SKELETON_TITLE_WIDTH = 208;

/** Width of the last line of each skeleton paragraph, one entry per paragraph. */
export const PDF_SKELETON_LAST_LINE_WIDTHS = [
  SKELETON_BAR_WIDTHS[1],
  SKELETON_BAR_WIDTHS[2],
];

/** Number of full-width lines rendered before the last line of each skeleton paragraph. */
export const PDF_SKELETON_FULL_LINES_PER_PARAGRAPH = 4;
