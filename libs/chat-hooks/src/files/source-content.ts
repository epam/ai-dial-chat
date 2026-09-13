/** Pure source classification. Keep MIME values aligned with attachment-canvas
 * without importing its renderer dependency graph into this entry point. */

/** Canonical MIME type for each supported Office Open XML/CSV renderer format, keyed by lowercased file extension. */
const OOXML_MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv: 'text/csv',
};

/** File extensions known to be previewable as plain text. */
const TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'json',
  'jsonl',
  'ndjson',
  'xml',
  'csv',
  'tsv',
  'yaml',
  'yml',
  'toml',
  'ini',
  'conf',
  'cfg',
  'css',
  'scss',
  'sass',
  'less',
  'js',
  'jsx',
  'ts',
  'tsx',
  'mjs',
  'cjs',
  'mts',
  'cts',
  'py',
  'rb',
  'go',
  'rs',
  'java',
  'kt',
  'swift',
  'c',
  'h',
  'cpp',
  'cs',
  'sh',
  'bash',
  'zsh',
  'fish',
  'ps1',
  'log',
  'env',
  'gitignore',
  'dockerfile',
  'makefile',
  'sql',
]);

/** File extensions that are rendered as HTML in a sandboxed iframe. */
const HTML_EXTENSIONS = new Set(['html', 'htm']);

const PDF_EXTENSION = 'pdf';
const PDF_MIME_TYPE = 'application/pdf';

/** Strips a trailing `?query` string and/or `#fragment` from a URL or path. */
const stripUrlQueryAndFragment = (url: string): string => url.split(/[?#]/)[0];

/** Returns the lowercased extension (without the leading dot) of `fileName`, or an empty string if it has none. */
const lowerFileExtension = (fileName: string): string => {
  const dot = fileName.lastIndexOf('.');
  return dot === -1 ? '' : fileName.slice(dot + 1).toLowerCase();
};

/**
 * Returns the last path segment of `url` — its file name — for both absolute
 * URLs and DIAL-relative resource paths such as
 * `files/<bucket>/qa-routed-source.html`. Any query string or hash is dropped
 * and percent escapes are decoded. Returns an empty string when no segment can
 * be extracted. Used to classify a resource by extension when its display name
 * is a citation title rather than a file name.
 */
export const getUrlFileName = (url: string): string => {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    /* A relative DIAL resource path has no base to resolve against, so the
     * query and hash are stripped by hand instead. */
    path = stripUrlQueryAndFragment(url);
  }
  const segment = path.split('/').filter(Boolean).pop() ?? '';
  try {
    return decodeURIComponent(segment);
  } catch {
    /* Malformed percent escape — the raw segment still works for extension
     * matching. */
    return segment;
  }
};

/** Returns true when `contentType` alone already trustworthily identifies an image, audio, PDF, or built-in document-renderer source. */
const isTrustedSourceContentType = (contentType: string): boolean => {
  if (contentType.startsWith('image/') || contentType.startsWith('audio/')) {
    return true;
  }
  const normalized = contentType.split(';', 1)[0].trim().toLowerCase();
  return (
    contentType === PDF_MIME_TYPE ||
    Object.values(OOXML_MIME_TYPE_BY_EXTENSION).includes(normalized)
  );
};

/**
 * Returns the content type to trust for an external citation source: `contentType`
 * unchanged when it is already an image/audio/PDF/document-renderer marker,
 * otherwise the type implied by `url`'s path extension (`application/pdf` for
 * `.pdf`, the canonical MIME for `.docx`/`.xlsx`/`.pptx`/`.csv`) when that
 * extension is recognized, otherwise `contentType` unchanged.
 *
 * Web-search grounding APIs label every reference — PDFs and Office documents
 * included — as `text/markdown`, so a mislabeled `contentType` must not win
 * over a recognized URL extension: doing so previously sent a PDF's raw bytes
 * into the markdown/text canvas viewer, rendering garbled text instead of
 * opening the PDF/OOXML viewer.
 */
export const resolveExternalSourceContentType = (
  contentType: string,
  url: string,
): string => {
  if (isTrustedSourceContentType(contentType)) {
    return contentType;
  }
  const ext = lowerFileExtension(getUrlFileName(url));
  if (ext === PDF_EXTENSION) return PDF_MIME_TYPE;
  return Object.prototype.hasOwnProperty.call(OOXML_MIME_TYPE_BY_EXTENSION, ext)
    ? OOXML_MIME_TYPE_BY_EXTENSION[ext]
    : contentType;
};

/** Returns true when an external (non-DIAL) source URL should be opened in the canvas rather than a new browser tab. */
export const isExternalSourcePreviewable = (
  contentType: string,
  url: string,
): boolean => {
  const resolvedType = resolveExternalSourceContentType(contentType, url);
  if (isTrustedSourceContentType(resolvedType)) {
    return true;
  }
  const ext = lowerFileExtension(getUrlFileName(url));
  /* 'html'/'htm' are not in TEXT_EXTENSIONS (they use HtmlContent), so both must be checked explicitly. */
  return TEXT_EXTENSIONS.has(ext) || HTML_EXTENSIONS.has(ext);
};
