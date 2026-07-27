/**
 * Image sources that DIAL Chat always permits, on top of any admin-configured
 * `ALLOWED_IMAGE_SOURCES`. These back first-party UI that legitimately loads
 * third-party images the product depends on:
 *  - `authjs.dev`   — sign-in provider icons on the sign-in page
 *  - `s.gravatar.com` / `cdn.auth0.com` / `i1.wp.com` — user avatars served by
 *    auth providers (Auth0 proxies some avatars through the wp.com image CDN)
 *
 * Entries are path-scoped where possible to keep the CSP `img-src` directive
 * tight; the markdown image allowlist (`parseAllowedImageHosts`) resolves each
 * entry down to its bare host.
 */
export const DEFAULT_ALLOWED_IMAGE_SOURCES = [
  'https://authjs.dev/img/providers/',
  'https://s.gravatar.com/',
  'https://i1.wp.com/cdn.auth0.com/avatars/',
  'https://cdn.auth0.com/avatars/',
].join(' ');

/**
 * Returns the effective `ALLOWED_IMAGE_SOURCES` value: the admin-configured
 * origins (if any) with the product defaults always appended. Shared by the CSP
 * `img-src` directive and the markdown image allowlist so both stay in sync.
 */
export const getAllowedImageSources = (): string =>
  `${process.env.ALLOWED_IMAGE_SOURCES ?? ''} ${DEFAULT_ALLOWED_IMAGE_SOURCES}`.trim();
