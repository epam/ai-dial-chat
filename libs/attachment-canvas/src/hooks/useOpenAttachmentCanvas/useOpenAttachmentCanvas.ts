import type {
  CustomVisualizer,
  DisplayAttachment,
} from '@epam/ai-dial-chat-shared';
import {
  AttachmentType,
  FileExtension,
  MIMEType,
  stripUrlQueryAndFragment,
} from '@epam/ai-dial-chat-shared';
import { useCallback } from 'react';
import { useAttachmentCanvas } from '../../context/AttachmentCanvasContext';
import type {
  CodeCanvasContent,
  ErrorCanvasContent,
  HtmlCanvasContent,
  ImageCanvasContent,
  JsonCanvasContent,
  MarkdownCanvasContent,
  OoxmlCanvasContent,
  PdfCanvasContent,
  PlainTextCanvasContent,
  VisualizerCanvasContent,
} from '../../models/attachment-canvas';
import {
  AttachmentContentType,
  type OoxmlFileType,
} from '../../types/attachment-canvas';
import {
  createUnsupportedCanvasContent,
  extensionToLanguage,
  getOoxmlFileType,
  isHtmlPreviewable,
  isTextPreviewable,
} from '../../utils/content';
import { findVisualizerForMime } from '../../utils/visualizer';

/**
 * Content resolvers `useOpenAttachmentCanvas` calls to turn a
 * `DisplayAttachment` into an `AttachmentCanvasContent` payload. The host
 * implements every resolver — the hook itself never fetches or decodes
 * attachment bytes, only decides which resolver to call and how to interpret
 * a `null`/rejected result.
 */
export interface UseOpenAttachmentCanvasResolvers {
  /** Resolves an image attachment's displayable URL. Returns `null` if unavailable. */
  resolveImageContent(attachment: DisplayAttachment): ImageCanvasContent | null;
  /** Resolves an attachment's plain-text content. Returns `null` if unavailable. */
  resolveTextContent(
    attachment: DisplayAttachment,
  ): Promise<PlainTextCanvasContent | ErrorCanvasContent | null>;
  /** Resolves an attachment's Markdown content. Returns `null` if unavailable. */
  resolveMarkdownContent(
    attachment: DisplayAttachment,
  ): Promise<MarkdownCanvasContent | ErrorCanvasContent | null>;
  /** Resolves an attachment's syntax-highlighted code content, given an optional language hint. Returns `null` if unavailable. */
  resolveCodeContent(
    attachment: DisplayAttachment,
    language?: string,
  ): Promise<CodeCanvasContent | ErrorCanvasContent | null>;
  /** Resolves an attachment's HTML content. Returns `null` if unavailable or rejected (e.g. exceeded a size limit). */
  resolveHtmlContent(
    attachment: DisplayAttachment,
  ): Promise<HtmlCanvasContent | ErrorCanvasContent | null>;
  /** Resolves an attachment's PDF content. Returns `null` if unavailable. */
  resolvePdfContent(
    attachment: DisplayAttachment,
  ): Promise<PdfCanvasContent | ErrorCanvasContent | null>;
  /** Resolves an attachment's OOXML (Word/Excel/PowerPoint) content for the given format. Returns `null` if unavailable. */
  resolveOoxmlContent(
    attachment: DisplayAttachment,
    format: OoxmlFileType,
  ): Promise<OoxmlCanvasContent | ErrorCanvasContent | null>;
  /** Resolves an attachment's JSON content, falling back to plain text when the payload is not valid JSON. Returns `null` if unavailable. */
  resolveJsonContent(
    attachment: DisplayAttachment,
  ): Promise<
    JsonCanvasContent | PlainTextCanvasContent | ErrorCanvasContent | null
  >;
  /** Resolves an attachment against a matched custom-visualizer registry entry. Returns `null` when the payload cannot be fetched. */
  resolveVisualizerContent(
    attachment: DisplayAttachment,
    visualizer: CustomVisualizer,
    themeId?: string,
  ): Promise<VisualizerCanvasContent | null>;
  /** Resolves a reference-only attachment's `referenceUrl` (optionally carrying a page anchor) into PDF content. Returns `null` when the reference does not target a PDF. */
  resolveReferencePdfContent(
    attachment: DisplayAttachment,
  ): PdfCanvasContent | null;
  /** Resolves the attachment's downloadable URL, used for `Unsupported` content and as the HTML content's fallback `url`. */
  resolveContentUrl(attachment: DisplayAttachment): string | undefined;
  /**
   * Whether the attachment carries a text source `resolveHtmlContent`/
   * `resolveTextContent` etc. can fetch from (inline data, a host-resolved
   * download URL, or a locally-picked file). Used to distinguish "nothing to
   * fetch" from "fetched and rejected" when an HTML resolver returns `null`.
   */
  hasTextSource(attachment: DisplayAttachment): boolean;
}

/**
 * Options controlling `useOpenAttachmentCanvas`'s dispatch behavior beyond the
 * content resolvers.
 */
export interface UseOpenAttachmentCanvasOptions {
  /** Registry of custom visualizers matched by MIME type ahead of PDF/Markdown/JSON routing. */
  customVisualizers: CustomVisualizer[];
  /** Active theme id forwarded to a matched custom visualizer's layout. */
  themeId?: string;
  /** Called before the canvas opens for an image, file, pasted, or prompt attachment — never for audio. Lets the host close other panels first. */
  onBeforeOpen?: () => void;
}

/** Signature of the `openAttachmentCanvas` function `useOpenAttachmentCanvas` returns. */
export type OpenAttachmentCanvas = (
  attachment: DisplayAttachment,
  canvasAttachmentId?: string,
) => Promise<boolean>;

/**
 * Returns the last path segment of `url` — its file name — for both absolute
 * URLs and DIAL-relative resource paths such as
 * `files/<bucket>/uploads/report.html`. Any query string or hash is dropped
 * and percent escapes are decoded. Returns an empty string when no segment can
 * be extracted. Used to classify a resource by extension when its display name
 * is a citation title rather than a file name.
 */
const getUrlFileName = (url: string): string => {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    /* A relative DIAL resource path has no base to resolve against, so the
     * query and hash are stripped by hand instead. */
    path = stripUrlQueryAndFragment(url);
  }
  const segment = path.split('/').filter(Boolean).pop() ?? '';
  try {
    return decodeURIComponent(segment);
  } catch {
    /* Malformed percent escape — the raw segment still works for extension
     * matching. */
    return segment;
  }
};

/**
 * Decides whether and how to open the attachment canvas for a given
 * attachment, dispatching on its type and content, using only injected
 * resolvers and callbacks — never an application React context.
 */
export const useOpenAttachmentCanvas = (
  resolvers: UseOpenAttachmentCanvasResolvers,
  options: UseOpenAttachmentCanvasOptions,
): { openAttachmentCanvas: OpenAttachmentCanvas } => {
  const { openCanvas, openCanvasLoading, closeCanvas } = useAttachmentCanvas();
  const { customVisualizers, themeId, onBeforeOpen } = options;

  const openFileCanvas = useCallback(
    async (
      attachment: DisplayAttachment,
      canvasAttachmentId: string | undefined,
    ): Promise<boolean> => {
      if (attachment.url == null && attachment.referenceUrl != null) {
        const pdfContent = resolvers.resolveReferencePdfContent(attachment);
        if (pdfContent != null) {
          openCanvas(pdfContent, attachment.name, canvasAttachmentId);
          return true;
        }
      }

      const contentType = attachment.contentType.toLowerCase();

      const visualizerEntry = findVisualizerForMime(
        contentType,
        customVisualizers,
      );
      if (visualizerEntry != null) {
        const content = await resolvers.resolveVisualizerContent(
          attachment,
          visualizerEntry,
          themeId,
        );
        if (content != null) {
          openCanvas(content, attachment.name, canvasAttachmentId);
          return true;
        }
      }

      if (!contentType && attachment.data != null) {
        const content = await resolvers.resolveTextContent(attachment);
        if (content != null) {
          openCanvas(content, attachment.name, canvasAttachmentId);
          return true;
        }
      }

      const mimeOoxmlFileType = getOoxmlFileType('', contentType);
      if (mimeOoxmlFileType != null) {
        const content = await resolvers.resolveOoxmlContent(
          attachment,
          mimeOoxmlFileType,
        );
        openCanvas(
          content ??
            createUnsupportedCanvasContent(
              resolvers.resolveContentUrl(attachment),
            ),
          attachment.name,
          canvasAttachmentId,
        );
        return true;
      }

      switch (contentType) {
        case MIMEType.PDF: {
          const content = await resolvers.resolvePdfContent(attachment);
          openCanvas(
            content ??
              createUnsupportedCanvasContent(
                resolvers.resolveContentUrl(attachment),
              ),
            attachment.name,
            canvasAttachmentId,
          );
          return true;
        }
        case MIMEType.Markdown: {
          const content = await resolvers.resolveMarkdownContent(attachment);
          openCanvas(
            content ??
              createUnsupportedCanvasContent(
                resolvers.resolveContentUrl(attachment),
              ),
            attachment.name,
            canvasAttachmentId,
          );
          return true;
        }
        case MIMEType.JSON: {
          const content = await resolvers.resolveJsonContent(attachment);
          openCanvas(
            content ??
              createUnsupportedCanvasContent(
                resolvers.resolveContentUrl(attachment),
              ),
            attachment.name,
            canvasAttachmentId,
          );
          return true;
        }
      }

      const fileName = attachment.name ?? '';
      const dotIdx = fileName.lastIndexOf('.');
      const ext = dotIdx !== -1 ? fileName.slice(dotIdx + 1).toLowerCase() : '';

      const extensionOoxmlFileType = getOoxmlFileType(fileName);
      if (extensionOoxmlFileType != null) {
        const content = await resolvers.resolveOoxmlContent(
          attachment,
          extensionOoxmlFileType,
        );
        openCanvas(
          content ??
            createUnsupportedCanvasContent(
              resolvers.resolveContentUrl(attachment),
            ),
          attachment.name,
          canvasAttachmentId,
        );
        return true;
      }

      switch (ext) {
        case FileExtension.Markdown:
        case FileExtension.MarkdownAlt: {
          const content = await resolvers.resolveMarkdownContent(attachment);
          if (content == null) return false;
          openCanvas(content, attachment.name, canvasAttachmentId);
          return true;
        }
        case FileExtension.JSON: {
          const content = await resolvers.resolveJsonContent(attachment);
          if (content == null) return false;
          openCanvas(content, attachment.name, canvasAttachmentId);
          return true;
        }
        case FileExtension.PDF: {
          const content = await resolvers.resolvePdfContent(attachment);
          if (content == null) return false;
          openCanvas(content, attachment.name, canvasAttachmentId);
          return true;
        }
      }

      /*
       * A cited source's `name` is its title, which usually carries no file
       * extension, so the URL's own file name has to be consulted as well —
       * otherwise an external `.html` source falls into the Unsupported
       * branch below instead of opening in the iframe.
       */
      const isHtmlSource =
        (attachment.name != null && isHtmlPreviewable(attachment.name)) ||
        (attachment.url != null &&
          isHtmlPreviewable(getUrlFileName(attachment.url)));

      if (
        attachment.name != null &&
        !isTextPreviewable(attachment.name) &&
        !isHtmlSource
      ) {
        openCanvas(
          createUnsupportedCanvasContent(
            resolvers.resolveContentUrl(attachment),
          ),
          attachment.name,
          canvasAttachmentId,
        );
        return true;
      }

      if (isHtmlSource) {
        const content = await resolvers.resolveHtmlContent(attachment);
        if (content != null) {
          openCanvas(content, attachment.name, canvasAttachmentId);
          return true;
        }
        if (!resolvers.hasTextSource(attachment)) {
          /* External HTML URL: nothing to fetch, so the iframe loads it directly. */
          if (attachment.url == null) return false;
          openCanvas(
            { type: AttachmentContentType.Html, url: attachment.url },
            attachment.name,
            canvasAttachmentId,
          );
          return true;
        }
        /*
         * The text was fetched and then rejected — currently only by the
         * srcdoc size gate. That is an unsupported preview, not a page the
         * browser refused to frame, so it must not fall through to the
         * url-only branch above.
         */
        openCanvas(
          createUnsupportedCanvasContent(
            resolvers.resolveContentUrl(attachment),
          ),
          attachment.name,
          canvasAttachmentId,
        );
        return true;
      }

      const content = await resolvers.resolveCodeContent(
        attachment,
        extensionToLanguage(ext),
      );
      if (content == null) return false;
      openCanvas(content, attachment.name, canvasAttachmentId);
      return true;
    },
    [openCanvas, customVisualizers, themeId, resolvers],
  );

  const openAttachmentCanvas = useCallback(
    async (
      attachment: DisplayAttachment,
      /*
       * DisplayAttachment.id is derived from content (url/data/title), so the
       * same id can recur across different messages (e.g. the same file
       * attached twice). Callers that need to track which specific tile
       * opened the canvas (to highlight it as selected) pass a caller-scoped
       * key here instead of relying on the content-derived id.
       */
      canvasAttachmentId: string | undefined = attachment.id,
    ): Promise<boolean> => {
      switch (attachment.type) {
        case AttachmentType.Image: {
          const content = resolvers.resolveImageContent(attachment);
          if (content == null) return false;
          onBeforeOpen?.();
          openCanvas(content, attachment.name, canvasAttachmentId);
          return true;
        }
        case AttachmentType.Audio: {
          const url = attachment.playUrl ?? attachment.url;
          if (url == null) return false;
          openCanvas(
            {
              type: AttachmentContentType.Audio,
              url,
              mimeType: attachment.contentType || undefined,
            },
            attachment.name,
            canvasAttachmentId,
          );
          return true;
        }
        case AttachmentType.File: {
          onBeforeOpen?.();
          openCanvasLoading(attachment.name, canvasAttachmentId);
          const opened = await openFileCanvas(attachment, canvasAttachmentId);
          if (!opened) closeCanvas();
          return opened;
        }
        case AttachmentType.Pasted:
        case AttachmentType.Prompt: {
          onBeforeOpen?.();
          openCanvasLoading(attachment.name, canvasAttachmentId);
          const content = await resolvers.resolveTextContent(attachment);
          if (content == null) {
            closeCanvas();
            return false;
          }
          openCanvas(content, attachment.name, canvasAttachmentId);
          return true;
        }
        default:
          return false;
      }
    },
    [
      openCanvas,
      openCanvasLoading,
      closeCanvas,
      onBeforeOpen,
      openFileCanvas,
      resolvers,
    ],
  );

  return { openAttachmentCanvas };
};
