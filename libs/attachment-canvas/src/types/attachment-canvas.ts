/** The type of content the canvas can display. */
export enum AttachmentContentType {
  PlainText = 'plain_text',
  Image = 'image',
  Markdown = 'markdown',
  Json = 'json',
  Pdf = 'pdf',
  Unsupported = 'unsupported',
  Error = 'error',
}

/** The kind of failure that produced an `ErrorCanvasContent`. */
export enum AttachmentErrorType {
  /** The file failed to load (network error or a non-`403` non-OK response). */
  LoadFailed = 'load_failed',
  /** The file request failed with HTTP `403` — the user lacks permission to access it. */
  Forbidden = 'forbidden',
}
