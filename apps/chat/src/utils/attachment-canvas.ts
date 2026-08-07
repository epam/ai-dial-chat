import type {
  CodeCanvasContent,
  ErrorCanvasContent,
  HtmlCanvasContent,
  ImageCanvasContent,
  JsonCanvasContent,
  MarkdownCanvasContent,
  PdfCanvasContent,
  PlainTextCanvasContent,
  VisualizerCanvasContent,
} from '@epam/ai-dial-attachment-canvas';
import {
  AttachmentContentType,
  AttachmentErrorType,
  isHtmlPreviewable,
  isTextPreviewable,
} from '@epam/ai-dial-attachment-canvas';
import type {
  Annotation,
  Attachment,
  AttachmentResource,
  CustomVisualizer,
  DisplayAttachment,
} from '@epam/ai-dial-chat-shared';
import {
  base64ToBlob,
  FileExtension,
  MIMEType,
  tryBase64ToBytes,
} from '@epam/ai-dial-chat-shared';
import {
  annotationHighlightId,
  annotationsToPdfHighlights,
  parsePdfPageReference,
  type AnnotationGroup,
} from '@epam/ai-dial-quotations';
import { LRUCache } from 'lru-cache';
import {
  isDialFileId,
  resolveDialFileDownloadUrl,
  resolveDialUrl,
} from './dial-file';

/**
 * Decodes an inline `data` payload into a Blob object URL of the given MIME
 * type. Falls back to treating `data` as raw (already-decoded) text when it
 * is not valid base64.
 */
const base64ToBlobUrl = (data: string, mimeType: string): string =>
  URL.createObjectURL(base64ToBlob(data, mimeType));

/**
 * Decodes an inline `data` payload into UTF-8 text. Falls back to returning
 * `data` unchanged when it is not valid base64 (some backends send
 * already-decoded plain text despite the base64 contract, e.g. OCR'd markdown
 * with non-Latin1 characters).
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

/* Returns true when an external source URL should be opened in the canvas
 * rather than a new browser tab.
 *
 * Image and audio content types are trusted directly since web-search grounding
 * APIs do not mislabel them. For document types we rely solely on the URL path
 * extension — Google's grounding API labels every web reference (YouTube,
 * Forbes, etc.) as 'text/markdown', so content-type alone is unreliable. */
export const isExternalSourcePreviewable = (
  contentType: string,
  url: string,
): boolean => {
  if (contentType.startsWith('image/') || contentType.startsWith('audio/')) {
    return true;
  }
  try {
    const { pathname } = new URL(url);
    const fileName = pathname.split('/').pop() ?? '';
    const dot = fileName.lastIndexOf('.');
    if (dot === -1) return false;
    const ext = fileName.slice(dot + 1).toLowerCase();
    /* 'pdf' is not in TEXT_EXTENSIONS; 'html'/'htm' are not in TEXT_EXTENSIONS (they use HtmlContent), so both must be checked explicitly. */
    return (
      ext === FileExtension.PDF ||
      isTextPreviewable(fileName) ||
      isHtmlPreviewable(fileName)
    );
  } catch {
    return false;
  }
};

/*
 * Session-scoped LRU caches keyed by DIAL download URL.
 * Cleared on conversation navigation via clearAttachmentCache().
 * blobCache: up to 10 binary files (PDFs, etc.)
 * textCache: up to 50 text files (markdown, JSON, plain text)
 */
const blobCache = new LRUCache<string, Promise<Blob>>({ max: 10 });
const textCache = new LRUCache<string, Promise<string>>({ max: 50 });

/** Clears all cached fetch results. Call this when leaving a conversation. */
export const clearAttachmentCache = (): void => {
  blobCache.clear();
  textCache.clear();
};

/**
 * Fetches a DIAL download URL and returns its body as a Blob.
 * The result is cached by URL; failed requests are removed from cache so the
 * next call retries the network.
 */
const fetchDialBlob = (dialUrl: string): Promise<Blob> => {
  let p = blobCache.get(dialUrl);
  if (p == null) {
    p = fetch(dialUrl)
      .then((r) => {
        if (!r.ok)
          throw Object.assign(new Error(`HTTP ${r.status}`), {
            status: r.status,
          });
        return r.blob();
      })
      .catch((err: unknown) => {
        blobCache.delete(dialUrl);
        throw err;
      });
    blobCache.set(dialUrl, p);
  }
  return p;
};

/**
 * Fetches a DIAL download URL and returns its body as text.
 * The result is cached by URL; failed requests are removed from cache so the
 * next call retries the network.
 */
const fetchDialText = (dialUrl: string): Promise<string> => {
  let p = textCache.get(dialUrl);
  if (p == null) {
    p = fetch(dialUrl)
      .then((r) => {
        if (!r.ok)
          throw Object.assign(new Error(`HTTP ${r.status}`), {
            status: r.status,
          });
        return r.text();
      })
      .catch((err: unknown) => {
        textCache.delete(dialUrl);
        throw err;
      });
    textCache.set(dialUrl, p);
  }
  return p;
};

/**
 * Resolves a displayable Blob/object URL for an attachment's binary content: a
 * locally-picked `File`, an already-uploaded DIAL file (fetched via LRU cache),
 * an existing preview URL, or inline base64 `data` decoded into a Blob URL.
 * Returns `undefined` when none of these sources are available, or an
 * `ErrorCanvasContent` when a DIAL file fetch fails.
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
      const blob = await fetchDialBlob(dialUrl);
      return URL.createObjectURL(blob);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status != null) return classifyFetchFailure(status, dialUrl);
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
 * fetched text from an already-uploaded DIAL file (via LRU cache), or inline
 * base64 `data` decoded into UTF-8 text. Returns `undefined` when none of
 * these sources are available, or an `ErrorCanvasContent` when the fetch
 * failed.
 */
const resolveAttachmentText = async (
  attachment: DisplayAttachment,
): Promise<string | ErrorCanvasContent | undefined> => {
  if (attachment.data != null) return base64ToText(attachment.data);
  const downloadUrl = resolveDialUrl(attachment);
  if (downloadUrl != null) {
    try {
      return await fetchDialText(downloadUrl);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status != null) return classifyFetchFailure(status, downloadUrl);
      return networkFailureContent(downloadUrl);
    }
  }
  if ('file' in attachment && (attachment as Attachment).file.size > 0) {
    return (attachment as Attachment).file.text();
  }
  return undefined;
};

/**
 * Resolves an image canvas content payload from a DisplayAttachment without
 * fetching — returns the BFF download URL (or a local/inline blob URL)
 * directly so the browser cache can be shared with the conversation view's
 * `<img>` element. Error detection is delegated to `<img onError>` in the
 * canvas renderer. Returns `null` if no URL source is available.
 */
export const resolveImageCanvasContent = (
  attachment: DisplayAttachment,
): ImageCanvasContent | null => {
  if ('file' in attachment && (attachment as Attachment).file.size > 0) {
    return {
      type: AttachmentContentType.Image,
      url: URL.createObjectURL((attachment as Attachment).file),
    };
  }
  const dialUrl = resolveDialUrl(attachment);
  if (dialUrl != null) {
    return { type: AttachmentContentType.Image, url: dialUrl };
  }
  if (attachment.previewUrl != null) {
    return { type: AttachmentContentType.Image, url: attachment.previewUrl };
  }
  if (attachment.data != null) {
    return {
      type: AttachmentContentType.Image,
      url: base64ToBlobUrl(attachment.data, attachment.contentType),
    };
  }
  return null;
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

const HTML_SRCDOC_SIZE_LIMIT = 1_048_576;

/** Resolves a syntax-highlighted code canvas content payload from a DisplayAttachment, or `null` if unavailable. */
export const resolveCodeCanvasContent = async (
  attachment: DisplayAttachment,
  language?: string,
): Promise<CodeCanvasContent | ErrorCanvasContent | null> => {
  const result = await resolveAttachmentText(attachment);
  if (result == null) return null;
  if (typeof result !== 'string') return result;
  return { type: AttachmentContentType.Code, text: result, language };
};

/**
 * Resolves an HTML canvas content payload from a DisplayAttachment.
 * Fetches and inlines the HTML as `srcdoc` when the attachment has a download URL or inline data.
 * Returns `null` if no source is available, or an `ErrorCanvasContent` on fetch failure.
 * Rejects `srcdoc` payloads larger than 1 MiB to prevent browser truncation.
 */
export const resolveHtmlCanvasContent = async (
  attachment: DisplayAttachment,
): Promise<HtmlCanvasContent | ErrorCanvasContent | null> => {
  const result = await resolveAttachmentText(attachment);
  if (result == null) return null;
  if (typeof result !== 'string') return result;
  if (result.length > HTML_SRCDOC_SIZE_LIMIT) return null;
  const url = resolveDialUrl(attachment) ?? undefined;
  return { type: AttachmentContentType.Html, srcdoc: result, url };
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

/**
 * Builds a `PdfCanvasContent` for a reference-only attachment whose
 * `reference_url` points at a PDF file (optionally with a `#page=N`
 * fragment), so it can be opened in the canvas and scrolled to the
 * referenced page the same way a regular PDF citation is. Returns `null`
 * when the attachment's `url` does not target a PDF.
 */
export const referenceAttachmentToPdfCanvasContent = (
  attachment: AttachmentResource,
): PdfCanvasContent | null => {
  const parsed = parsePdfPageReference(attachment.url);
  if (parsed == null) return null;

  const url = isDialFileId(parsed.baseUrl)
    ? resolveDialFileDownloadUrl(parsed.baseUrl)
    : parsed.baseUrl;
  if (url == null) return null;

  if (parsed.page == null) {
    return { type: AttachmentContentType.Pdf, url };
  }

  const selectedHighlightId = `reference-page-${parsed.page}`;
  return {
    type: AttachmentContentType.Pdf,
    url,
    highlights: [
      {
        id: selectedHighlightId,
        bboxes: [{ page: parsed.page, x1: 0, y1: 0, x2: 0, y2: 0 }],
        style: { backgroundColor: 'transparent', opacity: 0 },
      },
    ],
    selectedHighlightId,
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

/**
 * Fetches the attachment payload and builds a `VisualizerCanvasContent` for the
 * given registry entry and theme. Returns `null` when the payload cannot be
 * fetched (caller should fall through to default content-type handling).
 *
 * Only JSON payloads are parsed into `data`. Non-JSON payloads (plain text,
 * CSV, binary, …) resolve with `data: {}` — the visualizer still receives
 * `mimeType` and `layout`, just no payload body. This is intentional: only
 * JSON attachment content is forwarded to visualizers in this version.
 */
export const resolveVisualizerCanvasContent = async (
  attachment: DisplayAttachment,
  entry: CustomVisualizer,
  themeId: string,
): Promise<VisualizerCanvasContent | null> => {
  const result = await resolveAttachmentText(attachment);
  if (result == null || typeof result !== 'string') return null;

  let data: unknown = {};
  try {
    const parsed = JSON.parse(result);
    if (typeof parsed === 'object' && parsed !== null) {
      data = parsed;
    }
  } catch {
    /* non-JSON payload — send as empty object; visualizer receives raw mimeType */
  }

  return {
    type: AttachmentContentType.Visualizer,
    url: entry.url,
    mimeType: attachment.contentType,
    data,
    layout: {
      width: entry.width,
      height: entry.height,
      mobileHeight: entry.mobileHeight,
      themeId,
    },
    visualizerName: entry.title,
    requestTimeout: entry.requestTimeout,
  };
};
