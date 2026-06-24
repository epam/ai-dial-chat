import { TEXT_EXTENSIONS } from '../constants/file';
import type { UnsupportedCanvasContent } from '../models/attachment-canvas';
import { AttachmentContentType } from '../types/attachment-canvas';

/** Returns true if the file name has an extension known to be text-previewable. */
export const isTextPreviewable = (name: string): boolean => {
  const dot = name.lastIndexOf('.');
  if (dot === -1) return false;
  return TEXT_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
};

/** Creates an unsupported-format content payload. */
export const createUnsupportedCanvasContent = (): UnsupportedCanvasContent => ({
  type: AttachmentContentType.Unsupported,
});
