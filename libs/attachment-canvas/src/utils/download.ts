import {
  MIMEType,
  ensureDownloadFilename,
  triggerAnchorDownload,
  triggerBlobDownload,
} from '@epam/ai-dial-chat-shared';
import type { AttachmentCanvasContent } from '../models/attachment-canvas';
import {
  AttachmentContentType,
  AttachmentErrorType,
  OoxmlFileType,
} from '../types/attachment-canvas';

/* `content.url` for `Ooxml` is a blob URL created while resolving the preview
 * (see `resolveOoxmlCanvasContent`), so it never carries the original file's
 * extension. Fall back to the MIME type implied by `content.format`. */
const RENDERER_MIME_TYPES: Record<OoxmlFileType, string> = {
  [OoxmlFileType.Docx]: MIMEType.DOCX,
  [OoxmlFileType.Xlsx]: MIMEType.XLSX,
  [OoxmlFileType.Pptx]: MIMEType.PPTX,
  [OoxmlFileType.Csv]: MIMEType.CSV,
};

type ContentOf<T extends AttachmentContentType> = Extract<
  AttachmentCanvasContent,
  { type: T }
>;

/** URL and MIME type hint used to derive a file extension when the display name lacks one. */
interface ContentUrlAndMimeType {
  url: string | undefined;
  mimeType: string | undefined;
}

/** How one content type is downloaded. */
interface DownloadStrategy<C> {
  isDownloadable: (content: C) => boolean;
  urlAndMimeType: (content: C) => ContentUrlAndMimeType;
  download: (content: C, name: string) => void;
}

const always = () => true;
const never = () => false;

/* Text kinds are downloaded from memory; an empty body downloads nothing. */
const textStrategy = (
  mimeType: MIMEType,
): DownloadStrategy<{ text: string }> => ({
  isDownloadable: always,
  urlAndMimeType: () => ({ url: undefined, mimeType }),
  download: (content, name) => {
    if (content.text === '') return;
    triggerBlobDownload(new Blob([content.text], { type: mimeType }), name);
  },
});

/* URL kinds are downloaded through an anchor; without a URL there is nothing to download. */
const urlStrategy = <C extends { url?: string }>(
  isDownloadable: (content: C) => boolean,
  mimeType?: (content: C) => string | undefined,
): DownloadStrategy<C> => ({
  isDownloadable,
  urlAndMimeType: (content) => ({
    url: content.url,
    mimeType: mimeType?.(content),
  }),
  download: (content, name) => {
    if (content.url != null && isDownloadable(content)) {
      triggerAnchorDownload(content.url, name);
    }
  },
});

const NOT_DOWNLOADABLE: DownloadStrategy<unknown> = {
  isDownloadable: never,
  urlAndMimeType: () => ({ url: undefined, mimeType: undefined }),
  download: () => undefined,
};

/*
 * One entry per content type, so a new `AttachmentContentType` does not
 * compile until its download behaviour is decided here.
 */
const DOWNLOAD_STRATEGIES: {
  [T in AttachmentContentType]: DownloadStrategy<ContentOf<T>>;
} = {
  [AttachmentContentType.PlainText]: textStrategy(MIMEType.Plain),
  [AttachmentContentType.Markdown]: textStrategy(MIMEType.Markdown),
  [AttachmentContentType.Code]: textStrategy(MIMEType.Plain),
  [AttachmentContentType.Json]: {
    isDownloadable: always,
    urlAndMimeType: () => ({ url: undefined, mimeType: MIMEType.JSON }),
    download: (content, name) =>
      triggerBlobDownload(
        new Blob([JSON.stringify(content.value, null, 2)], {
          type: MIMEType.JSON,
        }),
        name,
      ),
  },
  [AttachmentContentType.Image]: urlStrategy(always),
  [AttachmentContentType.Audio]: urlStrategy(always, (c) => c.mimeType),
  [AttachmentContentType.Pdf]: urlStrategy(always, () => MIMEType.PDF),
  [AttachmentContentType.Ooxml]: urlStrategy(
    always,
    (c) => RENDERER_MIME_TYPES[c.format],
  ),
  [AttachmentContentType.Html]: urlStrategy(
    (c) => c.url != null,
    () => MIMEType.HTML,
  ),
  [AttachmentContentType.Unsupported]: urlStrategy((c) => c.url != null),
  [AttachmentContentType.Error]: urlStrategy(
    (c) => c.errorType !== AttachmentErrorType.Forbidden && c.url != null,
  ),
  /*
   * A standalone table's download action lives in its own inline header
   * (CSV, via its localized table labels), not the generic download button.
   */
  [AttachmentContentType.MarkdownTable]: {
    ...NOT_DOWNLOADABLE,
    urlAndMimeType: () => ({ url: undefined, mimeType: MIMEType.Markdown }),
  },
  [AttachmentContentType.Visualizer]: NOT_DOWNLOADABLE,
  [AttachmentContentType.GroupedVisualizer]: NOT_DOWNLOADABLE,
  [AttachmentContentType.McpApp]: NOT_DOWNLOADABLE,
};

/* TypeScript cannot correlate a union key with its own mapped entry, so the
 * lookup is widened once here; each entry is typed against its own content. */
const strategyFor = (
  content: AttachmentCanvasContent,
): DownloadStrategy<AttachmentCanvasContent> =>
  DOWNLOAD_STRATEGIES[
    content.type
  ] as DownloadStrategy<AttachmentCanvasContent>;

/** Returns true if the given canvas content can be downloaded. */
export const isDownloadable = (content: AttachmentCanvasContent): boolean =>
  strategyFor(content).isDownloadable(content);

/** Fetches a URL and returns its response body as a `Blob`. */
export const fetchBlobFromUrl = async (url: string): Promise<Blob> => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.blob();
};

/** Triggers a browser download for the given canvas content. */
export const downloadAttachmentContent = (
  content: AttachmentCanvasContent,
  fileName?: string,
): void => {
  const strategy = strategyFor(content);
  const { url, mimeType } = strategy.urlAndMimeType(content);
  const name = ensureDownloadFilename(fileName ?? 'attachment', url, mimeType);
  strategy.download(content, name);
};
