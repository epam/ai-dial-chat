/**
 * Well-known MIME type constants used in DIAL API attachments.
 * For arbitrary subtypes, pass a plain `string` alongside this enum.
 */
export enum MIMEType {
  // Text / markup
  /** GitHub-flavoured Markdown. */
  Markdown = 'text/markdown',
  /** Plain unformatted text. */
  Plain = 'text/plain',
  /** HTML markup. */
  HTML = 'text/html',
  /** XHTML markup. */
  XHTML = 'application/xhtml+xml',
  /** Cascading Style Sheets. */
  CSS = 'text/css',
  /** JavaScript source. */
  JavaScript = 'text/javascript',
  /** TypeScript source (non-standard but widely used). */
  TypeScript = 'text/typescript',
  /** CSV spreadsheet data. */
  CSV = 'text/csv',

  // Data formats
  /** JSON data. */
  JSON = 'application/json',
  /** XML document (application type). */
  XML = 'application/xml',
  /** PDF document. */
  PDF = 'application/pdf',
  /** ZIP archive. */
  ZIP = 'application/zip',
  /** GZIP-compressed data. */
  GZIP = 'application/gzip',

  // Images
  /** JPEG raster image. */
  JPEG = 'image/jpeg',
  /** PNG raster image. */
  PNG = 'image/png',
  /** GIF image. */
  GIF = 'image/gif',
  /** WebP image. */
  WebP = 'image/webp',
  /** BMP bitmap image. */
  BMP = 'image/bmp',
  /** SVG vector image. */
  SVG = 'image/svg+xml',
}
