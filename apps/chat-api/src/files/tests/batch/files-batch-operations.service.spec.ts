import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../../config/environment.config';
import type { DialClientService } from '../../../dial/dial-client.service';
import { FilesBatchOperationsService } from '../../batch/files-batch-operations.service';
import { FilesListingService } from '../../listing/files-listing.service';

type SdkClient = {
  getFileMetadata: ReturnType<typeof vi.fn>;
  deleteFile: ReturnType<typeof vi.fn>;
  moveResource: ReturnType<typeof vi.fn>;
  copyResource: ReturnType<typeof vi.fn>;
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
    deleteFile: vi.fn(),
    moveResource: vi.fn(),
    copyResource: vi.fn(),
  };

  const dialClient = {
    client: sdkClient,
    baseUrl: 'http://dial-core',
    dialApiVersion: '2024-10-21',
  } as unknown as DialClientService;

  const filesListingService = new FilesListingService(
    dialClient,
    configService,
  );
  const service = new FilesBatchOperationsService(
    dialClient,
    configService,
    filesListingService,
  );

  return { service, sdkClient };
}

describe('FilesBatchOperationsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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

    it('passes overwrite=true to DIAL Core copyResource when requested', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.copyResource.mockResolvedValue(okCopy());

      await service.copyFiles([singleFileItem({ overwrite: true })], 'token');

      expect(sdkClient.copyResource).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ overwrite: true }),
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

    it('passes overwrite=true to DIAL Core moveResource when requested', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.moveResource.mockResolvedValue(okMove());

      await service.moveFiles([singleFileItem({ overwrite: true })], 'token');

      expect(sdkClient.moveResource).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ overwrite: true }),
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
});
