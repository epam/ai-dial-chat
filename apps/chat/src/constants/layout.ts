/* Minimum pixel width the main content area must retain when a side panel is open. */
export const MIN_CONTENT_AREA_WIDTH = 400;

/**
 * Height and vertical padding shared by the page headers (Catalog, File
 * manager, Usage, Scheduled tasks) in both navigation layouts: 16px above and
 * below a title row that is at least 40px tall, so a 40px action button beside
 * the title does not change the header's height.
 */
export const PAGE_HEADER_ROW_CLASS = 'min-h-[72px] py-4';

/** `id` of the mobile sidebar drawer, referenced by the header toggle's `aria-controls`. */
export const MOBILE_SIDEBAR_ID = 'mobile-sidebar';
