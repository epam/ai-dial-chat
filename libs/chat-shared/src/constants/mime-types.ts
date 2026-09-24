/**
 * Maps common MIME types to canonical file extensions.
 *
 * The standard entries follow MDN's common media types table. Project-specific
 * aliases are retained for MIME values produced by existing integrations.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/MIME_types/Common_types
 */
export const MIME_TYPE_EXT_MAP: Record<string, string> = {
  // Text
  'text/calendar': 'ics',
  'text/css': 'css',
  'text/csv': 'csv',
  'text/html': 'html',
  'text/javascript': 'js',
  'text/jsx': 'jsx',
  'text/markdown': 'md',
  'text/plain': 'txt',
  'text/tsx': 'tsx',
  'text/typescript': 'ts',
  'text/xml': 'xml',
  'text/x-php': 'php',
  'text/x-rustsrc': 'rs',
  'text/x-sql': 'sql',
  'text/x-vue': 'vue',

  // Application
  'application/epub+zip': 'epub',
  'application/gzip': 'gz',
  'application/java-archive': 'jar',
  'application/javascript': 'js',
  'application/json': 'json',
  'application/ld+json': 'jsonld',
  'application/manifest+json': 'webmanifest',
  'application/msword': 'doc',
  'application/octet-stream': 'bin',
  'application/ogg': 'ogx',
  'application/pdf': 'pdf',
  'application/rtf': 'rtf',
  'application/sql': 'sql',
  'application/typescript': 'ts',
  'application/xhtml+xml': 'xhtml',
  'application/xml': 'xml',
  'application/yaml': 'yaml',
  'application/vnd.amazon.ebook': 'azw',
  'application/vnd.apple.installer+xml': 'mpkg',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.ms-fontobject': 'eot',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.ms-word': 'doc',
  'application/vnd.mozilla.xul+xml': 'xul',
  'application/vnd.oasis.opendocument.presentation': 'odp',
  'application/vnd.oasis.opendocument.spreadsheet': 'ods',
  'application/vnd.oasis.opendocument.text': 'odt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    'pptx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
  'application/vnd.rar': 'rar',
  'application/vnd.visio': 'vsd',
  'application/x-7z-compressed': '7z',
  'application/x-abiword': 'abw',
  'application/x-bzip': 'bz',
  'application/x-bzip2': 'bz2',
  'application/x-cdf': 'cda',
  'application/x-csh': 'csh',
  'application/x-freearc': 'arc',
  'application/x-gzip': 'gz',
  'application/x-httpd-php': 'php',
  'application/x-php': 'php',
  'application/x-rar-compressed': 'rar',
  'application/x-rust': 'rs',
  'application/x-sh': 'sh',
  'application/x-tar': 'tar',
  'application/x-zip-compressed': 'zip',
  'application/zip': 'zip',

  // Audio
  'audio/3gpp': '3gp',
  'audio/3gpp2': '3g2',
  'audio/aac': 'aac',
  'audio/midi': 'midi',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'oga',
  'audio/wav': 'wav',
  'audio/webm': 'weba',
  'audio/x-midi': 'midi',

  // Fonts
  'font/otf': 'otf',
  'font/ttf': 'ttf',
  'font/woff': 'woff',
  'font/woff2': 'woff2',

  // Images
  'image/apng': 'apng',
  'image/avif': 'avif',
  'image/bmp': 'bmp',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/tiff': 'tiff',
  'image/vnd.microsoft.icon': 'ico',
  'image/webp': 'webp',

  // Video
  'video/3gpp': '3gp',
  'video/3gpp2': '3g2',
  'video/mp2t': 'ts',
  'video/mp4': 'mp4',
  'video/mpeg': 'mpeg',
  'video/ogg': 'ogv',
  'video/webm': 'webm',
  'video/x-msvideo': 'avi',
};

/** MIME type wildcard that matches any content type. */
export const MIME_TYPE_WILDCARD = '*/*';
/** MIME type prefix shared by all audio content types. */
export const MIME_TYPE_AUDIO_PREFIX = 'audio/';

/**
 * Maps non-canonical MIME type spellings to the canonical type they denote.
 *
 * Deployments declare their `inputAttachmentTypes` by hand, while DIAL Core
 * stores the content type a browser or an upload client reported, so the two
 * sides routinely disagree on which of several equivalent spellings to use for
 * the same format (`text/json` vs `application/json`). Resolving both through
 * this map before comparing them keeps a declared type matching the files it
 * is meant to describe.
 *
 * Only aliases for one and the same format belong here — never a pair of
 * distinct formats that happen to share an extension.
 */
export const MIME_TYPE_ALIASES: Record<string, string> = {
  // JSON
  'text/json': 'application/json',
  'text/x-json': 'application/json',
  'application/x-json': 'application/json',

  // XML
  'text/xml': 'application/xml',

  // JavaScript / TypeScript
  'application/javascript': 'text/javascript',
  'application/x-javascript': 'text/javascript',
  'application/typescript': 'text/typescript',

  // Markdown
  'text/x-markdown': 'text/markdown',
  'application/markdown': 'text/markdown',

  // CSV
  'application/csv': 'text/csv',
  'text/x-csv': 'text/csv',
  'text/comma-separated-values': 'text/csv',

  // YAML
  'text/yaml': 'application/yaml',
  'text/x-yaml': 'application/yaml',
  'application/x-yaml': 'application/yaml',

  // SQL
  'text/sql': 'application/sql',
  'text/x-sql': 'application/sql',

  // PHP / Rust
  'application/php': 'text/x-php',
  'application/x-php': 'text/x-php',
  'application/x-httpd-php': 'text/x-php',
  'application/x-rust': 'text/x-rustsrc',

  // Documents
  'application/x-pdf': 'application/pdf',
  'application/vnd.ms-word': 'application/msword',
  'application/excel': 'application/vnd.ms-excel',
  'application/x-excel': 'application/vnd.ms-excel',
  'application/x-msexcel': 'application/vnd.ms-excel',
  'application/powerpoint': 'application/vnd.ms-powerpoint',
  'application/mspowerpoint': 'application/vnd.ms-powerpoint',

  // Archives
  'application/x-zip': 'application/zip',
  'application/x-zip-compressed': 'application/zip',
  'application/x-gzip': 'application/gzip',
  'application/x-rar-compressed': 'application/vnd.rar',

  // Images
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/x-png': 'image/png',
  'image/svg': 'image/svg+xml',
  'image/icon': 'image/vnd.microsoft.icon',
  'image/x-icon': 'image/vnd.microsoft.icon',

  // Audio
  'audio/mp3': 'audio/mpeg',
  'audio/mpeg3': 'audio/mpeg',
  'audio/x-mpeg-3': 'audio/mpeg',
  'audio/wave': 'audio/wav',
  'audio/x-wav': 'audio/wav',
  'audio/vnd.wave': 'audio/wav',
  'audio/x-m4a': 'audio/mp4',
};
