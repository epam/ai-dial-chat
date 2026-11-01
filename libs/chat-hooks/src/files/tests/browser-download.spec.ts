import { triggerBlobDownload } from '@epam/ai-dial-chat-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { triggerBrowserDownload } from '../browser-download';
import { DownloadDestinationType } from '../download-destination';
import { prepareDownloadDestination } from '../prepare-download-destination';

vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-chat-shared')>()),
  triggerBlobDownload: vi.fn(),
}));

describe('file download streaming', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'showSaveFilePicker');
    vi.restoreAllMocks();
  });

  it.each([
    ['attachment; filename="plain.csv"; filename*=UTF-8\'\'%ZZ', 'plain.csv'],
    ["attachment; filename*=UTF-8''%ZZ", 'fallback.csv'],
    ["attachment; filename*=UTF-8''folder%2Freport.csv", 'folderreport.csv'],
    ['attachment; filename="folder/report.csv"', 'folderreport.csv'],
  ])('sanitizes or falls back for %s', async (header, expected) => {
    expect(
      await triggerBrowserDownload(
        new Response('', {
          headers: { 'Content-Disposition': header },
        }),
        'fallback.csv',
      ),
    ).toBe(expected);
  });

  it('does not consume the response when the destination was cancelled', async () => {
    const response = new Response('bytes');
    const read = vi.spyOn(response, 'blob');
    expect(
      await triggerBrowserDownload(response, 'fallback', {
        type: DownloadDestinationType.Cancelled,
      }),
    ).toBe('fallback');
    expect(read).not.toHaveBeenCalled();
    expect(response.bodyUsed).toBe(false);
  });

  it('aborts the writable when the response has no body', async () => {
    const abort = vi.fn();
    await expect(
      triggerBrowserDownload(new Response(null), 'fallback', {
        type: DownloadDestinationType.Stream,
        writable: new WritableStream({ abort }),
      }),
    ).rejects.toThrow('Response has no readable stream');
    expect(abort).toHaveBeenCalledWith('Response has no readable stream');
  });

  it('propagates a failed stream and aborts its destination', async () => {
    const failure = new Error('read failed');
    const abort = vi.fn();
    const body = new ReadableStream({
      start(controller) {
        controller.error(failure);
      },
    });
    await expect(
      triggerBrowserDownload(new Response(body), 'fallback', {
        type: DownloadDestinationType.Stream,
        writable: new WritableStream({ abort }),
      }),
    ).rejects.toBe(failure);
    expect(abort).toHaveBeenCalledWith(failure);
  });

  it('pipes the response body directly to the selected file', async () => {
    const chunks: Uint8Array[] = [];
    const writable = new WritableStream<Uint8Array>({
      write(chunk) {
        chunks.push(chunk);
      },
    });
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: vi.fn().mockResolvedValue({
        createWritable: vi.fn().mockResolvedValue(writable),
      }),
    });

    const destination = await prepareDownloadDestination(
      'reports.zip',
      'application/zip',
    );
    const blobSpy = vi.spyOn(Response.prototype, 'blob');

    await triggerBrowserDownload(
      new Response('streamed archive'),
      'reports.zip',
      destination,
    );

    expect(destination.type).toBe(DownloadDestinationType.Stream);
    expect(blobSpy).not.toHaveBeenCalled();
    expect(new TextDecoder().decode(chunks[0])).toBe('streamed archive');
  });

  it('uses the server-provided Content-Disposition filename when present', async () => {
    vi.mocked(triggerBlobDownload).mockClear();
    const response = new Response('zip-bytes', {
      headers: {
        'Content-Disposition': 'attachment; filename="custom-name.zip"',
      },
    });

    const savedName = await triggerBrowserDownload(response, 'fallback.zip');

    expect(savedName).toBe('custom-name.zip');
    expect(triggerBlobDownload).toHaveBeenCalledWith(
      expect.anything(),
      'custom-name.zip',
    );
  });

  it('prefers the RFC 5987 UTF-8 filename over the ASCII fallback', async () => {
    vi.mocked(triggerBlobDownload).mockClear();
    const response = new Response('bytes', {
      headers: {
        'Content-Disposition': `attachment; filename="_____.csv"; filename*=UTF-8''${encodeURIComponent('отчёт.csv')}`,
      },
    });

    const savedName = await triggerBrowserDownload(response, 'fallback.csv');

    expect(savedName).toBe('отчёт.csv');
  });

  it('resolves the fallback filename when the response carries no Content-Disposition', async () => {
    vi.mocked(triggerBlobDownload).mockClear();
    const response = new Response('');

    const savedName = await triggerBrowserDownload(response, 'fallback.zip');

    expect(savedName).toBe('fallback.zip');
    expect(triggerBlobDownload).toHaveBeenCalledWith(
      expect.anything(),
      'fallback.zip',
    );
  });
});
