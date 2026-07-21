import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32 } from 'node:zlib';
import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  HttpException,
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

  const dialClient = {
    client: sdkClient,
    baseUrl: 'http://dial-core',
    dialApiVersion: '2024-10-21',
  } as unknown as DialClientService;

  const service = new FilesUploadService(dialClient, configService);

  return { service, sdkClient };
}

const okUpload = (url: string) => ({
  error: undefined,
  response: { status: 200, headers: { get: () => null } },
  data: { url },
});

const errResponse = (status: number) => ({
  error: new Error('HTTP error'),
  response: { status, headers: { get: () => null } },
  data: undefined,
});

const mockFile = { buffer: Buffer.from('hello'), mimetype: 'application/pdf' };

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
    it('returns FileUploadResponseDto on success', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.uploadFile.mockResolvedValue(okUpload('bucket/path/file.pdf'));

      const result = await service.uploadFile(
        'bucket',
        'path/file.pdf',
        mockFile,
        'token',
      );
      expect(result).toEqual({ url: 'files/bucket/path/file.pdf' });
    });

    it('builds the returned file URL from bucket and path', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.uploadFile.mockResolvedValue(okUpload('ignored-upstream-url'));

      const result = await service.uploadFile(
        'user-bucket',
        'uploads/2026-06/IMG_4740%202.jpg',
        mockFile,
        'token',
      );

      expect(result).toEqual({
        url: 'files/user-bucket/uploads/2026-06/IMG_4740%202.jpg',
      });
    });

    it('calls SDK with bucket, path, authorization and multipart form data', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.uploadFile.mockResolvedValue(
        okUpload('files/bucket/path/file.pdf'),
      );

      await service.uploadFile('bucket', 'path/file.pdf', mockFile, 'my-token');
      expect(sdkClient.uploadFile).toHaveBeenCalledWith(
        'bucket',
        'path/file.pdf',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
          body: expect.any(FormData),
        }),
      );
      expect(sdkClient.uploadFile.mock.calls[0][2].headers).not.toHaveProperty(
        'Content-Type',
      );
    });

    it('throws UnauthorizedException on 401', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.uploadFile.mockResolvedValue(errResponse(401));
      await expect(service.uploadFile('b', 'p', mockFile, 't')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws ForbiddenException on 403', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.uploadFile.mockResolvedValue(errResponse(403));
      await expect(service.uploadFile('b', 'p', mockFile, 't')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws HttpException(429) on 429', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.uploadFile.mockResolvedValue(errResponse(429));
      await expect(service.uploadFile('b', 'p', mockFile, 't')).rejects.toThrow(
        HttpException,
      );
    });

    it('throws BadGatewayException on 5xx', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.uploadFile.mockResolvedValue(errResponse(500));
      await expect(service.uploadFile('b', 'p', mockFile, 't')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.uploadFile.mockRejectedValue(new TypeError('fetch failed'));
      await expect(service.uploadFile('b', 'p', mockFile, 't')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('throws ServiceUnavailableException on timeout', async () => {
      const { service, sdkClient } = makeService();
      const timeoutErr = Object.assign(new Error('The operation was aborted'), {
        name: 'TimeoutError',
      });
      sdkClient.uploadFile.mockRejectedValue(timeoutErr);
      await expect(service.uploadFile('b', 'p', mockFile, 't')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('does not send If-None-Match when uploadMode is overwrite', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.uploadFile.mockResolvedValue(okUpload('bucket/path/file.pdf'));

      await service.uploadFile(
        'bucket',
        'path/file.pdf',
        mockFile,
        'token',
        'overwrite',
      );

      expect(sdkClient.uploadFile.mock.calls[0][2].headers).not.toHaveProperty(
        'If-None-Match',
      );
    });

    it('sends If-None-Match: * when uploadMode is create-only', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.uploadFile.mockResolvedValue(okUpload('bucket/path/file.pdf'));

      await service.uploadFile(
        'bucket',
        'path/file.pdf',
        mockFile,
        'token',
        'create-only',
      );

      expect(sdkClient.uploadFile.mock.calls[0][2].headers).toMatchObject({
        'If-None-Match': '*',
      });
    });

    it('maps 412 from DIAL Core to ConflictException (409)', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.uploadFile.mockResolvedValue(errResponse(412));

      await expect(
        service.uploadFile('b', 'p', mockFile, 't', 'create-only'),
      ).rejects.toThrow(HttpException);

      try {
        await service.uploadFile('b', 'p', mockFile, 't', 'create-only');
      } catch (err) {
        expect((err as HttpException).getStatus()).toBe(409);
        expect((err as HttpException).message).toBe(
          'File already exists at this path',
        );
      }
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
  });

  describe('uploadArchive', () => {
    it('uploads all entries successfully', async () => {
      const { service } = makeService();
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(okFetchUpload());
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
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(fetchSpy.mock.calls[0]?.[0]).toBe(
        'http://dial-core/v1/files/bucket/reports/a.txt',
      );
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
      const { service } = makeService();
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(okFetchUpload());
      const buffer = await buildZipBuffer([{ name: 'a.txt' }]);

      const result = await withArchiveFixture(buffer, (archiveFile) =>
        service.uploadArchive('bucket', '', archiveFile, 'token'),
      );

      expect(result.results).toEqual([{ path: 'a.txt', success: true }]);
      expect(fetchSpy.mock.calls[0]?.[0]).toBe(
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

    it('aborts once the entry-count limit is exceeded, with zero uploads attempted after the limit', async () => {
      const { service } = makeService({
        ARCHIVE_UPLOAD_MAX_FILES: 1,
      });
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(okFetchUpload());
      const buffer = await buildZipBuffer([
        { name: 'a.txt' },
        { name: 'b.txt' },
      ]);

      await withArchiveFixture(buffer, async (archiveFile) => {
        await expect(
          service.uploadArchive('bucket', 'reports', archiveFile, 'token'),
        ).rejects.toThrow(UnprocessableEntityException);
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('aborts mid-extraction once cumulative uncompressed bytes exceed the limit, retaining prior successful uploads', async () => {
      const { service } = makeService({
        ARCHIVE_UPLOAD_MAX_UNCOMPRESSED_BYTES: 10,
      });
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(okFetchUpload());
      const buffer = await buildZipBuffer([
        { name: 'small.txt', content: 'a'.repeat(5) },
        { name: 'big.txt', content: 'b'.repeat(50) },
      ]);

      await withArchiveFixture(buffer, async (archiveFile) => {
        await expect(
          service.uploadArchive('bucket', 'reports', archiveFile, 'token'),
        ).rejects.toThrow(UnprocessableEntityException);
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0]?.[0]).toBe(
        'http://dial-core/v1/files/bucket/reports/small.txt',
      );
    });

    it('uploads a conflicting entry with a deduplicated file name', async () => {
      const { service } = makeService();
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
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
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(fetchSpy.mock.calls[1]?.[0]).toBe(
        'http://dial-core/v1/files/bucket/reports/a%20(1).txt',
      );
    });

    it('increments the deduplicated file name until upload succeeds', async () => {
      const { service } = makeService();
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
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
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(fetchSpy.mock.calls[2]?.[0]).toBe(
        'http://dial-core/v1/files/bucket/reports/a%20(2).txt',
      );
    });

    it('rejects path-traversal entries without attempting to upload them', async () => {
      const { service } = makeService();
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(okFetchUpload());
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
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('throws ServiceUnavailableException and stops scheduling uploads when the timeout is exceeded', async () => {
      const { service } = makeService({
        ARCHIVE_UPLOAD_TIMEOUT_MS: 250,
      });
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
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
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('throws ServiceUnavailableException when the final entry upload times out', async () => {
      const { service } = makeService({
        ARCHIVE_UPLOAD_TIMEOUT_MS: 250,
      });
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
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
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });
});
