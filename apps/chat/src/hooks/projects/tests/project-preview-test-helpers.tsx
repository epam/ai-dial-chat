import {
  AttachmentCanvasProvider,
  AttachmentContentType,
  useAttachmentCanvas,
  type UseOpenAttachmentCanvasOptions,
  type UseOpenAttachmentCanvasResolvers,
} from '@epam/ai-dial-attachment-canvas';
import type { FC, ReactNode } from 'react';
import { vi } from 'vitest';

type OoxmlResolverArgs = Parameters<
  UseOpenAttachmentCanvasResolvers['resolveOoxmlContent']
>;

/** Resolver stand-ins: each viewer answers with a minimal valid payload, so a test sees which one was routed to. */
export const previewResolvers = {
  resolveImageContent: vi.fn(
    (): ReturnType<
      UseOpenAttachmentCanvasResolvers['resolveImageContent']
    > => ({
      type: AttachmentContentType.Image,
      url: 'blob:stub',
    }),
  ),
  resolveTextContent: vi.fn(async () => ({
    type: AttachmentContentType.PlainText as const,
    text: 'stub',
  })),
  resolveMarkdownContent: vi.fn(async () => ({
    type: AttachmentContentType.Markdown as const,
    text: 'stub',
  })),
  resolveCodeContent: vi.fn(async () => ({
    type: AttachmentContentType.Code as const,
    text: 'stub',
  })),
  resolveHtmlContent: vi.fn(async () => ({
    type: AttachmentContentType.Html as const,
    srcdoc: 'stub',
  })),
  resolvePdfContent: vi.fn(async () => ({
    type: AttachmentContentType.Pdf as const,
    url: 'blob:stub',
  })),
  resolveOoxmlContent: vi.fn(async (...[, format]: OoxmlResolverArgs) => ({
    type: AttachmentContentType.Ooxml as const,
    url: 'blob:stub',
    format,
  })),
  resolveJsonContent: vi.fn(async () => ({
    type: AttachmentContentType.Json as const,
    value: {},
  })),
  resolveVisualizerContent: vi.fn(async () => null),
  resolveReferencePdfContent: vi.fn(() => null),
  resolveContentUrl: vi.fn(() => undefined),
  hasTextSource: vi.fn(() => true),
} satisfies UseOpenAttachmentCanvasResolvers;

const options: UseOpenAttachmentCanvasOptions = { customVisualizers: [] };

/** The value a spec's `useAttachmentCanvasResolvers` mock returns; one stable object, as the real hook memoises. */
export const previewCanvasResolvers = { resolvers: previewResolvers, options };

/** Prints the key the shared canvas holds, or `closed`, with a button that closes it as the canvas's own Close does, so a page spec can read and drive the canvas from the DOM. */
export const CanvasProbe: FC = () => {
  const { isOpen, isLoading, attachmentId, closeCanvas } =
    useAttachmentCanvas();
  const isShown = isOpen || isLoading;
  return (
    <>
      <output aria-label="canvas">{isShown ? attachmentId : 'closed'}</output>
      <button type="button" onClick={closeCanvas}>
        close canvas
      </button>
    </>
  );
};

/** Mounts the page under the app's single canvas provider, with a probe beside it. */
export const withPreviewCanvas = (page: ReactNode): ReactNode => (
  <AttachmentCanvasProvider>
    <CanvasProbe />
    {page}
  </AttachmentCanvasProvider>
);
