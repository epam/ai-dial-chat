/*
 * The single source of truth for the app-wide responsive boundary. Every
 * mechanism that branches on viewport width must resolve to the same band:
 * the named Tailwind screens in the root tailwind.config.js, the
 * useBreakpoint hook (apps/chat), this package's useIsMobile hook, the
 * catalog grid virtualizer, the chat-overlay manager, and the SCSS @media
 * mirrors in libs/*. The sites that cannot import this module — the root
 * tailwind config (plain CJS), SCSS stylesheets, and chat-overlay (which has
 * no dependencies) — repeat the literal and are pinned to it by
 * apps/chat/src/hooks/breakpoint/breakpoint-sync.spec.ts.
 */

/** The viewport width (inclusive) where the desktop presentation begins. */
export const DESKTOP_BREAKPOINT_PX = 1280;

/** The largest viewport width that still renders the mobile/tablet presentation. */
export const MOBILE_MAX_WIDTH_PX = DESKTOP_BREAKPOINT_PX - 1;

/** `matchMedia` query matching the desktop band (1280px and wider). */
export const DESKTOP_MEDIA_QUERY = `(min-width: ${DESKTOP_BREAKPOINT_PX}px)`;

/** `matchMedia` query matching the mobile/tablet band (up to 1279px). */
export const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_MAX_WIDTH_PX}px)`;
