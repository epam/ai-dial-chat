import { HTML_EXTENSIONS, TEXT_EXTENSIONS } from '../constants/file';
import type {
  ErrorCanvasContent,
  UnsupportedCanvasContent,
} from '../models/attachment-canvas';
import {
  AttachmentContentType,
  AttachmentErrorType,
} from '../types/attachment-canvas';

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
