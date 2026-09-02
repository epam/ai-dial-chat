import {
  BadGatewayException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../dial/dial-client.service';
import { CatalogEntityType } from '../dto/catalog-entity-params.dto';
import { PublishService } from '../publish.service';

/* The caller's session bucket, passed through to every publish call. */
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

  it('falls back to the caller-supplied author and the current time when Core returns no parseable publication body', async () => {
    const { service, dialClient } = makeService();
    vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
      okResponse(undefined),
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

    expect(result.requestedBy).toBe('Test User');
    expect(new Date(result.requestedAt).toString()).not.toBe('Invalid Date');
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

  it('builds a versionless prompt title with no trailing space and uses the full entityId unmodified', async () => {
    const { service, dialClient } = makeService();
    vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
      okResponse({ createdAt: 1_700_000_000_000 }),
    );

    const result = await service.unpublish(
      'token-abc',
      TEST_BUCKET,
      CatalogEntityType.Prompt,
      'prompts/bucket-123/Work/AI/summarize',
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

/*
 * GH #8445. Core keeps the original ADD publication as APPROVED forever — it is
 * an audit record, not live state — so after an administrator approved an
 * unpublish request the folder still came back as published. The details panel
 * derives Publish-vs-Unpublish from exactly this history, so the action menu
 * went on offering Unpublish for a copy Core had already deleted, and acting on
 * it failed with "Target resource does not exists".
 */
describe('PublishService.getPublishHistory with approved removals', () => {
  const FOLDER = 'public/Organization/Data Science/';

  const addPublication = (createdAt: number, targetFolder = FOLDER) => ({
    targetFolder,
    createdAt,
    status: 'APPROVED',
    author: 'user@example.com',
    resources: [{ action: 'ADD', sourceUrl: TOOLSET_ID }],
  });

  const deletePublication = (createdAt: number, targetFolder = FOLDER) => ({
    targetFolder,
    createdAt,
    status: 'APPROVED',
    author: 'user@example.com',
    resources: [{ action: 'DELETE', sourceUrl: TOOLSET_ID }],
  });

  const getHistory = async (publications: unknown[]) => {
    const { service, dialClient, cacheManager } = makeService();
    cacheManager.get.mockResolvedValue(undefined);
    vi.spyOn(dialClient.client, 'getPublications').mockResolvedValue(
      okResponse(publications),
    );
    return service.getPublishHistory(
      'token-abc',
      TEST_BUCKET,
      CatalogEntityType.Toolset,
      TOOLSET_ID,
    );
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('drops the folder once the removal is APPROVED, so the menu offers Publish again', async () => {
    await expect(
      getHistory([
        addPublication(1_700_000_000_000),
        deletePublication(1_700_000_100_000),
      ]),
    ).resolves.toEqual([]);
  });

  it('lists the folder again after a re-publish that followed the approved removal', async () => {
    const result = await getHistory([
      addPublication(1_700_000_000_000),
      deletePublication(1_700_000_100_000),
      addPublication(1_700_000_200_000),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].folderPath).toBe('Organization/Data Science');
    expect(result[0].publishedAt).toBe(
      new Date(1_700_000_200_000).toISOString(),
    );
  });

  it('keeps the folders the removal did not target', async () => {
    const result = await getHistory([
      addPublication(1_700_000_000_000),
      addPublication(1_700_000_000_000, 'public/Organization/Reports/'),
      deletePublication(1_700_000_100_000),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].folderPath).toBe('Organization/Reports');
  });

  /*
   * The ADD's `targetFolder` was built from plain text, while Core echoes the
   * removal's back percent-encoded — a strict comparison would leave the
   * folder listed.
   */
  it('matches the removal across a percent-encoding difference', async () => {
    await expect(
      getHistory([
        addPublication(1_700_000_000_000, 'public/Organization/Data Science/'),
        deletePublication(
          1_700_000_100_000,
          'public/Organization/Data%20Science/',
        ),
      ]),
    ).resolves.toEqual([]);
  });
});

describe('PublishService.getPublishHistory list scope', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  /*
   * Regression: the scope used to be derived as `entityId.split('/')[1]`, which
   * is `undefined` for a bare deployment id and `public` for an already-public
   * resource. Both produced a scope Core cannot answer for the caller, so
   * history came back empty while publishing kept working — silently hiding the
   * Unpublish action.
   */
  it.each([
    ['a bare deployment id', 'gemini-pro-vision-adapter_ah'],
    ['a public resource path', 'applications/public/Shared/my-app__1.0'],
    ['an own-bucket resource path', 'applications/bucket-123/my-app__1.0'],
  ])('scopes by the session bucket for %s', async (_label, entityId) => {
    const { service, dialClient, cacheManager } = makeService();
    cacheManager.get.mockResolvedValue(undefined);
    vi.spyOn(dialClient.client, 'getPublications').mockResolvedValue(
      okResponse([]),
    );

    await service.getPublishHistory(
      'token-abc',
      TEST_BUCKET,
      CatalogEntityType.Application,
      entityId,
    );

    expect(dialClient.client.getPublications).toHaveBeenCalledWith({
      headers: { Authorization: 'Bearer token-abc' },
      body: { url: `publications/${TEST_BUCKET}/` },
    });
  });
});

describe('PublishService.getPublishHistory response shape', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  /*
   * Regression for GH #7897: a live Core answers `getPublications` with an
   * envelope, not the bare array the SDK types. Reading `.filter` off it threw a
   * TypeError that surfaced as a 503, which is why publish history was believed
   * to be broken on the Core side.
   */
  it('reads history from the { publications: [...] } envelope Core returns', async () => {
    const { service, dialClient, cacheManager } = makeService();
    cacheManager.get.mockResolvedValue(undefined);
    vi.spyOn(dialClient.client, 'getPublications').mockResolvedValue(
      okResponse({
        publications: [
          {
            targetFolder: 'public/Organization/01folder/',
            createdAt: 1_700_000_000_000,
            author: 'user@example.com',
            resources: [{ action: 'ADD', sourceUrl: TOOLSET_ID }],
          },
        ],
      }),
    );

    const result = await service.getPublishHistory(
      'token-abc',
      TEST_BUCKET,
      CatalogEntityType.Toolset,
      TOOLSET_ID,
    );

    expect(result).toHaveLength(1);
    expect(result[0].folderPath).toBe('Organization/01folder');
  });

  it('degrades an unrecognised shape to an empty history instead of throwing', async () => {
    const { service, dialClient, cacheManager } = makeService();
    cacheManager.get.mockResolvedValue(undefined);
    vi.spyOn(dialClient.client, 'getPublications').mockResolvedValue(
      okResponse({ unexpected: true }),
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
