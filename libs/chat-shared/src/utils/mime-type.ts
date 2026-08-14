import { AttachmentType } from '../types/attachment';
import { MIMEType } from '../types/mime-type';

/**
 * Maps a lowercased file extension (without a leading dot) to a `MIMEType`.
 * Extensions with no well-known MIME type fall back to `MIMEType.Plain` when
 * they are still text-previewable source/config formats, so a caller can
 * distinguish "recognized as text" from "genuinely unrecognized"
 * (`undefined`).
 */
const EXTENSION_TO_MIME_TYPE: Record<string, MIMEType> = {
  // Markup / text
  md: MIMEType.Markdown,
  markdown: MIMEType.Markdown,
  txt: MIMEType.Plain,
  html: MIMEType.HTML,
  htm: MIMEType.HTML,
  xhtml: MIMEType.XHTML,
  css: MIMEType.CSS,
  scss: MIMEType.Plain,
  sass: MIMEType.Plain,
  less: MIMEType.Plain,
  js: MIMEType.JavaScript,
  mjs: MIMEType.JavaScript,
  cjs: MIMEType.JavaScript,
  jsx: MIMEType.JavaScript,
  ts: MIMEType.TypeScript,
  mts: MIMEType.TypeScript,
  cts: MIMEType.TypeScript,
  tsx: MIMEType.TypeScript,
  csv: MIMEType.CSV,
  tsv: MIMEType.Plain,

  // Data formats
  json: MIMEType.JSON,
  jsonl: MIMEType.JSON,
  ndjson: MIMEType.JSON,
  xml: MIMEType.XML,
  pdf: MIMEType.PDF,
  zip: MIMEType.ZIP,
  gz: MIMEType.GZIP,
  gzip: MIMEType.GZIP,

  // Source code and config, previewable as plain text
  yaml: MIMEType.Plain,
  yml: MIMEType.Plain,
  toml: MIMEType.Plain,
  ini: MIMEType.Plain,
  conf: MIMEType.Plain,
  cfg: MIMEType.Plain,
  py: MIMEType.Plain,
  rb: MIMEType.Plain,
  go: MIMEType.Plain,
  rs: MIMEType.Plain,
  java: MIMEType.Plain,
  kt: MIMEType.Plain,
  swift: MIMEType.Plain,
  c: MIMEType.Plain,
  h: MIMEType.Plain,
  cpp: MIMEType.Plain,
  cs: MIMEType.Plain,
  sh: MIMEType.Plain,
  bash: MIMEType.Plain,
  zsh: MIMEType.Plain,
  fish: MIMEType.Plain,
  ps1: MIMEType.Plain,
  log: MIMEType.Plain,
  env: MIMEType.Plain,
  sql: MIMEType.Plain,

  // Images
  jpg: MIMEType.JPEG,
  jpeg: MIMEType.JPEG,
  png: MIMEType.PNG,
  gif: MIMEType.GIF,
  webp: MIMEType.WebP,
  bmp: MIMEType.BMP,
  svg: MIMEType.SVG,

  // Audio
  mp3: MIMEType.MP3,
  wav: MIMEType.WAV,
  ogg: MIMEType.OGG,
};

/**
 * Infers a `MIMEType` from a file path's extension, ignoring any query string
 * or `#` fragment. Returns `undefined` when the path has no extension or the
 * extension is not recognized.
 */
export const inferMimeTypeFromPath = (path: string): MIMEType | undefined => {
  const clean = path.split(/[?#]/)[0];
  const dotIdx = clean.lastIndexOf('.');
  if (dotIdx === -1) return undefined;
  const ext = clean.slice(dotIdx + 1).toLowerCase();
  return EXTENSION_TO_MIME_TYPE[ext];
};

/** Classifies a MIME type into an `AttachmentType` by prefix (`image/*` / `audio/*`), defaulting to `File`. */
export const getAttachmentTypeFromMime = (
  mimeType: string | undefined,
): AttachmentType => {
  if (mimeType?.startsWith('image/')) return AttachmentType.Image;
  if (mimeType?.startsWith('audio/')) return AttachmentType.Audio;
  return AttachmentType.File;
};
