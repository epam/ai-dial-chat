/* Minimum pixel width the main content area must retain when a side panel is open. */
export const MIN_CONTENT_AREA_WIDTH = 400;

/* Desktop navigation sidebar width in pixels; mirrors `NavigationSidebar`'s `w-[72px]` / `w-[336px]` column classes. */
export const NAVIGATION_SIDEBAR_COLLAPSED_WIDTH = 72;
export const NAVIGATION_SIDEBAR_EXPANDED_WIDTH = 336;

/* Preview panel on the file manager page: share of the viewport, and its bounds in pixels. */
export const FILE_MANAGER_CANVAS_WIDTH_RATIO = 0.33;
export const FILE_MANAGER_CANVAS_MIN_WIDTH = 400;
export const FILE_MANAGER_CANVAS_DEFAULT_MAX_WIDTH = 640;

/**
 * Height and vertical padding shared by the page headers (Catalog, File
 * manager, Usage, Scheduled tasks) in both navigation layouts: 16px above and
 * below a title row that is at least 40px tall, so a 40px action button beside
 * the title does not change the header's height.
 */
export const PAGE_HEADER_ROW_CLASS = 'min-h-[72px] py-4';

/** `id` of the mobile sidebar drawer, referenced by the header toggle's `aria-controls`. */
export const MOBILE_SIDEBAR_ID = 'mobile-sidebar';
