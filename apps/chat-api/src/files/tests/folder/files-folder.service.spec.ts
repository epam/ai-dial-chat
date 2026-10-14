import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../../config/environment.config';
import type { DialClientService } from '../../../dial/dial-client.service';
import { FilesFolderService } from '../../folder/files-folder.service';
import { FilesUploadService } from '../../upload/files-upload.service';

type SdkClient = {
  getFileMetadata: ReturnType<typeof vi.fn>;
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
  };
  const fetchCore = vi.fn();

  const dialClient = {
    client: sdkClient,
    baseUrl: 'http://dial-core',
    dialApiVersion: '2024-10-21',
    fetchCore,
  } as unknown as DialClientService;

  const filesUploadService = new FilesUploadService(dialClient, configService);
  const service = new FilesFolderService(
    dialClient,
    configService,
    filesUploadService,
  );

  return { service, sdkClient, fetchCore };
}

const respondWith =
  (status: number) => async (_: string, init: RequestInit) => {
    const reader = (init.body as ReadableStream).getReader();
    while (!(await reader.read()).done) {
      /* drain the marker upload body */
    }
    return new Response(null, { status });
  };

const errResponse = (status: number) => ({
  error: new Error('HTTP error'),
  response: { status, headers: { get: () => null } },
  data: undefined,
});

describe('FilesFolderService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('createFolder', () => {
    const notFound = () => ({
      error: new Error('Not found'),
      response: { status: 404, headers: { get: () => null } },
      data: undefined,
    });

    it('returns CreateFolderResponseDto on success', async () => {
      const { service, sdkClient, fetchCore } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue(notFound());
      fetchCore.mockImplementation(respondWith(201));

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
      expect(fetchCore.mock.calls[0][0]).toBe(
        'http://dial-core/v1/files/my-bucket/reports/2026/.dial_folder',
      );
    });

    it('throws ConflictException when marker already exists at target path', async () => {
      const { service, sdkClient, fetchCore } = makeService();
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
      expect(fetchCore).not.toHaveBeenCalled();
    });

    it('uploads marker when metadata probe returns parent folder marker', async () => {
      const { service, sdkClient, fetchCore } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue({
        error: undefined,
        response: { status: 200, headers: { get: () => null } },
        data: {
          nodeType: 'ITEM',
          name: '.dial_folder',
          url: 'files/my-bucket/asdasd/d/.dial_folder',
        },
      });
      fetchCore.mockImplementation(respondWith(201));

      await service.createFolder(
        'my-bucket',
        'asdasd/d/',
        'New folder 1',
        'token',
      );

      expect(fetchCore.mock.calls[0][0]).toBe(
        'http://dial-core/v1/files/my-bucket/asdasd/d/New%20folder%201/.dial_folder',
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
      const { service, sdkClient, fetchCore } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue(notFound());
      fetchCore.mockImplementation(respondWith(403));

      await expect(
        service.createFolder('my-bucket', '', 'reports', 'token'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('normalizes parentPath to include trailing slash', async () => {
      const { service, sdkClient, fetchCore } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue(notFound());
      fetchCore.mockImplementation(respondWith(201));

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
      const { service, sdkClient, fetchCore } = makeService();
      sdkClient.getFileMetadata.mockResolvedValue(notFound());
      fetchCore.mockImplementation(respondWith(201));

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
});
