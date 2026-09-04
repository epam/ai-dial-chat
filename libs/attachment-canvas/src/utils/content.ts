import {
  HTML_EXTENSIONS,
  OOXML_MIME_TYPES,
  TEXT_EXTENSIONS,
} from '../constants/file';
import type {
  ErrorCanvasContent,
  UnsupportedCanvasContent,
} from '../models/attachment-canvas';
import {
  AttachmentContentType,
  AttachmentErrorType,
  OoxmlFileType,
} from '../types/attachment-canvas';

const OOXML_EXTENSION_TO_FILE_TYPE: Record<string, OoxmlFileType> = {
  docx: OoxmlFileType.Docx,
  xlsx: OoxmlFileType.Xlsx,
  pptx: OoxmlFileType.Pptx,
};

const OOXML_MIME_TO_FILE_TYPE: Record<string, OoxmlFileType> = {
  [OOXML_MIME_TYPES.docx]: OoxmlFileType.Docx,
  [OOXML_MIME_TYPES.xlsx]: OoxmlFileType.Xlsx,
  [OOXML_MIME_TYPES.pptx]: OoxmlFileType.Pptx,
};

const OOXML_FILE_TYPE_TO_MIME: Record<OoxmlFileType, string> = {
  [OoxmlFileType.Docx]: OOXML_MIME_TYPES.docx,
  [OoxmlFileType.Xlsx]: OOXML_MIME_TYPES.xlsx,
  [OoxmlFileType.Pptx]: OOXML_MIME_TYPES.pptx,
};

/** Resolves a supported OOXML format from a MIME type or file extension. */
export const getOoxmlFileType = (
  name: string,
  mimeType?: string,
): OoxmlFileType | undefined => {
  const normalizedMimeType = mimeType?.split(';', 1)[0].trim().toLowerCase();
  if (normalizedMimeType != null) {
    const mimeMatch = OOXML_MIME_TO_FILE_TYPE[normalizedMimeType];
    if (mimeMatch != null) return mimeMatch;
  }

  const dot = name.lastIndexOf('.');
  if (dot === -1) return undefined;
  return OOXML_EXTENSION_TO_FILE_TYPE[name.slice(dot + 1).toLowerCase()];
};

/** Returns true when a file can be rendered by the built-in OOXML viewer. */
export const isOoxmlPreviewable = (name: string, mimeType?: string): boolean =>
  getOoxmlFileType(name, mimeType) != null;

/** Returns the canonical OOXML MIME type recognized from `name`'s extension or `mimeType`, or `undefined` if neither matches a supported format. */
export const getOoxmlMimeType = (
  name: string,
  mimeType?: string,
): string | undefined => {
  const fileType = getOoxmlFileType(name, mimeType);
  return fileType != null ? OOXML_FILE_TYPE_TO_MIME[fileType] : undefined;
};

/** Returns true if the file name has an extension known to be text-previewable. */
export const isTextPreviewable = (name: string): boolean => {
  const dot = name.lastIndexOf('.');
  if (dot === -1) return false;
  return TEXT_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
};

/** Returns true if the file name has an HTML extension (`html` or `htm`). */
export const isHtmlPreviewable = (name: string): boolean => {
  const dot = name.lastIndexOf('.');
  if (dot === -1) return false;
  return HTML_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
};

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  xml: 'xml',
  csv: 'plaintext',
  tsv: 'plaintext',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  ini: 'ini',
  conf: 'ini',
  cfg: 'ini',
  css: 'css',
  scss: 'css',
  sass: 'css',
  less: 'css',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  tsx: 'tsx',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  kt: 'kotlin',
  swift: 'swift',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cs: 'csharp',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  fish: 'bash',
  ps1: 'bash',
  sql: 'sql',
  json: 'json',
  jsonl: 'json',
  ndjson: 'json',
  txt: 'plaintext',
  log: 'plaintext',
  env: 'plaintext',
  gitignore: 'plaintext',
  dockerfile: 'plaintext',
  makefile: 'plaintext',
};

/** Maps a lowercased file extension (without leading dot) to a `react-syntax-highlighter` language identifier. Returns `undefined` for unmapped extensions. */
export const extensionToLanguage = (ext: string): string | undefined =>
  EXTENSION_TO_LANGUAGE[ext];

/** Creates an unsupported-format content payload. */
export const createUnsupportedCanvasContent = (
  url?: string,
): UnsupportedCanvasContent => ({
  type: AttachmentContentType.Unsupported,
  ...(url != null && { url }),
});

/** Creates a content payload for a file that failed to load (network error or non-403 failure). */
export const createLoadErrorCanvasContent = (
  url?: string,
): ErrorCanvasContent => ({
  type: AttachmentContentType.Error,
  errorType: AttachmentErrorType.LoadFailed,
  ...(url != null && { url }),
});

/** Creates a content payload for a file the current user is not permitted to access (HTTP 403). */
export const createForbiddenCanvasContent = (
  url?: string,
): ErrorCanvasContent => ({
  type: AttachmentContentType.Error,
  errorType: AttachmentErrorType.Forbidden,
  ...(url != null && { url }),
});
