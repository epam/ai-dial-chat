import {
  AttachmentContentType,
  AttachmentErrorType,
  OoxmlFileType,
} from '@epam/ai-dial-attachment-canvas';
import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';
import type {
  Annotation,
  CustomVisualizer,
  DisplayAttachment,
} from '@epam/ai-dial-chat-shared';
import {
  groupAnnotations,
  type AnnotationGroup,
} from '@epam/ai-dial-quotations';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttachmentCanvasUrlResolvers } from '../attachment-canvas';
import {
  annotationToOoxmlCanvasContent,
  annotationToPdfCanvasContent,
  clearAttachmentCache,
  hasAttachmentTextSource,
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
 * doesn't resolve outside a bundler. Only the enum members this spec (and
 * the module under test) actually reach for are provided here.
 */
const MOCK_OOXML_MIME_TO_FILE_TYPE: Record<string, string> = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    'pptx',
  'text/csv': 'csv',
};

const MOCK_OOXML_EXTENSION_TO_FILE_TYPE: Record<string, string> = {
  docx: 'docx',
  xlsx: 'xlsx',
  pptx: 'pptx',
  csv: 'csv',
};

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
    Csv: 'csv',
    Docx: 'docx',
    Pptx: 'pptx',
    Xlsx: 'xlsx',
  },
  OoxmlHighlightKind: {
    DocxTextRange: 'docxTextRange',
    PptxTextRange: 'pptxTextRange',
    XlsxCellRange: 'xlsxCellRange',
  },
  getOoxmlFileType: (name: string, mimeType?: string) => {
    const normalized = mimeType?.split(';', 1)[0].trim().toLowerCase();
    if (normalized != null && MOCK_OOXML_MIME_TO_FILE_TYPE[normalized]) {
      return MOCK_OOXML_MIME_TO_FILE_TYPE[normalized];
    }
    const dot = name.lastIndexOf('.');
    if (dot === -1) return undefined;
    return MOCK_OOXML_EXTENSION_TO_FILE_TYPE[name.slice(dot + 1).toLowerCase()];
  },
}));

/* Stand-in for the host's DIAL-URL resolvers, mirroring the app's real
 * `resolveDialFileDownloadUrl`/`resolveDialUrl`/`resolveDialFileMetadataUrl`
 * shape without depending on its endpoint constants. */
const resolveDialFileDownloadUrl = (url: string): string | undefined =>
  url.startsWith('files/bucket/')
    ? `/download?path=${url.slice('files/bucket/'.length)}`
    : undefined;

const resolveDialFileMetadataUrl = (url: string): string | undefined =>
  url.startsWith('files/bucket/')
    ? `/metadata?path=${url.slice('files/bucket/'.length)}`
    : undefined;

const resolvers: AttachmentCanvasUrlResolvers = {
  resolveDialFileDownloadUrl,
  resolveDialFileMetadataUrl,
  resolveDialUrl: (attachment) => {
    if (attachment.url != null)
      return resolveDialFileDownloadUrl(attachment.url);
    if (attachment.referenceUrl != null)
      return resolveDialFileDownloadUrl(attachment.referenceUrl);
    return undefined;
  },
};

/**
 * Builds a `fetch` mock that answers `/metadata` requests with the given
 * `etag` (via `metadata()`, re-evaluated on every call so a test can change
 * the served etag mid-flight) and routes every other request to
 * `contentHandler`. `metadata: 'fail'` simulates a non-2xx metadata response;
 * `metadata: undefined` (the default when omitted) simulates a response body
 * with no `etag` field.
 */
const stubDialFetch = (options: {
  metadata: () => string | undefined | 'fail';
  contentHandler: (url: string) => Promise<{
    ok: boolean;
    status?: number;
    text?: () => Promise<string>;
    blob?: () => Promise<Blob>;
  }>;
}) => {
  const mockFetch = vi.fn((url: string) => {
    if (url.startsWith('/metadata')) {
      const etag = options.metadata();
      if (etag === 'fail') return Promise.resolve({ ok: false, status: 500 });
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(etag != null ? { etag } : {}),
      });
    }
    return options.contentHandler(url);
  });
  vi.stubGlobal('fetch', mockFetch);
  return mockFetch;
};

/** Counts how many of `mockFetch`'s calls targeted a `/download` (content) URL. */
const countContentFetches = (mockFetch: ReturnType<typeof vi.fn>): number =>
  mockFetch.mock.calls.filter(([url]) =>
    (url as string).startsWith('/download'),
  ).length;

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
      page: 81,
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
      page: undefined,
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

describe('annotationToPdfCanvasContent', () => {
  it('selects highlights from the clicked cit group and only its PDF', () => {
    const annotation = (
      id: string,
      page: number,
      url = 'files/bucket/report.pdf',
    ): Annotation => ({
      target: { selector: { type: 'html_tag', tag: 'cit', id } },
      body: {
        source: {
          type: 'attachment',
          attachment: { type: 'application/pdf', url },
        },
        selector: { type: 'pdf_bbox', page, x1: 0, y1: 0, x2: 0, y2: 0 },
      },
    });
    const first = annotation('first', 1);
    const otherPdf = annotation('second', 2, 'files/bucket/other.pdf');
    const clicked = annotation('second', 3);
    const groups = groupAnnotations([first, otherPdf, clicked]);
    const result = annotationToPdfCanvasContent(clicked, groups, resolvers);
    expect(result?.page).toBe(3);
    expect(result?.url).toBe('/download?path=report.pdf');
    expect(result?.highlights).toHaveLength(1);
    expect(result?.highlights?.[0].bboxes[0].page).toBe(3);
    expect(result?.selectedHighlightId).toBe(result?.highlights?.[0].id);
  });
  const makeAnnotation = (index: number, page: number): Annotation => ({
    index,
    body: {
      source: {
        type: 'attachment',
        attachment: { type: 'application/pdf', url: 'files/bucket/report.pdf' },
      },
      selector: { type: 'pdf_bbox', page, x1: 10, y1: 10, x2: 20, y2: 20 },
    },
  });

  it('returns null when the annotation source is not a PDF', () => {
    const annotation: Annotation = {
      body: {
        source: {
          type: 'attachment',
          attachment: { type: 'text/html', url: 'https://example.com/a' },
        },
      },
    };
    expect(annotationToPdfCanvasContent(annotation, [], resolvers)).toBeNull();
  });

  it('sets page from a single annotation pdf_bbox selector', () => {
    const annotation = makeAnnotation(0, 3);
    const result = annotationToPdfCanvasContent(annotation, [], resolvers);
    expect(result?.page).toBe(3);
  });

  it('sets page from the clicked annotation in a two-page group, not the group primary', () => {
    const page2 = makeAnnotation(0, 2);
    const page7 = makeAnnotation(1, 7);
    const group: AnnotationGroup = {
      groupKey: 'files/bucket/report.pdf',
      sourceUrl: 'files/bucket/report.pdf',
      sourceName: 'report.pdf',
      annotations: [page2, page7],
      primaryAnnotation: page2,
    };

    expect(annotationToPdfCanvasContent(page7, [group], resolvers)?.page).toBe(
      7,
    );
    expect(annotationToPdfCanvasContent(page2, [group], resolvers)?.page).toBe(
      2,
    );
  });

  it('sets page to undefined when the annotation has no pdf_bbox selector', () => {
    const annotation: Annotation = {
      body: {
        source: {
          type: 'attachment',
          attachment: {
            type: 'application/pdf',
            url: 'files/bucket/report.pdf',
          },
        },
      },
    };
    expect(
      annotationToPdfCanvasContent(annotation, [], resolvers)?.page,
    ).toBeUndefined();
  });

  it('sets page correctly even when the bounding box is all zero', () => {
    const annotation: Annotation = {
      index: 0,
      body: {
        source: {
          type: 'attachment',
          attachment: {
            type: 'application/pdf',
            url: 'files/bucket/report.pdf',
          },
        },
        selector: { type: 'pdf_bbox', page: 5, x1: 0, y1: 0, x2: 0, y2: 0 },
      },
    };
    expect(annotationToPdfCanvasContent(annotation, [], resolvers)?.page).toBe(
      5,
    );
  });
});

describe('annotationToOoxmlCanvasContent', () => {
  const officeAnnotation = (
    id: string,
    selector: unknown,
    options: { url?: string; mimeType?: string; title?: string } = {},
  ): Annotation => {
    const {
      url = 'files/bucket/report.docx',
      mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      title = 'report.docx',
    } = options;
    return {
      target: { selector: { type: 'html_tag', tag: 'cit', id } },
      body: {
        title,
        source: {
          type: 'attachment',
          attachment: { type: mimeType, url, title },
        },
        selector: selector as NonNullable<Annotation['body']>['selector'],
      },
    };
  };

  const docxSelector = (overrides: Record<string, unknown> = {}) => ({
    type: 'docx_text_range',
    story: 'body',
    path: [3, 1],
    start: 0,
    end: 5,
    text: 'Hello',
    ...overrides,
  });

  it('returns content with highlights and a selectedHighlightId present in highlights, for a DOCX citation', () => {
    const clicked = officeAnnotation('a', docxSelector());
    const result = annotationToOoxmlCanvasContent(
      clicked,
      [clicked],
      resolvers,
    );

    expect(result?.format).toBe(OoxmlFileType.Docx);
    expect(result?.highlights).toHaveLength(1);
    expect(result?.selectedHighlightId).toBe(result?.highlights?.[0].id);
  });

  it('returns content with the correct format for a PPTX citation and an XLSX citation', () => {
    const pptx = officeAnnotation(
      'a',
      {
        type: 'pptx_text_range',
        slide: 1,
        shape_id: '7',
        start: 0,
        end: 5,
        text: 'Hello',
      },
      {
        url: 'files/bucket/deck.pptx',
        mimeType:
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      },
    );
    const xlsx = officeAnnotation(
      'b',
      { type: 'excel_rc_range', sheet: 'Sheet1', start: { row: 1, col: 1 } },
      {
        url: 'files/bucket/ledger.xlsx',
        mimeType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    );

    expect(
      annotationToOoxmlCanvasContent(pptx, [pptx], resolvers)?.format,
    ).toBe(OoxmlFileType.Pptx);
    expect(
      annotationToOoxmlCanvasContent(xlsx, [xlsx], resolvers)?.format,
    ).toBe(OoxmlFileType.Xlsx);
  });

  it('returns null for a CSV source', () => {
    const csv = officeAnnotation('a', docxSelector(), {
      url: 'files/bucket/data.csv',
      mimeType: 'text/csv',
    });

    expect(annotationToOoxmlCanvasContent(csv, [csv], resolvers)).toBeNull();
  });

  it('returns null for a non-Office source', () => {
    const annotation: Annotation = {
      body: {
        source: {
          type: 'attachment',
          attachment: { type: 'text/plain', url: 'files/bucket/notes.txt' },
        },
      },
    };
    expect(
      annotationToOoxmlCanvasContent(annotation, [annotation], resolvers),
    ).toBeNull();
  });

  it('returns content with highlights and selectedHighlightId both undefined when the only selector is malformed', () => {
    const clicked = officeAnnotation(
      'a',
      docxSelector({ end: 'not-a-number' }),
    );
    const result = annotationToOoxmlCanvasContent(
      clicked,
      [clicked],
      resolvers,
    );

    expect(result?.highlights).toBeUndefined();
    expect(result?.selectedHighlightId).toBeUndefined();
  });

  it('holds the sibling in highlights, with selectedHighlightId undefined, when the clicked annotation resolves to nothing but a sibling resolves', () => {
    const clicked = officeAnnotation(
      'a',
      docxSelector({ end: 'not-a-number' }),
    );
    const sibling = officeAnnotation('b', docxSelector());
    const result = annotationToOoxmlCanvasContent(
      clicked,
      [clicked, sibling],
      resolvers,
    );

    expect(result?.highlights).toHaveLength(1);
    expect(result?.selectedHighlightId).toBeUndefined();
  });

  it('resolves a DIAL files/… id through resolveDialFileDownloadUrl, and returns null when the resolver returns undefined', () => {
    const resolvable = officeAnnotation('a', docxSelector());
    expect(
      annotationToOoxmlCanvasContent(resolvable, [resolvable], resolvers)?.url,
    ).toBe('/download?path=report.docx');

    const unresolvable = officeAnnotation('a', docxSelector(), {
      url: 'files/other-bucket/report.docx',
    });
    expect(
      annotationToOoxmlCanvasContent(unresolvable, [unresolvable], resolvers),
    ).toBeNull();
  });

  it('omits highlights rather than setting [] when nothing resolves', () => {
    const clicked = officeAnnotation(
      'a',
      docxSelector({ end: 'not-a-number' }),
    );
    const result = annotationToOoxmlCanvasContent(
      clicked,
      [clicked],
      resolvers,
    );

    expect(result).not.toBeNull();
    expect(result).not.toHaveProperty('highlights');
    expect(result).not.toHaveProperty('selectedHighlightId');
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

  it('issues only one content fetch when the same DIAL text URL is resolved twice concurrently, observing the same etag', async () => {
    const mockFetch = stubDialFetch({
      metadata: () => 'etag-1',
      contentHandler: () =>
        Promise.resolve({ ok: true, text: () => Promise.resolve('# Hello') }),
    });

    const att = makeRemoteAttachment(
      'readme.md',
      'files/bucket/path/readme.md',
    );
    await Promise.all([
      resolveMarkdownCanvasContent(att, resolvers),
      resolveMarkdownCanvasContent(att, resolvers),
    ]);

    expect(countContentFetches(mockFetch)).toBe(1);
  });

  it('issues only one content fetch when the same DIAL blob URL is resolved twice concurrently, observing the same etag', async () => {
    const mockFetch = stubDialFetch({
      metadata: () => 'etag-1',
      contentHandler: () =>
        Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(new Blob(['%PDF'])),
        }),
    });

    const att = makeRemoteAttachment('doc.pdf', 'files/bucket/path/doc.pdf');
    await Promise.all([
      resolvePdfCanvasContent(att, resolvers),
      resolvePdfCanvasContent(att, resolvers),
    ]);

    expect(countContentFetches(mockFetch)).toBe(1);
  });

  it('retries a failed content fetch on the next call rather than replaying the rejection', async () => {
    let contentCalls = 0;
    const mockFetch = stubDialFetch({
      metadata: () => 'etag-1',
      contentHandler: () => {
        contentCalls += 1;
        if (contentCalls === 1)
          return Promise.resolve({ ok: false, status: 403 });
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve('# Retry'),
        });
      },
    });

    const att = makeRemoteAttachment('retry.md', 'files/bucket/path/retry.md');
    const failedResult = await resolveMarkdownCanvasContent(att, resolvers);
    const result = await resolveMarkdownCanvasContent(att, resolvers);

    expect(failedResult).toEqual({
      type: AttachmentContentType.Error,
      errorType: AttachmentErrorType.Forbidden,
      url: '/download?path=path/retry.md',
    });
    expect(countContentFetches(mockFetch)).toBe(2);
    expect(result).toEqual({
      type: AttachmentContentType.Markdown,
      text: '# Retry',
    });
  });

  it('clears cached entries so the next call re-fetches, even with an unchanged etag', async () => {
    const mockFetch = stubDialFetch({
      metadata: () => 'etag-1',
      contentHandler: () =>
        Promise.resolve({ ok: true, text: () => Promise.resolve('v1') }),
    });

    const att = makeRemoteAttachment('doc.md', 'files/bucket/path/doc.md');
    await resolveMarkdownCanvasContent(att, resolvers);

    clearAttachmentCache();
    await resolveMarkdownCanvasContent(att, resolvers);

    expect(countContentFetches(mockFetch)).toBe(2);
  });
});

describe('attachment cache freshness (ETag revalidation)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAttachmentCache();
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
  });

  it('reuses the cached body when a second resolution observes the same etag', async () => {
    const mockFetch = stubDialFetch({
      metadata: () => 'etag-1',
      contentHandler: () =>
        Promise.resolve({ ok: true, text: () => Promise.resolve('v1') }),
    });

    const att = makeRemoteAttachment('doc.md', 'files/bucket/path/doc.md');
    const r1 = await resolveMarkdownCanvasContent(att, resolvers);
    const r2 = await resolveMarkdownCanvasContent(att, resolvers);

    expect(countContentFetches(mockFetch)).toBe(1);
    expect(r1).toEqual({ type: AttachmentContentType.Markdown, text: 'v1' });
    expect(r2).toEqual({ type: AttachmentContentType.Markdown, text: 'v1' });
  });

  it('discards the stale entry and refetches when a second resolution observes a different etag', async () => {
    let etag = 'etag-1';
    const mockFetch = stubDialFetch({
      metadata: () => etag,
      contentHandler: () =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve(etag === 'etag-1' ? 'v1' : 'v2'),
        }),
    });

    const att = makeRemoteAttachment('doc.md', 'files/bucket/path/doc.md');
    const r1 = await resolveMarkdownCanvasContent(att, resolvers);
    etag = 'etag-2';
    const r2 = await resolveMarkdownCanvasContent(att, resolvers);

    expect(countContentFetches(mockFetch)).toBe(2);
    expect(r1).toEqual({ type: AttachmentContentType.Markdown, text: 'v1' });
    expect(r2).toEqual({ type: AttachmentContentType.Markdown, text: 'v2' });
  });

  it('issues a content fetch when the metadata call fails, even with an existing cache entry, and does not return the now-unverifiable entry', async () => {
    let metadataShouldFail = false;
    const mockFetch = stubDialFetch({
      metadata: () => (metadataShouldFail ? 'fail' : 'etag-1'),
      contentHandler: () =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve(metadataShouldFail ? 'v2' : 'v1'),
        }),
    });

    const att = makeRemoteAttachment('doc.md', 'files/bucket/path/doc.md');
    const r1 = await resolveMarkdownCanvasContent(att, resolvers);

    metadataShouldFail = true;
    const r2 = await resolveMarkdownCanvasContent(att, resolvers);

    expect(countContentFetches(mockFetch)).toBe(2);
    expect(r1).toEqual({ type: AttachmentContentType.Markdown, text: 'v1' });
    expect(r2).toEqual({ type: AttachmentContentType.Markdown, text: 'v2' });
  });

  it('bypasses the cache when the metadata response has no etag field, the same as a failed call', async () => {
    let hasEtag = true;
    const mockFetch = stubDialFetch({
      metadata: () => (hasEtag ? 'etag-1' : undefined),
      contentHandler: () =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve(hasEtag ? 'v1' : 'v2'),
        }),
    });

    const att = makeRemoteAttachment('doc.md', 'files/bucket/path/doc.md');
    await resolveMarkdownCanvasContent(att, resolvers);

    hasEtag = false;
    const r2 = await resolveMarkdownCanvasContent(att, resolvers);

    expect(countContentFetches(mockFetch)).toBe(2);
    expect(r2).toEqual({ type: AttachmentContentType.Markdown, text: 'v2' });
  });

  it('does not let a late-resolving older fetch clobber a newer cache entry', async () => {
    let etag = 'etag-1';
    let resolveOldContent!: () => void;
    const oldContentGate = new Promise<void>((resolve) => {
      resolveOldContent = resolve;
    });

    const mockFetch = stubDialFetch({
      metadata: () => etag,
      contentHandler: () => {
        if (etag === 'etag-1') {
          return oldContentGate.then(() => ({
            ok: true,
            text: () => Promise.resolve('v1'),
          }));
        }
        return Promise.resolve({ ok: true, text: () => Promise.resolve('v2') });
      },
    });

    const att = makeRemoteAttachment('doc.md', 'files/bucket/path/doc.md');
    const call1 = resolveMarkdownCanvasContent(att, resolvers);

    /* Flush a macrotask so call1's metadata resolution and cache write (for
     * etag-1) complete while its content fetch stays pending on
     * `oldContentGate`. */
    await new Promise((resolve) => setTimeout(resolve, 0));

    etag = 'etag-2';
    const call2Result = await resolveMarkdownCanvasContent(att, resolvers);
    expect(call2Result).toEqual({
      type: AttachmentContentType.Markdown,
      text: 'v2',
    });

    resolveOldContent();
    const call1Result = await call1;
    expect(call1Result).toEqual({
      type: AttachmentContentType.Markdown,
      text: 'v1',
    });

    const call3Result = await resolveMarkdownCanvasContent(att, resolvers);
    expect(call3Result).toEqual({
      type: AttachmentContentType.Markdown,
      text: 'v2',
    });
    expect(countContentFetches(mockFetch)).toBe(2);
  });

  it('never calls the metadata resolver for local-File or inline-data attachments', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    await resolveMarkdownCanvasContent(
      makeLocalAttachment('readme.md', '# Local'),
      resolvers,
    );
    await resolveMarkdownCanvasContent(
      {
        id: 'stage-att',
        name: 'inline.md',
        contentType: 'text/markdown',
        type: AttachmentType.File,
        status: RequestStatus.Idle,
        data: btoa('# Inline'),
      },
      resolvers,
    );

    expect(mockFetch).not.toHaveBeenCalled();
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

  it('returns PdfCanvasContent with the raw url for a non-DIAL external PDF source', async () => {
    const result = await resolvePdfCanvasContent(
      makeRemoteAttachment(
        'citation.pdf',
        'https://example.com/citation/doc-id-123',
      ),
      resolvers,
    );
    expect(result).toEqual({
      type: AttachmentContentType.Pdf,
      url: 'https://example.com/citation/doc-id-123',
    });
  });

  it('returns PdfCanvasContent with the raw url for a blob: source', async () => {
    const result = await resolvePdfCanvasContent(
      makeRemoteAttachment('citation.pdf', 'blob:http://localhost/abc-123'),
      resolvers,
    );
    expect(result).toEqual({
      type: AttachmentContentType.Pdf,
      url: 'blob:http://localhost/abc-123',
    });
  });

  it('returns null for a non-DIAL source url with no fetchable scheme', async () => {
    const result = await resolvePdfCanvasContent(
      makeRemoteAttachment('citation.pdf', 'citation-reference-id-123'),
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

  it('returns renderer content from a local CSV file', async () => {
    const result = await resolveOoxmlCanvasContent(
      makeLocalAttachment('export.csv', 'name,total\nAlice,42'),
      resolvers,
      OoxmlFileType.Csv,
    );

    expect(result).toEqual({
      type: AttachmentContentType.Ooxml,
      url: 'blob:mock-ooxml-url',
      format: 'csv',
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

  it('returns OOXML content with the raw url for a non-DIAL external xlsx source', async () => {
    const result = await resolveOoxmlCanvasContent(
      makeRemoteAttachment(
        'budget.xlsx',
        'https://example.com/citation/budget-report',
      ),
      resolvers,
      OoxmlFileType.Xlsx,
    );
    expect(result).toEqual({
      type: AttachmentContentType.Ooxml,
      url: 'https://example.com/citation/budget-report',
      format: OoxmlFileType.Xlsx,
    });
  });

  it('returns OOXML content with the raw url for a non-DIAL external pptx source', async () => {
    const result = await resolveOoxmlCanvasContent(
      makeRemoteAttachment(
        'slides.pptx',
        'https://example.com/citation/slides-deck',
      ),
      resolvers,
      OoxmlFileType.Pptx,
    );
    expect(result).toEqual({
      type: AttachmentContentType.Ooxml,
      url: 'https://example.com/citation/slides-deck',
      format: OoxmlFileType.Pptx,
    });
  });

  it('returns null for a non-DIAL Office source url with no fetchable scheme', async () => {
    const result = await resolveOoxmlCanvasContent(
      makeRemoteAttachment('report.docx', 'citation-reference-id-456'),
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
