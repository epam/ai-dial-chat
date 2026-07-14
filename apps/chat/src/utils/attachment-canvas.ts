import type {
  ErrorCanvasContent,
  ImageCanvasContent,
  JsonCanvasContent,
  MarkdownCanvasContent,
  PdfCanvasContent,
  PlainTextCanvasContent,
} from '@epam/ai-dial-attachment-canvas';
import {
  AttachmentContentType,
  AttachmentErrorType,
} from '@epam/ai-dial-attachment-canvas';
import type {
  Annotation,
  Attachment,
  DisplayAttachment,
} from '@epam/ai-dial-chat-shared';
import { MIMEType } from '@epam/ai-dial-chat-shared';
import {
  annotationHighlightId,
  annotationsToPdfHighlights,
} from './annotation';
import {
  isDialFileId,
  resolveDialFileDownloadUrl,
  resolveDialUrl,
} from './dial-file';
import type { AnnotationGroup } from './group-annotations-by-source';

/**
 * Decodes a base64 string into raw bytes, or `undefined` if the string is not
 * valid base64 (some backends put already-decoded plain text in `data` despite
 * the base64 contract, e.g. OCR'd markdown with non-Latin1 characters).
 */
const tryBase64ToBytes = (base64: string): Uint8Array | undefined => {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return undefined;
  }
};

/**
 * Decodes an inline `data` payload into a Blob object URL of the given MIME
 * type. Falls back to treating `data` as raw (already-decoded) text when it
 * is not valid base64.
 */
const base64ToBlobUrl = (data: string, mimeType: string): string => {
  const bytes = tryBase64ToBytes(data) ?? new TextEncoder().encode(data);
  return URL.createObjectURL(
    new Blob([bytes.buffer as ArrayBuffer], { type: mimeType }),
  );
};

/**
 * Decodes an inline `data` payload into UTF-8 text. Falls back to returning
 * `data` unchanged when it is not valid base64 (some backends send
 * already-decoded plain text, see `tryBase64ToBytes`).
 */
const base64ToText = (base64: string): string => {
  const bytes = tryBase64ToBytes(base64);
  return bytes != null ? new TextDecoder().decode(bytes) : base64;
};

/** Classifies a failed fetch response by HTTP status into an `ErrorCanvasContent`. */
const classifyFetchFailure = (
  status: number,
  url: string,
): ErrorCanvasContent => ({
  type: AttachmentContentType.Error,
  errorType:
    status === 403
      ? AttachmentErrorType.Forbidden
      : AttachmentErrorType.LoadFailed,
  url,
});

/** Builds an `ErrorCanvasContent` for a thrown fetch (network) failure. */
const networkFailureContent = (url: string): ErrorCanvasContent => ({
  type: AttachmentContentType.Error,
  errorType: AttachmentErrorType.LoadFailed,
  url,
});

/**
 * Resolves a displayable Blob/object URL for an attachment's binary content: a
 * locally-picked `File`, an already-uploaded DIAL file, an existing preview
 * URL, or inline base64 `data` decoded into a Blob URL. Returns `undefined`
 * when none of these sources are available, or an `ErrorCanvasContent` when a
 * DIAL file fetch fails.
 */
const resolveAttachmentBlobUrl = async (
  attachment: DisplayAttachment,
): Promise<string | ErrorCanvasContent | undefined> => {
  if ('file' in attachment && (attachment as Attachment).file.size > 0) {
    return URL.createObjectURL((attachment as Attachment).file);
  }
  const dialUrl = resolveDialUrl(attachment);
  if (dialUrl != null) {
    try {
      const response = await fetch(dialUrl);
      if (!response.ok) return classifyFetchFailure(response.status, dialUrl);
      return URL.createObjectURL(await response.blob());
    } catch {
      return networkFailureContent(dialUrl);
    }
  }
  if (attachment.previewUrl != null) return attachment.previewUrl;
  if (attachment.data != null) {
    return base64ToBlobUrl(attachment.data, attachment.contentType);
  }
  return undefined;
};

/**
 * Resolves an attachment's textual content: a locally-picked `File`'s text,
 * fetched text from an already-uploaded DIAL file, or inline base64 `data`
 * decoded into UTF-8 text. Returns `undefined` when none of these sources are
 * available, or an `ErrorCanvasContent` when the fetch failed.
 */
const resolveAttachmentText = async (
  attachment: DisplayAttachment,
): Promise<string | ErrorCanvasContent | undefined> => {
  if (attachment.data != null) return base64ToText(attachment.data);
  const downloadUrl = resolveDialUrl(attachment);
  if (downloadUrl != null) {
    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        return classifyFetchFailure(response.status, downloadUrl);
      }
      return response.text();
    } catch {
      return networkFailureContent(downloadUrl);
    }
  }
  if ('file' in attachment && (attachment as Attachment).file.size > 0) {
    return (attachment as Attachment).file.text();
  }
  return undefined;
};

/** Resolves an image canvas content payload from a DisplayAttachment, or `null` if unavailable. */
export const resolveImageCanvasContent = async (
  attachment: DisplayAttachment,
): Promise<ImageCanvasContent | ErrorCanvasContent | null> => {
  const result = await resolveAttachmentBlobUrl(attachment);
  if (result == null) return null;
  if (typeof result !== 'string') return result;
  return { type: AttachmentContentType.Image, url: result };
};

/** Resolves a plain-text canvas content payload from a DisplayAttachment, or `null` if unavailable. */
export const resolveTextCanvasContent = async (
  attachment: DisplayAttachment,
): Promise<PlainTextCanvasContent | ErrorCanvasContent | null> => {
  const result = await resolveAttachmentText(attachment);
  if (result == null) return null;
  if (typeof result !== 'string') return result;
  return { type: AttachmentContentType.PlainText, text: result };
};

/** Resolves a Markdown canvas content payload from a DisplayAttachment, or `null` if unavailable. */
export const resolveMarkdownCanvasContent = async (
  attachment: DisplayAttachment,
): Promise<MarkdownCanvasContent | ErrorCanvasContent | null> => {
  const result = await resolveAttachmentText(attachment);
  if (result == null) return null;
  if (typeof result !== 'string') return result;
  return { type: AttachmentContentType.Markdown, text: result };
};

/**
 * Builds a `PdfCanvasContent` for a PDF citation annotation, including highlights
 * for all annotations in the same source group and scroll target for the clicked one.
 * Returns `null` if the annotation has no PDF source attachment.
 */
export const annotationToPdfCanvasContent = (
  annotation: Annotation,
  groups: AnnotationGroup[],
): PdfCanvasContent | null => {
  const source = annotation.body?.source?.attachment;
  if (source?.type !== MIMEType.PDF) return null;

  const url = isDialFileId(source.url)
    ? resolveDialFileDownloadUrl(source.url)
    : source.url;
  if (url == null) return null;

  const group = groups.find((g) => g.sourceUrl === source.url);
  const allAnnotations = group?.annotations ?? [annotation];
  const selectedIndex = group ? group.annotations.indexOf(annotation) : 0;

  return {
    type: AttachmentContentType.Pdf,
    url,
    highlights: annotationsToPdfHighlights(allAnnotations),
    selectedHighlightId: annotationHighlightId(annotation, selectedIndex),
  };
};

/** Resolves a PDF canvas content payload from a DisplayAttachment, or `null` if unavailable. */
export const resolvePdfCanvasContent = async (
  attachment: DisplayAttachment,
): Promise<PdfCanvasContent | ErrorCanvasContent | null> => {
  const result = await resolveAttachmentBlobUrl(attachment);
  if (result == null) return null;
  if (typeof result !== 'string') {
    return result;
  }
  return { type: AttachmentContentType.Pdf, url: result };
};

/**
 * Resolves a JSON canvas content payload from a DisplayAttachment, or `null` if unavailable.
 * Falls back to `PlainTextCanvasContent` when the fetched text is not valid JSON.
 */
export const resolveJsonCanvasContent = async (
  attachment: DisplayAttachment,
): Promise<
  JsonCanvasContent | PlainTextCanvasContent | ErrorCanvasContent | null
> => {
  const result = await resolveAttachmentText(attachment);
  if (result == null) return null;
  if (typeof result !== 'string') return result;

  try {
    const value = JSON.parse(result);
    return { type: AttachmentContentType.Json, value };
  } catch {
    return { type: AttachmentContentType.PlainText, text: result };
  }
};
