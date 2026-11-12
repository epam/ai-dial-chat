import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogEntityType } from '../dto/catalog-entity-params.dto';
import { VersionPublicationStatus } from '../dto/version-status-entry.dto';
import type { StatusPublication } from '../version-status.util';
import { VersionStatusesService } from '../version-statuses.service';

const BUCKET = 'bucket-123';
const app = (name: string, version: string, folder = 'Design') => ({
  id: `applications/${BUCKET}/${folder}/${name}__${version}`,
  type: 'application',
  displayVersion: version,
});

const addPublication = (
  sourceUrl: string,
  status: string,
  overrides: Partial<StatusPublication> = {},
): StatusPublication => ({
  url: `publications/${BUCKET}/${status}`,
  status,
  targetFolder: 'public/Organization/',
  createdAt: 1000,
  displayAuthor: 'Jane Doe',
  resources: [{ action: 'ADD', sourceUrl }],
  ...overrides,
});

const makeService = (
  deployments: unknown[] = [],
  toolsets: unknown[] = [],
  publications: StatusPublication[] = [],
) => {
  const deploymentsService = {
    listDeployments: vi.fn().mockResolvedValue({ deployments }),
  };
  const toolsetsListingService = {
    listToolsets: vi.fn().mockResolvedValue({ data: toolsets }),
  };
  const publishService = {
    getBucketPublications: vi.fn().mockResolvedValue(publications),
  };
  const service = new VersionStatusesService(
    deploymentsService as never,
    toolsetsListingService as never,
    publishService as never,
  );
  return {
    service,
    deploymentsService,
    toolsetsListingService,
    publishService,
  };
};

const statuses = (
  service: VersionStatusesService,
  entityId: string,
  entityType = CatalogEntityType.Application,
  bucket = BUCKET,
) => service.getVersionStatuses('user1', 'token', bucket, entityType, entityId);

describe('VersionStatusesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns one entry per version of the group with its own status', async () => {
    const v1 = app('Review', '1.0.0');
    const v2 = app('Review', '1.1.0');
    const v3 = app('Review', '2.0.0');
    const { service } = makeService(
      [v1, v2, v3, app('Other', '1.0.0'), app('Review', '1.0.0', 'Research')],
      [],
      [
        addPublication(v1.id, 'APPROVED'),
        addPublication(v2.id, 'PENDING', { createdAt: 2000 }),
      ],
    );

    const result = await statuses(service, v2.id);

    expect(result).toEqual([
      {
        id: v1.id,
        version: '1.0.0',
        status: VersionPublicationStatus.Published,
        publishedFolders: ['Organization'],
        publishedBy: 'Jane Doe',
      },
      {
        id: v2.id,
        version: '1.1.0',
        status: VersionPublicationStatus.InReview,
        publishedFolders: [],
      },
      {
        id: v3.id,
        version: '2.0.0',
        status: VersionPublicationStatus.NotPublished,
        publishedFolders: [],
      },
    ]);
  });

  it('reads the caller publications once, however many versions there are', async () => {
    const versions = Array.from({ length: 10 }, (_, i) =>
      app('Review', `1.${i}.0`),
    );
    const { service, publishService } = makeService(versions);

    await statuses(service, versions[0].id);

    expect(publishService.getBucketPublications).toHaveBeenCalledOnce();
    expect(publishService.getBucketPublications).toHaveBeenCalledWith(
      'token',
      BUCKET,
    );
  });

  it('resolves the group from the unfiltered deployments listing', async () => {
    const v1 = app('Review', '1.0.0');
    const { service, deploymentsService } = makeService([v1]);

    await statuses(service, v1.id);

    expect(deploymentsService.listDeployments).toHaveBeenCalledWith(
      'user1',
      'token',
      BUCKET,
    );
  });

  it('lists a version saved moments ago as Not published', async () => {
    const saved = app('Review', '3.0.0');
    const { service } = makeService([app('Review', '1.0.0'), saved]);

    const result = await statuses(service, saved.id);

    expect(result.find((entry) => entry.id === saved.id)?.status).toBe(
      VersionPublicationStatus.NotPublished,
    );
  });

  it('reports every version of a never-published resource as Not published without an error', async () => {
    const v1 = app('Review', '1.0.0');
    const v2 = app('Review', '1.1.0');
    const { service } = makeService([v1, v2]);

    const result = await statuses(service, v1.id);

    expect(result.map((entry) => entry.status)).toEqual([
      VersionPublicationStatus.NotPublished,
      VersionPublicationStatus.NotPublished,
    ]);
  });

  it('reports a toolset group from the toolsets listing', async () => {
    const tool = {
      id: `toolsets/${BUCKET}/Search__1.0.0`,
      displayVersion: '1.0.0',
    };
    const { service, toolsetsListingService, deploymentsService } = makeService(
      [],
      [tool],
      [addPublication(tool.id, 'APPROVED')],
    );

    const result = await statuses(service, tool.id, CatalogEntityType.Toolset);

    expect(toolsetsListingService.listToolsets).toHaveBeenCalledOnce();
    expect(deploymentsService.listDeployments).not.toHaveBeenCalled();
    expect(result[0].status).toBe(VersionPublicationStatus.Published);
  });

  it('answers unknown for a resource owned by another user, without reading publications', async () => {
    const shared = {
      id: 'applications/other-bucket/Design/Review__1.0.0',
      type: 'application',
      displayVersion: '1.0.0',
    };
    const { service, publishService } = makeService([shared]);

    const result = await statuses(service, shared.id);

    expect(result).toEqual([
      {
        id: shared.id,
        version: '1.0.0',
        status: VersionPublicationStatus.Unknown,
        publishedFolders: [],
      },
    ]);
    expect(publishService.getBucketPublications).not.toHaveBeenCalled();
  });

  it('does not mix the same folder and name of two owners into one group', async () => {
    const own = app('Review', '1.0.0');
    const other = {
      id: 'applications/other-bucket/Design/Review__1.0.0',
      type: 'application',
      displayVersion: '1.0.0',
    };
    const { service } = makeService([own, other]);

    const result = await statuses(service, own.id);

    expect(result.map((entry) => entry.id)).toEqual([own.id]);
  });

  it('throws 404 when no version of the entity is listed', async () => {
    const { service } = makeService([app('Other', '1.0.0')]);

    await expect(
      statuses(service, `applications/${BUCKET}/Design/Review__1.0.0`),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('matches an id without a version suffix by itself', async () => {
    const plain = {
      id: `applications/${BUCKET}/Plain`,
      type: 'application',
      displayVersion: undefined,
    };
    const { service } = makeService([plain]);

    const result = await statuses(service, plain.id);

    expect(result).toEqual([
      {
        id: plain.id,
        version: '',
        status: VersionPublicationStatus.NotPublished,
        publishedFolders: [],
      },
    ]);
  });

  it('rejects an entity type without versions', async () => {
    const { service } = makeService();

    await expect(
      statuses(service, 'prompts/bucket-123/p', CatalogEntityType.Prompt),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("reads each caller's own bucket publications", async () => {
    const mine = app('Review', '1.0.0');
    const theirs = {
      id: 'applications/bucket-456/Design/Review__1.0.0',
      type: 'application',
      displayVersion: '1.0.0',
    };
    const { service, publishService } = makeService([mine, theirs]);

    await statuses(service, mine.id);
    await statuses(
      service,
      theirs.id,
      CatalogEntityType.Application,
      'bucket-456',
    );

    expect(publishService.getBucketPublications).toHaveBeenNthCalledWith(
      1,
      'token',
      BUCKET,
    );
    expect(publishService.getBucketPublications).toHaveBeenNthCalledWith(
      2,
      'token',
      'bucket-456',
    );
  });
});
