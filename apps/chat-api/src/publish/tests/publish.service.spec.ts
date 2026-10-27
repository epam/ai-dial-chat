import { BadGatewayException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminRoleService } from '../../auth/admin-role.service';
import type { DialClientService } from '../../dial/dial-client.service';
import { CatalogEntityType } from '../dto/catalog-entity-params.dto';
import { PublishRuleFunction } from '../dto/publish-rule.dto';
import { PublishService } from '../publish.service';

/* The caller's session bucket, passed through to every publish call. */
const TEST_BUCKET = 'bucket-123';

const okResponse = (data: unknown) =>
  ({ data, response: { ok: true, status: 200 } as Response }) as never;

const errResponse = (status: number) =>
  ({ error: {}, response: { ok: false, status } as Response }) as never;

/*
 * `openapi-fetch` short-circuits on an empty response body and returns
 * `{ error: undefined }` without reading it, even for a non-2xx status — see
 * the matching guard comment in `publish.service.ts`.
 */
const emptyBodyErrResponse = (status: number) =>
  ({ response: { ok: false, status } as Response }) as never;

const makeCacheManager = () => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
});

const makeService = () => {
  const dialClient = {
    client: {
      createPublication: vi.fn(),
      getCustomApplication: vi.fn().mockResolvedValue(okResponse({})),
      getPublication: vi.fn(),
      getPublications: vi.fn(),
    },
  } as unknown as DialClientService;
  const cacheManager = makeCacheManager();
  const service = new PublishService(
    dialClient,
    cacheManager as never,
    { isAdmin: vi.fn().mockReturnValue(false) } as unknown as AdminRoleService,
  );
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
        TEST_BUCKET,
        CatalogEntityType.Toolset,
        'toolsets/bucket-123/tool-abc123__1.2.0',
        'Organization/Data Science',
        undefined,
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

    it('falls back to the caller-supplied author and the current time when Core returns no parseable publication body', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
        okResponse(undefined),
      );

      const result = await service.publish(
        'token-abc',
        TEST_BUCKET,
        CatalogEntityType.Toolset,
        'toolsets/bucket-123/tool-abc123__1.2.0',
        'Organization/Data Science',
        undefined,
        'Test User',
      );

      expect(result.publishedBy).toBe('Test User');
      expect(new Date(result.publishedAt).toString()).not.toBe('Invalid Date');
    });

    /*
     * The round trip the Author field exists for ([#8727](https://github.com/epam/ai-dial-chat/issues/8727)): Core always
     * records its own token-derived `author`, so reading that first made the
     * submitted display author unobservable in every response this API hands
     * back.
     */
    it('reports the submitted display author, not the account Core recorded', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
        okResponse({
          createdAt: 1_700_000_000_000,
          author: 'user@example.com',
          displayAuthor: 'DIAL Team',
        }),
      );

      const result = await service.publish(
        'token-abc',
        TEST_BUCKET,
        CatalogEntityType.Toolset,
        'toolsets/bucket-123/tool-abc123__1.2.0',
        'Organization/Data Science',
        undefined,
        'DIAL Team',
      );

      expect(result.publishedBy).toBe('DIAL Team');
    });

    /* Core stores an omitted display author as `''`, not as a missing key. */
    it('reports the recorded account when Core stored an empty display author', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
        okResponse({
          createdAt: 1_700_000_000_000,
          author: 'user@example.com',
          displayAuthor: '',
        }),
      );

      const result = await service.publish(
        'token-abc',
        TEST_BUCKET,
        CatalogEntityType.Toolset,
        'toolsets/bucket-123/tool-abc123__1.2.0',
        'Organization/Data Science',
        undefined,
        'Test User',
      );

      expect(result.publishedBy).toBe('user@example.com');
    });

    it('publishes an unversioned skill using only its leaf name in the publication title and targetUrl', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
        okResponse({
          createdAt: 1_700_000_000_000,
          author: 'user@example.com',
        }),
      );

      const result = await service.publish(
        'token-abc',
        TEST_BUCKET,
        CatalogEntityType.Skill,
        'skills/bucket-123/team-a/docs-helper',
        'Organization/Data Science',
        undefined,
        'Test User',
      );

      expect(dialClient.client.createPublication).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token-abc' },
        body: {
          name: 'docs-helper',
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
        version: '',
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
        TEST_BUCKET,
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
        TEST_BUCKET,
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

    it('sets publishCredentials on the ADD resource when the flag is true', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
        okResponse({}),
      );

      await service.publish(
        'token-abc',
        TEST_BUCKET,
        CatalogEntityType.Toolset,
        'toolsets/bucket-123/tool-abc123__1.2.0',
        'Organization/Data Science',
        '1.2.0',
        'Test User',
        undefined,
        true,
      );

      expect(dialClient.client.createPublication).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            resources: [
              {
                action: 'ADD',
                sourceUrl: 'toolsets/bucket-123/tool-abc123__1.2.0',
                targetUrl:
                  'toolsets/public/Organization/Data%20Science/tool-abc123__1.2.0',
                publishCredentials: true,
              },
            ],
          }),
        }),
      );
    });

    /*
     * Omitted rather than sent as `false`, so the Core request stays
     * byte-identical to the pre-change one for every existing caller.
     */
    it('omits publishCredentials entirely when the flag is false', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
        okResponse({}),
      );

      await service.publish(
        'token-abc',
        TEST_BUCKET,
        CatalogEntityType.Toolset,
        'toolsets/bucket-123/tool-abc123__1.2.0',
        'Organization/Data Science',
        '1.2.0',
        'Test User',
        undefined,
        false,
      );

      const [[call]] = vi.mocked(dialClient.client.createPublication).mock
        .calls as unknown as [
        [{ body: { resources: Record<string, unknown>[] } }],
      ];
      expect(call.body.resources[0]).not.toHaveProperty('publishCredentials');
    });

    it('omits publishCredentials entirely when the flag is absent', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
        okResponse({}),
      );

      await service.publish(
        'token-abc',
        TEST_BUCKET,
        CatalogEntityType.Toolset,
        'toolsets/bucket-123/tool-abc123__1.2.0',
        'Organization/Data Science',
        '1.2.0',
        'Test User',
      );

      const [[call]] = vi.mocked(dialClient.client.createPublication).mock
        .calls as unknown as [
        [{ body: { resources: Record<string, unknown>[] } }],
      ];
      expect(call.body.resources[0]).not.toHaveProperty('publishCredentials');
    });

    it('publishes a new version of an edited toolset under a new {name}__{version} target, not the path it was created with', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
        okResponse({ createdAt: 1_700_000_000_000 }),
      );

      await service.publish(
        'token',
        TEST_BUCKET,
        CatalogEntityType.Toolset,
        'toolsets/bucket-123/my-tool__1.0.0',
        'Team',
        '1.0.1',
        'Test User',
      );

      expect(dialClient.client.createPublication).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            name: 'my-tool 1.0.1',
            resources: [
              {
                action: 'ADD',
                sourceUrl: 'toolsets/bucket-123/my-tool__1.0.0',
                targetUrl: 'toolsets/public/Team/my-tool__1.0.1',
              },
            ],
          }),
        }),
      );
    });

    it('keeps the source name in targetUrl when the supplied version has characters outside the version charset', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
        okResponse({ createdAt: 1_700_000_000_000 }),
      );

      await service.publish(
        'token',
        TEST_BUCKET,
        CatalogEntityType.Toolset,
        'toolsets/bucket-123/my-tool__1.0.0',
        'Team',
        '../evil',
        'Test User',
      );

      expect(dialClient.client.createPublication).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            resources: [
              expect.objectContaining({
                targetUrl: 'toolsets/public/Team/my-tool__1.0.0',
              }),
            ],
          }),
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
        TEST_BUCKET,
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
              sourceUrl: 'applications/bucket-123/My%20App%20Name__0.0.1',
              targetUrl:
                'applications/public/DK%20Test%20with%20nested/Level%201/My%20App%20Name__0.0.1',
            },
          ],
          displayAuthor: 'Test User',
          rules: [],
        },
      });
    });

    it('publishes an application uploaded icon alongside the app, nested under its versioned target name', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.getCustomApplication).mockResolvedValue(
        okResponse({ iconUrl: 'files/bucket-123/icons/app%20icon.png?v=1' }),
      );
      vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
        okResponse({}),
      );

      await service.publish(
        'token-abc',
        TEST_BUCKET,
        CatalogEntityType.Application,
        'applications/bucket-123/My App__0.0.1',
        'Team',
        '0.0.2',
        'Test User',
      );

      expect(dialClient.client.getCustomApplication).toHaveBeenCalledWith(
        'bucket-123',
        'My%20App__0.0.1',
        { headers: { Authorization: 'Bearer token-abc' } },
      );
      expect(dialClient.client.createPublication).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            resources: [
              {
                action: 'ADD',
                sourceUrl: 'applications/bucket-123/My%20App__0.0.1',
                targetUrl: 'applications/public/Team/My%20App__0.0.2',
              },
              {
                action: 'ADD',
                sourceUrl: 'files/bucket-123/icons/app%20icon.png',
                targetUrl: 'files/public/Team/My%20App__0.0.2/app%20icon.png',
              },
            ],
          }),
        }),
      );
    });

    it.each([
      ['a public-bucket file', { iconUrl: 'files/public/icons/app.png' }],
      ['another bucket file', { iconUrl: 'files/other/icons/app.png' }],
      ['an absolute URL', { iconUrl: 'https://example.com/app.png' }],
      ['a theme icon name', { icon_url: 'app-theme-icon.svg' }],
    ])(
      'publishes the application alone when its icon is %s',
      async (_label, application) => {
        const { service, dialClient } = makeService();
        vi.mocked(dialClient.client.getCustomApplication).mockResolvedValue(
          okResponse(application),
        );
        vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
          okResponse({}),
        );

        await service.publish(
          'token-abc',
          TEST_BUCKET,
          CatalogEntityType.Application,
          'applications/bucket-123/my-app__0.0.1',
          'Team',
          undefined,
          'Test User',
        );

        expect(dialClient.client.createPublication).toHaveBeenCalledWith(
          expect.objectContaining({
            body: expect.objectContaining({
              resources: [
                {
                  action: 'ADD',
                  sourceUrl: 'applications/bucket-123/my-app__0.0.1',
                  targetUrl: 'applications/public/Team/my-app__0.0.1',
                },
              ],
            }),
          }),
        );
      },
    );

    it.each([
      ['rejects', () => Promise.reject(new Error('network'))],
      ['returns an upstream error', () => Promise.resolve(errResponse(500))],
    ])(
      'still publishes the application alone when the application read %s',
      async (_label, readResult) => {
        const { service, dialClient } = makeService();
        vi.mocked(dialClient.client.getCustomApplication).mockImplementation(
          readResult as never,
        );
        vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
          okResponse({}),
        );

        await service.publish(
          'token-abc',
          TEST_BUCKET,
          CatalogEntityType.Application,
          'applications/bucket-123/my-app__0.0.1',
          'Team',
          undefined,
          'Test User',
        );

        expect(dialClient.client.createPublication).toHaveBeenCalledWith(
          expect.objectContaining({
            body: expect.objectContaining({
              resources: [
                {
                  action: 'ADD',
                  sourceUrl: 'applications/bucket-123/my-app__0.0.1',
                  targetUrl: 'applications/public/Team/my-app__0.0.1',
                },
              ],
            }),
          }),
        );
      },
    );

    it('does not read the entity for a non-application publish', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
        okResponse({}),
      );

      await service.publish(
        'token-abc',
        TEST_BUCKET,
        CatalogEntityType.Toolset,
        'toolsets/bucket-123/tool__1.0.0',
        'Team',
        undefined,
        'Test User',
      );

      expect(dialClient.client.getCustomApplication).not.toHaveBeenCalled();
    });

    it('uses a bare "public/" targetFolder when publishing to the public root (no subfolder)', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
        okResponse({}),
      );

      await service.publish(
        'token-abc',
        TEST_BUCKET,
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
                targetUrl: 'applications/public/My%20App%20Name__0.0.1',
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
        TEST_BUCKET,
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
        TEST_BUCKET,
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
        TEST_BUCKET,
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

    it('percent-encodes a raw space in a versionless prompt name in both sourceUrl and targetUrl', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
        okResponse({}),
      );

      await service.publish(
        'token-abc',
        TEST_BUCKET,
        CatalogEntityType.Prompt,
        'prompts/bucket-123/test space',
        '01folder',
        undefined,
        'Test User',
      );

      expect(dialClient.client.createPublication).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            resources: [
              expect.objectContaining({
                sourceUrl: 'prompts/bucket-123/test%20space',
                targetUrl: 'prompts/public/01folder/test%20space',
              }),
            ],
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
          TEST_BUCKET,
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
          TEST_BUCKET,
          CatalogEntityType.Toolset,
          'toolsets/bucket-123/tool-abc123__1.2.0',
          'Organization/Data Science',
          '1.2.0',
          'Test User',
        ),
      ).rejects.toBeInstanceOf(BadGatewayException);
    });

    it('maps a Core 500 with an empty response body to BadGatewayException instead of reporting success', async () => {
      const { service, dialClient, cacheManager } = makeService();
      vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
        emptyBodyErrResponse(500),
      );

      await expect(
        service.publish(
          'token-abc',
          TEST_BUCKET,
          CatalogEntityType.Toolset,
          'toolsets/bucket-123/tool-abc123__1.2.0',
          'Organization/Data Science',
          '1.2.0',
          'Test User',
        ),
      ).rejects.toBeInstanceOf(BadGatewayException);
      expect(cacheManager.del).not.toHaveBeenCalled();
    });
  });

  describe('getPublishHistory', () => {
    /*
     * The regression the detail lookup exists for: Core's list call returns
     * publication metadata only — no `resources` — so filtering the list
     * response matched nothing. A live Core returned 60 publications and
     * history still came back empty, hiding Unpublish on a published entity.
     */
    it('re-reads each APPROVED publication, because the list omits resources', async () => {
      const { service, dialClient, cacheManager } = makeService();
      cacheManager.get.mockResolvedValue(undefined);
      vi.spyOn(dialClient.client, 'getPublications').mockResolvedValue(
        okResponse([
          {
            url: 'publications/bucket-123/mine',
            status: 'APPROVED',
            targetFolder: 'public/Organization/Data Science/',
          },
          {
            url: 'publications/bucket-123/someone-else',
            status: 'APPROVED',
            targetFolder: 'public/Organization/Other/',
          },
          {
            url: 'publications/bucket-123/awaiting-approval',
            status: 'PENDING',
            targetFolder: 'public/Organization/Pending/',
          },
        ]),
      );
      vi.spyOn(dialClient.client, 'getPublication').mockImplementation((async ({
        body,
      }: {
        body: { url: string };
      }) =>
        okResponse({
          url: body.url,
          status: 'APPROVED',
          targetFolder:
            body.url === 'publications/bucket-123/mine'
              ? 'public/Organization/Data Science/'
              : 'public/Organization/Other/',
          createdAt: 1_700_000_000_000,
          author: 'user@example.com',
          resources: [
            {
              sourceUrl:
                body.url === 'publications/bucket-123/mine'
                  ? 'toolsets/bucket-123/tool-abc123__1.2.0'
                  : 'toolsets/bucket-123/some-other-entity__0.9.0',
            },
          ],
        })) as never);

      const result = await service.getPublishHistory(
        'token-abc',
        TEST_BUCKET,
        CatalogEntityType.Toolset,
        'toolsets/bucket-123/tool-abc123__1.2.0',
      );

      /* The PENDING publication is not a published copy, so it is never read. */
      expect(dialClient.client.getPublication).toHaveBeenCalledTimes(2);
      expect(dialClient.client.getPublication).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token-abc' },
        body: { url: 'publications/bucket-123/mine' },
      });
      expect(result).toEqual([
        {
          entityId: 'toolsets/bucket-123/tool-abc123__1.2.0',
          entityType: CatalogEntityType.Toolset,
          folderPath: 'Organization/Data Science',
          version: '1.2.0',
          publishedAt: new Date(1_700_000_000_000).toISOString(),
          publishedBy: 'user@example.com',
          publishCredentials: false,
        },
      ]);
    });

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
        TEST_BUCKET,
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
          publishCredentials: false,
        },
      ]);
    });

    it('reports the version a publication put in the folder, read off its targetUrl', async () => {
      const { service, dialClient, cacheManager } = makeService();
      cacheManager.get.mockResolvedValue(undefined);
      vi.spyOn(dialClient.client, 'getPublications').mockResolvedValue(
        okResponse([
          {
            targetFolder: 'public/Team/',
            createdAt: 1_700_000_000_000,
            resources: [
              {
                sourceUrl: 'toolsets/bucket-123/my-tool__1.0.0',
                targetUrl: 'toolsets/public/Team/my-tool__1.0.1',
              },
            ],
          },
        ]),
      );

      const result = await service.getPublishHistory(
        'token',
        TEST_BUCKET,
        CatalogEntityType.Toolset,
        'toolsets/bucket-123/my-tool__1.0.0',
      );

      expect(result).toEqual([
        expect.objectContaining({ folderPath: 'Team', version: '1.0.1' }),
      ]);
    });

    /* History is the surface a re-publish is judged from, so it must name the
       author the publisher chose, not the account Core recorded ([#8727](https://github.com/epam/ai-dial-chat/issues/8727)). */
    it('reports each publication submitted display author', async () => {
      const { service, dialClient, cacheManager } = makeService();
      cacheManager.get.mockResolvedValue(undefined);
      vi.spyOn(dialClient.client, 'getPublications').mockResolvedValue(
        okResponse([
          {
            targetFolder: 'public/Organization/Data Science/',
            createdAt: 1_700_000_000_000,
            author: 'user@example.com',
            displayAuthor: 'DIAL Team',
            resources: [
              { sourceUrl: 'toolsets/bucket-123/tool-abc123__1.2.0' },
            ],
          },
        ]),
      );

      const result = await service.getPublishHistory(
        'token-abc',
        TEST_BUCKET,
        CatalogEntityType.Toolset,
        'toolsets/bucket-123/tool-abc123__1.2.0',
      );

      expect(result[0].publishedBy).toBe('DIAL Team');
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
        TEST_BUCKET,
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
        TEST_BUCKET,
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
        TEST_BUCKET,
        CatalogEntityType.Toolset,
        'toolsets/bucket-123/tool-abc123__1.0.0',
      );

      expect(result[0].folderPath).toBe('test 14.04');
    });

    /*
     * The flag rides on the resource, so it is read back off the same resource
     * the narrowing already matched by `sourceUrl` — see
     * `getPublicationSourceCredentials`.
     */
    it('reports publishCredentials: true for a publication made with shared credentials', async () => {
      const { service, dialClient, cacheManager } = makeService();
      cacheManager.get.mockResolvedValue(undefined);
      vi.spyOn(dialClient.client, 'getPublications').mockResolvedValue(
        okResponse([
          {
            status: 'APPROVED',
            targetFolder: 'public/Organization/Data Science/',
            createdAt: 1_700_000_000_000,
            author: 'user@example.com',
            resources: [
              {
                action: 'ADD',
                sourceUrl: 'toolsets/bucket-123/tool-abc123__1.2.0',
                publishCredentials: true,
              },
            ],
          },
        ]),
      );

      const result = await service.getPublishHistory(
        'token-abc',
        TEST_BUCKET,
        CatalogEntityType.Toolset,
        'toolsets/bucket-123/tool-abc123__1.2.0',
      );

      expect(result).toHaveLength(1);
      expect(result[0].publishCredentials).toBe(true);
    });

    it('reports publishCredentials: false when the resource carries the flag as false', async () => {
      const { service, dialClient, cacheManager } = makeService();
      cacheManager.get.mockResolvedValue(undefined);
      vi.spyOn(dialClient.client, 'getPublications').mockResolvedValue(
        okResponse([
          {
            status: 'APPROVED',
            targetFolder: 'public/Organization/Data Science/',
            createdAt: 1_700_000_000_000,
            author: 'user@example.com',
            resources: [
              {
                action: 'ADD',
                sourceUrl: 'toolsets/bucket-123/tool-abc123__1.2.0',
                publishCredentials: false,
              },
            ],
          },
        ]),
      );

      const result = await service.getPublishHistory(
        'token-abc',
        TEST_BUCKET,
        CatalogEntityType.Toolset,
        'toolsets/bucket-123/tool-abc123__1.2.0',
      );

      expect(result[0].publishCredentials).toBe(false);
    });

    /* A publication predating the field reports false, never an absent key. */
    it('reports publishCredentials: false when the resource has no such property', async () => {
      const { service, dialClient, cacheManager } = makeService();
      cacheManager.get.mockResolvedValue(undefined);
      vi.spyOn(dialClient.client, 'getPublications').mockResolvedValue(
        okResponse([
          {
            status: 'APPROVED',
            targetFolder: 'public/Organization/Data Science/',
            createdAt: 1_700_000_000_000,
            author: 'user@example.com',
            resources: [
              { sourceUrl: 'toolsets/bucket-123/tool-abc123__1.2.0' },
            ],
          },
        ]),
      );

      const result = await service.getPublishHistory(
        'token-abc',
        TEST_BUCKET,
        CatalogEntityType.Toolset,
        'toolsets/bucket-123/tool-abc123__1.2.0',
      );

      expect(result[0]).toHaveProperty('publishCredentials', false);
    });

    /*
     * Regression guard for the narrowing the new field rides along with: an
     * approved DELETE still cancels the ADD it removed, ordering is still
     * newest-first, and only the extra field was added to each entry.
     */
    it('leaves narrowing, ordering, and DELETE cancellation unchanged', async () => {
      const { service, dialClient, cacheManager } = makeService();
      cacheManager.get.mockResolvedValue(undefined);
      vi.spyOn(dialClient.client, 'getPublications').mockResolvedValue(
        okResponse([
          {
            status: 'APPROVED',
            targetFolder: 'public/Organization/Removed/',
            createdAt: 1_700_000_000_000,
            author: 'user@example.com',
            resources: [
              {
                action: 'ADD',
                sourceUrl: 'toolsets/bucket-123/tool-abc123__1.2.0',
                publishCredentials: true,
              },
            ],
          },
          {
            status: 'APPROVED',
            targetFolder: 'public/Organization/Removed/',
            createdAt: 1_700_000_100_000,
            author: 'user@example.com',
            resources: [
              {
                action: 'DELETE',
                sourceUrl: 'toolsets/bucket-123/tool-abc123__1.2.0',
              },
            ],
          },
          {
            status: 'APPROVED',
            targetFolder: 'public/Organization/Older/',
            createdAt: 1_600_000_000_000,
            author: 'user@example.com',
            resources: [
              { sourceUrl: 'toolsets/bucket-123/tool-abc123__1.2.0' },
            ],
          },
          {
            status: 'APPROVED',
            targetFolder: 'public/Organization/Newer/',
            createdAt: 1_800_000_000_000,
            author: 'user@example.com',
            resources: [
              {
                action: 'ADD',
                sourceUrl: 'toolsets/bucket-123/tool-abc123__1.2.0',
                publishCredentials: true,
              },
            ],
          },
        ]),
      );

      const result = await service.getPublishHistory(
        'token-abc',
        TEST_BUCKET,
        CatalogEntityType.Toolset,
        'toolsets/bucket-123/tool-abc123__1.2.0',
      );

      /* The removed folder is gone; the rest are newest-first, as before. */
      expect(result.map((entry) => entry.folderPath)).toEqual([
        'Organization/Newer',
        'Organization/Older',
      ]);
      expect(result.map((entry) => entry.publishCredentials)).toEqual([
        true,
        false,
      ]);
    });

    it('returns an empty array when no publications match', async () => {
      const { service, dialClient, cacheManager } = makeService();
      cacheManager.get.mockResolvedValue(undefined);
      vi.spyOn(dialClient.client, 'getPublications').mockResolvedValue(
        okResponse([]),
      );

      const result = await service.getPublishHistory(
        'token-abc',
        TEST_BUCKET,
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
        TEST_BUCKET,
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
          TEST_BUCKET,
          CatalogEntityType.Toolset,
          'toolsets/bucket-123/tool-abc123__1.2.0',
        ),
      ).rejects.toBeInstanceOf(BadGatewayException);
    });
  });
});
