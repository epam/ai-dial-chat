import { BadGatewayException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminRoleService } from '../../auth/admin-role.service';
import type { SessionUser } from '../../auth/session/session.types';
import type { DialClientService } from '../../dial/dial-client.service';
import { CatalogEntityType } from '../dto/catalog-entity-params.dto';
import { PublishService } from '../publish.service';

const COPY_ID = 'applications/public/Org/my-app__1.0.0';

const makeUser = (bucket = 'bucket-123'): SessionUser =>
  ({
    sub: `user-${bucket}`,
    providerId: 'keycloak',
    at: 'token-abc',
    bucket,
    claims: { name: 'Test User' },
  }) as SessionUser;

const okResponse = (data: unknown) =>
  ({ data, response: { ok: true, status: 200 } as Response }) as never;

const errResponse = (status: number) =>
  ({ error: {}, response: { ok: false, status } as Response }) as never;

const approvedAdd = (
  targetUrl: string,
  extra: Record<string, unknown> = {},
) => ({
  url: 'publications/bucket-123/pub-1',
  status: 'APPROVED',
  targetFolder: 'public/Org/',
  createdAt: 1_700_000_000_000,
  resources: [
    {
      action: 'ADD',
      sourceUrl: 'applications/bucket-123/my-app__1.0.0',
      targetUrl,
    },
  ],
  ...extra,
});

/* A cache that behaves like the real one, so a hit and a miss are both observable. */
const makeCacheManager = () => {
  const store = new Map<string, unknown>();
  return {
    get: vi.fn(async (key: string) => store.get(key)),
    set: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  };
};

const makeService = ({ isAdmin = false } = {}) => {
  const dialClient = {
    client: { getPublications: vi.fn(), getPublication: vi.fn() },
  } as unknown as DialClientService;
  const cacheManager = makeCacheManager();
  const adminRoleService = { isAdmin: vi.fn().mockReturnValue(isAdmin) };
  const service = new PublishService(
    dialClient,
    cacheManager as never,
    adminRoleService as unknown as AdminRoleService,
  );
  return { service, dialClient, cacheManager };
};

describe('PublishService.canUnpublish', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('allows an administrator without reading any publication', async () => {
    const { service, dialClient } = makeService({ isAdmin: true });

    await expect(
      service.canUnpublish(makeUser(), CatalogEntityType.Application, COPY_ID),
    ).resolves.toBe(true);
    expect(dialClient.client.getPublications).not.toHaveBeenCalled();
  });

  it('allows an entity in the caller’s own bucket without reading any publication', async () => {
    const { service, dialClient } = makeService();

    await expect(
      service.canUnpublish(
        makeUser(),
        CatalogEntityType.Toolset,
        'toolsets/bucket-123/tool-abc__1.0.0',
      ),
    ).resolves.toBe(true);
    expect(dialClient.client.getPublications).not.toHaveBeenCalled();
  });

  it('allows the publisher of a public copy', async () => {
    const { service, dialClient } = makeService();
    vi.mocked(dialClient.client.getPublications).mockResolvedValue(
      okResponse([approvedAdd(COPY_ID)]),
    );

    await expect(
      service.canUnpublish(makeUser(), CatalogEntityType.Application, COPY_ID),
    ).resolves.toBe(true);
    expect(dialClient.client.getPublications).toHaveBeenCalledWith({
      headers: { Authorization: 'Bearer token-abc' },
      body: { url: 'publications/bucket-123/' },
    });
  });

  it('reads a listed publication’s resources when the list omits them', async () => {
    const { service, dialClient } = makeService();
    const { resources, ...metadata } = approvedAdd(COPY_ID);
    vi.mocked(dialClient.client.getPublications).mockResolvedValue(
      okResponse([metadata]),
    );
    vi.mocked(dialClient.client.getPublication).mockResolvedValue(
      okResponse({ ...metadata, resources }),
    );

    await expect(
      service.canUnpublish(makeUser(), CatalogEntityType.Application, COPY_ID),
    ).resolves.toBe(true);
  });

  it('refuses a user none of whose publications targets the copy', async () => {
    const { service, dialClient } = makeService();
    vi.mocked(dialClient.client.getPublications).mockResolvedValue(
      okResponse([approvedAdd('applications/public/Org/other-app__1.0.0')]),
    );

    await expect(
      service.canUnpublish(makeUser(), CatalogEntityType.Application, COPY_ID),
    ).resolves.toBe(false);
  });

  it('ignores a matching display author on a publication that targets another copy', async () => {
    const { service, dialClient } = makeService();
    vi.mocked(dialClient.client.getPublications).mockResolvedValue(
      okResponse([
        approvedAdd('applications/public/Org/other-app__1.0.0', {
          displayAuthor: 'Test User',
        }),
      ]),
    );

    await expect(
      service.canUnpublish(makeUser(), CatalogEntityType.Application, COPY_ID),
    ).resolves.toBe(false);
  });

  it('confers nothing for a publish that is still pending', async () => {
    const { service, dialClient } = makeService();
    vi.mocked(dialClient.client.getPublications).mockResolvedValue(
      okResponse([approvedAdd(COPY_ID, { status: 'PENDING' })]),
    );

    await expect(
      service.canUnpublish(makeUser(), CatalogEntityType.Application, COPY_ID),
    ).resolves.toBe(false);
  });

  it('fails closed with a 502 when the publication list cannot be read, caching nothing', async () => {
    const { service, dialClient, cacheManager } = makeService();
    vi.mocked(dialClient.client.getPublications).mockResolvedValue(
      errResponse(500),
    );

    await expect(
      service.canUnpublish(makeUser(), CatalogEntityType.Application, COPY_ID),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(cacheManager.set).not.toHaveBeenCalled();
  });

  it('fails closed with a 502 when DIAL Core is unreachable', async () => {
    const { service, dialClient } = makeService();
    vi.mocked(dialClient.client.getPublications).mockRejectedValue(
      new TypeError('fetch failed'),
    );

    await expect(
      service.canUnpublish(makeUser(), CatalogEntityType.Application, COPY_ID),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('answers a repeat check from the cache, a refusal included', async () => {
    const { service, dialClient, cacheManager } = makeService();
    vi.mocked(dialClient.client.getPublications).mockResolvedValue(
      okResponse([]),
    );

    await service.canUnpublish(
      makeUser(),
      CatalogEntityType.Application,
      COPY_ID,
    );
    await expect(
      service.canUnpublish(makeUser(), CatalogEntityType.Application, COPY_ID),
    ).resolves.toBe(false);

    expect(dialClient.client.getPublications).toHaveBeenCalledOnce();
    expect(cacheManager.set).toHaveBeenCalledWith(
      `unpublish-access:bucket-123:application:${COPY_ID}`,
      { canUnpublish: false },
      60_000,
    );
  });

  it('never serves one caller’s cached answer to another', async () => {
    const { service, dialClient } = makeService();
    vi.mocked(dialClient.client.getPublications)
      .mockResolvedValueOnce(okResponse([approvedAdd(COPY_ID)]))
      .mockResolvedValueOnce(okResponse([]));

    await expect(
      service.canUnpublish(makeUser(), CatalogEntityType.Application, COPY_ID),
    ).resolves.toBe(true);
    await expect(
      service.canUnpublish(
        makeUser('bucket-other'),
        CatalogEntityType.Application,
        COPY_ID,
      ),
    ).resolves.toBe(false);
    expect(dialClient.client.getPublications).toHaveBeenCalledTimes(2);
  });

  it('does not treat an unresolved bucket as owning a bare deployment id', async () => {
    const { service, dialClient } = makeService();
    vi.mocked(dialClient.client.getPublications).mockResolvedValue(
      okResponse([]),
    );

    await expect(
      service.canUnpublish(
        makeUser(''),
        CatalogEntityType.Model,
        'gemini-pro-vision',
      ),
    ).resolves.toBe(false);
  });
});
