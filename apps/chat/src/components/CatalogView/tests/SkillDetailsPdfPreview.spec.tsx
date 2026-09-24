import { AttachmentCanvasProvider } from '@epam/ai-dial-attachment-canvas';
import {
  SKILL_MANIFEST_MAX_BYTES,
  type SkillFileContent,
} from '@epam/ai-dial-chat-hooks';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configurePdfWorker } from '../../../utils/pdf';
import { SkillDetailsFilePreview } from '../SkillDetailsFilePreview';
import { createOversizedPdfBytes } from './pdf-fixture';

/*
 * This suite deliberately does NOT mock `../../SkillFilePreview/SkillFilePreview`
 * (as the sibling `SkillDetailsFilePreview.spec.tsx` does), so the real
 * component — and through it the real `AttachmentCanvasBody`/`PdfContent` —
 * is exercised. Only `DocumentPreview` is stubbed: it needs a real pdf.js
 * worker and a canvas, neither of which jsdom provides. Nothing here proves
 * that pdf.js rasterises the document; that stays a browser-verification step.
 */

const { documentPreview, workerDeferred } = vi.hoisted(() => {
  let resolveWorker!: () => void;
  const promise = new Promise<void>((resolve) => {
    resolveWorker = resolve;
  });
  return {
    documentPreview: vi.fn((props: { fileUrl?: string }) => props),
    workerDeferred: { promise, resolve: () => resolveWorker() },
  };
});

vi.mock('@epam/ai-dial-react-pdf-highlighter', () => ({
  DocumentPreview: (props: { fileUrl?: string }) => {
    documentPreview(props);
    return <div data-testid="document-preview" />;
  },
  PageThumbnail: () => null,
}));

/*
 * The app's own initializer, gated on a deferred so the "not mounted until
 * the promise resolves" ordering is observable. `SkillFilePreview` imports
 * `configurePdfWorker` from this module, so what reaches `PdfContent` is
 * this export — the identity assertion itself lives in
 * `components/SkillFilePreview/tests/SkillFilePreview.spec.tsx`.
 */
vi.mock('../../../utils/pdf', () => ({
  configurePdfWorker: vi.fn(() => workerDeferred.promise),
}));

vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ currentTheme: 'light' }),
}));

vi.mock('../../../context/AppConfigContext', () => ({
  useAppConfig: () => ({ config: { allowedConnectOrigins: [] } }),
}));

vi.mock('../../../context/ConversationPanelContext', () => ({
  useConversationPanel: () => ({ closePanel: vi.fn() }),
}));

vi.mock('../../../context/SourcesSidebarContext', () => ({
  useSourcesSidebar: () => ({ handleClose: vi.fn() }),
}));

/* A stable array — a fresh one per render would re-create the resolver
 * options and re-fire the open effect on every render. */
const NO_VISUALIZERS: never[] = [];

vi.mock('../../../hooks/attachment/useCustomVisualizers', () => ({
  useCustomVisualizers: () => NO_VISUALIZERS,
}));

const PDF_BYTES = createOversizedPdfBytes();

const renderPreview = (
  fileName: string,
  content: SkillFileContent,
): { onLoadFile: ReturnType<typeof vi.fn> } => {
  const onLoadFile = vi.fn().mockResolvedValue(content);
  render(
    <AttachmentCanvasProvider>
      <SkillDetailsFilePreview
        fileId={`skill/files/${fileName}`}
        fileName={fileName}
        onLoadFile={onLoadFile}
      />
    </AttachmentCanvasProvider>,
  );
  return { onLoadFile };
};

describe('SkillDetailsFilePreview — real renderer', () => {
  beforeEach(() => {
    vi.mocked(configurePdfWorker).mockClear();
    documentPreview.mockClear();
    URL.createObjectURL = vi.fn(() => 'blob:skill-pdf');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.mocked(configurePdfWorker).mockImplementation(
      () => workerDeferred.promise,
    );
  });

  it('resolves an over-cap PDF to PDF canvas content, not the load error', async () => {
    renderPreview('guide.pdf', { bytes: PDF_BYTES });

    /* The viewer is gated on the initializer, so it must not be mounted yet. */
    await waitFor(() => expect(configurePdfWorker).toHaveBeenCalled());
    await waitFor(() => expect(configurePdfWorker).toHaveBeenCalled());
    expect(screen.queryByTestId('document-preview')).toBeNull();

    await act(async () => {
      workerDeferred.resolve();
    });

    const preview = await screen.findByTestId('document-preview');
    expect(preview).toBeTruthy();
    expect(documentPreview).toHaveBeenCalledWith(
      expect.objectContaining({ fileUrl: 'blob:skill-pdf' }),
    );
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(screen.queryByText(/load_failed|Failed to load file/)).toBeNull();
  });

  it('builds PDF content from a fixture larger than the old preview cap', async () => {
    expect(PDF_BYTES.byteLength).toBeGreaterThan(SKILL_MANIFEST_MAX_BYTES);

    renderPreview('guide.pdf', { bytes: PDF_BYTES });

    await act(async () => {
      workerDeferred.resolve();
    });
    await screen.findByTestId('document-preview');

    const file = vi.mocked(URL.createObjectURL).mock.calls[0][0] as File;
    expect(file.size).toBe(PDF_BYTES.byteLength);
    expect(file.type).toBe('application/pdf');
  });

  it('never invokes the PDF worker initializer for a non-PDF file', async () => {
    renderPreview('notes.md', {
      bytes: new TextEncoder().encode('# Notes'),
      mimeType: 'text/markdown',
    });

    await screen.findByText('Notes');
    expect(configurePdfWorker).not.toHaveBeenCalled();
    expect(screen.queryByTestId('document-preview')).toBeNull();
  });
});
