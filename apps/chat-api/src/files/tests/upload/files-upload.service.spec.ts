import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { type IncomingHttpHeaders, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough, Readable } from 'node:stream';
import { crc32 } from 'node:zlib';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import archiver from 'archiver';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../../config/environment.config';
import type { DialClientService } from '../../../dial/dial-client.service';
import { FilesUploadService } from '../../upload/files-upload.service';
import { UPLOAD_RESPONSE_TIMEOUT_MS } from '../../upload/upload-watchdog';

type SdkClient = {
  uploadFile: ReturnType<typeof vi.fn>;
};

function makeService(configOverrides: Record<string, unknown> = {}) {
  const configService = {
    get: vi.fn((key: string) => {
      if (key in configOverrides) return configOverrides[key];
      if (key === 'DIAL_CORE_URL') return 'http://dial-core';
      if (key === 'FILE_TRANSFER_TIMEOUT_MS') return 30_000;
      return undefined;
    }),
  } as unknown as ConfigService<EnvironmentVariables>;

  const sdkClient: SdkClient = {
    uploadFile: vi.fn(),
  };
  const fetchCore = vi.fn();

  const dialClient = {
    client: sdkClient,
    baseUrl: 'http://dial-core',
    dialApiVersion: '2024-10-21',
    fetchCore,
  } as unknown as DialClientService;

  const service = new FilesUploadService(dialClient, configService);

  return { service, sdkClient, fetchCore };
}

const readBody = async (body: unknown, delayMs = 0): Promise<Buffer> => {
  const reader = (body as ReadableStream<Uint8Array>).getReader();
  const parts: Buffer[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(Buffer.from(value));
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return Buffer.concat(parts);
};

const mockFile = { buffer: Buffer.from('hello'), mimetype: 'application/pdf' };

const withStagedFile = async <T>(
  content: Buffer,
  run: (staged: { path: string; size: number }) => Promise<T>,
): Promise<T> => {
  const directory = await mkdtemp(join(tmpdir(), 'files-upload-staged-'));
  const stagedPath = join(directory, 'staged.bin');
  await writeFile(stagedPath, content);

  try {
    return await run({ path: stagedPath, size: content.length });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

const buildZipBuffer = (
  entries: Array<{ name: string; content?: string }>,
): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const archive = archiver('zip', { store: true });
    const chunks: Buffer[] = [];
    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('error', reject);
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    for (const entry of entries) {
      archive.append(Buffer.from(entry.content ?? 'content'), {
        name: entry.name,
      });
    }
    void archive.finalize();
  });

const okFetchUpload = (): Response => new Response(null, { status: 200 });

const withArchiveFixture = async <T>(
  buffer: Buffer,
  run: (archiveFile: { path: string; size: number }) => Promise<T>,
): Promise<T> => {
  const directory = await mkdtemp(join(tmpdir(), 'files-upload-archive-'));
  const archivePath = join(directory, 'archive.zip');
  await writeFile(archivePath, buffer);

  try {
    return await run({ path: archivePath, size: buffer.length });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

/*
 * `archiver` sanitizes entry names (strips `..`/leading `/`) before writing,
 * so it cannot produce a zip-slip fixture. This hand-rolls a minimal, single
 * central-directory-record ZIP (stored/uncompressed) with an arbitrary raw
 * entry name to exercise the service's own path-safety rejection.
 */
const buildRawZipBuffer = (
  entries: Array<{ name: string; content?: string }>,
): Buffer => {
  const localEntries: Buffer[] = [];
  const centralEntries: Buffer[] = [];
  let offset = 0;

  for (const { name, content = 'content' } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const contentBuf = Buffer.from(content, 'utf8');
    const crc = crc32(contentBuf);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(contentBuf.length, 18);
    localHeader.writeUInt32LE(contentBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const localEntry = Buffer.concat([localHeader, nameBuf, contentBuf]);
    localEntries.push(localEntry);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(contentBuf.length, 20);
    centralHeader.writeUInt32LE(contentBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralEntries.push(Buffer.concat([centralHeader, nameBuf]));
    offset += localEntry.length;
  }

  const localSection = Buffer.concat(localEntries);
  const centralSection = Buffer.concat(centralEntries);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSection.length, 12);
  eocd.writeUInt32LE(localSection.length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localSection, centralSection, eocd]);
};

describe('FilesUploadService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('uploadFile', () => {
    const putCall = (fetchCore: ReturnType<typeof vi.fn>) => {
      const [url, init] = fetchCore.mock.calls[0] as [string, RequestInit];
      return { url, init, headers: init.headers as Record<string, string> };
    };

    const respondWith =
      (status: number) => async (_: string, init: unknown) => {
        await readBody((init as RequestInit).body);
        return new Response(null, { status });
      };

    const hangUntilAborted = (init: RequestInit): Promise<never> =>
      new Promise((_, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      });

    it('returns FileUploadResponseDto on success', async () => {
      const { service, fetchCore } = makeService();
      fetchCore.mockImplementation(respondWith(201));

      const result = await service.uploadFile(
        'bucket',
        'path/file.pdf',
        mockFile,
        'token',
      );
      expect(result).toEqual({ url: 'files/bucket/path/file.pdf' });
    });

    it('builds the returned file URL from bucket and path', async () => {
      const { service, fetchCore } = makeService();
      fetchCore.mockImplementation(respondWith(201));

      const result = await service.uploadFile(
        'user-bucket',
        'uploads/2026-06/IMG_4740%202.jpg',
        mockFile,
        'token',
      );

      expect(result).toEqual({
        url: 'files/user-bucket/uploads/2026-06/IMG_4740%202.jpg',
      });
      expect(putCall(fetchCore).url).toBe(
        'http://dial-core/v1/files/user-bucket/uploads/2026-06/IMG_4740%202.jpg',
      );
    });

    it('PUTs authorization and a multipart body carrying the file bytes, name and mimetype', async () => {
      const { service, fetchCore } = makeService();
      let sentBody = '';
      fetchCore.mockImplementation(async (_: string, init: RequestInit) => {
        sentBody = (await readBody(init.body)).toString();
        return new Response(null, { status: 201 });
      });

      await service.uploadFile(
        'bucket',
        'path/file.pdf',
        { ...mockFile, originalname: 'report.pdf' },
        'my-token',
      );

      const { init, headers } = putCall(fetchCore);
      expect(init.method).toBe('PUT');
      expect(headers.Authorization).toBe('Bearer my-token');
      expect(headers['Content-Type']).toMatch(
        /^multipart\/form-data; boundary=dial-upload-/,
      );
      expect(sentBody).toContain('filename="report.pdf"');
      expect(sentBody).toContain('Content-Type: application/pdf');
      expect(sentBody).toContain('hello');
    });

    it('delivers a multi-chunk file byte for byte', async () => {
      const { service, fetchCore } = makeService();
      const payload = Buffer.alloc(200_000, 'x');
      let received: Buffer = Buffer.alloc(0);
      fetchCore.mockImplementation(async (_: string, init: RequestInit) => {
        received = await readBody(init.body);
        return new Response(null, { status: 201 });
      });

      await service.uploadFile(
        'b',
        'big.bin',
        { buffer: payload, mimetype: 'application/octet-stream' },
        't',
      );

      const text = received.toString('latin1');
      expect(text.split('x').length - 1).toBe(payload.length);
    });

    it('streams a file staged on disk byte for byte', async () => {
      const { service, fetchCore } = makeService();
      const payload = Buffer.from(
        Array.from({ length: 200_000 }, (_, i) => i % 251),
      );
      let received: Buffer = Buffer.alloc(0);
      fetchCore.mockImplementation(async (_: string, init: RequestInit) => {
        received = await readBody(init.body);
        return new Response(null, { status: 201 });
      });

      await withStagedFile(payload, (staged) =>
        service.uploadFile(
          'b',
          'big.bin',
          { ...staged, mimetype: 'application/octet-stream' },
          't',
        ),
      );

      expect(received.includes(payload)).toBe(true);
    });

    const captureBodyLength = (fetchCore: ReturnType<typeof vi.fn>) => {
      const captured = { bytes: 0 };
      fetchCore.mockImplementation(async (_: string, init: RequestInit) => {
        captured.bytes = (await readBody(init.body)).length;
        return new Response(null, { status: 201 });
      });
      return captured;
    };

    it('sends a Content-Length equal to the body bytes for an in-memory file', async () => {
      const { service, fetchCore } = makeService();
      const captured = captureBodyLength(fetchCore);

      await service.uploadFile('b', 'p', mockFile, 't');

      expect(putCall(fetchCore).headers['Content-Length']).toBe(
        String(captured.bytes),
      );
    });

    it('sends a Content-Length equal to the body bytes for a disk-staged file', async () => {
      const { service, fetchCore } = makeService();
      const captured = captureBodyLength(fetchCore);

      await withStagedFile(Buffer.alloc(150_000, 'y'), (staged) =>
        service.uploadFile(
          'b',
          'p',
          { ...staged, mimetype: 'text/plain' },
          't',
        ),
      );

      expect(putCall(fetchCore).headers['Content-Length']).toBe(
        String(captured.bytes),
      );
    });

    it('maps a DIAL Core 413 to PayloadTooLargeException', async () => {
      const { service, fetchCore } = makeService();
      fetchCore.mockImplementation(respondWith(413));
      await expect(service.uploadFile('b', 'p', mockFile, 't')).rejects.toThrow(
        PayloadTooLargeException,
      );
    });

    it.each([
      [401, UnauthorizedException],
      [403, ForbiddenException],
      [500, BadGatewayException],
    ])('maps DIAL Core %i to the matching exception', async (status, error) => {
      const { service, fetchCore } = makeService();
      fetchCore.mockImplementation(respondWith(status));
      await expect(service.uploadFile('b', 'p', mockFile, 't')).rejects.toThrow(
        error,
      );
    });

    it('throws HttpException(429) on 429', async () => {
      const { service, fetchCore } = makeService();
      fetchCore.mockImplementation(respondWith(429));
      await expect(service.uploadFile('b', 'p', mockFile, 't')).rejects.toThrow(
        HttpException,
      );
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service, fetchCore } = makeService();
      fetchCore.mockRejectedValue(new TypeError('fetch failed'));
      await expect(service.uploadFile('b', 'p', mockFile, 't')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('does not send If-None-Match when uploadMode is overwrite', async () => {
      const { service, fetchCore } = makeService();
      fetchCore.mockImplementation(respondWith(201));

      await service.uploadFile('b', 'p', mockFile, 't', 'overwrite');

      expect(putCall(fetchCore).headers).not.toHaveProperty('If-None-Match');
    });

    it('does not send If-None-Match when uploadMode is omitted', async () => {
      const { service, fetchCore } = makeService();
      fetchCore.mockImplementation(respondWith(201));

      await service.uploadFile('b', 'p', mockFile, 't');

      expect(putCall(fetchCore).headers).not.toHaveProperty('If-None-Match');
    });

    it('sends If-None-Match: * when uploadMode is create-only', async () => {
      const { service, fetchCore } = makeService();
      fetchCore.mockImplementation(respondWith(201));

      await service.uploadFile('b', 'p', mockFile, 't', 'create-only');

      expect(putCall(fetchCore).headers).toMatchObject({
        'If-None-Match': '*',
      });
    });

    it('maps 412 from DIAL Core to ConflictException (409)', async () => {
      const { service, fetchCore } = makeService();
      fetchCore.mockImplementation(respondWith(412));

      const error = await service
        .uploadFile('b', 'p', mockFile, 't', 'create-only')
        .catch((err: unknown) => err);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(409);
      expect((error as HttpException).message).toBe(
        'File already exists at this path',
      );
    });

    it('streams a multi-megabyte file to a real HTTP server with the expected headers', async () => {
      const received = {
        headers: {} as IncomingHttpHeaders,
        bytes: 0,
        url: '',
      };
      const server = createServer((req, res) => {
        received.headers = req.headers;
        received.url = req.url ?? '';
        req.on('data', (chunk: Buffer) => {
          received.bytes += chunk.length;
        });
        req.on('end', () => res.writeHead(201).end());
      });
      await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve),
      );
      const { port } = server.address() as AddressInfo;

      try {
        const { service } = makeService({
          DIAL_CORE_URL: `http://127.0.0.1:${port}`,
        });
        (
          service as unknown as {
            dialClient: { baseUrl: string; fetchCore: typeof fetch };
          }
        ).dialClient.baseUrl = `http://127.0.0.1:${port}`;
        (
          service as unknown as { dialClient: { fetchCore: typeof fetch } }
        ).dialClient.fetchCore = globalThis.fetch;
        const payload = Buffer.alloc(3 * 1024 * 1024, 'x');

        const result = await service.uploadFile(
          'bucket',
          'dir/big file.csv',
          {
            buffer: payload,
            mimetype: 'text/csv',
            originalname: 'big file.csv',
          },
          'tok',
          'create-only',
        );

        expect(result).toEqual({ url: 'files/bucket/dir/big file.csv' });
        expect(received.url).toBe('/v1/files/bucket/dir/big%20file.csv');
        expect(received.headers.authorization).toBe('Bearer tok');
        expect(received.headers['if-none-match']).toBe('*');
        expect(received.headers['content-type']).toMatch(
          /^multipart\/form-data; boundary=/,
        );
        expect(received.bytes).toBeGreaterThan(payload.length);
        expect(received.bytes).toBeLessThan(payload.length + 1024);
        expect(received.headers['content-length']).toBe(String(received.bytes));
        expect(received.headers['transfer-encoding']).toBeUndefined();
      } finally {
        server.close();
      }
    });

    describe('streamed source', () => {
      const PATTERN = Buffer.from(
        Array.from({ length: 300_000 }, (_, i) => i % 251),
      );

      const streamedFile = (
        payload: Buffer,
        size: number = payload.length,
      ): { stream: Readable; size: number; mimetype: string } => ({
        stream: Readable.from(
          (function* () {
            for (let offset = 0; offset < payload.length; offset += 16_384) {
              yield payload.subarray(offset, offset + 16_384);
            }
          })(),
        ),
        size,
        mimetype: 'text/csv',
      });

      const captureBody = (fetchCore: ReturnType<typeof vi.fn>) => {
        const captured: { body: Buffer } = { body: Buffer.alloc(0) };
        fetchCore.mockImplementation(async (_: string, init: RequestInit) => {
          captured.body = await readBody(init.body);
          return new Response(null, { status: 201 });
        });
        return captured;
      };

      it('forwards a Content-Length of preamble + declared size + epilogue without chunked encoding', async () => {
        const { service, fetchCore } = makeService();
        const captured = captureBody(fetchCore);

        await service.uploadFile(
          'b',
          'reports/q3.csv',
          streamedFile(PATTERN),
          't',
        );

        const { headers } = putCall(fetchCore);
        const body = captured.body.toString('latin1');
        const boundary = headers['Content-Type'].split('boundary=')[1];
        const preamble = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="q3.csv"\r\nContent-Type: text/csv\r\n\r\n`;
        const epilogue = `\r\n--${boundary}--\r\n`;
        expect(headers['Content-Length']).toBe(
          String(preamble.length + PATTERN.length + epilogue.length),
        );
        expect(headers['Content-Length']).toBe(String(captured.body.length));
        expect(headers).not.toHaveProperty('Transfer-Encoding');
        expect(body.startsWith(preamble)).toBe(true);
        expect(body.endsWith(epilogue)).toBe(true);
      });

      it('delivers the stream bytes to the fetch body in order', async () => {
        const { service, fetchCore } = makeService();
        const captured = captureBody(fetchCore);

        await service.uploadFile('b', 'big.bin', streamedFile(PATTERN), 't');

        expect(captured.body.includes(PATTERN)).toBe(true);
      });

      it.each([
        ['ends short of', PATTERN.length + 1],
        ['runs past', PATTERN.length - 1],
      ])(
        'errors the request body when the stream %s its declared size',
        async (_label, declaredSize) => {
          const { service, fetchCore } = makeService();
          let bodyError: unknown;
          fetchCore.mockImplementation(async (_: string, init: RequestInit) => {
            bodyError = await readBody(init.body).then(
              () => undefined,
              (err: unknown) => err,
            );
            throw bodyError ?? new Error('body completed');
          });

          const error = await service
            .uploadFile(
              'b',
              'big.bin',
              streamedFile(PATTERN, declaredSize),
              't',
            )
            .catch((err: unknown) => err);

          expect((bodyError as Error).message).toMatch(/declared/);
          expect(error).toBeInstanceOf(ServiceUnavailableException);
        },
      );

      it('aborts the fetch and reports a client close when the external signal aborts', async () => {
        const { service, fetchCore } = makeService();
        const client = new AbortController();
        let fetchSignal: AbortSignal | undefined;
        fetchCore.mockImplementation(async (_: string, init: RequestInit) => {
          fetchSignal = init.signal ?? undefined;
          await (init.body as ReadableStream).getReader().read();
          const pending = hangUntilAborted(init);
          client.abort();
          return pending;
        });

        const error = await service
          .uploadFile(
            'b',
            'big.bin',
            streamedFile(PATTERN),
            't',
            undefined,
            client.signal,
          )
          .catch((err: unknown) => err);

        expect(fetchSignal?.aborted).toBe(true);
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as Error).message).toBe('The client closed the upload');
      });

      it('aborts with the stall 503 when the stream stops delivering bytes', async () => {
        const { service, fetchCore } = makeService({
          FILE_TRANSFER_TIMEOUT_MS: 100,
        });
        const stalled = new PassThrough();
        stalled.write(Buffer.alloc(1024));
        fetchCore.mockImplementation((_: string, init: RequestInit) => {
          void readBody(init.body).catch(() => undefined);
          return hangUntilAborted(init);
        });

        const error = await service
          .uploadFile(
            'b',
            'big.bin',
            { stream: stalled, size: 4096, mimetype: 'text/plain' },
            't',
          )
          .catch((err: unknown) => err);

        expect(error).toBeInstanceOf(ServiceUnavailableException);
        expect((error as Error).message).toMatch(/stalled/);
      });

      it('leaves the source stream open when DIAL Core answers before the body ends', async () => {
        const { service, fetchCore } = makeService();
        const source = new PassThrough();
        source.write(Buffer.alloc(1024));
        fetchCore.mockImplementation(async (_: string, init: RequestInit) => {
          await (init.body as ReadableStream).getReader().read();
          return new Response(null, { status: 413 });
        });

        await expect(
          service.uploadFile(
            'b',
            'big.bin',
            { stream: source, size: 4096, mimetype: 'text/plain' },
            't',
          ),
        ).rejects.toThrow(PayloadTooLargeException);
        expect(source.destroyed).toBe(false);
      });

      it.each([
        [412, ConflictException],
        [413, PayloadTooLargeException],
        [500, BadGatewayException],
        [503, BadGatewayException],
      ])(
        'maps DIAL Core %i to the matching exception',
        async (status, error) => {
          const { service, fetchCore } = makeService();
          fetchCore.mockImplementation(respondWith(status));

          await expect(
            service.uploadFile(
              'b',
              'p',
              streamedFile(PATTERN),
              't',
              'create-only',
            ),
          ).rejects.toThrow(error);
        },
      );
    });

    describe('progress-based timeouts', () => {
      const MANY_CHUNKS = Buffer.alloc(64 * 1024 * 128);

      it('completes a transfer that outlasts the idle limit while bytes keep flowing', async () => {
        const { service, fetchCore } = makeService({
          FILE_TRANSFER_TIMEOUT_MS: 150,
        });
        fetchCore.mockImplementation(async (_: string, init: RequestInit) => {
          await readBody(init.body, 8);
          return new Response(null, { status: 201 });
        });

        const startedAt = Date.now();
        const result = await service.uploadFile(
          'b',
          'big.bin',
          { buffer: MANY_CHUNKS, mimetype: 'application/octet-stream' },
          't',
        );

        expect(result).toEqual({ url: 'files/b/big.bin' });
        expect(Date.now() - startedAt).toBeGreaterThan(300);
      });

      it('aborts with a clear 503 when no data moves for the idle limit', async () => {
        const { service, fetchCore } = makeService({
          FILE_TRANSFER_TIMEOUT_MS: 100,
        });
        fetchCore.mockImplementation(async (_: string, init: RequestInit) => {
          const reader = (init.body as ReadableStream).getReader();
          await reader.read();
          return hangUntilAborted(init);
        });

        const error = await service
          .uploadFile(
            'b',
            'big.bin',
            { buffer: MANY_CHUNKS, mimetype: 'application/octet-stream' },
            't',
          )
          .catch((err: unknown) => err);

        expect(error).toBeInstanceOf(ServiceUnavailableException);
        expect((error as Error).message).toMatch(/stalled/);
        expect((error as Error).message).not.toMatch(/unreachable/);
      });

      it('aborts with a clear 503 when DIAL Core does not answer after the last byte', async () => {
        vi.useFakeTimers();
        try {
          const { service, fetchCore } = makeService();
          fetchCore.mockImplementation(async (_: string, init: RequestInit) => {
            await readBody(init.body);
            return hangUntilAborted(init);
          });

          const result = service
            .uploadFile('b', 'p', mockFile, 't')
            .catch((err: unknown) => err);
          await vi.advanceTimersByTimeAsync(UPLOAD_RESPONSE_TIMEOUT_MS);
          const error = await result;

          expect(error).toBeInstanceOf(ServiceUnavailableException);
          expect((error as Error).message).toMatch(/did not respond/);
        } finally {
          vi.useRealTimers();
        }
      });
    });
  });

  describe('resolveArchiveEntryPath', () => {
    it('rejects a parent-directory traversal segment', () => {
      const { service } = makeService();
      expect(service.resolveArchiveEntryPath('../../etc/passwd')).toEqual({
        isDirectory: false,
        safeRelativePath: null,
      });
    });

    it('rejects an absolute path', () => {
      const { service } = makeService();
      expect(service.resolveArchiveEntryPath('/etc/passwd')).toEqual({
        isDirectory: false,
        safeRelativePath: null,
      });
    });

    it('rejects a Windows drive-letter absolute path', () => {
      const { service } = makeService();
      expect(
        service.resolveArchiveEntryPath('C:\\Windows\\System32\\config'),
      ).toEqual({
        isDirectory: false,
        safeRelativePath: null,
      });
    });

    it('accepts a valid nested relative path', () => {
      const { service } = makeService();
      expect(service.resolveArchiveEntryPath('reports/2026/q1.pdf')).toEqual({
        isDirectory: false,
        safeRelativePath: 'reports/2026/q1.pdf',
      });
    });

    it('identifies directory entries for silent skipping', () => {
      const { service } = makeService();
      expect(service.resolveArchiveEntryPath('reports/')).toEqual({
        isDirectory: true,
        safeRelativePath: null,
      });
    });

    it('rejects a blank (non-directory) entry name', () => {
      const { service } = makeService();
      expect(service.resolveArchiveEntryPath('')).toEqual({
        isDirectory: false,
        safeRelativePath: null,
      });
    });

    it('rejects a bare parent-directory entry name', () => {
      const { service } = makeService();
      expect(service.resolveArchiveEntryPath('..')).toEqual({
        isDirectory: false,
        safeRelativePath: null,
      });
    });

    it('rejects a single-dot segment (current-directory alias)', () => {
      const { service } = makeService();
      expect(service.resolveArchiveEntryPath('a/./b')).toEqual({
        isDirectory: false,
        safeRelativePath: null,
      });
      expect(service.resolveArchiveEntryPath('.')).toEqual({
        isDirectory: false,
        safeRelativePath: null,
      });
    });
  });

  describe('uploadArchive', () => {
    it('uploads all entries successfully', async () => {
      const { service, fetchCore } = makeService();
      fetchCore.mockResolvedValue(okFetchUpload());
      const buffer = await buildZipBuffer([
        { name: 'a.txt' },
        { name: 'b.txt' },
      ]);

      const result = await withArchiveFixture(buffer, (archiveFile) =>
        service.uploadArchive('bucket', 'reports', archiveFile, 'token'),
      );

      expect(result.results).toEqual([
        { path: 'reports/a.txt', success: true },
        { path: 'reports/b.txt', success: true },
      ]);
      expect(fetchCore).toHaveBeenCalledTimes(2);
      expect(fetchCore.mock.calls[0]?.[0]).toBe(
        'http://dial-core/v1/files/bucket/reports/a.txt',
      );
      const [, init] = fetchCore.mock.calls[0] as [string, RequestInit];
      expect(init).toMatchObject({
        method: 'PUT',
        duplex: 'half',
      });
      expect(init.headers).toMatchObject({
        Authorization: 'Bearer token',
        'If-None-Match': '*',
      });
      expect((init.headers as Record<string, string>)['Content-Type']).toMatch(
        /^multipart\/form-data; boundary=dial-upload-/,
      );
    });

    it('sends each archive entry with a Content-Length equal to its body bytes', async () => {
      const { service, fetchCore } = makeService();
      const sent: Array<{ header: string; bytes: number }> = [];
      fetchCore.mockImplementation(async (_: string, init: RequestInit) => {
        const bytes = (await readBody(init.body)).length;
        sent.push({
          header: (init.headers as Record<string, string>)['Content-Length'],
          bytes,
        });
        return okFetchUpload();
      });
      const buffer = await buildZipBuffer([
        { name: 'a.txt', content: 'short' },
        { name: 'b.txt', content: 'a somewhat longer entry body' },
      ]);

      await withArchiveFixture(buffer, (archiveFile) =>
        service.uploadArchive('bucket', 'reports', archiveFile, 'token'),
      );

      expect(sent).toHaveLength(2);
      for (const { header, bytes } of sent) {
        expect(header).toBe(String(bytes));
      }
    });

    it('returns an empty results array for an empty archive', async () => {
      const { service } = makeService();
      const buffer = await buildZipBuffer([]);

      const result = await withArchiveFixture(buffer, (archiveFile) =>
        service.uploadArchive('bucket', 'reports', archiveFile, 'token'),
      );

      expect(result.results).toEqual([]);
    });

    it('uploads archive entries to the bucket root when destination is empty', async () => {
      const { service, fetchCore } = makeService();
      fetchCore.mockResolvedValue(okFetchUpload());
      const buffer = await buildZipBuffer([{ name: 'a.txt' }]);

      const result = await withArchiveFixture(buffer, (archiveFile) =>
        service.uploadArchive('bucket', '', archiveFile, 'token'),
      );

      expect(result.results).toEqual([{ path: 'a.txt', success: true }]);
      expect(fetchCore.mock.calls[0]?.[0]).toBe(
        'http://dial-core/v1/files/bucket/a.txt',
      );
    });

    it('throws a validation error for a non-ZIP buffer', async () => {
      const { service } = makeService();
      const buffer = Buffer.from('not a zip file');

      await withArchiveFixture(buffer, async (archiveFile) => {
        await expect(
          service.uploadArchive('bucket', 'reports', archiveFile, 'token'),
        ).rejects.toThrow(BadRequestException);
      });
    });

    it('rejects with 422 and zero uploads when the archive exceeds the file-count limit', async () => {
      const { service, fetchCore } = makeService({
        ARCHIVE_UPLOAD_MAX_FILES: 1,
      });
      fetchCore.mockResolvedValue(okFetchUpload());
      const buffer = await buildZipBuffer([
        { name: 'a.txt' },
        { name: 'b.txt' },
      ]);

      await withArchiveFixture(buffer, async (archiveFile) => {
        await expect(
          service.uploadArchive('bucket', 'reports', archiveFile, 'token'),
        ).rejects.toThrow(UnprocessableEntityException);
      });
      expect(fetchCore).toHaveBeenCalledTimes(0);
    });

    it('aborts mid-extraction once cumulative uncompressed bytes exceed the limit, retaining prior successful uploads', async () => {
      const { service, fetchCore } = makeService({
        ARCHIVE_UPLOAD_MAX_UNCOMPRESSED_BYTES: 10,
      });
      fetchCore.mockResolvedValue(okFetchUpload());
      const buffer = await buildZipBuffer([
        { name: 'small.txt', content: 'a'.repeat(5) },
        { name: 'big.txt', content: 'b'.repeat(50) },
      ]);

      await withArchiveFixture(buffer, async (archiveFile) => {
        await expect(
          service.uploadArchive('bucket', 'reports', archiveFile, 'token'),
        ).rejects.toThrow(UnprocessableEntityException);
      });
      expect(fetchCore).toHaveBeenCalledTimes(1);
      expect(fetchCore.mock.calls[0]?.[0]).toBe(
        'http://dial-core/v1/files/bucket/reports/small.txt',
      );
    });

    it('uploads a conflicting entry with a deduplicated file name', async () => {
      const { service, fetchCore } = makeService();
      fetchCore
        .mockResolvedValueOnce(new Response(null, { status: 412 }))
        .mockResolvedValueOnce(okFetchUpload())
        .mockResolvedValueOnce(okFetchUpload());
      const buffer = await buildZipBuffer([
        { name: 'a.txt' },
        { name: 'b.txt' },
      ]);

      const result = await withArchiveFixture(buffer, (archiveFile) =>
        service.uploadArchive('bucket', 'reports', archiveFile, 'token'),
      );

      expect(result.results).toEqual([
        { path: 'reports/a (1).txt', success: true },
        { path: 'reports/b.txt', success: true },
      ]);
      expect(fetchCore).toHaveBeenCalledTimes(3);
      expect(fetchCore.mock.calls[1]?.[0]).toBe(
        'http://dial-core/v1/files/bucket/reports/a%20(1).txt',
      );
    });

    it('increments the deduplicated file name until upload succeeds', async () => {
      const { service, fetchCore } = makeService();
      fetchCore
        .mockResolvedValueOnce(new Response(null, { status: 412 }))
        .mockResolvedValueOnce(new Response(null, { status: 412 }))
        .mockResolvedValueOnce(okFetchUpload());
      const buffer = await buildZipBuffer([{ name: 'a.txt' }]);

      const result = await withArchiveFixture(buffer, (archiveFile) =>
        service.uploadArchive('bucket', 'reports', archiveFile, 'token'),
      );

      expect(result.results).toEqual([
        { path: 'reports/a (2).txt', success: true },
      ]);
      expect(fetchCore).toHaveBeenCalledTimes(3);
      expect(fetchCore.mock.calls[2]?.[0]).toBe(
        'http://dial-core/v1/files/bucket/reports/a%20(2).txt',
      );
    });

    it('rejects path-traversal entries without attempting to upload them', async () => {
      const { service, fetchCore } = makeService();
      fetchCore.mockResolvedValue(okFetchUpload());
      const buffer = buildRawZipBuffer([
        { name: '../../etc/passwd' },
        { name: 'safe.txt' },
      ]);

      const result = await withArchiveFixture(buffer, (archiveFile) =>
        service.uploadArchive('bucket', 'reports', archiveFile, 'token'),
      );

      expect(result.results).toEqual([
        { path: '../../etc/passwd', success: false, error: 'Invalid path' },
        { path: 'reports/safe.txt', success: true },
      ]);
      expect(fetchCore).toHaveBeenCalledTimes(1);
    });

    it('throws ServiceUnavailableException and stops scheduling uploads when the timeout is exceeded', async () => {
      const { service, fetchCore } = makeService({
        ARCHIVE_UPLOAD_TIMEOUT_MS: 250,
      });
      fetchCore.mockImplementation(
        (_input, init) =>
          new Promise<Response>((resolve, reject) => {
            const signal = (init as RequestInit | undefined)?.signal;
            signal?.addEventListener(
              'abort',
              () => {
                reject(
                  Object.assign(new Error('Aborted'), {
                    name: 'AbortError',
                  }),
                );
              },
              { once: true },
            );
            setTimeout(() => resolve(okFetchUpload()), 1_000);
          }),
      );
      const buffer = await buildZipBuffer([
        { name: 'a.txt' },
        { name: 'b.txt' },
      ]);

      await withArchiveFixture(buffer, async (archiveFile) => {
        await expect(
          service.uploadArchive('bucket', 'reports', archiveFile, 'token'),
        ).rejects.toThrow(ServiceUnavailableException);
      });
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(fetchCore).toHaveBeenCalledTimes(1);
    });

    it('throws ServiceUnavailableException when the final entry upload times out', async () => {
      const { service, fetchCore } = makeService({
        ARCHIVE_UPLOAD_TIMEOUT_MS: 250,
      });
      fetchCore.mockImplementation(
        (_input, init) =>
          new Promise<Response>((resolve, reject) => {
            const signal = (init as RequestInit | undefined)?.signal;
            signal?.addEventListener(
              'abort',
              () => {
                reject(
                  Object.assign(new Error('Aborted'), {
                    name: 'AbortError',
                  }),
                );
              },
              { once: true },
            );
            setTimeout(() => resolve(okFetchUpload()), 1_000);
          }),
      );
      const buffer = await buildZipBuffer([{ name: 'only.txt' }]);

      await withArchiveFixture(buffer, async (archiveFile) => {
        await expect(
          service.uploadArchive('bucket', 'reports', archiveFile, 'token'),
        ).rejects.toThrow(ServiceUnavailableException);
      });
      expect(fetchCore).toHaveBeenCalledTimes(1);
    });
  });
});
