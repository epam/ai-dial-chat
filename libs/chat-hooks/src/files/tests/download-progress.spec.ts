import { describe, expect, it, vi } from 'vitest';
import {
  createDownloadResponseError,
  estimateArchiveSize,
  getContentLength,
  getDownloadPercent,
  withDownloadProgress,
} from '../download-progress';

const streamOf = (...chunks: number[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const size of chunks) controller.enqueue(new Uint8Array(size));
      controller.close();
    },
  });

describe('withDownloadProgress', () => {
  it('reports the running byte total and passes every byte through', async () => {
    const onBytes = vi.fn();
    const wrapped = withDownloadProgress(
      new Response(streamOf(3, 4, 5)),
      onBytes,
    );

    const body = new Uint8Array(await wrapped.arrayBuffer());

    expect(body.byteLength).toBe(12);
    expect(onBytes.mock.calls.map(([received]) => received)).toEqual([
      3, 7, 12,
    ]);
  });

  it('keeps the headers and status, so the saved name still resolves', () => {
    const response = new Response(streamOf(1), {
      status: 200,
      headers: {
        'content-disposition': 'attachment; filename="report.pdf"',
        'content-length': '1',
      },
    });

    const wrapped = withDownloadProgress(response, vi.fn());

    expect(wrapped.status).toBe(200);
    expect(wrapped.headers.get('content-disposition')).toBe(
      'attachment; filename="report.pdf"',
    );
  });

  it('returns a response without a body unchanged', () => {
    const response = new Response(null, { status: 204 });

    expect(withDownloadProgress(response, vi.fn())).toBe(response);
  });
});

describe('getContentLength', () => {
  it('reads a positive Content-Length', () => {
    const response = new Response('x', { headers: { 'content-length': '42' } });

    expect(getContentLength(response)).toBe(42);
  });

  it('is undefined when the header is missing or not positive', () => {
    expect(getContentLength(new Response(streamOf(1)))).toBeUndefined();
    expect(
      getContentLength(
        new Response('', { headers: { 'content-length': '0' } }),
      ),
    ).toBeUndefined();
  });
});

describe('getDownloadPercent', () => {
  it('is the rounded share of a known total', () => {
    expect(getDownloadPercent(5, 10, false)).toBe(50);
    expect(getDownloadPercent(10, 10, false)).toBe(100);
  });

  it('caps an estimated total at 99', () => {
    expect(getDownloadPercent(12, 10, true)).toBe(99);
  });

  it('is undefined without a total', () => {
    expect(getDownloadPercent(5, undefined, false)).toBeUndefined();
  });
});

describe('createDownloadResponseError', () => {
  it('keeps the response, so its status can be read', () => {
    const response = new Response('', { status: 413 });

    const error = createDownloadResponseError(response) as Error & {
      response: Response;
    };

    expect(error.response).toBe(response);
    expect(error.message).toContain('413');
  });
});

describe('estimateArchiveSize', () => {
  it('sums the sizes of a selection of sized files', () => {
    expect(
      estimateArchiveSize([
        { isFolder: false, contentLength: 1024 },
        { isFolder: false, contentLength: 2048 },
      ]),
    ).toBe(3072);
  });

  it('gives no estimate when the selection has a folder or an unsized file', () => {
    expect(
      estimateArchiveSize([
        { isFolder: false, contentLength: 1024 },
        { isFolder: true },
      ]),
    ).toBeUndefined();
    expect(estimateArchiveSize([{ isFolder: false }])).toBeUndefined();
  });
});
