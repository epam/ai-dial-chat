/**
 * Well-known MIME type constants used in DIAL API attachments.
 * For arbitrary subtypes, pass a plain `string` alongside this enum.
 */
export enum MIMEType {
  /** GitHub-flavoured Markdown. */
  Markdown = 'text/markdown',
  /** Plain unformatted text. */
  Plain = 'text/plain',
  /** HTML markup. */
  HTML = 'text/html',
  /** XHTML markup. */
  XHTML = 'application/xhtml+xml',
  /** JPEG raster image. */
  JPEG = 'image/jpeg',
  /** PNG raster image. */
  PNG = 'image/png',
  /** JSON data. */
  JSON = 'application/json',
}
