import {
  AttachmentContentType,
  AttachmentErrorType,
  OoxmlFileType,
  isTextPreviewable,
} from '@epam/ai-dial-attachment-canvas';
import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';
import type {
  CustomVisualizer,
  DisplayAttachment,
} from '@epam/ai-dial-chat-shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttachmentCanvasUrlResolvers } from '../attachment-canvas';
import {
  clearAttachmentCache,
  getUrlFileName,
  hasAttachmentTextSource,
  isExternalSourcePreviewable,
  referenceAttachmentToPdfCanvasContent,
  resolveImageCanvasContent,
  resolveJsonCanvasContent,
  resolveMarkdownCanvasContent,
  resolveOoxmlCanvasContent,
  resolvePdfCanvasContent,
  resolveTextCanvasContent,
  resolveVisualizerCanvasContent,
} from '../attachment-canvas';

/*
 * Mocked without `importOriginal` — the real module transitively pulls in
 * @epam/pdf-highlighter-kit's compiled dist, whose internal relative import
 * doesn't resolve outside a bundler. Only the enum members and preview
 * predicates this spec (and the module under test) actually reach for are
 * provided here.
 */
vi.mock('@epam/ai-dial-attachment-canvas', () => ({
  AttachmentContentType: {
    Error: 'error',
    Image: 'image',
    Json: 'json',
    Markdown: 'markdown',
    Ooxml: 'ooxml',
    Pdf: 'pdf',
    PlainText: 'plain_text',
    Visualizer: 'visualizer',
  },
  AttachmentErrorType: {
    Forbidden: 'forbidden',
    LoadFailed: 'load_failed',
  },
  OoxmlFileType: {
    Docx: 'docx',
    Pptx: 'pptx',
    Xlsx: 'xlsx',
  },
  isHtmlPreviewable: vi.fn().mockReturnValue(false),
  isTextPreviewable: vi.fn(),
}));

/* Stand-in for the host's DIAL-URL resolvers, mirroring the app's real
 * `resolveDialFileDownloadUrl`/`resolveDialUrl` shape without depending on
 * its endpoint constants. */
const resolveDialFileDownloadUrl = (url: string): string | undefined =>
  url.startsWith('files/bucket/')
    ? `/download?path=${url.slice('files/bucket/'.length)}`
    : undefined;

const resolvers: AttachmentCanvasUrlResolvers = {
  resolveDialFileDownloadUrl,
  resolveDialUrl: (attachment) => {
    if (attachment.url != null)
      return resolveDialFileDownloadUrl(attachment.url);
    if (attachment.referenceUrl != null)
      return resolveDialFileDownloadUrl(attachment.referenceUrl);
    return undefined;
  },
};

const makeRemoteAttachment = (name: string, url: string): DisplayAttachment =>
  ({
    id: name,
    name,
    contentType: 'text/plain',
    type: AttachmentType.File,
    status: RequestStatus.Idle,
    url,
  }) as DisplayAttachment;

const makeLocalAttachment = (
  name: string,
  content: string,
): DisplayAttachment => {
  const file = new File([content], name, { type: 'text/plain' });
  // jsdom does not implement Blob.text — provide a shim
  (file as unknown as { text: () => Promise<string> }).text = () =>
    Promise.resolve(content);
  return {
    id: name,
    name,
    contentType: 'text/plain',
    type: AttachmentType.File,
    status: RequestStatus.Idle,
    file,
  } as unknown as DisplayAttachment;
};

const makeLocalZeroByteAttachment = (name: string): DisplayAttachment => {
  const file = new File([], name, { type: 'text/plain' });
  // jsdom does not implement Blob.text — provide a shim
  (file as unknown as { text: () => Promise<string> }).text = () =>
    Promise.resolve('');
  return {
    id: name,
    name,
    contentType: 'text/plain',
    type: AttachmentType.File,
    status: RequestStatus.Idle,
    file,
  } as unknown as DisplayAttachment;
};

const makeReferenceUrlAttachment = (
  name: string,
  referenceUrl: string,
): DisplayAttachment =>
  ({
    id: name,
    name,
    contentType: 'text/plain',
    type: AttachmentType.File,
    status: RequestStatus.Idle,
    referenceUrl,
  }) as DisplayAttachment;

describe('resolveMarkdownCanvasContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAttachmentCache();
  });

  it('returns MarkdownCanvasContent from inline base64 data', async () => {
    const result = await resolveMarkdownCanvasContent(
      {
        id: 'stage-att',
        name: '[1] report.pdf',
        contentType: 'text/markdown',
        type: AttachmentType.File,
        status: RequestStatus.Idle,
        data: btoa('# Hello from stage'),
      },
      resolvers,
    );
    expect(result).toEqual({
      type: AttachmentContentType.Markdown,
      text: '# Hello from stage',
    });
  });

  it('falls back to raw text when inline data is not valid base64', async () => {
    const result = await resolveMarkdownCanvasContent(
      {
        id: 'stage-att',
        name: 'ocr-page.md',
        contentType: 'text/markdown',
        type: AttachmentType.File,
        status: RequestStatus.Idle,
        data: '# Résumé — café',
      },
      resolvers,
    );
    expect(result).toEqual({
      type: AttachmentContentType.Markdown,
      text: '# Résumé — café',
    });
  });

  it('resolves content via referenceUrl when url is absent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('# From reference'),
      }),
    );
    const result = await resolveMarkdownCanvasContent(
      makeReferenceUrlAttachment('plan.md', 'files/bucket/path/plan.md'),
      resolvers,
    );
    expect(result).toEqual({
      type: AttachmentContentType.Markdown,
      text: '# From reference',
    });
  });

  it('returns MarkdownCanvasContent for a successful remote fetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('# Hello'),
      }),
    );
    const result = await resolveMarkdownCanvasContent(
      makeRemoteAttachment('readme.md', 'files/bucket/path/readme.md'),
      resolvers,
    );
    expect(result).toEqual({
      type: AttachmentContentType.Markdown,
      text: '# Hello',
    });
  });

  it('returns a LoadFailed error content when the remote response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );
    const result = await resolveMarkdownCanvasContent(
      makeRemoteAttachment('readme.md', 'files/bucket/path/readme.md'),
      resolvers,
    );
    expect(result).toEqual({
      type: AttachmentContentType.Error,
      errorType: AttachmentErrorType.LoadFailed,
      url: '/download?path=path/readme.md',
    });
  });

  it('returns a Forbidden error content when the remote response is a 403', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 403 }),
    );
    const result = await resolveMarkdownCanvasContent(
      makeRemoteAttachment('readme.md', 'files/bucket/path/readme.md'),
      resolvers,
    );
    expect(result).toEqual({
      type: AttachmentContentType.Error,
      errorType: AttachmentErrorType.Forbidden,
      url: '/download?path=path/readme.md',
    });
  });

  it('returns a LoadFailed error content when the fetch throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network error')),
    );
    const result = await resolveMarkdownCanvasContent(
      makeRemoteAttachment('readme.md', 'files/bucket/path/readme.md'),
      resolvers,
    );
    expect(result).toEqual({
      type: AttachmentContentType.Error,
      errorType: AttachmentErrorType.LoadFailed,
      url: '/download?path=path/readme.md',
    });
  });

  it('returns MarkdownCanvasContent from a local File', async () => {
    const result = await resolveMarkdownCanvasContent(
      makeLocalAttachment('readme.md', '# Local'),
      resolvers,
    );
    expect(result).toEqual({
      type: AttachmentContentType.Markdown,
      text: '# Local',
    });
  });
});

describe('resolveJsonCanvasContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAttachmentCache();
  });

  it('returns JsonCanvasContent from inline base64 data', async () => {
    const result = await resolveJsonCanvasContent(
      {
        id: 'stage-att',
        name: '[1] report.pdf',
        contentType: 'application/json',
        type: AttachmentType.File,
        status: RequestStatus.Idle,
        data: btoa('{"stage":true}'),
      },
      resolvers,
    );
    expect(result).toEqual({
      type: AttachmentContentType.Json,
      value: { stage: true },
    });
  });

  it('falls back to PlainTextCanvasContent when inline data is invalid JSON', async () => {
    const result = await resolveJsonCanvasContent(
      {
        id: 'stage-att',
        name: '[1] report.pdf',
        contentType: 'application/json',
        type: AttachmentType.File,
        status: RequestStatus.Idle,
        data: btoa('not valid json'),
      },
      resolvers,
    );
    expect(result).toEqual({
      type: AttachmentContentType.PlainText,
      text: 'not valid json',
    });
  });

  it('returns JsonCanvasContent for valid JSON from a remote file', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('{"key":"value","count":42}'),
      }),
    );
    const result = await resolveJsonCanvasContent(
      makeRemoteAttachment('data.json', 'files/bucket/path/data.json'),
      resolvers,
    );
    expect(result).toEqual({
      type: AttachmentContentType.Json,
      value: { key: 'value', count: 42 },
    });
  });

  it('falls back to PlainTextCanvasContent when JSON is invalid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('not valid json'),
      }),
    );
    const result = await resolveJsonCanvasContent(
      makeRemoteAttachment('data.json', 'files/bucket/path/data.json'),
      resolvers,
    );
    expect(result).toEqual({
      type: AttachmentContentType.PlainText,
      text: 'not valid json',
    });
  });

  it('returns a Forbidden error content when the remote response is a 403', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 403 }),
    );
    const result = await resolveJsonCanvasContent(
      makeRemoteAttachment('data.json', 'files/bucket/path/data.json'),
      resolvers,
    );
    expect(result).toEqual({
      type: AttachmentContentType.Error,
      errorType: AttachmentErrorType.Forbidden,
      url: '/download?path=path/data.json',
    });
  });

  it('returns JsonCanvasContent from a local File with valid JSON', async () => {
    const result = await resolveJsonCanvasContent(
      makeLocalAttachment('data.json', '{"x":1}'),
      resolvers,
    );
    expect(result).toEqual({
      type: AttachmentContentType.Json,
      value: { x: 1 },
    });
  });

  it('resolves content via referenceUrl when url is absent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('{"via":"reference"}'),
      }),
    );
    const result = await resolveJsonCanvasContent(
      makeReferenceUrlAttachment(
        'result.json',
        'files/bucket/path/result.json',
      ),
      resolvers,
    );
    expect(result).toEqual({
      type: AttachmentContentType.Json,
      value: { via: 'reference' },
    });
  });
});

describe('referenceAttachmentToPdfCanvasContent', () => {
  it('returns null when the url does not target a PDF', () => {
    expect(
      referenceAttachmentToPdfCanvasContent(
        {
          type: 'text/markdown',
          url: 'https://example.com/redirect/abc',
        },
        resolvers,
      ),
    ).toBeNull();
  });

  it('builds a PDF canvas payload with a page-scoped invisible highlight', () => {
    const result = referenceAttachmentToPdfCanvasContent(
      {
        type: 'text/markdown',
        url: 'files/bucket/uploads/report%20(3).pdf#page=81',
      },
      resolvers,
    );

    expect(result).toEqual({
      type: AttachmentContentType.Pdf,
      url: '/download?path=uploads/report%20(3).pdf',
      highlights: [
        {
          id: 'reference-page-81',
          bboxes: [{ page: 81, x1: 0, y1: 0, x2: 0, y2: 0 }],
          style: { backgroundColor: 'transparent', opacity: 0 },
        },
      ],
      selectedHighlightId: 'reference-page-81',
    });
  });

  it('builds a PDF canvas payload with no highlights when there is no page anchor', () => {
    const result = referenceAttachmentToPdfCanvasContent(
      {
        type: 'text/markdown',
        url: 'files/bucket/report.pdf',
      },
      resolvers,
    );

    expect(result).toEqual({
      type: AttachmentContentType.Pdf,
      url: '/download?path=report.pdf',
    });
  });

  it('produces a distinct highlight id per page, so re-opening at a different page re-triggers scroll', () => {
    const page5 = referenceAttachmentToPdfCanvasContent(
      {
        type: 'text/markdown',
        url: 'files/bucket/report.pdf#page=5',
      },
      resolvers,
    );
    const page19 = referenceAttachmentToPdfCanvasContent(
      {
        type: 'text/markdown',
        url: 'files/bucket/report.pdf#page=19',
      },
      resolvers,
    );

    expect(page5?.selectedHighlightId).not.toBe(page19?.selectedHighlightId);
  });
});

describe('resolveImageCanvasContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAttachmentCache();
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-image-url');
  });

  it('returns ImageCanvasContent with the BFF URL for a DIAL attachment (no fetch)', () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const result = resolveImageCanvasContent(
      {
        id: 'photo.jpg',
        name: 'photo.jpg',
        contentType: 'image/jpeg',
        type: AttachmentType.Image,
        status: RequestStatus.Idle,
        url: 'files/bucket/path/photo.jpg',
      } as DisplayAttachment,
      resolvers,
    );

    expect(result).toEqual({
      type: AttachmentContentType.Image,
      url: '/download?path=path/photo.jpg',
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns ImageCanvasContent from a data: previewUrl', () => {
    const result = resolveImageCanvasContent(
      {
        id: 'stage-att',
        name: 'Annotated page #1',
        contentType: 'image/jpeg',
        type: AttachmentType.Image,
        status: RequestStatus.Idle,
        previewUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJ',
      },
      resolvers,
    );
    expect(result).toEqual({
      type: AttachmentContentType.Image,
      url: 'data:image/jpeg;base64,/9j/4AAQSkZJ',
    });
  });

  it('returns ImageCanvasContent from inline base64 data via a Blob URL', () => {
    const result = resolveImageCanvasContent(
      {
        id: 'stage-att',
        name: 'Annotated page #1',
        contentType: 'image/jpeg',
        type: AttachmentType.Image,
        status: RequestStatus.Idle,
        data: btoa('binary-image-bytes'),
      },
      resolvers,
    );
    expect(result).toEqual({
      type: AttachmentContentType.Image,
      url: 'blob:mock-image-url',
    });
  });

  it('returns null when no source is available', () => {
    const result = resolveImageCanvasContent(
      {
        id: 'stage-att',
        name: 'Annotated page #1',
        contentType: 'image/jpeg',
        type: AttachmentType.Image,
        status: RequestStatus.Idle,
      },
      resolvers,
    );
    expect(result).toBeNull();
  });

  it('returns ImageCanvasContent for a zero-byte local file instead of treating it as missing', () => {
    const result = resolveImageCanvasContent(
      makeLocalZeroByteAttachment('empty.png'),
      resolvers,
    );
    expect(result).toEqual({
      type: AttachmentContentType.Image,
      url: 'blob:mock-image-url',
    });
  });
});

describe('zero-byte local file handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAttachmentCache();
  });

  it('resolveTextCanvasContent opens an empty preview for a zero-byte local file', async () => {
    const result = await resolveTextCanvasContent(
      makeLocalZeroByteAttachment('empty.txt'),
      resolvers,
    );
    expect(result).toEqual({ type: AttachmentContentType.PlainText, text: '' });
  });

  it('resolveMarkdownCanvasContent opens an empty preview for a zero-byte local file', async () => {
    const result = await resolveMarkdownCanvasContent(
      makeLocalZeroByteAttachment('empty.md'),
      resolvers,
    );
    expect(result).toEqual({ type: AttachmentContentType.Markdown, text: '' });
  });

  it('hasAttachmentTextSource reports true for a zero-byte local file', () => {
    expect(
      hasAttachmentTextSource(
        makeLocalZeroByteAttachment('empty.txt'),
        resolvers,
      ),
    ).toBe(true);
  });
});

describe('attachment cache deduplication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAttachmentCache();
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
  });

  it('issues only one fetch when the same DIAL text URL is resolved twice concurrently', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('# Hello'),
    });
    vi.stubGlobal('fetch', mockFetch);

    const att = makeRemoteAttachment(
      'readme.md',
      'files/bucket/path/readme.md',
    );
    await Promise.all([
      resolveMarkdownCanvasContent(att, resolvers),
      resolveMarkdownCanvasContent(att, resolvers),
    ]);

    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('issues only one fetch when the same DIAL blob URL is resolved twice concurrently', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['%PDF'])),
    });
    vi.stubGlobal('fetch', mockFetch);

    const att = makeRemoteAttachment('doc.pdf', 'files/bucket/path/doc.pdf');
    await Promise.all([
      resolvePdfCanvasContent(att, resolvers),
      resolvePdfCanvasContent(att, resolvers),
    ]);

    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('retries a failed fetch on the next call', async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('# Retry'),
      });
    vi.stubGlobal('fetch', mockFetch);

    const att = makeRemoteAttachment('retry.md', 'files/bucket/path/retry.md');
    await resolveMarkdownCanvasContent(att, resolvers);
    const result = await resolveMarkdownCanvasContent(att, resolvers);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      type: AttachmentContentType.Markdown,
      text: '# Retry',
    });
  });

  it('clears cached entries so the next call re-fetches', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('v1'),
    });
    vi.stubGlobal('fetch', mockFetch);

    const att = makeRemoteAttachment('doc.md', 'files/bucket/path/doc.md');
    await resolveMarkdownCanvasContent(att, resolvers);

    clearAttachmentCache();
    await resolveMarkdownCanvasContent(att, resolvers);

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe('resolvePdfCanvasContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAttachmentCache();
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-pdf-url');
  });

  it('returns PdfCanvasContent from inline base64 data via a Blob URL', async () => {
    const result = await resolvePdfCanvasContent(
      {
        id: 'stage-att',
        name: 'doc.pdf',
        contentType: 'application/pdf',
        type: AttachmentType.File,
        status: RequestStatus.Idle,
        data: btoa('%PDF-1.4'),
      },
      resolvers,
    );
    expect(result).toEqual({
      type: AttachmentContentType.Pdf,
      url: 'blob:mock-pdf-url',
    });
  });

  it('returns PdfCanvasContent via a Blob URL for a successful DIAL fetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(['%PDF-1.4'])),
      }),
    );
    const result = await resolvePdfCanvasContent(
      makeRemoteAttachment('doc.pdf', 'files/bucket/path/doc.pdf'),
      resolvers,
    );
    expect(result).toEqual({
      type: AttachmentContentType.Pdf,
      url: 'blob:mock-pdf-url',
    });
  });

  it('returns a LoadFailed error content when the DIAL fetch is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );
    const result = await resolvePdfCanvasContent(
      makeRemoteAttachment('doc.pdf', 'files/bucket/path/doc.pdf'),
      resolvers,
    );
    expect(result).toEqual({
      type: AttachmentContentType.Error,
      errorType: AttachmentErrorType.LoadFailed,
      url: '/download?path=path/doc.pdf',
    });
  });

  it('returns null when no source is available', async () => {
    const result = await resolvePdfCanvasContent(
      {
        id: 'stage-att',
        name: 'doc.pdf',
        contentType: 'application/pdf',
        type: AttachmentType.File,
        status: RequestStatus.Idle,
      },
      resolvers,
    );
    expect(result).toBeNull();
  });
});

describe('resolveOoxmlCanvasContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAttachmentCache();
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-ooxml-url');
  });

  it('returns OOXML content from a local Office file', async () => {
    const result = await resolveOoxmlCanvasContent(
      makeLocalAttachment('report.docx', 'OOXML bytes'),
      resolvers,
      OoxmlFileType.Docx,
    );

    expect(result).toEqual({
      type: AttachmentContentType.Ooxml,
      url: 'blob:mock-ooxml-url',
      format: 'docx',
    });
  });

  it('returns a Forbidden error when a remote Office file cannot be fetched', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 403 }),
    );

    const result = await resolveOoxmlCanvasContent(
      makeRemoteAttachment('budget.xlsx', 'files/bucket/path/budget.xlsx'),
      resolvers,
      OoxmlFileType.Xlsx,
    );

    expect(result).toEqual({
      type: AttachmentContentType.Error,
      errorType: AttachmentErrorType.Forbidden,
      url: '/download?path=path/budget.xlsx',
    });
  });

  it('returns a LoadFailed error when the fetch throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down')),
    );

    const result = await resolveOoxmlCanvasContent(
      makeRemoteAttachment('slides.pptx', 'files/bucket/path/slides.pptx'),
      resolvers,
      OoxmlFileType.Pptx,
    );

    expect(result).toEqual({
      type: AttachmentContentType.Error,
      errorType: AttachmentErrorType.LoadFailed,
      url: '/download?path=path/slides.pptx',
    });
  });

  it('returns null when the attachment has no resolvable source', async () => {
    /* No local file, no DIAL url, no previewUrl, and no inline data — there is
     * nothing for the blob resolver to work from. */
    const result = await resolveOoxmlCanvasContent(
      {
        id: 'report.docx',
        name: 'report.docx',
        contentType: 'application/octet-stream',
        type: AttachmentType.File,
      } as DisplayAttachment,
      resolvers,
      OoxmlFileType.Docx,
    );

    expect(result).toBeNull();
  });
});

describe('resolveVisualizerCanvasContent', () => {
  const visualizerEntry: CustomVisualizer = {
    title: 'my-viz',
    contentType: 'application/x-my-viz',
    url: 'https://viz.example.com',
  };

  beforeEach(() => {
    clearAttachmentCache();
    vi.unstubAllGlobals();
  });

  it('returns null when the remote response is a 403 (ErrorCanvasContent is not forwarded)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 403 }),
    );

    const result = await resolveVisualizerCanvasContent(
      makeRemoteAttachment('chart.viz', 'files/bucket/path/chart.viz'),
      resolvers,
      visualizerEntry,
      'light',
    );

    expect(result).toBeNull();
  });

  it('returns VisualizerCanvasContent when the payload is valid JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('{"series":[1,2,3]}'),
      }),
    );

    const result = await resolveVisualizerCanvasContent(
      makeRemoteAttachment('chart.viz', 'files/bucket/path/chart.viz'),
      resolvers,
      visualizerEntry,
      'light',
    );

    expect(result).toEqual(
      expect.objectContaining({
        type: AttachmentContentType.Visualizer,
        url: 'https://viz.example.com',
        visualizerName: 'my-viz',
        data: { series: [1, 2, 3] },
        layout: expect.objectContaining({ themeId: 'light' }),
      }),
    );
  });
});

describe('getUrlFileName', () => {
  it('returns the last path segment of an absolute url', () => {
    expect(getUrlFileName('https://example.com/files/report.pdf')).toBe(
      'report.pdf',
    );
  });

  it('returns the file name of a relative DIAL resource path', () => {
    expect(
      getUrlFileName(
        'files/4FD1MyzohvVCq3YG9kDnt7Yk38cZfot7myHgGbBMKBpsSERRfFUHAh6ZsqCfieQsGy/qa-routed-source.html',
      ),
    ).toBe('qa-routed-source.html');
  });

  it('drops the query string and hash', () => {
    expect(getUrlFileName('files/bucket/page.html?v=2#top')).toBe('page.html');
    expect(getUrlFileName('https://example.com/page.html?v=2#top')).toBe(
      'page.html',
    );
  });

  it('decodes percent escapes in the file name', () => {
    expect(getUrlFileName('files/bucket/my%20report.pdf')).toBe(
      'my report.pdf',
    );
  });

  it('ignores a trailing slash', () => {
    expect(getUrlFileName('files/bucket/nested/')).toBe('nested');
  });

  it('returns an empty string when there is no path segment', () => {
    expect(getUrlFileName('')).toBe('');
    expect(getUrlFileName('https://example.com/')).toBe('');
  });
});

describe('isExternalSourcePreviewable', () => {
  beforeEach(() => {
    vi.mocked(isTextPreviewable).mockReturnValue(false);
  });

  it('returns true for an image/* content type regardless of url', () => {
    expect(
      isExternalSourcePreviewable('image/jpeg', 'https://example.com/photo'),
    ).toBe(true);
  });

  it('returns true for an audio/* content type regardless of url', () => {
    expect(
      isExternalSourcePreviewable(
        'audio/mpeg',
        'https://example.com/track.mp3',
      ),
    ).toBe(true);
  });

  it('returns true for a url whose path ends with .pdf', () => {
    expect(
      isExternalSourcePreviewable(
        'application/octet-stream',
        'https://example.com/files/report.pdf',
      ),
    ).toBe(true);
  });

  it('returns true when isTextPreviewable reports the filename is previewable', () => {
    vi.mocked(isTextPreviewable).mockReturnValue(true);
    expect(
      isExternalSourcePreviewable(
        'text/markdown',
        'https://example.com/files/readme.md',
      ),
    ).toBe(true);
  });

  it('returns false when the url path has no file extension', () => {
    expect(
      isExternalSourcePreviewable(
        'text/html',
        'https://example.com/page/about',
      ),
    ).toBe(false);
  });

  it('returns false for a url that cannot be parsed', () => {
    expect(isExternalSourcePreviewable('text/html', 'not a valid url')).toBe(
      false,
    );
  });

  it('returns false when the extension is not previewable and content type is not image or audio', () => {
    expect(
      isExternalSourcePreviewable(
        'application/zip',
        'https://example.com/archive.zip',
      ),
    ).toBe(false);
  });
});
