/** Well-known MIME type constants used in DIAL API attachments. */
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
  /** JSX source. */
  JSX = 'text/jsx',
  /** TSX source. */
  TSX = 'text/tsx',
  /** PHP source. */
  PHP = 'text/x-php',
  /** Rust source. */
  Rust = 'text/x-rustsrc',
  /** Vue single-file component. */
  Vue = 'text/x-vue',

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
  /** RAR archive. */
  RAR = 'application/vnd.rar',
  /** 7-Zip archive. */
  SevenZip = 'application/x-7z-compressed',
  /** TAR archive. */
  TAR = 'application/x-tar',
  /** SQL script. */
  SQL = 'application/sql',

  // Office documents
  /** Legacy Word document (`.doc`). */
  DOC = 'application/msword',
  /** Word document (`.docx`). */
  DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  /** Legacy Excel workbook (`.xls`). */
  XLS = 'application/vnd.ms-excel',
  /** Excel workbook (`.xlsx`). */
  XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  /** Legacy PowerPoint presentation (`.ppt`). */
  PPT = 'application/vnd.ms-powerpoint',
  /** PowerPoint presentation (`.pptx`). */
  PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation',

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

  // Audio
  /** MPEG audio (`.mp3`). */
  MP3 = 'audio/mpeg',
  /** WAV audio. */
  WAV = 'audio/wav',
  /** Ogg audio. */
  OGG = 'audio/ogg',
}

/** Well-known file extension constants used as fallback when a MIME type is unavailable. */
export enum FileExtension {
  /** PDF document. */
  PDF = 'pdf',
  /** Markdown document (`.md`). */
  Markdown = 'md',
  /** Markdown document, alternate extension (`.markdown`). */
  MarkdownAlt = 'markdown',
  /** JSON document. */
  JSON = 'json',
}
