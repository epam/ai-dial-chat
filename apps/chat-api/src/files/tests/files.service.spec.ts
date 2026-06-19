import {
  BadGatewayException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../config/environment.config';
import { FilesService } from '../files.service';

type SdkClient = {
  uploadFile: ReturnType<typeof vi.fn>;
  downloadFile: ReturnType<typeof vi.fn>;
  getFileMetadata: ReturnType<typeof vi.fn>;
};

function makeService() {
  const configService = {
    get: vi.fn((key: string) => {
      if (key === 'DIAL_CORE_URL') return 'http://dial-core';
      if (key === 'FILE_TRANSFER_TIMEOUT_MS') return 30_000;
      return undefined;
    }),
  } as unknown as ConfigService<EnvironmentVariables>;

  const sdkClient: SdkClient = {
    uploadFile: vi.fn(),
    downloadFile: vi.fn(),
    getFileMetadata: vi.fn(),
  };

  const service = new FilesService(configService);
  (service as unknown as { client: SdkClient }).client = sdkClient;

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

    it('includes nextToken when DIAL returns one', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue(okList([], 'cursor-abc'));

      const result = await service.listFiles(
        'my-bucket',
        undefined,
        {},
        'token',
      );
      expect(result.nextToken).toBe('cursor-abc');
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
        expect.anything(),
      );
    });

    it('normalizes path without trailing slash before SDK call', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue(okList([]));

      await service.listFiles('my-bucket', 'reports', {}, 'at');
      expect(sdkClient.getFileMetadata).toHaveBeenCalledWith(
        'my-bucket',
        'reports/',
        expect.anything(),
      );
    });
  });
});
