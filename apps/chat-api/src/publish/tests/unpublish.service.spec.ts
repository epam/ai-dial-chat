import {
  BadGatewayException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../dial/dial-client.service';
import { CatalogEntityType } from '../dto/catalog-entity-params.dto';
import { PublishService } from '../publish.service';

/* The caller's own bucket, which `toSourceUrl` uses to qualify a prompt's bucket-relative id. */
const TEST_BUCKET = 'bucket-123';
const TOOLSET_ID = 'toolsets/bucket-123/tool-abc123__1.2.0';

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

const createPublicationBody = (dialClient: DialClientService, call = 0) =>
  vi.mocked(dialClient.client.createPublication).mock.calls[call][0]
    .body as Record<string, unknown>;

describe('PublishService.unpublish', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls createPublication with a single DELETE resource and returns UnpublishResultDto', async () => {
    const { service, dialClient, cacheManager } = makeService();
    vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
      okResponse({
        createdAt: 1_700_000_000_000,
        author: 'user@example.com',
      }),
    );

    const result = await service.unpublish(
      'token-abc',
      TEST_BUCKET,
      CatalogEntityType.Toolset,
      TOOLSET_ID,
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
            action: 'DELETE',
            sourceUrl: TOOLSET_ID,
            targetUrl:
              'toolsets/public/Organization/Data%20Science/tool-abc123__1.2.0',
          },
        ],
        displayAuthor: 'Test User',
      },
    });
    expect(result).toEqual({
      entityId: TOOLSET_ID,
      entityType: CatalogEntityType.Toolset,
      folderPath: 'Organization/Data Science',
      version: '1.2.0',
      requestedAt: new Date(1_700_000_000_000).toISOString(),
      requestedBy: 'user@example.com',
    });
    expect(cacheManager.del).toHaveBeenCalledWith(
      `publish-history:toolset:${TOOLSET_ID}`,
    );
  });

  /*
   * The whole point of `getPublishedTargetUrl`: a DELETE resource whose
   * `targetUrl` does not match the published copy removes nothing, and Core
   * can accept it (and an admin approve it) while nothing observable changes.
   */
  it('derives a targetUrl character-for-character identical to the one publish sent', async () => {
    const { service, dialClient } = makeService();
    vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
      okResponse({ createdAt: 1_700_000_000_000 }),
    );

    await service.publish(
      'token-abc',
      TEST_BUCKET,
      CatalogEntityType.Toolset,
      TOOLSET_ID,
      'test 14.04/Ünïcode',
      undefined,
      'Test User',
    );
    await service.unpublish(
      'token-abc',
      TEST_BUCKET,
      CatalogEntityType.Toolset,
      TOOLSET_ID,
      'test 14.04/Ünïcode',
      undefined,
      'Test User',
    );

    const publishBody = createPublicationBody(dialClient, 0);
    const unpublishBody = createPublicationBody(dialClient, 1);
    const publishResources = publishBody.resources as { targetUrl: string }[];
    const unpublishResources = unpublishBody.resources as {
      targetUrl: string;
    }[];

    expect(unpublishResources[0].targetUrl).toBe(publishResources[0].targetUrl);
    expect(unpublishBody.targetFolder).toBe(publishBody.targetFolder);
  });

  it('targets the public root when folderPath is empty', async () => {
    const { service, dialClient } = makeService();
    vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
      okResponse({ createdAt: 1_700_000_000_000 }),
    );

    await service.unpublish(
      'token-abc',
      TEST_BUCKET,
      CatalogEntityType.Toolset,
      TOOLSET_ID,
      '',
      '1.2.0',
      'Test User',
    );

    const body = createPublicationBody(dialClient);
    expect(body.targetFolder).toBe('public/');
    expect((body.resources as { targetUrl: string }[])[0].targetUrl).toBe(
      'toolsets/public/tool-abc123__1.2.0',
    );
  });

  it('never forwards a rules array, since a removal request grants nobody anything', async () => {
    const { service, dialClient } = makeService();
    vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
      okResponse({ createdAt: 1_700_000_000_000 }),
    );

    await service.unpublish(
      'token-abc',
      TEST_BUCKET,
      CatalogEntityType.Toolset,
      TOOLSET_ID,
      'Organization/Data Science',
      '1.2.0',
      'Test User',
    );

    expect(createPublicationBody(dialClient)).not.toHaveProperty('rules');
  });

  it('recovers an omitted version from the entity id', async () => {
    const { service, dialClient } = makeService();
    vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
      okResponse({ createdAt: 1_700_000_000_000 }),
    );

    const result = await service.unpublish(
      'token-abc',
      TEST_BUCKET,
      CatalogEntityType.Toolset,
      TOOLSET_ID,
      'Organization/Data Science',
      undefined,
      'Test User',
    );

    expect(result.version).toBe('1.2.0');
    expect(createPublicationBody(dialClient).name).toBe('tool-abc123 1.2.0');
  });

  it('builds a versionless prompt title with no trailing space and qualifies the bucket-relative id', async () => {
    const { service, dialClient } = makeService();
    vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
      okResponse({ createdAt: 1_700_000_000_000 }),
    );

    const result = await service.unpublish(
      'token-abc',
      TEST_BUCKET,
      CatalogEntityType.Prompt,
      'Work/AI/summarize',
      'Organization/Prompts',
      undefined,
      'Test User',
    );

    const body = createPublicationBody(dialClient);
    const resources = body.resources as {
      sourceUrl: string;
      targetUrl: string;
    }[];

    expect(body.name).toBe('summarize');
    expect(resources[0].sourceUrl).toBe('prompts/bucket-123/Work/AI/summarize');
    expect(resources[0].targetUrl).toBe(
      'prompts/public/Organization/Prompts/summarize',
    );
    expect(result.version).toBe('');
  });

  /*
   * `mapDialHttpStatus` funnels every unlisted status — 502 and 503 included —
   * into `BadGatewayException`; `ServiceUnavailableException` is reserved for
   * the unreachable/timeout path asserted separately below. Unpublish maps
   * exactly as publish does, which is the point of reusing the helper.
   */
  it.each([
    [403, ForbiddenException],
    [404, NotFoundException],
    [502, BadGatewayException],
    [503, BadGatewayException],
  ])('maps a Core %i to the matching exception', async (status, expected) => {
    const { service, dialClient, cacheManager } = makeService();
    vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
      errResponse(status),
    );

    await expect(
      service.unpublish(
        'token-abc',
        TEST_BUCKET,
        CatalogEntityType.Toolset,
        TOOLSET_ID,
        'Organization/Data Science',
        '1.2.0',
        'Test User',
      ),
    ).rejects.toBeInstanceOf(expected);
    expect(cacheManager.del).not.toHaveBeenCalled();
  });

  it('surfaces a thrown SDK error as BadGatewayException and leaves the cache intact', async () => {
    const { service, dialClient, cacheManager } = makeService();
    vi.spyOn(dialClient.client, 'createPublication').mockRejectedValue(
      new Error('socket hang up'),
    );

    await expect(
      service.unpublish(
        'token-abc',
        TEST_BUCKET,
        CatalogEntityType.Toolset,
        TOOLSET_ID,
        'Organization/Data Science',
        '1.2.0',
        'Test User',
      ),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(cacheManager.del).not.toHaveBeenCalled();
  });
});

describe('PublishService.getPublishHistory with pending removals', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('lists a folder once when both an ADD and a pending DELETE publication exist for it', async () => {
    const { service, dialClient, cacheManager } = makeService();
    cacheManager.get.mockResolvedValue(undefined);
    vi.spyOn(dialClient.client, 'getPublications').mockResolvedValue(
      okResponse([
        {
          targetFolder: 'public/Organization/Data Science/',
          createdAt: 1_700_000_000_000,
          author: 'user@example.com',
          resources: [{ action: 'ADD', sourceUrl: TOOLSET_ID }],
        },
        {
          targetFolder: 'public/Organization/Data Science/',
          createdAt: 1_700_000_100_000,
          author: 'user@example.com',
          resources: [{ action: 'DELETE', sourceUrl: TOOLSET_ID }],
        },
      ]),
    );

    const result = await service.getPublishHistory(
      'token-abc',
      TEST_BUCKET,
      CatalogEntityType.Toolset,
      TOOLSET_ID,
    );

    expect(result).toHaveLength(1);
    expect(result[0].folderPath).toBe('Organization/Data Science');
    expect(result[0].publishedAt).toBe(
      new Date(1_700_000_000_000).toISOString(),
    );
  });

  it('returns an empty array when the only matching publication is a pending removal', async () => {
    const { service, dialClient, cacheManager } = makeService();
    cacheManager.get.mockResolvedValue(undefined);
    vi.spyOn(dialClient.client, 'getPublications').mockResolvedValue(
      okResponse([
        {
          targetFolder: 'public/Organization/Data Science/',
          createdAt: 1_700_000_000_000,
          resources: [{ action: 'DELETE', sourceUrl: TOOLSET_ID }],
        },
      ]),
    );

    await expect(
      service.getPublishHistory(
        'token-abc',
        TEST_BUCKET,
        CatalogEntityType.Toolset,
        TOOLSET_ID,
      ),
    ).resolves.toEqual([]);
  });
});
