import {
  AttachmentContentType,
  useAttachmentCanvas,
  type PdfCanvasContent,
} from '@epam/ai-dial-attachment-canvas';
import {
  base64ToBlob,
  ensureDownloadFilename,
  triggerAnchorDownload,
  triggerBlobDownload,
  MIMEType,
  type AttachmentResource,
  type DisplayAttachment,
} from '@epam/ai-dial-chat-shared';
import { parsePdfPageReference } from '@epam/ai-dial-quotations';
import { useCallback } from 'react';
import { openAnnotationAttachment } from '../../files/annotation';
import {
  isDialFileId,
  isDialFolderId,
  isDialProjectFileId,
  isDialStoredFileId,
} from '../../files/dial-file';

/** Resolves a DIAL Core file id or project file id to a downloadable URL, or `undefined` when the host serves none. Host-owned — encodes the app's own file-download endpoints. */
export type ResolveDownloadUrl = (fileId: string) => string | undefined;

/** Parameters for {@link useAttachmentAction}. */
export interface UseAttachmentActionParams {
  /** Resolves a DIAL Core file id to a downloadable URL. */
  resolveDownloadUrl: ResolveDownloadUrl;
}

/** Return value of {@link useAttachmentAction}. */
export interface UseAttachmentActionResult {
  /** Default click handler for an attachment tile: download, canvas-preview, or open-in-browser. */
  handleAttachmentClick: (attachment: DisplayAttachment) => void;
}

/* DIAL Core serves no download for a folder id (`files/{bucket}/{path}/`).
 * A project file id (`projects/…/files/…`) is downloadable too; the host's
 * `resolveDownloadUrl` decides whether it has a route for it. */
const isDownloadableDialFileId = (url: string | undefined): url is string =>
  url != null &&
  ((isDialFileId(url) && !isDialFolderId(url)) || isDialProjectFileId(url));

/** Returns true when `downloadAttachment` can trigger a download for `attachment`; a DIAL folder attachment is not downloadable. */
export const isDownloadableAttachment = (
  attachment: DisplayAttachment,
): boolean =>
  isDownloadableDialFileId(attachment.url) || attachment.data != null;

/**
 * Downloads an attachment that carries its own content: a DIAL-hosted file
 * (`url` resolves to a DIAL file id) or an inline `data` payload. Returns
 * whether a download was actually triggered, so callers can skip
 * non-downloadable (reference-only) attachments without duplicating the
 * DIAL-file-id / URL-resolution checks.
 */
export const downloadAttachment = (
  attachment: DisplayAttachment,
  resolveDownloadUrl: ResolveDownloadUrl,
): boolean => {
  const { url, name, contentType, data } = attachment;

  if (isDownloadableDialFileId(url)) {
    const downloadUrl = resolveDownloadUrl(url);
    if (downloadUrl == null) return false;

    triggerAnchorDownload(
      downloadUrl,
      ensureDownloadFilename(name, url, contentType),
    );
    return true;
  }

  /* Generated attachments (e.g. a produced .md report) can arrive inline in
   * `data` rather than as a DIAL file, in which case there is no download URL
   * to resolve — build the blob locally instead. */
  if (data != null) {
    triggerBlobDownload(
      base64ToBlob(data, contentType || MIMEType.Plain),
      ensureDownloadFilename(name, url, contentType),
    );
    return true;
  }

  return false;
};

const referenceAttachmentToPdfCanvasContent = (
  attachment: AttachmentResource,
  resolveDownloadUrl: ResolveDownloadUrl,
): PdfCanvasContent | null => {
  const parsed = parsePdfPageReference(attachment.url);
  if (parsed == null) return null;

  const url = isDialStoredFileId(parsed.baseUrl)
    ? resolveDownloadUrl(parsed.baseUrl)
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

/**
 * Default click behavior for a plain attachment tile: downloads DIAL-hosted
 * and inline (`data`) files, and for reference-only attachments (no `url`/`data`,
 * only `referenceUrl` — e.g. RAG/search-grounding chunks), opens a PDF
 * `referenceUrl` in the canvas scrolled to its referenced page when present,
 * otherwise opens/downloads the `referenceUrl` as-is.
 */
export const useAttachmentAction = ({
  resolveDownloadUrl,
}: UseAttachmentActionParams): UseAttachmentActionResult => {
  const { openCanvas } = useAttachmentCanvas();

  const handleAttachmentClick = useCallback(
    (attachment: DisplayAttachment): void => {
      const { url, referenceUrl, data, name } = attachment;

      if (url != null || data != null) {
        downloadAttachment(attachment, resolveDownloadUrl);
        return;
      }

      if (referenceUrl == null) return;

      const resource: AttachmentResource = {
        type: attachment.contentType,
        url: referenceUrl,
        title: name,
      };

      const canvasContent = referenceAttachmentToPdfCanvasContent(
        resource,
        resolveDownloadUrl,
      );
      if (canvasContent) {
        openCanvas(canvasContent, name);
        return;
      }

      openAnnotationAttachment(resource, resolveDownloadUrl);
    },
    [openCanvas, resolveDownloadUrl],
  );

  return { handleAttachmentClick };
};
