/*
 * An SVG is an active document: opened directly from this origin it could run
 * embedded scripts. This policy is scoped to the image response itself, so it
 * holds even when the global CSP runs in report-only mode, and it does not
 * affect rendering through <img>, CSS background-image, or <link rel="icon">.
 * Shared by every endpoint that serves an SVG from an external source.
 */
export const SVG_CONTENT_SECURITY_POLICY =
  "default-src 'none'; style-src 'unsafe-inline'; sandbox";
