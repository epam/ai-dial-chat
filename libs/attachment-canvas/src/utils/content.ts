import { TEXT_EXTENSIONS } from '../constants/file';
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
