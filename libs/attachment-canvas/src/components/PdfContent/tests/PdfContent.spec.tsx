import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PdfContent } from '../PdfContent';

vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-shared')>();
  return { ...actual, useIsMobile: () => false };
});

let capturedLoadFileCb: ((url: string) => Promise<Blob>) | undefined;

vi.mock('@epam/ai-dial-react-pdf-highlighter', () => ({
  DocumentPreview: ({
    loadFileCb,
  }: {
    loadFileCb: (url: string) => Promise<Blob>;
  }) => {
    capturedLoadFileCb = loadFileCb;
    return null;
  },
  PageThumbnail: () => null,
}));

describe('PdfContent', () => {
  beforeEach(() => {
    capturedLoadFileCb = undefined;
    vi.unstubAllGlobals();
  });

  it('resolves the file from the provided blob without fetching', async () => {
    const blob = new Blob(['%PDF-1.4']);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    render(<PdfContent url="blob:mock-pdf-url" blob={blob} highlights={[]} />);

    const result = await capturedLoadFileCb?.('blob:mock-pdf-url');
    expect(result).toBe(blob);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetches the url when no blob is provided', async () => {
    const remoteBlob = new Blob(['%PDF-1.4']);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(remoteBlob),
      }),
    );

    render(<PdfContent url="https://example.com/doc.pdf" highlights={[]} />);

    const result = await capturedLoadFileCb?.('https://example.com/doc.pdf');
    expect(result).toBe(remoteBlob);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://example.com/doc.pdf',
    );
  });

  it('prefers a custom loadPdf over fetching when no blob is provided', async () => {
    const customBlob = new Blob(['%PDF-1.4']);
    const loadPdf = vi.fn().mockResolvedValue(customBlob);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    render(
      <PdfContent
        url="https://example.com/doc.pdf"
        loadPdf={loadPdf}
        highlights={[]}
      />,
    );

    const result = await capturedLoadFileCb?.('https://example.com/doc.pdf');
    expect(result).toBe(customBlob);
    expect(loadPdf).toHaveBeenCalledWith('https://example.com/doc.pdf');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
