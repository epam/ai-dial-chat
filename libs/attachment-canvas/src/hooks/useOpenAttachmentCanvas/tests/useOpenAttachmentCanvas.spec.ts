import type {
  Annotation,
  CustomVisualizer,
  DisplayAttachment,
} from '@epam/ai-dial-chat-shared';
import { AttachmentType } from '@epam/ai-dial-chat-shared';
import { annotationsToPdfHighlights } from '@epam/ai-dial-quotations';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findVisualizerForMime } from '../../../utils/visualizer';
import type { UseOpenAttachmentCanvasResolvers } from '../useOpenAttachmentCanvas';
import { useOpenAttachmentCanvas } from '../useOpenAttachmentCanvas';

const mockOpenCanvas = vi.fn();
const mockOpenCanvasLoading = vi.fn();
const mockCloseCanvas = vi.fn();

vi.mock('../../../context/AttachmentCanvasContext', () => ({
  useAttachmentCanvas: () => ({
    openCanvas: mockOpenCanvas,
    openCanvasLoading: mockOpenCanvasLoading,
    closeCanvas: mockCloseCanvas,
  }),
}));

const mockResolveMarkdown = vi.fn();
const mockResolveJson = vi.fn();
const mockResolveText = vi.fn();
const mockResolveCode = vi.fn();
const mockResolvePdf = vi.fn();
const mockResolveOoxml = vi.fn();
const mockReferenceToPdf = vi.fn();
const mockResolveVisualizer = vi.fn();
const mockResolveHtml = vi.fn();
const mockResolveImage = vi.fn();
const mockResolveContentUrl = vi.fn();
const mockHasTextSource = vi.fn();

const makeResolvers = (): UseOpenAttachmentCanvasResolvers => ({
  resolveImageContent: mockResolveImage,
  resolveTextContent: mockResolveText,
  resolveMarkdownContent: mockResolveMarkdown,
  resolveCodeContent: mockResolveCode,
  resolveHtmlContent: mockResolveHtml,
  resolvePdfContent: mockResolvePdf,
  resolveOoxmlContent: mockResolveOoxml,
  resolveJsonContent: mockResolveJson,
  resolveVisualizerContent: mockResolveVisualizer,
  resolveReferencePdfContent: mockReferenceToPdf,
  resolveContentUrl: mockResolveContentUrl,
  hasTextSource: mockHasTextSource,
});

const renderOpenAttachmentCanvas = (
  customVisualizers: CustomVisualizer[] = [],
) =>
  renderHook(() =>
    useOpenAttachmentCanvas(makeResolvers(), { customVisualizers }),
  );

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

  it.each([
    [
      'report.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'docx',
    ],
    [
      'budget.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'xlsx',
    ],
    [
      'slides.pptx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'pptx',
    ],
  ])('routes %s to the OOXML resolver', async (name, mimeType, format) => {
    const content = { type: 'ooxml', url: `blob:${name}`, format };
    mockResolveOoxml.mockResolvedValue(content);

    const { result } = renderOpenAttachmentCanvas();
    const opened = await result.current.openAttachmentCanvas(
      makeAttachment(name, mimeType),
    );

    expect(opened).toBe(true);
    expect(mockResolveOoxml).toHaveBeenCalledWith(
      expect.objectContaining({ name, contentType: mimeType }),
      format,
    );
    expect(mockOpenCanvas).toHaveBeenCalledWith(content, name, name);
  });

  it('routes an OOXML attachment by extension when its MIME type is generic', async () => {
    mockResolveOoxml.mockResolvedValue({
      type: 'ooxml',
      url: 'blob:deck',
      format: 'pptx',
    });

    const { result } = renderOpenAttachmentCanvas();
    await result.current.openAttachmentCanvas(
      makeAttachment('slides.PPTX', 'application/octet-stream'),
    );

    expect(mockResolveOoxml).toHaveBeenCalledWith(expect.anything(), 'pptx');
  });

  it('routes an OOXML attachment whose name has no extension by MIME type', async () => {
    const content = { type: 'ooxml', url: 'blob:titled', format: 'xlsx' };
    mockResolveOoxml.mockResolvedValue(content);

    const { result } = renderOpenAttachmentCanvas();
    const opened = await result.current.openAttachmentCanvas(
      makeAttachment(
        'Quarterly Report',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ),
    );

    expect(opened).toBe(true);
    expect(mockResolveOoxml).toHaveBeenCalledWith(expect.anything(), 'xlsx');
    expect(mockOpenCanvas).toHaveBeenCalledWith(
      content,
      'Quarterly Report',
      'Quarterly Report',
    );
  });

  it('opens the unsupported panel when a recognized OOXML file cannot be resolved', async () => {
    mockResolveOoxml.mockResolvedValue(null);

    const { result } = renderOpenAttachmentCanvas();
    const opened = await result.current.openAttachmentCanvas(
      makeAttachment('report.docx', 'application/octet-stream'),
    );

    /* Still `true`: the format was recognized, so the canvas owns the
     * outcome — the caller must not fall back to a bare browser download. */
    expect(opened).toBe(true);
    expect(mockOpenCanvas).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'unsupported' }),
      'report.docx',
      'report.docx',
    );
  });

  it('forwards a Forbidden error from the OOXML resolver to the canvas', async () => {
    const forbidden = {
      type: 'error',
      errorType: 'forbidden',
      url: '/download?path=path/budget.xlsx',
    };
    mockResolveOoxml.mockResolvedValue(forbidden);

    const { result } = renderOpenAttachmentCanvas();
    await result.current.openAttachmentCanvas(
      makeAttachment('budget.xlsx', 'application/octet-stream'),
    );

    expect(mockOpenCanvas).toHaveBeenCalledWith(
      forbidden,
      'budget.xlsx',
      'budget.xlsx',
    );
  });

  it('does not route legacy binary Office formats to the OOXML resolver', async () => {
    const { result } = renderOpenAttachmentCanvas();
    await result.current.openAttachmentCanvas(
      makeAttachment('old.doc', 'application/octet-stream'),
    );

    expect(mockResolveOoxml).not.toHaveBeenCalled();
  });

  it('routes .md attachments to the markdown resolver', async () => {
    mockResolveMarkdown.mockResolvedValue({
      type: 'markdown',
      text: '# Hello',
    });

    const { result } = renderOpenAttachmentCanvas();
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

    const { result } = renderOpenAttachmentCanvas();
    await result.current.openAttachmentCanvas(makeAttachment('notes.markdown'));

    expect(mockResolveMarkdown).toHaveBeenCalledOnce();
    expect(mockResolveText).not.toHaveBeenCalled();
  });

  it('routes .json attachments to the JSON resolver', async () => {
    mockResolveJson.mockResolvedValue({ type: 'json', value: {} });

    const { result } = renderOpenAttachmentCanvas();
    await result.current.openAttachmentCanvas(makeAttachment('data.json'));

    expect(mockResolveJson).toHaveBeenCalledOnce();
    expect(mockResolveMarkdown).not.toHaveBeenCalled();
    expect(mockResolveText).not.toHaveBeenCalled();
  });

  it('routes .jsonl attachments to the code resolver (not JSON)', async () => {
    mockResolveCode.mockResolvedValue({
      type: 'code',
      text: '{}\n{}',
      language: 'json',
    });

    const { result } = renderOpenAttachmentCanvas();
    await result.current.openAttachmentCanvas(makeAttachment('stream.jsonl'));

    expect(mockResolveCode).toHaveBeenCalledOnce();
    expect(mockResolveJson).not.toHaveBeenCalled();
    expect(mockResolveText).not.toHaveBeenCalled();
  });

  it('opens the canvas with the resolved content', async () => {
    const content = { type: 'markdown' as const, text: '# Doc' };
    mockResolveMarkdown.mockResolvedValue(content);

    const { result } = renderOpenAttachmentCanvas();
    const opened = await result.current.openAttachmentCanvas(
      makeAttachment('doc.md'),
    );

    expect(opened).toBe(true);
    expect(mockOpenCanvas).toHaveBeenCalledWith(content, 'doc.md', 'doc.md');
  });

  it('routes text/markdown MIME type to the markdown resolver (ignores .pdf extension in title)', async () => {
    mockResolveMarkdown.mockResolvedValue({
      type: 'markdown',
      text: '# From stage',
    });

    const { result } = renderOpenAttachmentCanvas();
    await result.current.openAttachmentCanvas(
      makeAttachment('[1] report.pdf', 'text/markdown'),
    );

    expect(mockResolveMarkdown).toHaveBeenCalledOnce();
    expect(mockResolveJson).not.toHaveBeenCalled();
    expect(mockResolveText).not.toHaveBeenCalled();
  });

  it('prefers a known text MIME type over an OOXML-looking title', async () => {
    mockResolveMarkdown.mockResolvedValue({
      type: 'markdown',
      text: '# Extracted document',
    });

    const { result } = renderOpenAttachmentCanvas();
    await result.current.openAttachmentCanvas(
      makeAttachment('[1] report.docx', 'text/markdown'),
    );

    expect(mockResolveMarkdown).toHaveBeenCalledOnce();
    expect(mockResolveOoxml).not.toHaveBeenCalled();
  });

  it('routes application/json MIME type to the JSON resolver', async () => {
    mockResolveJson.mockResolvedValue({ type: 'json', value: {} });

    const { result } = renderOpenAttachmentCanvas();
    await result.current.openAttachmentCanvas(
      makeAttachment('[1] report.pdf', 'application/json'),
    );

    expect(mockResolveJson).toHaveBeenCalledOnce();
    expect(mockResolveMarkdown).not.toHaveBeenCalled();
    expect(mockResolveText).not.toHaveBeenCalled();
  });

  it('returns false when the markdown resolver returns null (extension routing)', async () => {
    mockResolveMarkdown.mockResolvedValue(null);

    const { result } = renderOpenAttachmentCanvas();
    const opened = await result.current.openAttachmentCanvas(
      makeAttachment('empty.md'),
    );

    expect(opened).toBe(false);
    expect(mockOpenCanvas).not.toHaveBeenCalled();
  });

  it('opens unsupported canvas when text/markdown MIME resolver returns null (no data, no url)', async () => {
    mockResolveMarkdown.mockResolvedValue(null);

    const { result } = renderOpenAttachmentCanvas();
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

    const { result } = renderOpenAttachmentCanvas();
    const opened = await result.current.openAttachmentCanvas(
      makeAttachment('doc.pdf', 'application/pdf'),
    );

    expect(opened).toBe(true);
    expect(mockResolvePdf).toHaveBeenCalledOnce();
    expect(mockResolveMarkdown).not.toHaveBeenCalled();
    expect(mockResolveJson).not.toHaveBeenCalled();
    expect(mockResolveText).not.toHaveBeenCalled();
    expect(mockOpenCanvas).toHaveBeenCalledWith(
      pdfContent,
      'doc.pdf',
      'doc.pdf',
    );
  });

  it('routes .pdf extension to the PDF resolver', async () => {
    const pdfContent = {
      type: 'pdf' as const,
      url: 'https://example.com/report.pdf',
    };
    mockResolvePdf.mockReturnValue(pdfContent);

    const { result } = renderOpenAttachmentCanvas();
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

    const { result } = renderOpenAttachmentCanvas();
    const opened = await result.current.openAttachmentCanvas(
      makeAttachment('doc.pdf', 'application/pdf'),
    );

    expect(opened).toBe(true);
    expect(mockResolvePdf).toHaveBeenCalledOnce();
    expect(mockOpenCanvas).toHaveBeenCalledOnce();
  });

  it('returns false when .pdf extension resolver returns null', async () => {
    mockResolvePdf.mockReturnValue(null);

    const { result } = renderOpenAttachmentCanvas();
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

    const { result } = renderOpenAttachmentCanvas();
    const opened = await result.current.openAttachmentCanvas(
      makeReferenceAttachment('report.pdf', 'files/bucket/report.pdf#page=5'),
    );

    expect(opened).toBe(true);
    expect(mockOpenCanvas).toHaveBeenCalledWith(
      pdfContent,
      'report.pdf',
      'report.pdf',
    );
    expect(mockResolveMarkdown).not.toHaveBeenCalled();
  });

  it('falls through to MIME-type routing when the referenceUrl is not a PDF', async () => {
    mockReferenceToPdf.mockReturnValue(null);
    mockResolveMarkdown.mockResolvedValue({ type: 'markdown', text: 'x' });

    const { result } = renderOpenAttachmentCanvas();
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

    const { result } = renderOpenAttachmentCanvas();
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
      'Revised prompt',
    );
  });

  describe('html routing', () => {
    it('routes a cited source whose title has no extension by its .html URL', async () => {
      /*
       * A cited source's name is its title, so the html check must fall back
       * to the URL's file name — otherwise the canvas opens Unsupported.
       */
      mockResolveHtml.mockResolvedValue(null);

      const attachment = {
        id: 'routed source',
        name: 'routed source',
        contentType: 'text/html',
        type: AttachmentType.File,
        url: 'https://example.com/docs/page.html',
      } as DisplayAttachment;

      const { result } = renderOpenAttachmentCanvas();
      const opened = await result.current.openAttachmentCanvas(attachment);

      expect(opened).toBe(true);
      expect(mockOpenCanvas).toHaveBeenCalledWith(
        { type: 'html', url: 'https://example.com/docs/page.html' },
        'routed source',
        'routed source',
      );
    });

    it('routes a cited source whose title has no extension by its DIAL-relative .html url', async () => {
      /*
       * A DIAL resource path is relative, so `new URL(url)` throws for it —
       * the file name still has to be recovered from the last path segment.
       */
      const htmlContent = { type: 'html', srcdoc: '<p>roadmap</p>' };
      mockResolveHtml.mockResolvedValue(htmlContent);

      const attachment = {
        id: 'PG AI Factory scope roadmap',
        name: 'PG AI Factory scope roadmap',
        contentType: 'text/html',
        type: AttachmentType.File,
        url: 'files/7bKTZyWQAe8Aht4USAmWYAHdXd9qgc3aFhBJ5V9tg27DrzkZDvwwaXoQnRLkchfngQ/uploads/2026-08/pg_ai_factory_scope_roadmap.html',
      } as DisplayAttachment;

      const { result } = renderOpenAttachmentCanvas();
      const opened = await result.current.openAttachmentCanvas(attachment);

      expect(opened).toBe(true);
      expect(mockOpenCanvas).toHaveBeenCalledWith(
        htmlContent,
        'PG AI Factory scope roadmap',
        undefined,
      );
    });

    it('opens unsupported canvas when the html resolver rejects fetched text', async () => {
      /*
       * The resolver returns null for text that exceeded the srcdoc size
       * gate, and `hasTextSource` confirms there was something to fetch.
       * Re-opening it as a url-only iframe would claim the page was
       * frame-blocked, which is not what happened.
       */
      mockResolveHtml.mockResolvedValue(null);
      mockHasTextSource.mockReturnValue(true);

      const { result } = renderOpenAttachmentCanvas();
      const opened = await result.current.openAttachmentCanvas(
        makeAttachment('huge.html', 'text/html'),
      );

      expect(opened).toBe(true);
      expect(mockOpenCanvas).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'unsupported' }),
        'huge.html',
        'huge.html',
      );
    });

    it('opens the raw url as an iframe when the html resolver has no text source to fetch', async () => {
      /*
       * `hasTextSource` reports false for an external HTML source the host
       * never fetched (no inline data, no resolvable download URL, no local
       * file) — the canvas falls back to loading `attachment.url` directly.
       */
      mockResolveHtml.mockResolvedValue(null);
      mockHasTextSource.mockReturnValue(false);

      const { result } = renderOpenAttachmentCanvas();
      const opened = await result.current.openAttachmentCanvas(
        makeAttachment('page.html', 'text/html'),
      );

      expect(opened).toBe(true);
      expect(mockOpenCanvas).toHaveBeenCalledWith(
        { type: 'html', url: 'files/bucket/path/page.html' },
        'page.html',
        'page.html',
      );
    });

    it('opens the resolved srcdoc content for an html file attachment', async () => {
      mockResolveHtml.mockResolvedValue({
        type: 'html',
        srcdoc: '<p>Hello</p>',
      });

      const { result } = renderOpenAttachmentCanvas();
      await result.current.openAttachmentCanvas(
        makeAttachment('page.html', 'text/html'),
      );

      expect(mockOpenCanvas).toHaveBeenCalledWith(
        { type: 'html', srcdoc: '<p>Hello</p>' },
        'page.html',
        'page.html',
      );
    });
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

    const { result } = renderOpenAttachmentCanvas();
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

describe('useOpenAttachmentCanvas — visualizer routing', () => {
  const visualizerEntry = {
    title: 'my-viz',
    description: 'test viz',
    icon: 'icon.svg',
    contentType: 'application/x-my-viz',
    url: 'https://viz.example.com',
    requestTimeout: 5000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens the canvas with visualizer content when MIME matches a registry entry', async () => {
    const vizContent = {
      type: 'visualizer',
      url: 'https://viz.example.com',
      visualizerName: 'my-viz',
      mimeType: 'application/x-my-viz',
      data: {},
      layout: { themeId: 'light' },
    };
    mockResolveVisualizer.mockResolvedValue(vizContent);

    const { result } = renderOpenAttachmentCanvas([visualizerEntry]);
    const opened = await result.current.openAttachmentCanvas(
      makeAttachment('chart.x-my-viz', 'application/x-my-viz'),
    );

    expect(opened).toBe(true);
    expect(mockOpenCanvas).toHaveBeenCalledWith(
      vizContent,
      'chart.x-my-viz',
      'chart.x-my-viz',
    );
    expect(mockResolveMarkdown).not.toHaveBeenCalled();
  });

  it('carries visualizerName equal to the entry title', async () => {
    const vizContent = {
      type: 'visualizer',
      visualizerName: 'my-viz',
      mimeType: 'application/x-my-viz',
      url: '',
      data: {},
      layout: { themeId: 'light' },
    };
    mockResolveVisualizer.mockResolvedValue(vizContent);

    const { result } = renderOpenAttachmentCanvas([visualizerEntry]);
    await result.current.openAttachmentCanvas(
      makeAttachment('f.viz', 'application/x-my-viz'),
    );

    expect(mockOpenCanvas).toHaveBeenCalledWith(
      expect.objectContaining({ visualizerName: 'my-viz' }),
      'f.viz',
      'f.viz',
    );
  });

  it('carries mimeType equal to the attachment MIME, not the raw entry contentType', async () => {
    const commaEntry = {
      ...visualizerEntry,
      contentType: 'application/x-foo, application/x-my-viz',
    };
    const vizContent = {
      type: 'visualizer',
      visualizerName: 'my-viz',
      mimeType: 'application/x-my-viz',
      url: '',
      data: {},
      layout: { themeId: 'light' },
    };
    mockResolveVisualizer.mockResolvedValue(vizContent);

    const { result } = renderOpenAttachmentCanvas([commaEntry]);
    await result.current.openAttachmentCanvas(
      makeAttachment('f.viz', 'application/x-my-viz'),
    );

    expect(mockOpenCanvas).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: 'application/x-my-viz' }),
      'f.viz',
      'f.viz',
    );
  });

  it('falls through to existing PDF/Markdown/JSON handling when visualizer payload fetch fails', async () => {
    mockResolveVisualizer.mockResolvedValue(null);
    mockResolvePdf.mockResolvedValue({ type: 'pdf', url: 'u' });

    const { result } = renderOpenAttachmentCanvas([visualizerEntry]);
    const opened = await result.current.openAttachmentCanvas(
      makeAttachment('doc.pdf', 'application/pdf'),
    );

    expect(opened).toBe(true);
    expect(mockResolvePdf).toHaveBeenCalled();
  });

  it('falls through to Unsupported canvas when visualizer payload fetch returns an error (e.g. 403)', async () => {
    /* resolveVisualizerContent maps ErrorCanvasContent (403/load
     * failure) to null — same fallthrough as a missing payload. For a
     * custom MIME that is not PDF/Markdown/JSON and not text-previewable,
     * the hook must open Unsupported rather than leave the canvas empty. */
    mockResolveVisualizer.mockResolvedValue(null);

    const { result } = renderOpenAttachmentCanvas([visualizerEntry]);
    const opened = await result.current.openAttachmentCanvas(
      makeAttachment('chart.viz', 'application/x-my-viz'),
    );

    expect(opened).toBe(true);
    expect(mockOpenCanvas).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'unsupported' }),
      'chart.viz',
      'chart.viz',
    );
  });

  it('does not call resolveVisualizerContent when registry is empty', async () => {
    mockResolveMarkdown.mockResolvedValue({ type: 'markdown', text: '# H' });

    const { result } = renderOpenAttachmentCanvas([]);
    await result.current.openAttachmentCanvas(makeAttachment('readme.md'));

    expect(mockResolveVisualizer).not.toHaveBeenCalled();
  });

  describe('with the real findVisualizerForMime', () => {
    it('matches case-insensitively end-to-end', async () => {
      mockResolveVisualizer.mockResolvedValue({
        type: 'visualizer',
        visualizerName: 'my-viz',
        mimeType: 'APPLICATION/X-MY-VIZ',
        url: '',
        data: {},
        layout: { themeId: 'light' },
      });

      const { result } = renderOpenAttachmentCanvas([visualizerEntry]);
      const opened = await result.current.openAttachmentCanvas(
        makeAttachment('chart.viz', 'APPLICATION/X-MY-VIZ'),
      );

      expect(opened).toBe(true);
      expect(mockResolveVisualizer).toHaveBeenCalledWith(
        expect.objectContaining({ contentType: 'APPLICATION/X-MY-VIZ' }),
        visualizerEntry,
        undefined,
      );
    });

    it('matches a comma-separated entry via a MIME from the middle of the list', async () => {
      const commaEntry: CustomVisualizer = {
        ...visualizerEntry,
        contentType:
          'application/x-foo, application/x-my-viz, application/x-bar',
      };
      mockResolveVisualizer.mockResolvedValue({
        type: 'visualizer',
        visualizerName: 'my-viz',
        mimeType: 'application/x-my-viz',
        url: '',
        data: {},
        layout: { themeId: 'light' },
      });

      const { result } = renderOpenAttachmentCanvas([commaEntry]);
      const opened = await result.current.openAttachmentCanvas(
        makeAttachment('chart.viz', 'application/x-my-viz'),
      );

      expect(opened).toBe(true);
      expect(mockResolveVisualizer).toHaveBeenCalledWith(
        expect.anything(),
        commaEntry,
        undefined,
      );
    });

    it('matches via the exported findVisualizerForMime used by the hook internally', () => {
      expect(
        findVisualizerForMime('application/x-my-viz', [visualizerEntry]),
      ).toBe(visualizerEntry);
    });
  });
});

describe('useOpenAttachmentCanvas — panel coordination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls onBeforeOpen before opening an Image attachment', async () => {
    mockResolveImage.mockReturnValue({ type: 'image', url: 'blob:image' });
    const onBeforeOpen = vi.fn();

    const { result } = renderHook(() =>
      useOpenAttachmentCanvas(makeResolvers(), {
        customVisualizers: [],
        onBeforeOpen,
      }),
    );
    const attachment = {
      id: 'pic.png',
      name: 'pic.png',
      contentType: 'image/png',
      type: AttachmentType.Image,
    } as DisplayAttachment;

    const opened = await result.current.openAttachmentCanvas(attachment);

    expect(opened).toBe(true);
    expect(onBeforeOpen).toHaveBeenCalledOnce();
  });

  it('does not call onBeforeOpen for an Audio attachment', async () => {
    const onBeforeOpen = vi.fn();

    const { result } = renderHook(() =>
      useOpenAttachmentCanvas(makeResolvers(), {
        customVisualizers: [],
        onBeforeOpen,
      }),
    );
    const attachment = {
      id: 'clip.mp3',
      name: 'clip.mp3',
      contentType: 'audio/mpeg',
      type: AttachmentType.Audio,
      url: 'https://example.com/clip.mp3',
    } as DisplayAttachment;

    const opened = await result.current.openAttachmentCanvas(attachment);

    expect(opened).toBe(true);
    expect(onBeforeOpen).not.toHaveBeenCalled();
    expect(mockOpenCanvas).toHaveBeenCalledWith(
      {
        type: 'audio',
        url: 'https://example.com/clip.mp3',
        mimeType: 'audio/mpeg',
      },
      'clip.mp3',
      'clip.mp3',
    );
  });

  it('calls onBeforeOpen before a File attachment enters its loading state', async () => {
    mockResolveMarkdown.mockResolvedValue({ type: 'markdown', text: 'x' });
    const onBeforeOpen = vi.fn();
    const callOrder: string[] = [];
    onBeforeOpen.mockImplementation(() => callOrder.push('onBeforeOpen'));
    mockOpenCanvasLoading.mockImplementation(() =>
      callOrder.push('openCanvasLoading'),
    );

    const { result } = renderHook(() =>
      useOpenAttachmentCanvas(makeResolvers(), {
        customVisualizers: [],
        onBeforeOpen,
      }),
    );

    await result.current.openAttachmentCanvas(makeAttachment('readme.md'));

    expect(callOrder).toEqual(['onBeforeOpen', 'openCanvasLoading']);
  });

  it('calls closeCanvas when the file dispatcher resolves to no content', async () => {
    mockResolveMarkdown.mockResolvedValue(null);

    const { result } = renderOpenAttachmentCanvas();
    const opened = await result.current.openAttachmentCanvas(
      makeAttachment('empty.md'),
    );

    expect(opened).toBe(false);
    expect(mockCloseCanvas).toHaveBeenCalledOnce();
  });

  it('returns false for an unrecognized attachment type', async () => {
    const { result } = renderOpenAttachmentCanvas();
    const attachment = {
      id: 'weird',
      name: 'weird',
      contentType: '',
      type: 'unknown-type',
    } as unknown as DisplayAttachment;

    const opened = await result.current.openAttachmentCanvas(attachment);

    expect(opened).toBe(false);
    expect(mockOpenCanvas).not.toHaveBeenCalled();
  });
});
