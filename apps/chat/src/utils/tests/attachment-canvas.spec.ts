import {
  AttachmentContentType,
  AttachmentErrorType,
} from '@epam/ai-dial-attachment-canvas';
import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';
import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  referenceAttachmentToPdfCanvasContent,
  resolveImageCanvasContent,
  resolveJsonCanvasContent,
  resolveMarkdownCanvasContent,
  resolvePdfCanvasContent,
} from '../attachment-canvas';

vi.mock('../dial-file', () => {
  const resolveDialFileDownloadUrl = (url: string) =>
    url.startsWith('files/bucket/')
      ? `/download?path=${url.slice('files/bucket/'.length)}`
      : undefined;
  return {
    isDialFileId: (url: string) => url.startsWith('files/'),
    resolveDialFileDownloadUrl,
    resolveDialUrl: (attachment: { url?: string; referenceUrl?: string }) => {
      if (attachment.url != null)
        return resolveDialFileDownloadUrl(attachment.url);
      if (attachment.referenceUrl != null)
        return resolveDialFileDownloadUrl(attachment.referenceUrl);
      return undefined;
    },
  };
});

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
  });

  it('returns MarkdownCanvasContent from inline base64 data', async () => {
    const result = await resolveMarkdownCanvasContent({
      id: 'stage-att',
      name: '[1] report.pdf',
      contentType: 'text/markdown',
      type: AttachmentType.File,
      status: RequestStatus.Idle,
      data: btoa('# Hello from stage'),
    });
    expect(result).toEqual({
      type: AttachmentContentType.Markdown,
      text: '# Hello from stage',
    });
  });

  it('falls back to raw text when inline data is not valid base64', async () => {
    const result = await resolveMarkdownCanvasContent({
      id: 'stage-att',
      name: 'ocr-page.md',
      contentType: 'text/markdown',
      type: AttachmentType.File,
      status: RequestStatus.Idle,
      data: '# Résumé — café',
    });
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
  });

  it('returns JsonCanvasContent from inline base64 data', async () => {
    const result = await resolveJsonCanvasContent({
      id: 'stage-att',
      name: '[1] report.pdf',
      contentType: 'application/json',
      type: AttachmentType.File,
      status: RequestStatus.Idle,
      data: btoa('{"stage":true}'),
    });
    expect(result).toEqual({
      type: AttachmentContentType.Json,
      value: { stage: true },
    });
  });

  it('falls back to PlainTextCanvasContent when inline data is invalid JSON', async () => {
    const result = await resolveJsonCanvasContent({
      id: 'stage-att',
      name: '[1] report.pdf',
      contentType: 'application/json',
      type: AttachmentType.File,
      status: RequestStatus.Idle,
      data: btoa('not valid json'),
    });
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
      referenceAttachmentToPdfCanvasContent({
        type: 'text/markdown',
        url: 'https://example.com/redirect/abc',
      }),
    ).toBeNull();
  });

  it('builds a PDF canvas payload with a page-scoped invisible highlight', () => {
    const result = referenceAttachmentToPdfCanvasContent({
      type: 'text/markdown',
      url: 'files/bucket/uploads/report%20(3).pdf#page=81',
    });

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
    const result = referenceAttachmentToPdfCanvasContent({
      type: 'text/markdown',
      url: 'files/bucket/report.pdf',
    });

    expect(result).toEqual({
      type: AttachmentContentType.Pdf,
      url: '/download?path=report.pdf',
    });
  });

  it('produces a distinct highlight id per page, so re-opening at a different page re-triggers scroll', () => {
    const page5 = referenceAttachmentToPdfCanvasContent({
      type: 'text/markdown',
      url: 'files/bucket/report.pdf#page=5',
    });
    const page19 = referenceAttachmentToPdfCanvasContent({
      type: 'text/markdown',
      url: 'files/bucket/report.pdf#page=19',
    });

    expect(page5?.selectedHighlightId).not.toBe(page19?.selectedHighlightId);
  });
});

describe('resolveImageCanvasContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-image-url');
  });

  it('returns ImageCanvasContent from a data: previewUrl', async () => {
    const result = await resolveImageCanvasContent({
      id: 'stage-att',
      name: 'Annotated page #1',
      contentType: 'image/jpeg',
      type: AttachmentType.Image,
      status: RequestStatus.Idle,
      previewUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJ',
    });
    expect(result).toEqual({
      type: AttachmentContentType.Image,
      url: 'data:image/jpeg;base64,/9j/4AAQSkZJ',
    });
  });

  it('returns ImageCanvasContent from inline base64 data via a Blob URL', async () => {
    const result = await resolveImageCanvasContent({
      id: 'stage-att',
      name: 'Annotated page #1',
      contentType: 'image/jpeg',
      type: AttachmentType.Image,
      status: RequestStatus.Idle,
      data: btoa('binary-image-bytes'),
    });
    expect(result).toEqual({
      type: AttachmentContentType.Image,
      url: 'blob:mock-image-url',
    });
  });

  it('returns null when no source is available', async () => {
    const result = await resolveImageCanvasContent({
      id: 'stage-att',
      name: 'Annotated page #1',
      contentType: 'image/jpeg',
      type: AttachmentType.Image,
      status: RequestStatus.Idle,
    });
    expect(result).toBeNull();
  });

  it('returns ImageCanvasContent via a Blob URL for a successful DIAL fetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(['bytes'])),
      }),
    );
    const result = await resolveImageCanvasContent({
      id: 'photo.jpg',
      name: 'photo.jpg',
      contentType: 'image/jpeg',
      type: AttachmentType.Image,
      status: RequestStatus.Idle,
      url: 'files/bucket/path/photo.jpg',
    } as DisplayAttachment);
    expect(result).toEqual({
      type: AttachmentContentType.Image,
      url: 'blob:mock-image-url',
    });
  });

  it('returns a Forbidden error content when the DIAL fetch is a 403', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 403 }),
    );
    const result = await resolveImageCanvasContent({
      id: 'photo.jpg',
      name: 'photo.jpg',
      contentType: 'image/jpeg',
      type: AttachmentType.Image,
      status: RequestStatus.Idle,
      url: 'files/bucket/path/photo.jpg',
    } as DisplayAttachment);
    expect(result).toEqual({
      type: AttachmentContentType.Error,
      errorType: AttachmentErrorType.Forbidden,
      url: '/download?path=path/photo.jpg',
    });
  });
});

describe('resolvePdfCanvasContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-pdf-url');
  });

  it('returns PdfCanvasContent from inline base64 data via a Blob URL', async () => {
    const result = await resolvePdfCanvasContent({
      id: 'stage-att',
      name: 'doc.pdf',
      contentType: 'application/pdf',
      type: AttachmentType.File,
      status: RequestStatus.Idle,
      data: btoa('%PDF-1.4'),
    });
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
    );
    expect(result).toEqual({
      type: AttachmentContentType.Error,
      errorType: AttachmentErrorType.LoadFailed,
      url: '/download?path=path/doc.pdf',
    });
  });

  it('returns null when no source is available', async () => {
    const result = await resolvePdfCanvasContent({
      id: 'stage-att',
      name: 'doc.pdf',
      contentType: 'application/pdf',
      type: AttachmentType.File,
      status: RequestStatus.Idle,
    });
    expect(result).toBeNull();
  });
});
