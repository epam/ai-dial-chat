import type {
  ImageCanvasContent,
  PlainTextCanvasContent,
  UnsupportedCanvasContent,
} from '@epam/ai-dial-attachment-canvas';
import { AttachmentContentType } from '@epam/ai-dial-attachment-canvas';
import type { Attachment, DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { resolveDialFileDownloadUrl } from './icon-path';

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
  'html',
  'htm',
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

/** Returns true if the file name has an extension that is known to be text-previewable. */
export const isTextPreviewable = (name: string): boolean => {
  const dot = name.lastIndexOf('.');
  if (dot === -1) return false;
  return TEXT_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
};

/** Creates an unsupported content payload. */
export const createUnsupportedCanvasContent = (): UnsupportedCanvasContent => ({
  type: AttachmentContentType.Unsupported,
});

/** Resolves an image canvas content payload from a DisplayAttachment, or `null` if unavailable. */
export const resolveImageCanvasContent = async (
  attachment: DisplayAttachment,
): Promise<ImageCanvasContent | null> => {
  if (attachment.url?.startsWith('files/')) {
    const url = resolveDialFileDownloadUrl(attachment.url);
    return url != null ? { type: AttachmentContentType.Image, url } : null;
  }
  if ('file' in attachment) {
    const a = attachment as Attachment;
    const url = a.previewUrl ?? URL.createObjectURL(a.file);
    return { type: AttachmentContentType.Image, url };
  }
  return null;
};

/** Resolves a plain-text canvas content payload from a DisplayAttachment, or `null` if unavailable. */
export const resolveTextCanvasContent = async (
  attachment: DisplayAttachment,
): Promise<PlainTextCanvasContent | null> => {
  if (attachment.url?.startsWith('files/')) {
    const downloadUrl = resolveDialFileDownloadUrl(attachment.url);
    if (downloadUrl == null) return null;
    const response = await fetch(downloadUrl);
    if (!response.ok) return null;
    const text = await response.text();
    return { type: AttachmentContentType.PlainText, text };
  }
  if ('file' in attachment && (attachment as Attachment).file.size > 0) {
    const text = await (attachment as Attachment).file.text();
    return { type: AttachmentContentType.PlainText, text };
  }
  return null;
};
