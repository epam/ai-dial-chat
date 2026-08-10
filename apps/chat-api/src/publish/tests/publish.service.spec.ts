import { BadGatewayException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../dial/dial-client.service';
import { CatalogEntityType } from '../dto/catalog-entity-params.dto';
import { PublishRuleFunction } from '../dto/publish-rule.dto';
import { PublishService } from '../publish.service';

const okResponse = (data: unknown) =>
  ({ data, response: {} as Response }) as never;

const errResponse = (status: number) =>
  ({ error: {}, response: { status } as Response }) as never;

const makeCacheManager = () => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
});

const makeService = () => {
  const dialClient = {
    client: { createPublication: vi.fn(), getPublications: vi.fn() },
  } as unknown as DialClientService;
  const cacheManager = makeCacheManager();
  const service = new PublishService(dialClient, cacheManager as never);
  return { service, dialClient, cacheManager };
};

describe('PublishService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('publish', () => {
    it('calls createPublication with a public-bucket-qualified targetFolder/targetUrl and returns PublishResultDto', async () => {
      const { service, dialClient, cacheManager } = makeService();
      vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
        okResponse({
          createdAt: 1_700_000_000_000,
          author: 'user@example.com',
        }),
      );

      const result = await service.publish(
        'token-abc',
        CatalogEntityType.Toolset,
        'toolsets/bucket-123/tool-abc123__1.2.0',
        'Organization/Data Science',
        '1.2.0',
        'Test User',
      );

      expect(dialClient.client.createPublication).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token-abc' },
        body: {
          name: 'tool-abc123 1.2.0',
          targetFolder: 'public/Organization/Data%20Science/',
          resources: [
            {
              action: 'ADD',
              sourceUrl: 'toolsets/bucket-123/tool-abc123__1.2.0',
              targetUrl:
                'toolsets/public/Organization/Data%20Science/tool-abc123__1.2.0',
            },
          ],
          displayAuthor: 'Test User',
          rules: [],
        },
      });
      expect(result).toEqual({
        entityId: 'toolsets/bucket-123/tool-abc123__1.2.0',
        entityType: CatalogEntityType.Toolset,
        folderPath: 'Organization/Data Science',
        version: '1.2.0',
        publishedAt: new Date(1_700_000_000_000).toISOString(),
        publishedBy: 'user@example.com',
      });
      expect(cacheManager.del).toHaveBeenCalledWith(
        'publish-history:toolset:toolsets/bucket-123/tool-abc123__1.2.0',
      );
    });

    it('publishes a skill entityType, using the leaf name only for targetUrl and the caller-supplied version', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
        okResponse({
          createdAt: 1_700_000_000_000,
          author: 'user@example.com',
        }),
      );

      const result = await service.publish(
        'token-abc',
        CatalogEntityType.Skill,
        'skills/bucket-123/team-a/docs-helper',
        'Organization/Data Science',
        '2.1.0',
        'Test User',
      );

      expect(dialClient.client.createPublication).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token-abc' },
        body: {
          /* No {name}__{version} suffix to recover from a skill entityId —
             the title's "name" segment is the bare leaf path, and "version"
             is always the caller-supplied value for skills (open question,
             catalog-publish-api spec). */
          name: 'docs-helper 2.1.0',
          targetFolder: 'public/Organization/Data%20Science/',
          resources: [
            {
              action: 'ADD',
              sourceUrl: 'skills/bucket-123/team-a/docs-helper',
              /* Leaf name only — the "team-a/" grouping-folder subpath is
                 not preserved in targetUrl (documented collision risk). */
              targetUrl:
                'skills/public/Organization/Data%20Science/docs-helper',
            },
          ],
          displayAuthor: 'Test User',
          rules: [],
        },
      });
      expect(result).toEqual({
        entityId: 'skills/bucket-123/team-a/docs-helper',
        entityType: CatalogEntityType.Skill,
        folderPath: 'Organization/Data Science',
        version: '2.1.0',
        publishedAt: new Date(1_700_000_000_000).toISOString(),
        publishedBy: 'user@example.com',
      });
    });

    it('passes the caller-supplied rules through to createPublication unchanged', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
        okResponse({}),
      );

      const rules = [
        {
          source: 'roles',
          function: PublishRuleFunction.Contain,
          targets: ['engineering', 'support'],
        },
      ];

      await service.publish(
        'token-abc',
        CatalogEntityType.Toolset,
        'toolsets/bucket-123/tool-abc123__1.2.0',
        'Organization/Data Science',
        '1.2.0',
        'Test User',
        rules,
      );

      expect(dialClient.client.createPublication).toHaveBeenCalledWith(
        expect.objectContaining({ body: expect.objectContaining({ rules }) }),
      );
    });

    it('defaults rules to [] when omitted', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
        okResponse({}),
      );

      await service.publish(
        'token-abc',
        CatalogEntityType.Toolset,
        'toolsets/bucket-123/tool-abc123__1.2.0',
        'Organization/Data Science',
        '1.2.0',
        'Test User',
      );

      expect(dialClient.client.createPublication).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ rules: [] }),
        }),
      );
    });

    it('builds targetUrl as resourceTypePrefix + targetFolder + resourceName, matching the DIAL Core OpenAPI spec example', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
        okResponse({}),
      );

      await service.publish(
        'token-abc',
        CatalogEntityType.Application,
        'applications/bucket-123/My App Name__0.0.1',
        'DK Test with nested/Level 1',
        '0.0.1',
        'Test User',
      );

      expect(dialClient.client.createPublication).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token-abc' },
        body: {
          name: 'My App Name 0.0.1',
          targetFolder: 'public/DK%20Test%20with%20nested/Level%201/',
          resources: [
            {
              action: 'ADD',
              sourceUrl: 'applications/bucket-123/My App Name__0.0.1',
              targetUrl:
                'applications/public/DK%20Test%20with%20nested/Level%201/My App Name__0.0.1',
            },
          ],
          displayAuthor: 'Test User',
          rules: [],
        },
      });
    });

    it('uses a bare "public/" targetFolder when publishing to the public root (no subfolder)', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
        okResponse({}),
      );

      await service.publish(
        'token-abc',
        CatalogEntityType.Application,
        'applications/bucket-123/My App Name__0.0.1',
        '',
        '0.0.1',
        'Test User',
      );

      expect(dialClient.client.createPublication).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            targetFolder: 'public/',
            resources: [
              expect.objectContaining({
                targetUrl: 'applications/public/My App Name__0.0.1',
              }),
            ],
          }),
        }),
      );
    });

    it('percent-encodes folderPath segments in targetFolder/targetUrl, matching the reported "Bad resource url" 400 for a space in the folder name', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
        okResponse({}),
      );

      await service.publish(
        'token-abc',
        CatalogEntityType.Application,
        'applications/bucket-123/Untitled%20app123123123123__0.0.1',
        'test 14.04',
        '0.0.1',
        'Test User',
      );

      expect(dialClient.client.createPublication).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            targetFolder: 'public/test%2014.04/',
            resources: [
              expect.objectContaining({
                targetUrl:
                  'applications/public/test%2014.04/Untitled%20app123123123123__0.0.1',
              }),
            ],
          }),
        }),
      );
    });

    it('builds the request title as "{entity name} {version}", without the author, and sets displayAuthor/rules separately', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
        okResponse({}),
      );

      await service.publish(
        'token-abc',
        CatalogEntityType.Toolset,
        'toolsets/bucket-123/tool-abc123__1.2.0',
        'Organization/Data Science',
        '1.2.0',
        'Unknown Author',
      );

      expect(dialClient.client.createPublication).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            name: 'tool-abc123 1.2.0',
            displayAuthor: 'Unknown Author',
            rules: [],
          }),
        }),
      );
    });

    it('URL-decodes the entity name in the request title', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
        okResponse({}),
      );

      await service.publish(
        'token-abc',
        CatalogEntityType.Application,
        'applications/bucket-123/Untitled%20app%202222232__0.0.1',
        'folder02',
        '0.0.1',
        'Test User',
      );

      expect(dialClient.client.createPublication).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            name: 'Untitled app 2222232 0.0.1',
          }),
        }),
      );
    });

    it('maps a Core 403 to ForbiddenException', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
        errResponse(403),
      );

      await expect(
        service.publish(
          'token-abc',
          CatalogEntityType.Toolset,
          'toolsets/bucket-123/tool-abc123__1.2.0',
          'Organization/Production',
          '1.2.0',
          'Test User',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('maps an unexpected thrown error to BadGatewayException', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'createPublication').mockRejectedValue(
        new Error('boom'),
      );

      await expect(
        service.publish(
          'token-abc',
          CatalogEntityType.Toolset,
          'toolsets/bucket-123/tool-abc123__1.2.0',
          'Organization/Data Science',
          '1.2.0',
          'Test User',
        ),
      ).rejects.toBeInstanceOf(BadGatewayException);
    });
  });

  describe('getPublishHistory', () => {
    it('scopes the Core request by the caller own-bucket publications list (not entityId), maps matching publications, and recovers the version from entityId (not Publication.name)', async () => {
      const { service, dialClient, cacheManager } = makeService();
      cacheManager.get.mockResolvedValue(undefined);
      vi.spyOn(dialClient.client, 'getPublications').mockResolvedValue(
        okResponse([
          {
            name: 'New request by Test User',
            targetFolder: 'public/Organization/Data Science/',
            createdAt: 1_700_000_000_000,
            author: 'user@example.com',
            resources: [
              {
                sourceUrl: 'toolsets/bucket-123/tool-abc123__1.2.0',
                targetUrl:
                  'toolsets/public/Organization/Data Science/tool-abc123__1.2.0',
              },
            ],
          },
          {
            name: 'New request by Someone Else',
            targetFolder: 'public/Organization/Other/',
            resources: [
              { sourceUrl: 'toolsets/bucket-123/some-other-entity__0.9.0' },
            ],
          },
        ]),
      );

      const result = await service.getPublishHistory(
        'token-abc',
        CatalogEntityType.Toolset,
        'toolsets/bucket-123/tool-abc123__1.2.0',
      );

      expect(dialClient.client.getPublications).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token-abc' },
        body: { url: 'publications/bucket-123/' },
      });
      expect(result).toEqual([
        {
          entityId: 'toolsets/bucket-123/tool-abc123__1.2.0',
          entityType: CatalogEntityType.Toolset,
          folderPath: 'Organization/Data Science',
          version: '1.2.0',
          publishedAt: new Date(1_700_000_000_000).toISOString(),
          publishedBy: 'user@example.com',
        },
      ]);
    });

    it('returns an empty version when entityId has no {name}__{version} suffix', async () => {
      const { service, dialClient, cacheManager } = makeService();
      cacheManager.get.mockResolvedValue(undefined);
      vi.spyOn(dialClient.client, 'getPublications').mockResolvedValue(
        okResponse([
          {
            targetFolder: 'public/Organization/Data Science/',
            resources: [
              {
                sourceUrl: 'toolsets/bucket-123/legacy-entity-without-version',
              },
            ],
          },
        ]),
      );

      const result = await service.getPublishHistory(
        'token-abc',
        CatalogEntityType.Toolset,
        'toolsets/bucket-123/legacy-entity-without-version',
      );

      expect(result[0].version).toBe('');
    });

    it('maps a bare "public/" targetFolder back to an empty folderPath (public root)', async () => {
      const { service, dialClient, cacheManager } = makeService();
      cacheManager.get.mockResolvedValue(undefined);
      vi.spyOn(dialClient.client, 'getPublications').mockResolvedValue(
        okResponse([
          {
            targetFolder: 'public/',
            resources: [
              { sourceUrl: 'toolsets/bucket-123/tool-abc123__1.0.0' },
            ],
          },
        ]),
      );

      const result = await service.getPublishHistory(
        'token-abc',
        CatalogEntityType.Toolset,
        'toolsets/bucket-123/tool-abc123__1.0.0',
      );

      expect(result[0].folderPath).toBe('');
    });

    it('decodes percent-encoded segments in targetFolder back to plain text', async () => {
      const { service, dialClient, cacheManager } = makeService();
      cacheManager.get.mockResolvedValue(undefined);
      vi.spyOn(dialClient.client, 'getPublications').mockResolvedValue(
        okResponse([
          {
            targetFolder: 'public/test%2014.04/',
            resources: [
              { sourceUrl: 'toolsets/bucket-123/tool-abc123__1.0.0' },
            ],
          },
        ]),
      );

      const result = await service.getPublishHistory(
        'token-abc',
        CatalogEntityType.Toolset,
        'toolsets/bucket-123/tool-abc123__1.0.0',
      );

      expect(result[0].folderPath).toBe('test 14.04');
    });

    it('returns an empty array when no publications match', async () => {
      const { service, dialClient, cacheManager } = makeService();
      cacheManager.get.mockResolvedValue(undefined);
      vi.spyOn(dialClient.client, 'getPublications').mockResolvedValue(
        okResponse([]),
      );

      const result = await service.getPublishHistory(
        'token-abc',
        CatalogEntityType.Toolset,
        'toolsets/bucket-123/tool-abc123__1.2.0',
      );

      expect(result).toEqual([]);
    });

    it('returns the cached value without calling Core again', async () => {
      const { service, dialClient, cacheManager } = makeService();
      cacheManager.get.mockResolvedValue([{ entityId: 'cached' }]);

      const result = await service.getPublishHistory(
        'token-abc',
        CatalogEntityType.Toolset,
        'toolsets/bucket-123/tool-abc123__1.2.0',
      );

      expect(result).toEqual([{ entityId: 'cached' }]);
      expect(dialClient.client.getPublications).not.toHaveBeenCalled();
    });

    it('maps an unexpected Core error to BadGatewayException', async () => {
      const { service, dialClient, cacheManager } = makeService();
      cacheManager.get.mockResolvedValue(undefined);
      vi.spyOn(dialClient.client, 'getPublications').mockResolvedValue(
        errResponse(500),
      );

      await expect(
        service.getPublishHistory(
          'token-abc',
          CatalogEntityType.Toolset,
          'toolsets/bucket-123/tool-abc123__1.2.0',
        ),
      ).rejects.toBeInstanceOf(BadGatewayException);
    });
  });
});
