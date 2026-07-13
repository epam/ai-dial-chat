import { AttachmentContentType } from '@epam/ai-dial-attachment-canvas';
import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';
import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
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

  it('returns null when the remote response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const result = await resolveMarkdownCanvasContent(
      makeRemoteAttachment('readme.md', 'files/bucket/path/readme.md'),
    );
    expect(result).toBeNull();
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

  it('returns null when the remote response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const result = await resolveJsonCanvasContent(
      makeRemoteAttachment('data.json', 'files/bucket/path/data.json'),
    );
    expect(result).toBeNull();
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
});

describe('resolvePdfCanvasContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-pdf-url');
  });

  it('returns PdfCanvasContent from inline base64 data via a Blob URL', () => {
    const result = resolvePdfCanvasContent({
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

  it('returns PdfCanvasContent for a DIAL file url', () => {
    const result = resolvePdfCanvasContent(
      makeRemoteAttachment('doc.pdf', 'files/bucket/path/doc.pdf'),
    );
    expect(result).toEqual({
      type: AttachmentContentType.Pdf,
      url: '/download?path=path/doc.pdf',
    });
  });

  it('returns null when no source is available', () => {
    const result = resolvePdfCanvasContent({
      id: 'stage-att',
      name: 'doc.pdf',
      contentType: 'application/pdf',
      type: AttachmentType.File,
      status: RequestStatus.Idle,
    });
    expect(result).toBeNull();
  });
});
