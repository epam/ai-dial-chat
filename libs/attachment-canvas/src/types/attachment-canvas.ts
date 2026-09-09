/** The type of content the canvas can display. */
export enum AttachmentContentType {
  PlainText = 'plain_text',
  Image = 'image',
  Audio = 'audio',
  Markdown = 'markdown',
  MarkdownTable = 'markdown_table',
  Json = 'json',
  Pdf = 'pdf',
  Ooxml = 'ooxml',
  Code = 'code',
  Html = 'html',
  Visualizer = 'visualizer',
  McpApp = 'mcp_app',
  Unsupported = 'unsupported',
  Error = 'error',
}

/** Supported document formats rendered by the bundled `@silurus/ooxml` runtime. */
export enum OoxmlFileType {
  Docx = 'docx',
  Xlsx = 'xlsx',
  Pptx = 'pptx',
  Csv = 'csv',
}

/** The kind of failure that produced an `ErrorCanvasContent`. */
export enum AttachmentErrorType {
  /** The file failed to load (network error or a non-`403` non-OK response). */
  LoadFailed = 'load_failed',
  /** The file request failed with HTTP `403` — the user lacks permission to access it. */
  Forbidden = 'forbidden',
}
