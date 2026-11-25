/* Plain values, not kit re-exports: this module is evaluated on import of the
 * lib barrel, where hosts and specs may replace `@epam/ai-dial-ui-kit` with a
 * partial mock. */

/** Width of the skeleton title line in pixels. */
export const PDF_SKELETON_TITLE_WIDTH = 208;

/** Width of the last line of each skeleton paragraph, one entry per paragraph. */
export const PDF_SKELETON_LAST_LINE_WIDTHS = ['45%', '60%'];

/** Number of full-width lines rendered before the last line of each skeleton paragraph. */
export const PDF_SKELETON_FULL_LINES_PER_PARAGRAPH = 4;
