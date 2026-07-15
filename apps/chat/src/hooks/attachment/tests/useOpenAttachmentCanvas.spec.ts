import type { Annotation, DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { AttachmentType } from '@epam/ai-dial-chat-shared';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { annotationsToPdfHighlights } from '../../../utils/annotation';
import { useOpenAttachmentCanvas } from '../useOpenAttachmentCanvas';

const mockOpenCanvas = vi.fn();

vi.mock('@epam/ai-dial-attachment-canvas', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-attachment-canvas')>();
  return {
    ...actual,
    useAttachmentCanvas: () => ({ openCanvas: mockOpenCanvas }),
  };
});

const mockResolveMarkdown = vi.fn();
const mockResolveJson = vi.fn();
const mockResolveText = vi.fn();
const mockResolvePdf = vi.fn();
const mockReferenceToPdf = vi.fn();

vi.mock('../../../utils/attachment-canvas', () => ({
  resolveImageCanvasContent: vi.fn(),
  resolveMarkdownCanvasContent: (...args: unknown[]) =>
    mockResolveMarkdown(...args),
  resolveJsonCanvasContent: (...args: unknown[]) => mockResolveJson(...args),
  resolveTextCanvasContent: (...args: unknown[]) => mockResolveText(...args),
  resolvePdfCanvasContent: (...args: unknown[]) => mockResolvePdf(...args),
  referenceAttachmentToPdfCanvasContent: (...args: unknown[]) =>
    mockReferenceToPdf(...args),
}));

const makeAttachment = (
  name: string,
  contentType = 'text/plain',
): DisplayAttachment =>
  ({
    id: name,
    name,
    contentType,
    type: AttachmentType.File,
    url: `files/bucket/path/${name}`,
  }) as DisplayAttachment;

const makeReferenceAttachment = (
  name: string,
  referenceUrl: string,
  contentType = 'text/markdown',
): DisplayAttachment =>
  ({
    id: name,
    name,
    contentType,
    type: AttachmentType.File,
    referenceUrl,
  }) as DisplayAttachment;

describe('useOpenAttachmentCanvas routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes .md attachments to the markdown resolver', async () => {
    mockResolveMarkdown.mockResolvedValue({
      type: 'markdown',
      text: '# Hello',
    });

    const { result } = renderHook(() => useOpenAttachmentCanvas());
    await result.current.openAttachmentCanvas(makeAttachment('readme.md'));

    expect(mockResolveMarkdown).toHaveBeenCalledOnce();
    expect(mockResolveJson).not.toHaveBeenCalled();
    expect(mockResolveText).not.toHaveBeenCalled();
  });

  it('routes .markdown attachments to the markdown resolver', async () => {
    mockResolveMarkdown.mockResolvedValue({
      type: 'markdown',
      text: '# Hello',
    });

    const { result } = renderHook(() => useOpenAttachmentCanvas());
    await result.current.openAttachmentCanvas(makeAttachment('notes.markdown'));

    expect(mockResolveMarkdown).toHaveBeenCalledOnce();
    expect(mockResolveText).not.toHaveBeenCalled();
  });

  it('routes .json attachments to the JSON resolver', async () => {
    mockResolveJson.mockResolvedValue({ type: 'json', value: {} });

    const { result } = renderHook(() => useOpenAttachmentCanvas());
    await result.current.openAttachmentCanvas(makeAttachment('data.json'));

    expect(mockResolveJson).toHaveBeenCalledOnce();
    expect(mockResolveMarkdown).not.toHaveBeenCalled();
    expect(mockResolveText).not.toHaveBeenCalled();
  });

  it('routes .jsonl attachments to the plain-text resolver (not JSON)', async () => {
    mockResolveText.mockResolvedValue({ type: 'plain_text', text: '{}\n{}' });

    const { result } = renderHook(() => useOpenAttachmentCanvas());
    await result.current.openAttachmentCanvas(makeAttachment('stream.jsonl'));

    expect(mockResolveText).toHaveBeenCalledOnce();
    expect(mockResolveJson).not.toHaveBeenCalled();
  });

  it('opens the canvas with the resolved content', async () => {
    const content = { type: 'markdown' as const, text: '# Doc' };
    mockResolveMarkdown.mockResolvedValue(content);

    const { result } = renderHook(() => useOpenAttachmentCanvas());
    const opened = await result.current.openAttachmentCanvas(
      makeAttachment('doc.md'),
    );

    expect(opened).toBe(true);
    expect(mockOpenCanvas).toHaveBeenCalledWith(content, 'doc.md');
  });

  it('routes text/markdown MIME type to the markdown resolver (ignores .pdf extension in title)', async () => {
    mockResolveMarkdown.mockResolvedValue({
      type: 'markdown',
      text: '# From stage',
    });

    const { result } = renderHook(() => useOpenAttachmentCanvas());
    await result.current.openAttachmentCanvas(
      makeAttachment('[1] report.pdf', 'text/markdown'),
    );

    expect(mockResolveMarkdown).toHaveBeenCalledOnce();
    expect(mockResolveJson).not.toHaveBeenCalled();
    expect(mockResolveText).not.toHaveBeenCalled();
  });

  it('routes application/json MIME type to the JSON resolver', async () => {
    mockResolveJson.mockResolvedValue({ type: 'json', value: {} });

    const { result } = renderHook(() => useOpenAttachmentCanvas());
    await result.current.openAttachmentCanvas(
      makeAttachment('[1] report.pdf', 'application/json'),
    );

    expect(mockResolveJson).toHaveBeenCalledOnce();
    expect(mockResolveMarkdown).not.toHaveBeenCalled();
    expect(mockResolveText).not.toHaveBeenCalled();
  });

  it('returns false when the markdown resolver returns null (extension routing)', async () => {
    mockResolveMarkdown.mockResolvedValue(null);

    const { result } = renderHook(() => useOpenAttachmentCanvas());
    const opened = await result.current.openAttachmentCanvas(
      makeAttachment('empty.md'),
    );

    expect(opened).toBe(false);
    expect(mockOpenCanvas).not.toHaveBeenCalled();
  });

  it('opens unsupported canvas when text/markdown MIME resolver returns null (no data, no url)', async () => {
    mockResolveMarkdown.mockResolvedValue(null);

    const { result } = renderHook(() => useOpenAttachmentCanvas());
    const opened = await result.current.openAttachmentCanvas(
      makeAttachment('[1] report.pdf', 'text/markdown'),
    );

    expect(opened).toBe(true);
    expect(mockOpenCanvas).toHaveBeenCalledOnce();
    expect(mockResolveMarkdown).toHaveBeenCalledOnce();
  });

  it('routes application/pdf MIME type to the PDF resolver', async () => {
    const pdfContent = {
      type: 'pdf' as const,
      url: 'https://example.com/doc.pdf',
    };
    mockResolvePdf.mockReturnValue(pdfContent);

    const { result } = renderHook(() => useOpenAttachmentCanvas());
    const opened = await result.current.openAttachmentCanvas(
      makeAttachment('doc.pdf', 'application/pdf'),
    );

    expect(opened).toBe(true);
    expect(mockResolvePdf).toHaveBeenCalledOnce();
    expect(mockResolveMarkdown).not.toHaveBeenCalled();
    expect(mockResolveJson).not.toHaveBeenCalled();
    expect(mockResolveText).not.toHaveBeenCalled();
    expect(mockOpenCanvas).toHaveBeenCalledWith(pdfContent, 'doc.pdf');
  });

  it('routes .pdf extension to the PDF resolver', async () => {
    const pdfContent = {
      type: 'pdf' as const,
      url: 'https://example.com/report.pdf',
    };
    mockResolvePdf.mockReturnValue(pdfContent);

    const { result } = renderHook(() => useOpenAttachmentCanvas());
    const opened = await result.current.openAttachmentCanvas(
      makeAttachment('report.pdf'),
    );

    expect(opened).toBe(true);
    expect(mockResolvePdf).toHaveBeenCalledOnce();
    expect(mockResolveMarkdown).not.toHaveBeenCalled();
    expect(mockResolveJson).not.toHaveBeenCalled();
    expect(mockResolveText).not.toHaveBeenCalled();
  });

  it('opens unsupported canvas when application/pdf MIME resolver returns null', async () => {
    mockResolvePdf.mockReturnValue(null);

    const { result } = renderHook(() => useOpenAttachmentCanvas());
    const opened = await result.current.openAttachmentCanvas(
      makeAttachment('doc.pdf', 'application/pdf'),
    );

    expect(opened).toBe(true);
    expect(mockResolvePdf).toHaveBeenCalledOnce();
    expect(mockOpenCanvas).toHaveBeenCalledOnce();
  });

  it('returns false when .pdf extension resolver returns null', async () => {
    mockResolvePdf.mockReturnValue(null);

    const { result } = renderHook(() => useOpenAttachmentCanvas());
    const opened = await result.current.openAttachmentCanvas(
      makeAttachment('report.pdf'),
    );

    expect(opened).toBe(false);
    expect(mockOpenCanvas).not.toHaveBeenCalled();
  });

  it('routes a reference-only PDF-page attachment to the canvas ahead of MIME-type routing', async () => {
    const pdfContent = {
      type: 'pdf' as const,
      url: 'https://example.com/report.pdf',
      highlights: [],
      selectedHighlightId: 'reference-page-5',
    };
    mockReferenceToPdf.mockReturnValue(pdfContent);

    const { result } = renderHook(() => useOpenAttachmentCanvas());
    const opened = await result.current.openAttachmentCanvas(
      makeReferenceAttachment('report.pdf', 'files/bucket/report.pdf#page=5'),
    );

    expect(opened).toBe(true);
    expect(mockOpenCanvas).toHaveBeenCalledWith(pdfContent, 'report.pdf');
    expect(mockResolveMarkdown).not.toHaveBeenCalled();
  });

  it('falls through to MIME-type routing when the referenceUrl is not a PDF', async () => {
    mockReferenceToPdf.mockReturnValue(null);
    mockResolveMarkdown.mockResolvedValue({ type: 'markdown', text: 'x' });

    const { result } = renderHook(() => useOpenAttachmentCanvas());
    await result.current.openAttachmentCanvas(
      makeReferenceAttachment('notes.md', 'files/bucket/notes.md'),
    );

    expect(mockResolveMarkdown).toHaveBeenCalledOnce();
  });

  it('routes attachments with no contentType and inline data to the plain-text resolver', async () => {
    mockResolveText.mockResolvedValue({
      type: 'plain_text',
      text: 'A serene sunrise over a tranquil landscape.',
    });

    const attachment = {
      id: 'Revised prompt',
      name: 'Revised prompt',
      contentType: '',
      type: AttachmentType.File,
      data: 'A serene sunrise over a tranquil landscape.',
    } as DisplayAttachment;

    const { result } = renderHook(() => useOpenAttachmentCanvas());
    const opened = await result.current.openAttachmentCanvas(attachment);

    expect(opened).toBe(true);
    expect(mockResolveText).toHaveBeenCalledOnce();
    expect(mockResolveMarkdown).not.toHaveBeenCalled();
    expect(mockResolveJson).not.toHaveBeenCalled();
    expect(mockResolvePdf).not.toHaveBeenCalled();
    expect(mockOpenCanvas).toHaveBeenCalledWith(
      {
        type: 'plain_text',
        text: 'A serene sunrise over a tranquil landscape.',
      },
      'Revised prompt',
    );
  });

  it('falls through to extension/unsupported routing when contentType is empty and no data is present', async () => {
    mockResolvePdf.mockReturnValue(null);

    const attachment = {
      id: 'mystery.pdf',
      name: 'mystery.pdf',
      contentType: '',
      type: AttachmentType.File,
      url: 'files/bucket/path/mystery.pdf',
    } as DisplayAttachment;

    const { result } = renderHook(() => useOpenAttachmentCanvas());
    const opened = await result.current.openAttachmentCanvas(attachment);

    expect(opened).toBe(false);
    expect(mockResolveText).not.toHaveBeenCalled();
    expect(mockResolvePdf).toHaveBeenCalledOnce();
  });
});

describe('annotationsToPdfHighlights', () => {
  it('maps a single annotation with one pdf_bbox selector to a highlight', () => {
    const annotations: Annotation[] = [
      {
        index: 0,
        body: {
          selector: {
            type: 'pdf_bbox',
            page: 1,
            x1: 10,
            y1: 20,
            x2: 100,
            y2: 50,
          },
        },
      },
    ];

    const highlights = annotationsToPdfHighlights(annotations);

    expect(highlights).toHaveLength(1);
    expect(highlights[0].id).toBe('0');
    expect(highlights[0].bboxes).toEqual([
      { page: 1, x1: 10, y1: 20, x2: 100, y2: 50 },
    ]);
  });

  it('maps a single annotation with multiple pdf_bbox selectors to one highlight with multiple bboxes', () => {
    const annotations: Annotation[] = [
      {
        index: 3,
        body: {
          selector: [
            { type: 'pdf_bbox', page: 1, x1: 0, y1: 0, x2: 10, y2: 10 },
            { type: 'pdf_bbox', page: 2, x1: 5, y1: 5, x2: 15, y2: 15 },
          ],
        },
      },
    ];

    const highlights = annotationsToPdfHighlights(annotations);

    expect(highlights).toHaveLength(1);
    expect(highlights[0].id).toBe('3');
    expect(highlights[0].bboxes).toHaveLength(2);
  });

  it('maps multiple annotations to multiple highlights', () => {
    const annotations: Annotation[] = [
      {
        index: 0,
        body: {
          selector: { type: 'pdf_bbox', page: 1, x1: 0, y1: 0, x2: 10, y2: 10 },
        },
      },
      {
        index: 1,
        body: {
          selector: { type: 'pdf_bbox', page: 2, x1: 5, y1: 5, x2: 20, y2: 20 },
        },
      },
    ];

    const highlights = annotationsToPdfHighlights(annotations);

    expect(highlights).toHaveLength(2);
    expect(highlights[0].id).toBe('0');
    expect(highlights[1].id).toBe('1');
  });

  it('uses array position as id when annotation.index is absent', () => {
    const annotations: Annotation[] = [
      {
        body: {
          selector: { type: 'pdf_bbox', page: 1, x1: 0, y1: 0, x2: 10, y2: 10 },
        },
      },
      {
        body: {
          selector: {
            type: 'pdf_bbox',
            page: 1,
            x1: 20,
            y1: 0,
            x2: 30,
            y2: 10,
          },
        },
      },
    ];

    const highlights = annotationsToPdfHighlights(annotations);

    expect(highlights).toHaveLength(2);
    expect(highlights[0].id).toBe('0');
    expect(highlights[1].id).toBe('1');
  });

  it('skips annotations with no pdf_bbox selectors', () => {
    const annotations: Annotation[] = [
      {
        index: 0,
        body: { selector: { type: 'text_character_range', start: 0, end: 5 } },
      },
      {
        index: 1,
        body: {
          selector: { type: 'pdf_bbox', page: 1, x1: 0, y1: 0, x2: 10, y2: 10 },
        },
      },
    ];

    const highlights = annotationsToPdfHighlights(annotations);

    expect(highlights).toHaveLength(1);
    expect(highlights[0].id).toBe('1');
  });

  it('skips annotations with missing selector', () => {
    const annotations: Annotation[] = [
      { index: 0, body: {} },
      {
        index: 1,
        body: {
          selector: { type: 'pdf_bbox', page: 1, x1: 0, y1: 0, x2: 10, y2: 10 },
        },
      },
    ];

    const highlights = annotationsToPdfHighlights(annotations);

    expect(highlights).toHaveLength(1);
  });

  it('returns an empty array when given an empty list', () => {
    expect(annotationsToPdfHighlights([])).toEqual([]);
  });
});
