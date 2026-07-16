import {
  BadGatewayException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../../config/environment.config';
import type { DialClientService } from '../../../dial/dial-client.service';
import { FilesListingService } from '../../listing/files-listing.service';

type SdkClient = {
  getFileMetadata: ReturnType<typeof vi.fn>;
  getSharedResources: ReturnType<typeof vi.fn>;
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
    getFileMetadata: vi.fn(),
    getSharedResources: vi.fn(),
  };

  const dialClient = {
    client: sdkClient,
    baseUrl: 'http://dial-core',
    dialApiVersion: '2024-10-21',
  } as unknown as DialClientService;

  const service = new FilesListingService(dialClient, configService);

  return { service, sdkClient };
}

const errResponse = (status: number) => ({
  error: new Error('HTTP error'),
  response: { status, headers: { get: () => null } },
  data: undefined,
});

describe('FilesListingService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
