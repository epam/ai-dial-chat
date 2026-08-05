/** Maps MIME types to canonical file extensions. */
export const MIME_TYPE_EXT_MAP: Record<string, string> = {
  // Text
  'text/markdown': 'md',
  'text/plain': 'txt',
  'text/javascript': 'js',
  'text/typescript': 'ts',
  'text/jsx': 'jsx',
  'text/tsx': 'tsx',
  'text/x-sql': 'sql',
  'text/x-php': 'php',
  'text/x-rustsrc': 'rs',
  'text/x-vue': 'vue',

  // Application
  'application/javascript': 'js',
  'application/typescript': 'ts',
  'application/xhtml+xml': 'xhtml',
  'application/gzip': 'gz',
  'application/x-tar': 'tar',
  'application/x-zip-compressed': 'zip',
  'application/x-rar-compressed': 'rar',
  'application/x-7z-compressed': '7z',
  'application/x-php': 'php',
  'application/x-rust': 'rs',
  'application/sql': 'sql',
  'application/msword': 'doc',
  'application/vnd.ms-word': 'doc',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    'pptx',

  // Images
  'image/jpeg': 'jpg',
  'image/svg+xml': 'svg',
};

/** MIME type wildcard that matches any content type. */
export const MIME_TYPE_WILDCARD = '*/*';
/** MIME type prefix shared by all audio content types. */
export const MIME_TYPE_AUDIO_PREFIX = 'audio/';
