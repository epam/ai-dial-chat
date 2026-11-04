/*
 * Layout stays at 1280px. Menus and right-panel overlays opt into a separate
 * 768px policy. Tailwind and SCSS mirrors are pinned by breakpoint-sync.spec.ts.
 */

/** The viewport width (inclusive) where the desktop presentation begins. */
export const DESKTOP_BREAKPOINT_PX = 1280;

/** The largest viewport width that still renders the mobile/tablet presentation. */
export const MOBILE_MAX_WIDTH_PX = DESKTOP_BREAKPOINT_PX - 1;

/** `matchMedia` query matching the desktop band (1280px and wider). */
export const DESKTOP_MEDIA_QUERY = `(min-width: ${DESKTOP_BREAKPOINT_PX}px)`;

/** `matchMedia` query matching the mobile/tablet band (up to 1279px). */
export const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_MAX_WIDTH_PX}px)`;

/** Inclusive boundary for anchored menus and bounded tablet panels, independent of layout. */
export const TABLET_BREAKPOINT_PX = 768;

/** Phone menu presentation, including fractional widths below 768px. */
export const PHONE_MEDIA_QUERY = `(width < ${TABLET_BREAKPOINT_PX}px)`;

/** Bounded overlays without changing the app's mobile layout policy. */
export const TABLET_MEDIA_QUERY = `(${TABLET_BREAKPOINT_PX}px <= width < ${DESKTOP_BREAKPOINT_PX}px)`;
