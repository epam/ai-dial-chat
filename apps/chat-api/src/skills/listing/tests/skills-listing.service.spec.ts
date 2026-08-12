import {
  BadGatewayException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../../config/environment.config';
import type { DialClientService } from '../../../dial/dial-client.service';
import { SkillsListingService } from '../skills-listing.service';

const folderItem = {
  bucket: 'my-bucket',
  name: 'team-a',
  nodeType: 'FOLDER',
};

const skillItem = {
  bucket: 'my-bucket',
  name: 'docs-helper',
  nodeType: 'ITEM',
  parentPath: 'team-a/',
  etag: '"abc123"',
  author: 'user@example.com',
  createdAt: 1000,
  updatedAt: 2000,
  permissions: ['READ', 'WRITE'],
};

const makeService = (
  listSkillMetadataResult: unknown = {
    error: undefined,
    response: { status: 200 },
    data: { items: [folderItem, skillItem], nextToken: 'next-page' },
  },
) => {
  const sdkClient = {
    listSkillMetadata: vi.fn().mockResolvedValue(listSkillMetadataResult),
    listSkillFileMetadata: vi.fn().mockResolvedValue(listSkillMetadataResult),
  };

  const configService = {
    get: vi.fn().mockReturnValue(undefined),
  } as unknown as ConfigService<EnvironmentVariables>;

  const dialClient = {
    client: sdkClient,
    baseUrl: 'http://dial-core',
  } as unknown as DialClientService;

  const service = new SkillsListingService(dialClient, configService);
  return { service, sdkClient };
};

describe('SkillsListingService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('listSkills', () => {
    it('maps a folder item to nodeType folder with a trailing slash path', async () => {
      const { service } = makeService();
      const result = await service.listSkills('my-bucket', '', {}, 'token');
      const folder = result.items.find(
        (i: { name: string }) => i.name === 'team-a',
      );
      expect(folder?.nodeType).toBe('folder');
      expect(folder?.path).toBe('team-a/');
    });

    it('maps an item to nodeType item with etag/author/timestamps', async () => {
      const { service } = makeService();
      const result = await service.listSkills('my-bucket', '', {}, 'token');
      const item = result.items.find(
        (i: { name: string }) => i.name === 'docs-helper',
      );
      expect(item?.nodeType).toBe('item');
      expect(item?.etag).toBe('"abc123"');
      expect(item?.author).toBe('user@example.com');
      expect(item?.createdAt).toBe(1000);
      expect(item?.updatedAt).toBe(2000);
      expect(item?.permissions).toEqual(['READ', 'WRITE']);
    });

    it('round-trips the pagination token', async () => {
      const { service, sdkClient } = makeService();
      const result = await service.listSkills(
        'my-bucket',
        'team-a/',
        { token: 'page-1' },
        'token',
      );
      expect(result.nextToken).toBe('next-page');
      expect(sdkClient.listSkillMetadata).toHaveBeenCalledWith(
        'my-bucket',
        'team-a/',
        expect.objectContaining({
          params: {
            query: { token: 'page-1', limit: undefined, recursive: false },
          },
        }),
      );
    });

    it('returns an empty items array for an empty listing', async () => {
      const { service } = makeService({
        error: undefined,
        response: { status: 200 },
        data: {},
      });
      const result = await service.listSkills('my-bucket', '', {}, 'token');
      expect(result.items).toEqual([]);
    });

    it('skips malformed upstream metadata with no nodeType', async () => {
      const { service } = makeService({
        error: undefined,
        response: { status: 200 },
        data: { items: [{ bucket: 'my-bucket', name: 'weird' }] },
      });
      const result = await service.listSkills('my-bucket', '', {}, 'token');
      expect(result.items).toEqual([]);
    });

    it('maps a 400 to BadRequestException-derived error', async () => {
      const { service } = makeService({
        error: true,
        response: { status: 400 },
        data: undefined,
      });
      await expect(
        service.listSkills('my-bucket', '', {}, 'token'),
      ).rejects.toThrow();
    });

    it('maps a 403 to ForbiddenException', async () => {
      const { service } = makeService({
        error: true,
        response: { status: 403 },
        data: undefined,
      });
      await expect(
        service.listSkills('my-bucket', '', {}, 'token'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('maps a 404 to NotFoundException', async () => {
      const { service } = makeService({
        error: true,
        response: { status: 404 },
        data: undefined,
      });
      await expect(
        service.listSkills('my-bucket', '', {}, 'token'),
      ).rejects.toThrow(NotFoundException);
    });

    it('maps a 429 to a 429 HttpException', async () => {
      const { service } = makeService({
        error: true,
        response: { status: 429 },
        data: undefined,
      });
      await expect(
        service.listSkills('my-bucket', '', {}, 'token'),
      ).rejects.toThrow();
    });

    it('maps a 5xx to BadGatewayException', async () => {
      const { service } = makeService({
        error: true,
        response: { status: 502 },
        data: undefined,
      });
      await expect(
        service.listSkills('my-bucket', '', {}, 'token'),
      ).rejects.toThrow(BadGatewayException);
    });

    it('maps a network/timeout failure to ServiceUnavailableException', async () => {
      const sdkClient = {
        listSkillMetadata: vi
          .fn()
          .mockRejectedValue(
            Object.assign(new Error('aborted'), { name: 'TimeoutError' }),
          ),
        listSkillFileMetadata: vi.fn(),
      };
      const configService = {
        get: vi.fn().mockReturnValue(undefined),
      } as unknown as ConfigService<EnvironmentVariables>;
      const dialClient = {
        client: sdkClient,
        baseUrl: 'http://dial-core',
      } as unknown as DialClientService;
      const service = new SkillsListingService(dialClient, configService);

      await expect(
        service.listSkills('my-bucket', '', {}, 'token'),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('listSkillFiles', () => {
    it('calls listSkillFileMetadata with bucket/path/filePath', async () => {
      const { service, sdkClient } = makeService();
      await service.listSkillFiles(
        'my-bucket',
        'team-a/docs-helper',
        '',
        {},
        'token',
      );
      expect(sdkClient.listSkillFileMetadata).toHaveBeenCalledWith(
        'my-bucket',
        'team-a/docs-helper',
        '',
        expect.objectContaining({
          params: {
            query: { token: undefined, limit: undefined, recursive: false },
          },
        }),
      );
    });

    it('maps a 404 to NotFoundException', async () => {
      const { service } = makeService({
        error: true,
        response: { status: 404 },
        data: undefined,
      });
      await expect(
        service.listSkillFiles(
          'my-bucket',
          'team-a/docs-helper',
          '',
          {},
          'token',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
