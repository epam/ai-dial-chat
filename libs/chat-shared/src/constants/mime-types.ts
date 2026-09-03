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
