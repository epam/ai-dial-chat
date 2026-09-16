import type {
  CodeCanvasContent,
  ErrorCanvasContent,
  HtmlCanvasContent,
  ImageCanvasContent,
  JsonCanvasContent,
  MarkdownCanvasContent,
  OoxmlCanvasContent,
  OoxmlHighlight,
  OoxmlHighlightLocation,
  GroupedVisualizerCanvasContent,
  PdfCanvasContent,
  PlainTextCanvasContent,
  VisualizerCanvasContent,
} from '@epam/ai-dial-attachment-canvas';
import {
  AttachmentContentType,
  AttachmentErrorType,
  getOoxmlFileType,
  OoxmlFileType,
  OoxmlHighlightKind,
} from '@epam/ai-dial-attachment-canvas';
import type {
  Annotation,
  ApplicationVisualizer,
  Attachment,
  AttachmentResource,
  CustomVisualizer,
  CustomVisualizerDataLayout,
  DisplayAttachment,
  GroupedAttachmentItem,
} from '@epam/ai-dial-chat-shared';
import {
  base64ToBlob,
  MIMEType,
  tryBase64ToBytes,
} from '@epam/ai-dial-chat-shared';
import {
  annotationHighlightId,
  annotationsToPdfHighlights,
  annotationToOfficeHighlightLocations,
  gatherSameSourceAnnotations,
  getAnnotationPdfPage,
  type AnnotationGroup,
  type OfficeHighlightLocation,
  parsePdfPageReference,
} from '@epam/ai-dial-quotations';
import { LRUCache } from 'lru-cache';
import { isDialFileId } from './dial-file';

/**
 * DIAL-file URL resolution injected by the host into every attachment-canvas
 * content resolver below. Host-owned — encodes the app's own
 * file-download endpoint.
 */
export interface AttachmentCanvasUrlResolvers {
  /** Resolves a DIAL Core file id to a downloadable URL. */
  resolveDialFileDownloadUrl: (fileId: string) => string | undefined;
  /** Resolves the best downloadable DIAL-file URL from an attachment's `url` or `referenceUrl`. */
  resolveDialUrl: (attachment: DisplayAttachment) => string | undefined;
  /** Resolves a DIAL Core file id to a fetchable metadata URL (used for cache-freshness validation). */
  resolveDialFileMetadataUrl: (fileId: string) => string | undefined;
}

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

/*
 * getUrlFileName, resolveExternalSourceContentType and
 * isExternalSourcePreviewable live in `./source-content` so
 * a consumer of only the `/source-content` entry point never resolves
 * fetching, LRU cache initialization, or the
 * `@epam/ai-dial-attachment-canvas`/`@epam/ai-dial-chat-shared` packages.
 * `index.ts` and `entry-points/file-manager.ts` re-export `./source-content`
 * directly for backward compatibility, rather than this module re-exporting
 * it — that keeps each name owned by exactly one star-export target, since
 * two `export *` declarations for the same name in one file silently drop it.
 */

/** A cached content fetch alongside the ETag it was validated against. */
interface CachedAttachmentEntry<T> {
  /** ETag captured from the metadata call that preceded this fetch. */
  etag: string | undefined;
  /** The in-flight or resolved content fetch itself. */
  promise: Promise<T>;
}

/*
 * Session-scoped LRU caches keyed by DIAL download URL. Before a cached entry
 * is reused, its `etag` is revalidated against a fresh metadata call
 * (`fetchCurrentEtag`) — a cached body is only served on an exact ETag match,
 * so a resource overwritten since it was cached (same conversation or a
 * different one) is refetched instead of replayed. Also cleared wholesale on
 * conversation navigation via clearAttachmentCache() as coarse
 * defense-in-depth.
 * blobCache: up to 10 binary files (PDFs, etc.)
 * textCache: up to 50 text files (markdown, JSON, plain text)
 */
const blobCache = new LRUCache<string, CachedAttachmentEntry<Blob>>({
  max: 10,
});
const textCache = new LRUCache<string, CachedAttachmentEntry<string>>({
  max: 50,
});

/** Clears all cached fetch results. Call this when leaving a conversation. */
export const clearAttachmentCache = (): void => {
  blobCache.clear();
  textCache.clear();
};

/**
 * Resolves the resource's current `etag` via
 * `resolvers.resolveDialFileMetadataUrl(fileId)`. Never throws — returns
 * `undefined` when the URL cannot be resolved, the fetch fails, the response
 * is non-2xx, or the body has no `etag` field, so the caller can treat the
 * validator as unusable and bypass the cache rather than serve unverifiable
 * content.
 */
const fetchCurrentEtag = async (
  fileId: string,
  resolvers: AttachmentCanvasUrlResolvers,
): Promise<string | undefined> => {
  const metadataUrl = resolvers.resolveDialFileMetadataUrl(fileId);
  if (metadataUrl == null) return undefined;
  try {
    const response = await fetch(metadataUrl);
    if (!response.ok) return undefined;
    const body: unknown = await response.json();
    const etag = (body as { etag?: unknown })?.etag;
    return typeof etag === 'string' ? etag : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Fetches a DIAL download URL and returns its body as a Blob, revalidating
 * freshness against the resource's current ETag before reusing a cached
 * entry. The cache is skipped entirely (no read, no write) when the ETag
 * cannot be determined. A failed content fetch removes its cache entry so
 * the next call retries the network.
 */
const fetchDialBlob = async (
  dialUrl: string,
  fileId: string,
  resolvers: AttachmentCanvasUrlResolvers,
): Promise<Blob> => {
  const etag = await fetchCurrentEtag(fileId, resolvers);
  if (etag == null) {
    return fetch(dialUrl).then((r) => {
      if (!r.ok)
        throw Object.assign(new Error(`HTTP ${r.status}`), {
          status: r.status,
        });
      return r.blob();
    });
  }

  const existing = blobCache.get(dialUrl);
  if (existing != null && existing.etag === etag) {
    return existing.promise;
  }

  blobCache.delete(dialUrl);
  const promise = fetch(dialUrl)
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
  blobCache.set(dialUrl, { etag, promise });
  return promise;
};

/**
 * Fetches a DIAL download URL and returns its body as text, revalidating
 * freshness against the resource's current ETag before reusing a cached
 * entry. The cache is skipped entirely (no read, no write) when the ETag
 * cannot be determined. A failed content fetch removes its cache entry so
 * the next call retries the network.
 */
const fetchDialText = async (
  dialUrl: string,
  fileId: string,
  resolvers: AttachmentCanvasUrlResolvers,
): Promise<string> => {
  const etag = await fetchCurrentEtag(fileId, resolvers);
  if (etag == null) {
    return fetch(dialUrl).then((r) => {
      if (!r.ok)
        throw Object.assign(new Error(`HTTP ${r.status}`), {
          status: r.status,
        });
      return r.text();
    });
  }

  const existing = textCache.get(dialUrl);
  if (existing != null && existing.etag === etag) {
    return existing.promise;
  }

  textCache.delete(dialUrl);
  const promise = fetch(dialUrl)
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
  textCache.set(dialUrl, { etag, promise });
  return promise;
};

/** Strips a trailing `#...` fragment (e.g. a PDF `#page=N` anchor) from a DIAL file id. */
const stripFragment = (fileId: string): string => fileId.split('#')[0];

/**
 * Extracts the raw `files/{bucket}/{path}` id backing an attachment's `url`
 * or `referenceUrl`, mirroring the source-selection order
 * `resolvers.resolveDialUrl` uses internally, so the metadata-freshness check
 * validates the same resource the download URL was resolved from. Returns
 * `undefined` when neither is a DIAL file id.
 */
const resolveAttachmentFileId = (
  attachment: DisplayAttachment,
): string | undefined => {
  if (attachment.url != null && isDialFileId(attachment.url)) {
    return stripFragment(attachment.url);
  }
  if (
    attachment.referenceUrl != null &&
    isDialFileId(attachment.referenceUrl)
  ) {
    return stripFragment(attachment.referenceUrl);
  }
  return undefined;
};

/**
 * Resolves a displayable Blob/object URL for an attachment's binary content: a
 * local `File` with bytes, an already-uploaded DIAL file (fetched via LRU
 * cache), a 0-byte local `File`, an existing preview URL, or inline base64
 * `data` decoded into a Blob URL. A local `File` with bytes takes precedence
 * over the DIAL download URL; a 0-byte `File` (the file-manager placeholder)
 * does not. Returns `undefined` when none of these sources are available, or
 * an `ErrorCanvasContent` when a DIAL file fetch fails.
 */
const resolveAttachmentBlobUrl = async (
  attachment: DisplayAttachment,
  resolvers: AttachmentCanvasUrlResolvers,
): Promise<string | ErrorCanvasContent | undefined> => {
  const file =
    'file' in attachment ? (attachment as Attachment).file : undefined;
  const isFileEmpty = file != null && file.size === 0;
  const dialUrl =
    file != null && !isFileEmpty
      ? undefined
      : resolvers.resolveDialUrl(attachment);
  if (file != null && dialUrl == null) {
    return URL.createObjectURL(file);
  }
  if (dialUrl != null) {
    try {
      const blob = await fetchDialBlob(
        dialUrl,
        resolveAttachmentFileId(attachment) ?? '',
        resolvers,
      );
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
  resolvers: AttachmentCanvasUrlResolvers,
): Promise<string | ErrorCanvasContent | undefined> => {
  if (attachment.data != null) return base64ToText(attachment.data);
  const downloadUrl = resolvers.resolveDialUrl(attachment);
  if (downloadUrl != null) {
    try {
      return await fetchDialText(
        downloadUrl,
        resolveAttachmentFileId(attachment) ?? '',
        resolvers,
      );
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status != null) return classifyFetchFailure(status, downloadUrl);
      return networkFailureContent(downloadUrl);
    }
  }
  if ('file' in attachment) {
    return (attachment as Attachment).file.text();
  }
  return undefined;
};

/**
 * Whether the attachment carries text `resolveAttachmentText` can resolve —
 * inline data, a DIAL download URL, or a locally-picked file. Mirrors that
 * function's source list, so a `null` resolver result can be read as "the text
 * was fetched and rejected" rather than "there was no text to fetch".
 */
export const hasAttachmentTextSource = (
  attachment: DisplayAttachment,
  resolvers: AttachmentCanvasUrlResolvers,
): boolean =>
  attachment.data != null ||
  resolvers.resolveDialUrl(attachment) != null ||
  'file' in attachment;

/**
 * Resolves an image canvas content payload from a DisplayAttachment without
 * fetching — returns a local blob URL or the BFF download URL directly so the
 * browser cache can be shared with the conversation view's `<img>` element.
 * A local `File` with bytes takes precedence over the DIAL download URL; a
 * 0-byte `File` (the file-manager placeholder) does not. Error detection is
 * delegated to `<img onError>` in the canvas renderer. Returns `null` if no
 * URL source is available.
 */
export const resolveImageCanvasContent = (
  attachment: DisplayAttachment,
  resolvers: AttachmentCanvasUrlResolvers,
): ImageCanvasContent | null => {
  const file =
    'file' in attachment ? (attachment as Attachment).file : undefined;
  const isFileEmpty = file != null && file.size === 0;
  const dialUrl =
    file != null && !isFileEmpty
      ? undefined
      : resolvers.resolveDialUrl(attachment);
  if (file != null && dialUrl == null) {
    return {
      type: AttachmentContentType.Image,
      url: URL.createObjectURL(file),
    };
  }
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
  resolvers: AttachmentCanvasUrlResolvers,
): Promise<PlainTextCanvasContent | ErrorCanvasContent | null> => {
  const result = await resolveAttachmentText(attachment, resolvers);
  if (result == null) return null;
  if (typeof result !== 'string') return result;
  return { type: AttachmentContentType.PlainText, text: result };
};

/** Resolves a Markdown canvas content payload from a DisplayAttachment, or `null` if unavailable. */
export const resolveMarkdownCanvasContent = async (
  attachment: DisplayAttachment,
  resolvers: AttachmentCanvasUrlResolvers,
): Promise<MarkdownCanvasContent | ErrorCanvasContent | null> => {
  const result = await resolveAttachmentText(attachment, resolvers);
  if (result == null) return null;
  if (typeof result !== 'string') return result;
  return { type: AttachmentContentType.Markdown, text: result };
};

const HTML_SRCDOC_SIZE_LIMIT = 1_048_576;

/** Resolves a syntax-highlighted code canvas content payload from a DisplayAttachment, or `null` if unavailable. */
export const resolveCodeCanvasContent = async (
  attachment: DisplayAttachment,
  resolvers: AttachmentCanvasUrlResolvers,
  language?: string,
): Promise<CodeCanvasContent | ErrorCanvasContent | null> => {
  const result = await resolveAttachmentText(attachment, resolvers);
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
  resolvers: AttachmentCanvasUrlResolvers,
): Promise<HtmlCanvasContent | ErrorCanvasContent | null> => {
  const result = await resolveAttachmentText(attachment, resolvers);
  if (result == null) return null;
  if (typeof result !== 'string') return result;
  if (result.length > HTML_SRCDOC_SIZE_LIMIT) return null;
  const url = resolvers.resolveDialUrl(attachment) ?? undefined;
  return { type: AttachmentContentType.Html, srcdoc: result, url };
};

/**
 * Builds a `PdfCanvasContent` for a PDF citation annotation, including highlights
 * for the clicked annotation's document within its citation group.
 * Returns `null` if the annotation has no PDF source attachment.
 */
export const annotationToPdfCanvasContent = (
  annotation: Annotation,
  groups: AnnotationGroup[],
  resolvers: AttachmentCanvasUrlResolvers,
): PdfCanvasContent | null => {
  const source = annotation.body?.source?.attachment;
  if (source?.type !== MIMEType.PDF) return null;

  const url = isDialFileId(source.url)
    ? resolvers.resolveDialFileDownloadUrl(source.url)
    : source.url;
  if (url == null) return null;

  const group = groups.find((g) => g.annotations.includes(annotation));
  const allAnnotations = (group?.annotations ?? [annotation]).filter(
    (entry) => entry.body?.source?.attachment?.url === source.url,
  );
  const selectedIndex = allAnnotations.indexOf(annotation);
  const highlights = annotationsToPdfHighlights(allAnnotations);
  const highlightId = annotationHighlightId(annotation, selectedIndex);

  return {
    type: AttachmentContentType.Pdf,
    url,
    highlights,
    selectedHighlightId: highlights.some(
      (highlight) => highlight.id === highlightId,
    )
      ? highlightId
      : undefined,
    page: getAnnotationPdfPage(annotation),
  };
};

/**
 * Maps one `OfficeHighlightLocation` (quotations-owned, discriminated by the
 * wire's own `type` string) to the `OoxmlHighlightLocation` shape
 * `libs/attachment-canvas` renders (discriminated by its own
 * `OoxmlHighlightKind` enum). This is the layer boundary noted in
 * `design.md`'s architecture diagram: `libs/quotations` cannot depend on
 * `libs/attachment-canvas` (a real circular dependency — `attachment-canvas`
 * already depends on `quotations` for the PDF highlight path), so the
 * translation happens here, in the one lib that already depends on both.
 */
const toOoxmlHighlightLocation = (
  location: OfficeHighlightLocation,
): OoxmlHighlightLocation => {
  switch (location.type) {
    case 'docx_text_range':
      return {
        kind: OoxmlHighlightKind.DocxTextRange,
        story: location.story,
        path: location.path,
        start: location.start,
        endExclusive: location.endExclusive,
        text: location.text,
      };
    case 'pptx_text_range':
      return {
        kind: OoxmlHighlightKind.PptxTextRange,
        slide: location.slide,
        shapeId: location.shapeId,
        start: location.start,
        endExclusive: location.endExclusive,
        text: location.text,
      };
    case 'excel_rc_range':
      return {
        kind: OoxmlHighlightKind.XlsxCellRange,
        sheet: location.sheet,
        start: location.start,
        end: location.end,
      };
  }
};

/**
 * Builds an `OoxmlCanvasContent` for a DOCX/PPTX/XLSX citation annotation,
 * including highlights for every annotation sharing the clicked one's source
 * document. Returns `null` when the annotation has no source attachment,
 * the source is not a format `@silurus/ooxml` renders as DOCX/XLSX/PPTX (a
 * CSV source returns `null` — citation highlighting targets Office documents
 * only), or no URL resolves.
 */
export const annotationToOoxmlCanvasContent = (
  annotation: Annotation,
  annotations: Annotation[],
  resolvers: AttachmentCanvasUrlResolvers,
): OoxmlCanvasContent | null => {
  const source = annotation.body?.source?.attachment;
  if (source?.url == null) return null;

  const format = getOoxmlFileType(source.title ?? source.url, source.type);
  if (
    format !== OoxmlFileType.Docx &&
    format !== OoxmlFileType.Xlsx &&
    format !== OoxmlFileType.Pptx
  ) {
    return null;
  }

  const url = isDialFileId(source.url)
    ? resolvers.resolveDialFileDownloadUrl(source.url)
    : source.url;
  if (url == null) return null;

  const sameSource = gatherSameSourceAnnotations(annotation, annotations);
  const highlights: OoxmlHighlight[] = [];
  let selectedHighlightId: string | undefined;

  sameSource.forEach((entry, index) => {
    const locations = annotationToOfficeHighlightLocations(entry);
    if (locations.length === 0) return;

    const id = annotationHighlightId(entry, index);
    highlights.push({ id, locations: locations.map(toOoxmlHighlightLocation) });
    if (entry === annotation) selectedHighlightId = id;
  });

  return {
    type: AttachmentContentType.Ooxml,
    url,
    format,
    ...(highlights.length > 0 ? { highlights, selectedHighlightId } : {}),
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
  resolvers: AttachmentCanvasUrlResolvers,
): PdfCanvasContent | null => {
  const parsed = parsePdfPageReference(attachment.url);
  if (parsed == null) return null;

  const url = isDialFileId(parsed.baseUrl)
    ? resolvers.resolveDialFileDownloadUrl(parsed.baseUrl)
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
    page: parsed.page,
  };
};

/**
 * True when `url` is an absolute URL the PDF canvas viewer can fetch directly:
 * `http(s):` (a real external resource) or `blob:` (an already-created object
 * URL). A relative or opaque string (e.g. a citation/reference id with no
 * scheme) throws in the `URL` constructor and is rejected, since handing it
 * to the viewer would render a silent blank canvas instead of a fetch error.
 */
const isFetchableExternalUrl = (url: string): boolean => {
  try {
    const protocol = new URL(url).protocol;
    return (
      protocol === 'http:' || protocol === 'https:' || protocol === 'blob:'
    );
  } catch {
    return false;
  }
};

/**
 * Returns `attachment.url` when it is a fetchable external (non-DIAL) URL the
 * canvas viewer can load directly, or `undefined` otherwise. Shared by
 * `resolvePdfCanvasContent`/`resolveOoxmlCanvasContent` as the fallback used
 * when `resolveAttachmentBlobUrl` has no DIAL-hosted download URL, preview
 * URL, or inline data to offer — the same approach
 * `annotationToPdfCanvasContent`/`referenceAttachmentToPdfCanvasContent` use
 * for a citation whose source is an external PDF: hand the URL to the canvas
 * viewer directly rather than failing, since it fetches and renders the URL
 * itself.
 */
const resolveExternalAttachmentUrl = (
  attachment: DisplayAttachment,
): string | undefined =>
  attachment.url != null &&
  !isDialFileId(attachment.url) &&
  isFetchableExternalUrl(attachment.url)
    ? attachment.url
    : undefined;

/** Resolves a PDF canvas content payload from a DisplayAttachment, or `null` if unavailable. */
export const resolvePdfCanvasContent = async (
  attachment: DisplayAttachment,
  resolvers: AttachmentCanvasUrlResolvers,
): Promise<PdfCanvasContent | ErrorCanvasContent | null> => {
  const result = await resolveAttachmentBlobUrl(attachment, resolvers);
  if (result != null) {
    if (typeof result !== 'string') return result;
    return { type: AttachmentContentType.Pdf, url: result };
  }
  const externalUrl = resolveExternalAttachmentUrl(attachment);
  return externalUrl != null
    ? { type: AttachmentContentType.Pdf, url: externalUrl }
    : null;
};

/** Resolves an OOXML or CSV renderer payload from a DisplayAttachment, or `null` if unavailable. */
export const resolveOoxmlCanvasContent = async (
  attachment: DisplayAttachment,
  resolvers: AttachmentCanvasUrlResolvers,
  format: OoxmlFileType,
): Promise<OoxmlCanvasContent | ErrorCanvasContent | null> => {
  const result = await resolveAttachmentBlobUrl(attachment, resolvers);
  if (result != null) {
    if (typeof result !== 'string') return result;
    return { type: AttachmentContentType.Ooxml, url: result, format };
  }
  const externalUrl = resolveExternalAttachmentUrl(attachment);
  return externalUrl != null
    ? { type: AttachmentContentType.Ooxml, url: externalUrl, format }
    : null;
};

/**
 * Resolves a JSON canvas content payload from a DisplayAttachment, or `null` if unavailable.
 * Falls back to `PlainTextCanvasContent` when the fetched text is not valid JSON.
 */
export const resolveJsonCanvasContent = async (
  attachment: DisplayAttachment,
  resolvers: AttachmentCanvasUrlResolvers,
): Promise<
  JsonCanvasContent | PlainTextCanvasContent | ErrorCanvasContent | null
> => {
  const result = await resolveAttachmentText(attachment, resolvers);
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
  resolvers: AttachmentCanvasUrlResolvers,
  entry: CustomVisualizer,
  themeId: string,
): Promise<VisualizerCanvasContent | null> => {
  const result = await resolveAttachmentText(attachment, resolvers);
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

/** Outcome of building a grouped visualizer payload. */
export interface GroupedVisualizerResolution {
  /** The grouped payload, or `null` when no claimed attachment resolved to a URL. */
  content: GroupedVisualizerCanvasContent | null;
  /** The claimed attachments that reached `content.attachments`, in the input's order. The caller returns the rest to the ordinary attachment tray. */
  resolved: DisplayAttachment[];
}

/**
 * Builds the grouped payload for an application-scoped visualizer from the
 * attachments its entry claims, reporting which of them `resolveAbsoluteUrl`
 * could produce a URL for. Unlike the single-attachment resolver this fetches
 * nothing: the grouped protocol hands the visualizer URLs and lets it read
 * them itself, so the URLs must be absolute — a host-relative path would
 * resolve against the iframe's own origin. Producing one is host knowledge,
 * which is why it arrives as a callback rather than being built here.
 */
export const resolveGroupedVisualizerCanvasContent = (
  attachments: DisplayAttachment[],
  resolveAbsoluteUrl: (attachment: DisplayAttachment) => string | undefined,
  entry: ApplicationVisualizer,
  themeId: string,
): GroupedVisualizerResolution => {
  const layout: CustomVisualizerDataLayout = {
    width: entry.width,
    height: entry.height,
    mobileHeight: entry.mobileHeight,
    themeId,
  };

  const items: GroupedAttachmentItem[] = [];
  const resolved: DisplayAttachment[] = [];
  attachments.forEach((attachment) => {
    const url = resolveAbsoluteUrl(attachment);
    if (url == null) return;
    resolved.push(attachment);
    items.push({
      url,
      mimeType: attachment.contentType,
      visualizerData: { layout },
    });
  });

  if (items.length === 0) return { content: null, resolved: [] };

  return {
    content: {
      type: AttachmentContentType.GroupedVisualizer,
      url: entry.url,
      attachments: items,
      layout,
      visualizerName: entry.title,
      requestTimeout: entry.requestTimeout,
    },
    resolved,
  };
};
