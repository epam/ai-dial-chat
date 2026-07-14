import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { crc32 } from 'node:zlib';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import archiver from 'archiver';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../config/environment.config';
import type { DialClientService } from '../../dial/dial-client.service';
import { ArchiveItemNodeType } from '../dto/download-archive.dto';
import { SharePermission } from '../dto/share-files.dto';
import { FilesService } from '../files.service';

type SdkClient = {
  uploadFile: ReturnType<typeof vi.fn>;
  downloadFile: ReturnType<typeof vi.fn>;
  getFileMetadata: ReturnType<typeof vi.fn>;
  getSharedResources: ReturnType<typeof vi.fn>;
  deleteFile: ReturnType<typeof vi.fn>;
  moveResource: ReturnType<typeof vi.fn>;
  copyResource: ReturnType<typeof vi.fn>;
  shareResource: ReturnType<typeof vi.fn>;
  revokeSharedResources: ReturnType<typeof vi.fn>;
  discardSharedResources: ReturnType<typeof vi.fn>;
};

function makeService(configOverrides: Record<string, unknown> = {}) {
  const configService = {
    get: vi.fn((key: string) => {
      if (key in configOverrides) return configOverrides[key];
      if (key === 'DIAL_CORE_URL') return 'http://dial-core';
      if (key === 'FILE_TRANSFER_TIMEOUT_MS') return 30_000;
      if (key === 'ARCHIVE_TIMEOUT_MS') return 300_000;
      if (key === 'ARCHIVE_DOWNLOAD_CONCURRENCY') return 32;
      return undefined;
    }),
  } as unknown as ConfigService<EnvironmentVariables>;

  const sdkClient: SdkClient = {
    uploadFile: vi.fn(),
    downloadFile: vi.fn(),
    getFileMetadata: vi.fn(),
    getSharedResources: vi.fn(),
    deleteFile: vi.fn(),
    moveResource: vi.fn(),
    copyResource: vi.fn(),
    shareResource: vi.fn(),
    revokeSharedResources: vi.fn(),
    discardSharedResources: vi.fn(),
  };

  const dialClient = {
    client: sdkClient,
    baseUrl: 'http://dial-core',
    dialApiVersion: '2024-10-21',
  } as unknown as DialClientService;

  const service = new FilesService(dialClient, configService);

  return { service, sdkClient };
}

const okUpload = (url: string) => ({
  error: undefined,
  response: { status: 200, headers: { get: () => null } },
  data: { url },
});

const okDownload = (
  body: ReadableStream,
  headers: Record<string, string | null>,
) => ({
  error: undefined,
  response: {
    status: 200,
    body,
    headers: { get: (h: string) => headers[h] ?? null },
  },
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
  const directory = await mkdtemp(join(tmpdir(), 'files-service-archive-'));
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

describe('FilesService', () => {
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

  describe('downloadFile', () => {
    it('returns stream and allowlisted headers on success', async () => {
      const { service, sdkClient } = makeService();
      const webStream = new ReadableStream();
      sdkClient.downloadFile.mockResolvedValue(
        okDownload(webStream, {
          'content-type': 'application/pdf',
          'content-disposition': 'attachment; filename="f.pdf"',
          'content-length': '1024',
          'x-internal': 'should-be-stripped',
        }),
      );

      const result = await service.downloadFile(
        'bucket',
        'path/file.pdf',
        'token',
      );
      expect(result.stream).toBe(webStream);
      expect(result.headers).toEqual({
        'content-type': 'application/pdf',
        'content-disposition': 'attachment; filename="f.pdf"',
        'content-length': '1024',
      });
      expect(result.headers).not.toHaveProperty('x-internal');
    });

    it('strips files/{bucket}/ prefix before calling SDK download', async () => {
      const { service, sdkClient } = makeService();
      const webStream = new ReadableStream();
      sdkClient.downloadFile.mockResolvedValue(
        okDownload(webStream, {
          'content-type': 'application/pdf',
        }),
      );

      await service.downloadFile(
        'my-bucket',
        'files/my-bucket/reports/q1.pdf',
        'token',
      );

      expect(sdkClient.downloadFile).toHaveBeenCalledWith(
        'my-bucket',
        'reports/q1.pdf',
        expect.any(Object),
      );
    });

    it('throws NotFoundException on 404', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.downloadFile.mockResolvedValue(errResponse(404));
      await expect(service.downloadFile('b', 'p', 't')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws UnauthorizedException on 401', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.downloadFile.mockResolvedValue(errResponse(401));
      await expect(service.downloadFile('b', 'p', 't')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws BadGatewayException on 5xx', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.downloadFile.mockResolvedValue(errResponse(502));
      await expect(service.downloadFile('b', 'p', 't')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('throws ServiceUnavailableException on timeout', async () => {
      const { service, sdkClient } = makeService();
      const timeoutErr = Object.assign(new Error('The operation was aborted'), {
        name: 'TimeoutError',
      });
      sdkClient.downloadFile.mockRejectedValue(timeoutErr);
      await expect(service.downloadFile('b', 'p', 't')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.downloadFile.mockRejectedValue(new TypeError('ECONNREFUSED'));
      await expect(service.downloadFile('b', 'p', 't')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('getFileMetadata', () => {
    const okMeta = (fields: object = {}) => ({
      error: undefined,
      response: { status: 200 },
      data: {
        name: 'file.pdf',
        nodeType: 'item',
        bucket: 'my-bucket',
        parentPath: 'reports/',
        url: 'files/my-bucket/reports/file.pdf',
        resourceType: 'file',
        etag: '"abc123"',
        contentLength: 204800,
        contentType: 'application/pdf',
        createdAt: 1710000000000,
        updatedAt: 1712345678000,
        permissions: ['READ', 'WRITE'],
        author: 'user@example.com',
        ...fields,
      },
    });

    it('returns FileMetadataResponseDto on success', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue(okMeta());

      const result = await service.getFileMetadata(
        'my-bucket',
        'reports/file.pdf',
        'token',
      );

      expect(result.name).toBe('file.pdf');
      expect(result.nodeType).toBe('item');
      expect(result.etag).toBe('"abc123"');
      expect(result.contentLength).toBe(204800);
    });

    it('passes path to SDK without appending trailing slash', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue(okMeta());

      await service.getFileMetadata('my-bucket', 'reports/file.pdf', 'token');

      expect(sdkClient.getFileMetadata).toHaveBeenCalledWith(
        'my-bucket',
        'reports/file.pdf',
        expect.anything(),
      );
      const calledPath = sdkClient.getFileMetadata.mock.calls[0][1] as string;
      expect(calledPath.endsWith('/')).toBe(false);
    });

    it('throws NotFoundException when SDK returns 404', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue(errResponse(404));
      await expect(
        service.getFileMetadata('b', 'file.pdf', 't'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when SDK returns 403', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue(errResponse(403));
      await expect(
        service.getFileMetadata('b', 'file.pdf', 't'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws HttpException(429) when SDK returns 429', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue(errResponse(429));
      await expect(
        service.getFileMetadata('b', 'file.pdf', 't'),
      ).rejects.toThrow(HttpException);
    });

    it('throws BadGatewayException when SDK returns 5xx', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue(errResponse(500));
      await expect(
        service.getFileMetadata('b', 'file.pdf', 't'),
      ).rejects.toThrow(BadGatewayException);
    });

    it('throws ServiceUnavailableException on network failure', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockRejectedValue(
        new TypeError('fetch failed'),
      );
      await expect(
        service.getFileMetadata('b', 'file.pdf', 't'),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('throws ServiceUnavailableException on timeout', async () => {
      const { service, sdkClient } = makeService();
      const timeoutErr = Object.assign(new Error('The operation was aborted'), {
        name: 'TimeoutError',
      });
      sdkClient.getFileMetadata.mockRejectedValue(timeoutErr);
      await expect(
        service.getFileMetadata('b', 'file.pdf', 't'),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('listFiles', () => {
    const okList = (items: object[], nextToken?: string) => ({
      error: undefined,
      response: { status: 200 },
      data: { items, ...(nextToken != null ? { nextToken } : {}) },
    });

    it('returns normalized items on happy path', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue(
        okList([
          { nodeType: 'FOLDER', url: 'folder/', name: 'folder' },
          {
            nodeType: 'ITEM',
            url: 'file.pdf',
            name: 'file.pdf',
            parentPath: '',
          },
        ]),
      );

      const result = await service.listFiles(
        'my-bucket',
        'folder/',
        {},
        'token',
      );
      expect(result.items).toHaveLength(2);
      expect(result.items[0].nodeType).toBe('folder');
      expect(result.items[1].nodeType).toBe('item');
    });

    it('includes nextToken for an explicit paginated request when DIAL returns one', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue(okList([], 'cursor-abc'));

      const result = await service.listFiles(
        'my-bucket',
        undefined,
        { limit: 100 },
        'token',
      );
      expect(result.nextToken).toBe('cursor-abc');
    });

    it('aggregates DIAL Core pages when no pagination query is provided', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata
        .mockResolvedValueOnce(
          okList(
            [
              {
                nodeType: 'ITEM',
                url: 'first.pdf',
                name: 'first.pdf',
                parentPath: '',
              },
            ],
            'cursor-abc',
          ),
        )
        .mockResolvedValueOnce(
          okList([
            {
              nodeType: 'ITEM',
              url: 'second.pdf',
              name: 'second.pdf',
              parentPath: '',
            },
          ]),
        );
      sdkClient.getFileMetadata.mockClear();

      const result = await service.listFiles(
        'my-bucket',
        undefined,
        {},
        'token',
      );

      expect(result.items.map((item) => item.name)).toEqual([
        'first.pdf',
        'second.pdf',
      ]);
      expect(result.nextToken).toBeUndefined();
      expect(sdkClient.getFileMetadata).toHaveBeenNthCalledWith(
        1,
        'my-bucket',
        '',
        expect.objectContaining({
          params: {
            query: expect.objectContaining({
              limit: 1000,
              token: undefined,
            }),
          },
        }),
      );
      expect(sdkClient.getFileMetadata).toHaveBeenNthCalledWith(
        2,
        'my-bucket',
        '',
        expect.objectContaining({
          params: {
            query: expect.objectContaining({
              limit: 1000,
              token: 'cursor-abc',
            }),
          },
        }),
      );
    });

    it('passes folder permissions from DIAL Core metadata', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue({
        error: undefined,
        response: { status: 200 },
        data: { items: [], permissions: ['READ', 'WRITE'] },
      });

      const result = await service.listFiles(
        'my-bucket',
        undefined,
        {},
        'token',
      );
      expect(result.permissions).toEqual(['READ', 'WRITE']);
    });

    it('returns empty items when DIAL Core responds without a body', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue({
        error: undefined,
        response: { status: 200 },
        data: undefined,
      });

      const result = await service.listFiles(
        'my-bucket',
        'uploads/New folder 1/',
        {},
        'token',
      );
      expect(result.items).toEqual([]);
      expect(result.path).toBe('uploads/New folder 1/');
    });

    it('promotes marker permissions to the listed folder response', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue({
        error: undefined,
        response: { status: 200 },
        data: {
          items: [
            {
              nodeType: 'ITEM',
              name: '.dial_folder',
              url: 'uploads/New folder 1/.dial_folder',
              permissions: ['READ', 'WRITE'],
            },
          ],
        },
      });

      const result = await service.listFiles(
        'my-bucket',
        'uploads/New folder 1/',
        {},
        'token',
      );
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('.dial_folder');
      expect(result.permissions).toEqual(['READ', 'WRITE']);
    });

    it('returns empty items and no nextToken for empty folder', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue(okList([]));

      const result = await service.listFiles('my-bucket', '', {}, 'token');
      expect(result.items).toEqual([]);
      expect(result.nextToken).toBeUndefined();
    });

    it('throws ForbiddenException on 403', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue(errResponse(403));
      await expect(service.listFiles('b', undefined, {}, 't')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException on 404', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue(errResponse(404));
      await expect(service.listFiles('b', undefined, {}, 't')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws HttpException(429) on 429', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue(errResponse(429));
      await expect(service.listFiles('b', undefined, {}, 't')).rejects.toThrow(
        HttpException,
      );
    });

    it('throws BadGatewayException on 5xx', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue(errResponse(500));
      await expect(service.listFiles('b', undefined, {}, 't')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('throws ServiceUnavailableException on timeout (AbortError)', async () => {
      const { service, sdkClient } = makeService();
      const timeoutErr = Object.assign(new Error('The operation was aborted'), {
        name: 'TimeoutError',
      });
      sdkClient.getFileMetadata.mockRejectedValue(timeoutErr);
      await expect(service.listFiles('b', undefined, {}, 't')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('normalizes undefined path to empty string before SDK call', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue(okList([]));

      await service.listFiles('my-bucket', undefined, {}, 'at');
      expect(sdkClient.getFileMetadata).toHaveBeenCalledWith(
        'my-bucket',
        '',
        expect.objectContaining({
          params: {
            query: expect.objectContaining({
              recursive: false,
              permissions: true,
            }),
          },
        }),
      );
    });

    it('normalizes path without trailing slash before SDK call', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue(okList([]));

      await service.listFiles('my-bucket', 'reports', {}, 'at');
      expect(sdkClient.getFileMetadata).toHaveBeenCalledWith(
        'my-bucket',
        'reports/',
        expect.objectContaining({
          params: {
            query: expect.objectContaining({
              recursive: false,
              permissions: true,
            }),
          },
        }),
      );
    });

    it('keeps marker items (.dial_folder) in results', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue(
        okList([
          {
            nodeType: 'ITEM',
            url: 'reports/.dial_folder',
            name: '.dial_folder',
          },
          {
            nodeType: 'ITEM',
            url: 'report.pdf',
            name: 'report.pdf',
            parentPath: '',
          },
        ]),
      );

      const result = await service.listFiles(
        'my-bucket',
        'reports/',
        {},
        'token',
      );
      expect(result.items).toHaveLength(2);
      expect(result.items.map((item) => item.name)).toEqual([
        '.dial_folder',
        'report.pdf',
      ]);
    });
  });

  describe('listPublicFiles', () => {
    it('lists from the public bucket without requesting permissions', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue({
        error: undefined,
        response: { status: 200 },
        data: { items: [] },
      });

      const result = await service.listPublicFiles(
        { path: 'reports/', recursive: true },
        'token',
      );

      expect(result.bucket).toBe('public');
      expect(sdkClient.getFileMetadata).toHaveBeenCalledWith(
        'public',
        'reports/',
        expect.objectContaining({
          params: {
            query: expect.objectContaining({
              recursive: true,
              permissions: false,
            }),
          },
        }),
      );
    });

    it('aggregates public bucket pages when no pagination query is provided', async () => {
      const { service, sdkClient } = makeService();
      const okPublicList = (items: object[], nextToken?: string) => ({
        error: undefined,
        response: { status: 200 },
        data: { items, ...(nextToken != null ? { nextToken } : {}) },
      });

      sdkClient.getFileMetadata
        .mockResolvedValueOnce(
          okPublicList(
            [
              {
                nodeType: 'ITEM',
                url: 'first.md',
                name: 'first.md',
              },
            ],
            'public-cursor',
          ),
        )
        .mockResolvedValueOnce(
          okPublicList([
            {
              nodeType: 'ITEM',
              url: 'second.md',
              name: 'second.md',
            },
          ]),
        );
      sdkClient.getFileMetadata.mockClear();

      const result = await service.listPublicFiles({}, 'token');

      expect(result.bucket).toBe('public');
      expect(result.items.map((item) => item.name)).toEqual([
        'first.md',
        'second.md',
      ]);
      expect(result.nextToken).toBeUndefined();
      expect(sdkClient.getFileMetadata).toHaveBeenNthCalledWith(
        2,
        'public',
        '',
        expect.objectContaining({
          params: {
            query: expect.objectContaining({
              permissions: false,
              token: 'public-cursor',
            }),
          },
        }),
      );
    });
  });

  describe('listSharedFiles', () => {
    it('maps shared file resources to file-list items', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getSharedResources.mockResolvedValue({
        error: undefined,
        response: { status: 200 },
        data: {
          resources: [
            {
              nodeType: 'ITEM',
              name: 'shared.pdf',
              url: 'files/owner-bucket/shared.pdf',
              bucket: 'owner-bucket',
              author: 'Owner',
            },
          ],
        },
      });

      const result = await service.listSharedFiles({}, 'token');

      expect(result.items).toEqual([
        expect.objectContaining({
          name: 'shared.pdf',
          path: 'files/owner-bucket/shared.pdf',
          bucket: 'owner-bucket',
          author: 'Owner',
        }),
      ]);
      expect(sdkClient.getSharedResources).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer token' }),
          body: { resourceTypes: ['FILE'], with: 'me', includeUserInfo: true },
        }),
      );
    });

    it('maps shared resource owner to author when author is absent', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getSharedResources.mockResolvedValue({
        error: undefined,
        response: { status: 200 },
        data: {
          resources: [
            {
              nodeType: 'FOLDER',
              name: 'team-docs',
              url: 'files/owner-bucket/team-docs',
              bucket: 'owner-bucket',
              owner: 'Owner User',
            },
          ],
        },
      });

      const result = await service.listSharedFiles({}, 'token');

      expect(result.items[0]).toEqual(
        expect.objectContaining({
          name: 'team-docs',
          path: 'files/owner-bucket/team-docs/',
          author: 'Owner User',
        }),
      );
    });

    it('maps sharedBy user info to author when author is absent', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getSharedResources.mockResolvedValue({
        error: undefined,
        response: { status: 200 },
        data: {
          resources: [
            {
              nodeType: 'ITEM',
              name: 'shared.pdf',
              url: 'files/owner-bucket/shared.pdf',
              bucket: 'owner-bucket',
              sharedBy: [{ user: 'Sharing User' }],
            },
          ],
        },
      });

      const result = await service.listSharedFiles({}, 'token');

      expect(result.items[0]).toEqual(
        expect.objectContaining({
          name: 'shared.pdf',
          path: 'files/owner-bucket/shared.pdf',
          author: 'Sharing User',
        }),
      );
    });

    it('maps shared folder nested item author when top-level author is absent', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getSharedResources.mockResolvedValue({
        error: undefined,
        response: { status: 200 },
        data: {
          resources: [
            {
              nodeType: 'FOLDER',
              name: '2026-06',
              url: 'files/owner-bucket/uploads/2026-06/',
              bucket: 'owner-bucket',
              parentPath: 'uploads',
              items: [
                {
                  nodeType: 'ITEM',
                  name: 'image.png',
                  url: 'files/owner-bucket/uploads/2026-06/image.png',
                  author: 'Owner User',
                },
              ],
            },
          ],
        },
      });

      const result = await service.listSharedFiles({}, 'token');

      expect(result.items[0]).toEqual(
        expect.objectContaining({
          name: '2026-06',
          path: 'files/owner-bucket/uploads/2026-06/',
          author: 'Owner User',
        }),
      );
      expect(sdkClient.getFileMetadata).not.toHaveBeenCalled();
    });

    it('does not fetch extra metadata when shared listing omits author', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getSharedResources.mockResolvedValue({
        error: undefined,
        response: { status: 200 },
        data: {
          resources: [
            {
              nodeType: 'ITEM',
              name: 'shared.pdf',
              url: 'files/owner-bucket/docs/shared.pdf',
              bucket: 'owner-bucket',
              parentPath: 'docs',
            },
          ],
        },
      });

      const result = await service.listSharedFiles({}, 'token');

      expect(result.items[0]).toEqual(
        expect.objectContaining({
          name: 'shared.pdf',
          path: 'files/owner-bucket/docs/shared.pdf',
          author: undefined,
        }),
      );
      expect(sdkClient.getFileMetadata).not.toHaveBeenCalled();
    });
  });

  describe('createFolder', () => {
    const notFound = () => ({
      error: new Error('Not found'),
      response: { status: 404, headers: { get: () => null } },
      data: undefined,
    });

    it('returns CreateFolderResponseDto on success', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue(notFound());
      sdkClient.uploadFile.mockResolvedValue(
        okUpload('my-bucket/reports/.dial_folder'),
      );

      const result = await service.createFolder(
        'my-bucket',
        'reports/',
        '2026',
        'token',
      );
      expect(result).toEqual({
        name: '2026',
        path: 'files/my-bucket/reports/2026/',
        parentPath: 'reports',
        bucket: 'my-bucket',
        nodeType: 'folder',
        folderId: 'my-bucket:files/my-bucket/reports/2026/',
      });
      expect(sdkClient.uploadFile).toHaveBeenCalledWith(
        'my-bucket',
        'reports/2026/.dial_folder',
        expect.any(Object),
      );
    });

    it('throws ConflictException when marker already exists at target path', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue({
        error: undefined,
        response: { status: 200, headers: { get: () => null } },
        data: {
          nodeType: 'ITEM',
          name: '.dial_folder',
          url: 'files/my-bucket/appdata/213123123/.dial_folder',
        },
      });

      await expect(
        service.createFolder('my-bucket', 'appdata/', '213123123', 'token'),
      ).rejects.toThrow(ConflictException);
      expect(sdkClient.uploadFile).not.toHaveBeenCalled();
    });

    it('uploads marker when metadata probe returns parent folder marker', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue({
        error: undefined,
        response: { status: 200, headers: { get: () => null } },
        data: {
          nodeType: 'ITEM',
          name: '.dial_folder',
          url: 'files/my-bucket/asdasd/d/.dial_folder',
        },
      });
      sdkClient.uploadFile.mockResolvedValue(okUpload('any'));

      await service.createFolder(
        'my-bucket',
        'asdasd/d/',
        'New folder 1',
        'token',
      );

      expect(sdkClient.uploadFile).toHaveBeenCalledWith(
        'my-bucket',
        'asdasd/d/New folder 1/.dial_folder',
        expect.any(Object),
      );
    });

    it('throws ForbiddenException when DIAL Core returns 403 on metadata check', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue(errResponse(403));

      await expect(
        service.createFolder('my-bucket', '', 'reports', 'token'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when DIAL Core returns 403 on marker upload', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue(notFound());
      sdkClient.uploadFile.mockResolvedValue(errResponse(403));

      await expect(
        service.createFolder('my-bucket', '', 'reports', 'token'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('normalizes parentPath to include trailing slash', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue(notFound());
      sdkClient.uploadFile.mockResolvedValue(okUpload('any'));

      const result = await service.createFolder(
        'my-bucket',
        'parent',
        'child',
        'token',
      );
      expect(result.parentPath).toBe('parent');
      expect(result.path).toBe('files/my-bucket/parent/child/');
    });

    it('handles empty parentPath as root', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue(notFound());
      sdkClient.uploadFile.mockResolvedValue(okUpload('any'));

      const result = await service.createFolder(
        'my-bucket',
        '',
        'top',
        'token',
      );
      expect(result.path).toBe('files/my-bucket/top/');
      expect(result.parentPath).toBe('');
    });
  });

  describe('expandFolderContents', () => {
    const okListItems = (
      items: Array<{
        name?: string;
        url?: string;
        nodeType?: string;
        contentLength?: number;
      }>,
      nextToken?: string,
    ) => ({
      error: undefined,
      response: { status: 200 },
      data: { items, ...(nextToken != null ? { nextToken } : {}) },
    });

    it('returns flat file list including marker files', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue(
        okListItems([
          {
            nodeType: 'ITEM',
            url: 'reports/q1.pdf',
            name: 'q1.pdf',
            contentLength: 1000,
          },
          {
            nodeType: 'ITEM',
            url: 'reports/.dial_folder',
            name: '.dial_folder',
          },
        ]),
      );

      const result = await service.expandFolderContents(
        'my-bucket',
        'reports/',
        'reports',
        'token',
      );
      expect(result).toHaveLength(2);
      expect(result.map((entry) => entry.name).sort()).toEqual([
        '.dial_folder',
        'q1.pdf',
      ]);
      expect(result.find((entry) => entry.name === 'q1.pdf')?.archivePath).toBe(
        'reports/q1.pdf',
      );
      expect(
        result.find((entry) => entry.name === '.dial_folder')?.archivePath,
      ).toBe('reports/.dial_folder');
    });

    it('skips folder nodes', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue(
        okListItems([
          { nodeType: 'FOLDER', url: 'reports/sub/', name: 'sub' },
          { nodeType: 'ITEM', url: 'reports/file.txt', name: 'file.txt' },
        ]),
      );

      const result = await service.expandFolderContents(
        'my-bucket',
        'reports/',
        'reports',
        'token',
      );
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('file.txt');
    });

    it('strips files/{bucket}/ prefix before calling SDK metadata API', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue(okListItems([]));

      await service.expandFolderContents(
        'my-bucket',
        'files/my-bucket/reports/',
        'reports',
        'token',
      );

      expect(sdkClient.getFileMetadata).toHaveBeenCalledWith(
        'my-bucket',
        'reports/',
        expect.objectContaining({
          params: {
            query: expect.objectContaining({
              recursive: true,
              limit: 1000,
            }),
          },
        }),
      );
    });

    it('returns correct archivePath and download path for full-resource-path items', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue(
        okListItems([
          {
            nodeType: 'ITEM',
            url: 'files/my-bucket/reports/q1.pdf',
            name: 'q1.pdf',
            contentLength: 2048,
          },
        ]),
      );

      const result = await service.expandFolderContents(
        'my-bucket',
        'files/my-bucket/reports/',
        'reports',
        'token',
      );

      expect(result).toHaveLength(1);
      expect(result[0].archivePath).toBe('reports/q1.pdf');
      expect(result[0].path).toBe('reports/q1.pdf');
      expect(result[0].size).toBe(2048);
    });
  });

  describe('buildArchivePath', () => {
    it('returns null for paths containing ..', () => {
      const { service } = makeService();
      expect(service.buildArchivePath('root', '../etc/passwd')).toBeNull();
    });

    it('returns null for paths starting with /', () => {
      const { service } = makeService();
      expect(service.buildArchivePath('root', '/etc/passwd')).toBeNull();
    });

    it('returns null for paths containing backslash', () => {
      const { service } = makeService();
      expect(service.buildArchivePath('root', 'a\\b')).toBeNull();
    });

    it('returns joined path for valid relative path', () => {
      const { service } = makeService();
      expect(service.buildArchivePath('reports', '2026/q1.pdf')).toBe(
        'reports/2026/q1.pdf',
      );
    });

    it('returns relative path when root is empty', () => {
      const { service } = makeService();
      expect(service.buildArchivePath('', 'file.txt')).toBe('file.txt');
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

    it('reports a conflicting entry as failed while other entries still succeed', async () => {
      const { service } = makeService();
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response(null, { status: 412 }))
        .mockResolvedValueOnce(okFetchUpload());
      const buffer = await buildZipBuffer([
        { name: 'a.txt' },
        { name: 'b.txt' },
      ]);

      const result = await withArchiveFixture(buffer, (archiveFile) =>
        service.uploadArchive('bucket', 'reports', archiveFile, 'token'),
      );

      expect(result.results).toEqual([
        { path: 'reports/a.txt', success: false, error: 'Conflict' },
        { path: 'reports/b.txt', success: true },
      ]);
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

  describe('downloadArchive', () => {
    it('uses the archive timeout for downloading archive entries', async () => {
      const { service, sdkClient } = makeService();
      const response = new Response('archive content');
      sdkClient.downloadFile.mockResolvedValue({
        error: undefined,
        response,
      });
      const output = new PassThrough();
      output.resume();
      const setHeader = vi.fn();
      const flushHeaders = vi.fn();
      const expressResponse = Object.assign(output, {
        setHeader,
        flushHeaders,
      });
      const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');

      await service.downloadArchive(
        [
          {
            bucket: 'my-bucket',
            path: 'reports/q1.pdf',
            name: 'q1.pdf',
            nodeType: ArchiveItemNodeType.Item,
          },
        ],
        'token',
        expressResponse as never,
      );

      expect(timeoutSpy).toHaveBeenCalledWith(300_000);
      expect(flushHeaders).toHaveBeenCalledOnce();
      expect(sdkClient.downloadFile).toHaveBeenCalledWith(
        'my-bucket',
        'reports/q1.pdf',
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        }),
      );
    });
  });

  describe('deleteFiles', () => {
    const okDelete = () => ({
      error: undefined,
      response: { status: 200 },
      data: undefined,
    });

    const notFoundDelete = () => ({
      error: new Error('Not found'),
      response: { status: 404 },
      data: undefined,
    });

    const forbiddenDelete = () => ({
      error: new Error('Forbidden'),
      response: { status: 403 },
      data: undefined,
    });

    it('returns success for a single file that is deleted successfully', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.deleteFile = vi.fn().mockResolvedValue(okDelete());

      const result = await service.deleteFiles(
        [
          {
            bucket: 'user-files',
            path: 'reports/q1.pdf',
            name: 'q1.pdf',
            nodeType: 'item' as never,
          },
        ],
        'token',
      );

      expect(result.results).toEqual([
        { path: 'reports/q1.pdf', success: true },
      ]);
      expect(sdkClient.deleteFile).toHaveBeenCalledWith(
        'user-files',
        'reports/q1.pdf',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer token' }),
        }),
      );
    });

    it('treats SDK 404 (file already gone) as success', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.deleteFile = vi.fn().mockResolvedValue(notFoundDelete());

      const result = await service.deleteFiles(
        [
          {
            bucket: 'user-files',
            path: 'reports/q1.pdf',
            name: 'q1.pdf',
            nodeType: 'item' as never,
          },
        ],
        'token',
      );

      expect(result.results[0]).toEqual({
        path: 'reports/q1.pdf',
        success: true,
      });
    });

    it('returns success=false with "Forbidden" for SDK 403', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.deleteFile = vi.fn().mockResolvedValue(forbiddenDelete());

      const result = await service.deleteFiles(
        [
          {
            bucket: 'user-files',
            path: 'reports/q1.pdf',
            name: 'q1.pdf',
            nodeType: 'item' as never,
          },
        ],
        'token',
      );

      expect(result.results[0]).toEqual({
        path: 'reports/q1.pdf',
        success: false,
        error: 'Forbidden',
      });
    });

    it('expands folder, deletes children and marker; returns success', async () => {
      const { service, sdkClient } = makeService();

      sdkClient.getFileMetadata = vi.fn().mockResolvedValue({
        error: undefined,
        response: { status: 200 },
        data: {
          items: [
            {
              url: 'files/user-files/old-data/file1.txt',
              name: 'file1.txt',
              nodeType: 'item',
              contentLength: 100,
            },
          ],
          nextToken: undefined,
        },
      });
      sdkClient.deleteFile = vi.fn().mockResolvedValue(okDelete());

      const result = await service.deleteFiles(
        [
          {
            bucket: 'user-files',
            path: 'old-data/',
            name: 'old-data',
            nodeType: 'folder' as never,
          },
        ],
        'token',
      );

      expect(result.results[0]).toEqual({ path: 'old-data/', success: true });
      expect(sdkClient.deleteFile).toHaveBeenCalledWith(
        'user-files',
        'old-data/file1.txt',
        expect.anything(),
      );
    });

    it('treats missing folder marker (404) as success', async () => {
      const { service, sdkClient } = makeService();

      sdkClient.getFileMetadata = vi.fn().mockResolvedValue({
        error: undefined,
        response: { status: 200 },
        data: { items: [], nextToken: undefined },
      });
      sdkClient.deleteFile = vi.fn().mockResolvedValue(notFoundDelete());

      const result = await service.deleteFiles(
        [
          {
            bucket: 'user-files',
            path: 'empty-folder/',
            name: 'empty-folder',
            nodeType: 'folder' as never,
          },
        ],
        'token',
      );

      expect(result.results[0]).toEqual({
        path: 'empty-folder/',
        success: true,
      });
    });

    it('returns independent results per item in a partial batch', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.deleteFile = vi
        .fn()
        .mockResolvedValueOnce(okDelete())
        .mockResolvedValueOnce(forbiddenDelete());

      const result = await service.deleteFiles(
        [
          {
            bucket: 'b',
            path: 'file1.txt',
            name: 'file1.txt',
            nodeType: 'item' as never,
          },
          {
            bucket: 'b',
            path: 'file2.txt',
            name: 'file2.txt',
            nodeType: 'item' as never,
          },
        ],
        'token',
      );

      expect(result.results[0]).toEqual({ path: 'file1.txt', success: true });
      expect(result.results[1]).toEqual({
        path: 'file2.txt',
        success: false,
        error: 'Forbidden',
      });
    });
  });

  describe('renameFiles — single file (renameFileItem)', () => {
    const okMove = () => ({
      error: undefined,
      response: { status: 200 },
      data: undefined,
    });

    const errMove = (status: number) => ({
      error: new Error('HTTP error'),
      response: { status },
      data: undefined,
    });

    const singleFileItem = (overrides?: object) => ({
      bucket: 'user-files',
      sourcePath: 'reports/q1.pdf',
      destinationPath: 'reports/q1-final.pdf',
      nodeType: 'item' as never,
      name: 'q1.pdf',
      ...overrides,
    });

    it('returns success when DIAL Core moveResource returns 200', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.moveResource.mockResolvedValue(okMove());

      const result = await service.renameFiles([singleFileItem()], 'token');

      expect(result.results[0]).toEqual({
        sourcePath: 'reports/q1.pdf',
        destinationPath: 'reports/q1-final.pdf',
        success: true,
      });
      expect(sdkClient.moveResource).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer token' }),
          body: expect.objectContaining({
            sourceUrl: 'files/user-files/reports/q1.pdf',
            destinationUrl: 'files/user-files/reports/q1-final.pdf',
            overwrite: false,
          }),
        }),
      );
    });

    it('returns success=false with "Conflict" for DIAL Core 409', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.moveResource.mockResolvedValue(errMove(409));

      const result = await service.renameFiles([singleFileItem()], 'token');

      expect(result.results[0]).toEqual({
        sourcePath: 'reports/q1.pdf',
        destinationPath: 'reports/q1-final.pdf',
        success: false,
        error: 'Conflict',
      });
    });

    it('returns success=false with "Forbidden" for DIAL Core 403', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.moveResource.mockResolvedValue(errMove(403));

      const result = await service.renameFiles([singleFileItem()], 'token');

      expect(result.results[0]).toEqual({
        sourcePath: 'reports/q1.pdf',
        destinationPath: 'reports/q1-final.pdf',
        success: false,
        error: 'Forbidden',
      });
    });

    it('returns success=false with "Not found" for DIAL Core 404', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.moveResource.mockResolvedValue(errMove(404));

      const result = await service.renameFiles([singleFileItem()], 'token');

      expect(result.results[0]).toEqual({
        sourcePath: 'reports/q1.pdf',
        destinationPath: 'reports/q1-final.pdf',
        success: false,
        error: 'Not found',
      });
    });

    it('returns success=false with "Rename failed" for unexpected errors', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.moveResource.mockRejectedValue(new TypeError('fetch failed'));

      const result = await service.renameFiles([singleFileItem()], 'token');

      expect(result.results[0]).toEqual({
        sourcePath: 'reports/q1.pdf',
        destinationPath: 'reports/q1-final.pdf',
        success: false,
        error: 'Rename failed',
      });
    });
  });

  describe('renameFiles — folder (renameFolderItem)', () => {
    const okMove = () => ({
      error: undefined,
      response: { status: 200 },
      data: undefined,
    });

    const errMove = (status: number) => ({
      error: new Error('HTTP error'),
      response: { status },
      data: undefined,
    });

    const folderItem = (overrides?: object) => ({
      bucket: 'user-files',
      sourcePath: 'reports/',
      destinationPath: 'reports-2026/',
      nodeType: 'folder' as never,
      name: 'reports',
      ...overrides,
    });

    const makeFileMetadataPage = (items: object[], nextToken?: string) => ({
      error: undefined,
      response: { status: 200 },
      data: { items, ...(nextToken != null ? { nextToken } : {}) },
    });

    it('moves all children including .dial_folder marker on success', async () => {
      const { service, sdkClient } = makeService();

      sdkClient.getFileMetadata.mockResolvedValue(
        makeFileMetadataPage([
          {
            url: 'files/user-files/reports/q1.pdf',
            name: 'q1.pdf',
            nodeType: 'item',
            contentLength: 100,
          },
          {
            url: 'files/user-files/reports/.dial_folder',
            name: '.dial_folder',
            nodeType: 'item',
            contentLength: 0,
          },
        ]),
      );
      sdkClient.moveResource.mockResolvedValue(okMove());

      const result = await service.renameFiles([folderItem()], 'token');

      expect(result.results[0]).toEqual({
        sourcePath: 'reports/',
        destinationPath: 'reports-2026/',
        success: true,
      });
      expect(sdkClient.moveResource).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            sourceUrl: 'files/user-files/reports/q1.pdf',
            destinationUrl: 'files/user-files/reports-2026/q1.pdf',
          }),
        }),
      );
      expect(sdkClient.moveResource).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            sourceUrl: 'files/user-files/reports/.dial_folder',
            destinationUrl: 'files/user-files/reports-2026/.dial_folder',
          }),
        }),
      );
    });

    it('moves folder children with percent-encoded metadata URLs under the renamed folder', async () => {
      const { service, sdkClient } = makeService();

      sdkClient.getFileMetadata.mockResolvedValue(
        makeFileMetadataPage([
          {
            url: 'files/user-files/2026-06/New%20folder%201/.dial_folder',
            name: '.dial_folder',
            nodeType: 'item',
            contentLength: 0,
          },
          {
            url: 'files/user-files/2026-06/New%20folder%201/12.jpg',
            name: '12.jpg',
            nodeType: 'item',
            contentLength: 2145,
          },
        ]),
      );
      sdkClient.moveResource.mockResolvedValue(okMove());

      const result = await service.renameFiles(
        [
          folderItem({
            sourcePath: '2026-06/New folder 1/',
            destinationPath: '2026-06/New folder/',
            name: 'New folder',
          }),
        ],
        'token',
      );

      expect(result.results[0]).toEqual({
        sourcePath: '2026-06/New folder 1/',
        destinationPath: '2026-06/New folder/',
        success: true,
      });
      expect(sdkClient.moveResource).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            sourceUrl: 'files/user-files/2026-06/New%20folder%201/.dial_folder',
            destinationUrl:
              'files/user-files/2026-06/New%20folder/.dial_folder',
          }),
        }),
      );
      expect(sdkClient.moveResource).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            sourceUrl: 'files/user-files/2026-06/New%20folder%201/12.jpg',
            destinationUrl: 'files/user-files/2026-06/New%20folder/12.jpg',
          }),
        }),
      );
    });

    it('returns success=false with "Partial rename" when one child fails', async () => {
      const { service, sdkClient } = makeService();

      sdkClient.getFileMetadata.mockResolvedValue(
        makeFileMetadataPage([
          {
            url: 'files/user-files/reports/q1.pdf',
            name: 'q1.pdf',
            nodeType: 'item',
            contentLength: 100,
          },
          {
            url: 'files/user-files/reports/q2.pdf',
            name: 'q2.pdf',
            nodeType: 'item',
            contentLength: 100,
          },
        ]),
      );
      sdkClient.moveResource
        .mockResolvedValueOnce(okMove())
        .mockResolvedValueOnce(errMove(403));

      const result = await service.renameFiles([folderItem()], 'token');

      expect(result.results[0]).toEqual({
        sourcePath: 'reports/',
        destinationPath: 'reports-2026/',
        success: false,
        error: 'Partial rename',
      });
    });

    it('follows nextToken pagination to move all files across multiple pages', async () => {
      const { service, sdkClient } = makeService();

      sdkClient.getFileMetadata
        .mockResolvedValueOnce(
          makeFileMetadataPage(
            [
              {
                url: 'files/user-files/reports/a.pdf',
                name: 'a.pdf',
                nodeType: 'item',
                contentLength: 10,
              },
            ],
            'cursor-1',
          ),
        )
        .mockResolvedValueOnce(
          makeFileMetadataPage([
            {
              url: 'files/user-files/reports/b.pdf',
              name: 'b.pdf',
              nodeType: 'item',
              contentLength: 10,
            },
          ]),
        );
      sdkClient.moveResource.mockResolvedValue(okMove());

      const result = await service.renameFiles([folderItem()], 'token');

      expect(result.results[0].success).toBe(true);
      expect(sdkClient.moveResource).toHaveBeenCalledTimes(2);
    });

    it('returns success=true with no moveResource calls for an empty folder', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue(makeFileMetadataPage([]));

      const result = await service.renameFiles([folderItem()], 'token');

      expect(result.results[0].success).toBe(true);
      expect(sdkClient.moveResource).not.toHaveBeenCalled();
    });
  });

  describe('copyFiles — single file (copyFileItem)', () => {
    const okCopy = () => ({
      error: undefined,
      response: { status: 200 },
      data: undefined,
    });

    const errCopy = (status: number) => ({
      error: new Error('HTTP error'),
      response: { status },
      data: undefined,
    });

    const singleFileItem = (overrides?: object) => ({
      bucket: 'user-files',
      sourcePath: 'reports/q1.pdf',
      destinationPath: 'archive/q1.pdf',
      nodeType: 'item' as never,
      name: 'q1.pdf',
      ...overrides,
    });

    it('returns success when DIAL Core copyResource returns 200', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.copyResource.mockResolvedValue(okCopy());

      const result = await service.copyFiles([singleFileItem()], 'token');

      expect(result.results[0]).toEqual({
        sourcePath: 'reports/q1.pdf',
        destinationPath: 'archive/q1.pdf',
        success: true,
      });
      expect(sdkClient.copyResource).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer token' }),
          body: expect.objectContaining({
            sourceUrl: 'files/user-files/reports/q1.pdf',
            destinationUrl: 'files/user-files/archive/q1.pdf',
            overwrite: false,
          }),
        }),
      );
    });

    it('returns success=false with "Conflict" for DIAL Core 409', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.copyResource.mockResolvedValue(errCopy(409));

      const result = await service.copyFiles([singleFileItem()], 'token');

      expect(result.results[0]).toEqual({
        sourcePath: 'reports/q1.pdf',
        destinationPath: 'archive/q1.pdf',
        success: false,
        error: 'Conflict',
      });
    });

    it('returns success=false with "Forbidden" for DIAL Core 403', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.copyResource.mockResolvedValue(errCopy(403));

      const result = await service.copyFiles([singleFileItem()], 'token');

      expect(result.results[0]).toEqual({
        sourcePath: 'reports/q1.pdf',
        destinationPath: 'archive/q1.pdf',
        success: false,
        error: 'Forbidden',
      });
    });

    it('returns success=false with "Not found" for DIAL Core 404', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.copyResource.mockResolvedValue(errCopy(404));

      const result = await service.copyFiles([singleFileItem()], 'token');

      expect(result.results[0]).toEqual({
        sourcePath: 'reports/q1.pdf',
        destinationPath: 'archive/q1.pdf',
        success: false,
        error: 'Not found',
      });
    });

    it('returns success=false with "Copy failed" for unexpected errors', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.copyResource.mockRejectedValue(new TypeError('fetch failed'));

      const result = await service.copyFiles([singleFileItem()], 'token');

      expect(result.results[0]).toEqual({
        sourcePath: 'reports/q1.pdf',
        destinationPath: 'archive/q1.pdf',
        success: false,
        error: 'Copy failed',
      });
    });
  });

  describe('copyFiles — folder (copyFolderItem)', () => {
    const okCopy = () => ({
      error: undefined,
      response: { status: 200 },
      data: undefined,
    });

    const errCopy = (status: number) => ({
      error: new Error('HTTP error'),
      response: { status },
      data: undefined,
    });

    const folderItem = (overrides?: object) => ({
      bucket: 'user-files',
      sourcePath: 'reports/',
      destinationPath: 'archive/reports/',
      nodeType: 'folder' as never,
      name: 'reports',
      ...overrides,
    });

    const makeFileMetadataPage = (items: object[], nextToken?: string) => ({
      error: undefined,
      response: { status: 200 },
      data: { items, ...(nextToken != null ? { nextToken } : {}) },
    });

    it('copies all children including .dial_folder marker on success', async () => {
      const { service, sdkClient } = makeService();

      sdkClient.getFileMetadata.mockResolvedValue(
        makeFileMetadataPage([
          {
            url: 'files/user-files/reports/q1.pdf',
            name: 'q1.pdf',
            nodeType: 'item',
            contentLength: 100,
          },
          {
            url: 'files/user-files/reports/.dial_folder',
            name: '.dial_folder',
            nodeType: 'item',
            contentLength: 0,
          },
        ]),
      );
      sdkClient.copyResource.mockResolvedValue(okCopy());

      const result = await service.copyFiles([folderItem()], 'token');

      expect(result.results[0]).toEqual({
        sourcePath: 'reports/',
        destinationPath: 'archive/reports/',
        success: true,
      });
      expect(sdkClient.copyResource).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            sourceUrl: 'files/user-files/reports/q1.pdf',
            destinationUrl: 'files/user-files/archive/reports/q1.pdf',
          }),
        }),
      );
      expect(sdkClient.copyResource).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            sourceUrl: 'files/user-files/reports/.dial_folder',
            destinationUrl: 'files/user-files/archive/reports/.dial_folder',
          }),
        }),
      );
    });

    it('returns success=false with "Partial copy" when one child fails', async () => {
      const { service, sdkClient } = makeService();

      sdkClient.getFileMetadata.mockResolvedValue(
        makeFileMetadataPage([
          {
            url: 'files/user-files/reports/q1.pdf',
            name: 'q1.pdf',
            nodeType: 'item',
            contentLength: 100,
          },
          {
            url: 'files/user-files/reports/q2.pdf',
            name: 'q2.pdf',
            nodeType: 'item',
            contentLength: 100,
          },
        ]),
      );
      sdkClient.copyResource
        .mockResolvedValueOnce(okCopy())
        .mockResolvedValueOnce(errCopy(403));

      const result = await service.copyFiles([folderItem()], 'token');

      expect(result.results[0]).toEqual({
        sourcePath: 'reports/',
        destinationPath: 'archive/reports/',
        success: false,
        error: 'Partial copy',
      });
    });

    it('follows nextToken pagination to copy all files across multiple pages', async () => {
      const { service, sdkClient } = makeService();

      sdkClient.getFileMetadata
        .mockResolvedValueOnce(
          makeFileMetadataPage(
            [
              {
                url: 'files/user-files/reports/a.pdf',
                name: 'a.pdf',
                nodeType: 'item',
                contentLength: 10,
              },
            ],
            'cursor-1',
          ),
        )
        .mockResolvedValueOnce(
          makeFileMetadataPage([
            {
              url: 'files/user-files/reports/b.pdf',
              name: 'b.pdf',
              nodeType: 'item',
              contentLength: 10,
            },
          ]),
        );
      sdkClient.copyResource.mockResolvedValue(okCopy());

      const result = await service.copyFiles([folderItem()], 'token');

      expect(result.results[0].success).toBe(true);
      expect(sdkClient.copyResource).toHaveBeenCalledTimes(2);
    });

    it('returns success=true with no copyResource calls for an empty folder', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue(makeFileMetadataPage([]));

      const result = await service.copyFiles([folderItem()], 'token');

      expect(result.results[0].success).toBe(true);
      expect(sdkClient.copyResource).not.toHaveBeenCalled();
    });
  });

  describe('moveFiles — single file (moveFileItem)', () => {
    const okMove = () => ({
      error: undefined,
      response: { status: 200 },
      data: undefined,
    });

    const errMove = (status: number) => ({
      error: new Error('HTTP error'),
      response: { status },
      data: undefined,
    });

    const singleFileItem = (overrides?: object) => ({
      bucket: 'user-files',
      sourcePath: 'inbox/draft.pdf',
      destinationPath: 'reports/draft.pdf',
      nodeType: 'item' as never,
      name: 'draft.pdf',
      ...overrides,
    });

    it('returns success when DIAL Core moveResource returns 200', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.moveResource.mockResolvedValue(okMove());

      const result = await service.moveFiles([singleFileItem()], 'token');

      expect(result.results[0]).toEqual({
        sourcePath: 'inbox/draft.pdf',
        destinationPath: 'reports/draft.pdf',
        success: true,
      });
      expect(sdkClient.moveResource).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer token' }),
          body: expect.objectContaining({
            sourceUrl: 'files/user-files/inbox/draft.pdf',
            destinationUrl: 'files/user-files/reports/draft.pdf',
            overwrite: false,
          }),
        }),
      );
    });

    it('returns success=false with "Conflict" for DIAL Core 409', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.moveResource.mockResolvedValue(errMove(409));

      const result = await service.moveFiles([singleFileItem()], 'token');

      expect(result.results[0]).toEqual({
        sourcePath: 'inbox/draft.pdf',
        destinationPath: 'reports/draft.pdf',
        success: false,
        error: 'Conflict',
      });
    });

    it('returns success=false with "Forbidden" for DIAL Core 403', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.moveResource.mockResolvedValue(errMove(403));

      const result = await service.moveFiles([singleFileItem()], 'token');

      expect(result.results[0]).toEqual({
        sourcePath: 'inbox/draft.pdf',
        destinationPath: 'reports/draft.pdf',
        success: false,
        error: 'Forbidden',
      });
    });

    it('returns success=false with "Not found" for DIAL Core 404', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.moveResource.mockResolvedValue(errMove(404));

      const result = await service.moveFiles([singleFileItem()], 'token');

      expect(result.results[0]).toEqual({
        sourcePath: 'inbox/draft.pdf',
        destinationPath: 'reports/draft.pdf',
        success: false,
        error: 'Not found',
      });
    });

    it('returns success=false with "Move failed" for unexpected errors', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.moveResource.mockRejectedValue(new TypeError('fetch failed'));

      const result = await service.moveFiles([singleFileItem()], 'token');

      expect(result.results[0]).toEqual({
        sourcePath: 'inbox/draft.pdf',
        destinationPath: 'reports/draft.pdf',
        success: false,
        error: 'Move failed',
      });
    });
  });

  describe('moveFiles — folder (moveFolderItem)', () => {
    const okMove = () => ({
      error: undefined,
      response: { status: 200 },
      data: undefined,
    });

    const errMove = (status: number) => ({
      error: new Error('HTTP error'),
      response: { status },
      data: undefined,
    });

    const folderItem = (overrides?: object) => ({
      bucket: 'user-files',
      sourcePath: 'drafts/',
      destinationPath: 'final/drafts/',
      nodeType: 'folder' as never,
      name: 'drafts',
      ...overrides,
    });

    const makeFileMetadataPage = (items: object[], nextToken?: string) => ({
      error: undefined,
      response: { status: 200 },
      data: { items, ...(nextToken != null ? { nextToken } : {}) },
    });

    it('moves all children including .dial_folder marker on success', async () => {
      const { service, sdkClient } = makeService();

      sdkClient.getFileMetadata.mockResolvedValue(
        makeFileMetadataPage([
          {
            url: 'files/user-files/drafts/q1.pdf',
            name: 'q1.pdf',
            nodeType: 'item',
            contentLength: 100,
          },
          {
            url: 'files/user-files/drafts/.dial_folder',
            name: '.dial_folder',
            nodeType: 'item',
            contentLength: 0,
          },
        ]),
      );
      sdkClient.moveResource.mockResolvedValue(okMove());

      const result = await service.moveFiles([folderItem()], 'token');

      expect(result.results[0]).toEqual({
        sourcePath: 'drafts/',
        destinationPath: 'final/drafts/',
        success: true,
      });
      expect(sdkClient.moveResource).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            sourceUrl: 'files/user-files/drafts/q1.pdf',
            destinationUrl: 'files/user-files/final/drafts/q1.pdf',
          }),
        }),
      );
      expect(sdkClient.moveResource).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            sourceUrl: 'files/user-files/drafts/.dial_folder',
            destinationUrl: 'files/user-files/final/drafts/.dial_folder',
          }),
        }),
      );
    });

    it('returns success=false with "Partial move" when one child fails', async () => {
      const { service, sdkClient } = makeService();

      sdkClient.getFileMetadata.mockResolvedValue(
        makeFileMetadataPage([
          {
            url: 'files/user-files/drafts/q1.pdf',
            name: 'q1.pdf',
            nodeType: 'item',
            contentLength: 100,
          },
          {
            url: 'files/user-files/drafts/q2.pdf',
            name: 'q2.pdf',
            nodeType: 'item',
            contentLength: 100,
          },
        ]),
      );
      sdkClient.moveResource
        .mockResolvedValueOnce(okMove())
        .mockResolvedValueOnce(errMove(403));

      const result = await service.moveFiles([folderItem()], 'token');

      expect(result.results[0]).toEqual({
        sourcePath: 'drafts/',
        destinationPath: 'final/drafts/',
        success: false,
        error: 'Partial move',
      });
    });

    it('follows nextToken pagination to move all files across multiple pages', async () => {
      const { service, sdkClient } = makeService();

      sdkClient.getFileMetadata
        .mockResolvedValueOnce(
          makeFileMetadataPage(
            [
              {
                url: 'files/user-files/drafts/a.pdf',
                name: 'a.pdf',
                nodeType: 'item',
                contentLength: 10,
              },
            ],
            'cursor-1',
          ),
        )
        .mockResolvedValueOnce(
          makeFileMetadataPage([
            {
              url: 'files/user-files/drafts/b.pdf',
              name: 'b.pdf',
              nodeType: 'item',
              contentLength: 10,
            },
          ]),
        );
      sdkClient.moveResource.mockResolvedValue(okMove());

      const result = await service.moveFiles([folderItem()], 'token');

      expect(result.results[0].success).toBe(true);
      expect(sdkClient.moveResource).toHaveBeenCalledTimes(2);
    });

    it('returns success=true with no moveResource calls for an empty folder', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue(makeFileMetadataPage([]));

      const result = await service.moveFiles([folderItem()], 'token');

      expect(result.results[0].success).toBe(true);
      expect(sdkClient.moveResource).not.toHaveBeenCalled();
    });
  });

  describe('shareFiles', () => {
    const okShare = (invitationLink: string) => ({
      error: undefined,
      response: { status: 200 },
      data: { invitationLink },
    });

    it('returns the invitation link for a single-item share with read permission', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.shareResource = vi
        .fn()
        .mockResolvedValue(okShare('https://chat.example.com/share/abc123'));

      const result = await service.shareFiles(
        [{ bucket: 'user-bucket', path: 'reports/q1.pdf' }],
        SharePermission.Read,
        'token',
      );

      expect(result).toEqual({
        invitationLink: 'https://chat.example.com/share/abc123',
      });
      expect(sdkClient.shareResource).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer token' }),
          body: {
            invitationType: 'LINK',
            resources: [
              {
                url: 'files/user-bucket/reports/q1.pdf',
                permissions: ['READ'],
              },
            ],
          },
        }),
      );
    });

    it('maps readWrite permission to READ and WRITE', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.shareResource = vi
        .fn()
        .mockResolvedValue(okShare('https://chat.example.com/share/xyz'));

      await service.shareFiles(
        [{ bucket: 'user-bucket', path: 'reports/q1.pdf' }],
        SharePermission.ReadWrite,
        'token',
      );

      expect(sdkClient.shareResource).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            resources: [
              expect.objectContaining({ permissions: ['READ', 'WRITE'] }),
            ],
          }),
        }),
      );
    });

    it('issues exactly one Core call for a multi-item share', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.shareResource = vi
        .fn()
        .mockResolvedValue(okShare('https://chat.example.com/share/multi'));

      const result = await service.shareFiles(
        [
          { bucket: 'user-bucket', path: 'a.pdf' },
          { bucket: 'user-bucket', path: 'b.pdf' },
          { bucket: 'user-bucket', path: 'c.pdf' },
        ],
        SharePermission.Read,
        'token',
      );

      expect(sdkClient.shareResource).toHaveBeenCalledOnce();
      expect(sdkClient.shareResource).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            resources: [
              { url: 'files/user-bucket/a.pdf', permissions: ['READ'] },
              { url: 'files/user-bucket/b.pdf', permissions: ['READ'] },
              { url: 'files/user-bucket/c.pdf', permissions: ['READ'] },
            ],
          }),
        }),
      );
      expect(result.invitationLink).toBe(
        'https://chat.example.com/share/multi',
      );
    });

    it('throws ForbiddenException on 403', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.shareResource = vi.fn().mockResolvedValue(errResponse(403));

      await expect(
        service.shareFiles(
          [{ bucket: 'user-bucket', path: 'a.pdf' }],
          SharePermission.Read,
          'token',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException on 404', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.shareResource = vi.fn().mockResolvedValue(errResponse(404));

      await expect(
        service.shareFiles(
          [{ bucket: 'user-bucket', path: 'a.pdf' }],
          SharePermission.Read,
          'token',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadGatewayException on an unexpected error', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.shareResource = vi.fn().mockResolvedValue(errResponse(500));

      await expect(
        service.shareFiles(
          [{ bucket: 'user-bucket', path: 'a.pdf' }],
          SharePermission.Read,
          'token',
        ),
      ).rejects.toThrow(BadGatewayException);
    });
  });

  describe('revokeAccess', () => {
    const okRevoke = () => ({
      error: undefined,
      response: { status: 200 },
      data: undefined,
    });

    it('returns success=true for an owned, previously-shared resource', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.revokeSharedResources = vi.fn().mockResolvedValue(okRevoke());

      const result = await service.revokeAccess(
        [{ bucket: 'user-bucket', path: 'reports/q1.pdf' }],
        'token',
      );

      expect(result).toEqual({ success: true });
      expect(sdkClient.revokeSharedResources).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer token' }),
          body: {
            resources: [{ url: 'files/user-bucket/reports/q1.pdf' }],
          },
        }),
      );
    });

    it('calls Core once with the full item list for a batch', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.revokeSharedResources = vi.fn().mockResolvedValue(okRevoke());

      await service.revokeAccess(
        [
          { bucket: 'user-bucket', path: 'a.pdf' },
          { bucket: 'user-bucket', path: 'b.pdf' },
          { bucket: 'user-bucket', path: 'c.pdf' },
          { bucket: 'user-bucket', path: 'd.pdf' },
        ],
        'token',
      );

      expect(sdkClient.revokeSharedResources).toHaveBeenCalledOnce();
      expect(sdkClient.revokeSharedResources).toHaveBeenCalledWith(
        expect.objectContaining({
          body: {
            resources: [
              { url: 'files/user-bucket/a.pdf' },
              { url: 'files/user-bucket/b.pdf' },
              { url: 'files/user-bucket/c.pdf' },
              { url: 'files/user-bucket/d.pdf' },
            ],
          },
        }),
      );
    });

    it('throws ForbiddenException when the caller does not own the resource', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.revokeSharedResources = vi
        .fn()
        .mockResolvedValue(errResponse(403));

      await expect(
        service.revokeAccess(
          [{ bucket: 'user-bucket', path: 'a.pdf' }],
          'token',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException on 404', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.revokeSharedResources = vi
        .fn()
        .mockResolvedValue(errResponse(404));

      await expect(
        service.revokeAccess(
          [{ bucket: 'user-bucket', path: 'a.pdf' }],
          'token',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadGatewayException on an unexpected error', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.revokeSharedResources = vi
        .fn()
        .mockResolvedValue(errResponse(500));

      await expect(
        service.revokeAccess(
          [{ bucket: 'user-bucket', path: 'a.pdf' }],
          'token',
        ),
      ).rejects.toThrow(BadGatewayException);
    });
  });

  describe('discardShared', () => {
    const okDiscard = () => ({
      error: undefined,
      response: { status: 200 },
      data: undefined,
    });

    it('returns success=true for an item shared with the caller', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.discardSharedResources = vi.fn().mockResolvedValue(okDiscard());

      const result = await service.discardShared(
        [{ bucket: 'owner-bucket', path: 'shared.pdf' }],
        'token',
      );

      expect(result).toEqual({ success: true });
      expect(sdkClient.discardSharedResources).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer token' }),
          body: {
            resources: [{ url: 'files/owner-bucket/shared.pdf' }],
          },
        }),
      );
    });

    it('calls Core once with the full item list for a batch', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.discardSharedResources = vi.fn().mockResolvedValue(okDiscard());

      await service.discardShared(
        [
          { bucket: 'owner-bucket', path: 'a.pdf' },
          { bucket: 'owner-bucket', path: 'b.pdf' },
        ],
        'token',
      );

      expect(sdkClient.discardSharedResources).toHaveBeenCalledOnce();
    });

    it('throws ForbiddenException when the resource is not shared with the caller', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.discardSharedResources = vi
        .fn()
        .mockResolvedValue(errResponse(403));

      await expect(
        service.discardShared(
          [{ bucket: 'owner-bucket', path: 'a.pdf' }],
          'token',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException on 404', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.discardSharedResources = vi
        .fn()
        .mockResolvedValue(errResponse(404));

      await expect(
        service.discardShared(
          [{ bucket: 'owner-bucket', path: 'a.pdf' }],
          'token',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadGatewayException on an unexpected error', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.discardSharedResources = vi
        .fn()
        .mockResolvedValue(errResponse(500));

      await expect(
        service.discardShared(
          [{ bucket: 'owner-bucket', path: 'a.pdf' }],
          'token',
        ),
      ).rejects.toThrow(BadGatewayException);
    });
  });

  describe('listSharedByMe', () => {
    it('returns normalized items for the given bucket, filtering out other buckets', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getSharedResources.mockResolvedValue({
        error: undefined,
        response: { status: 200 },
        data: {
          resources: [
            {
              nodeType: 'ITEM',
              name: 'shared-by-me.pdf',
              url: 'files/user-bucket/shared-by-me.pdf',
              bucket: 'user-bucket',
            },
            {
              nodeType: 'ITEM',
              name: 'other-bucket.pdf',
              url: 'files/other-bucket/other-bucket.pdf',
              bucket: 'other-bucket',
            },
          ],
        },
      });

      const result = await service.listSharedByMe('user-bucket', 'token');

      expect(result.items).toEqual([
        expect.objectContaining({
          name: 'shared-by-me.pdf',
          bucket: 'user-bucket',
        }),
      ]);
      expect(sdkClient.getSharedResources).toHaveBeenCalledWith(
        expect.objectContaining({
          body: {
            resourceTypes: ['FILE'],
            with: 'others',
            includeUserInfo: false,
          },
        }),
      );
    });

    it('returns an empty items array, not an error, when nothing has been shared', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getSharedResources.mockResolvedValue({
        error: undefined,
        response: { status: 200 },
        data: { resources: [] },
      });

      const result = await service.listSharedByMe('user-bucket', 'token');

      expect(result.items).toEqual([]);
    });

    it('throws BadGatewayException on a Core error', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getSharedResources.mockResolvedValue(errResponse(500));

      await expect(
        service.listSharedByMe('user-bucket', 'token'),
      ).rejects.toThrow(BadGatewayException);
    });
  });
});
