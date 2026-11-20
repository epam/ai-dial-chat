import type { PublishApi } from '@epam/ai-dial-chat-api-client';
import { describe, expect, it, vi } from 'vitest';
import { createPublishApiClient } from '../create-publish-api';

describe('createPublishApiClient', () => {
  it('reads the publish dependencies of a catalog entity through the generated operation', async () => {
    const result = {
      dependencies: [
        { id: 'prompts/b/Hi', name: 'Hi', type: 'prompt', location: '' },
      ],
    };
    const getCatalogPublishDependencies = vi.fn().mockResolvedValue(result);
    const client = createPublishApiClient({
      getCatalogPublishDependencies,
    } as unknown as PublishApi);

    const response = await client.getCatalogPublishDependencies(
      'application',
      'applications/b/App__1.0.0',
    );

    expect(response).toBe(result);
    expect(getCatalogPublishDependencies).toHaveBeenCalledWith({
      entityType: 'application',
      entityId: 'applications/b/App__1.0.0',
    });
  });

  it('reads the dependencies of unsaved application values through the generated operation', async () => {
    const result = { dependencies: [] };
    const getApplicationValuesPublishDependencies = vi
      .fn()
      .mockResolvedValue(result);
    const client = createPublishApiClient({
      getApplicationValuesPublishDependencies,
    } as unknown as PublishApi);
    const body = { schemaId: 'https://schema/form', properties: { a: 1 } };

    expect(await client.getApplicationValuesPublishDependencies(body)).toBe(
      result,
    );
    expect(getApplicationValuesPublishDependencies).toHaveBeenCalledWith({
      applicationValuesDependenciesRequestDto: body,
    });
  });

  it('reads the version statuses of a catalog entity through the generated operation', async () => {
    const result = [
      {
        id: 'applications/b/App__1.0.0',
        version: '1.0.0',
        status: 'not-published',
        publishedFolders: [],
      },
    ];
    const getCatalogVersionStatuses = vi.fn().mockResolvedValue(result);
    const client = createPublishApiClient({
      getCatalogVersionStatuses,
    } as unknown as PublishApi);

    const response = await client.getCatalogVersionStatuses(
      'application',
      'applications/b/App__1.0.0',
    );

    expect(response).toBe(result);
    expect(getCatalogVersionStatuses).toHaveBeenCalledWith({
      entityType: 'application',
      entityId: 'applications/b/App__1.0.0',
    });
  });

  it('copies a catalog entity into an org-unit folder through the generated operation', async () => {
    const result = { id: 'applications/public/Acme/App__1.0.0' };
    const copyCatalogEntityToOrgUnit = vi.fn().mockResolvedValue(result);
    const client = createPublishApiClient({
      copyCatalogEntityToOrgUnit,
    } as unknown as PublishApi);

    const response = await client.copyCatalogEntityToOrgUnit(
      'application',
      'applications/b/App__1.0.0',
      { folderPath: 'Acme' },
    );

    expect(response).toBe(result);
    expect(copyCatalogEntityToOrgUnit).toHaveBeenCalledWith({
      entityType: 'application',
      entityId: 'applications/b/App__1.0.0',
      copyCatalogEntityToOrgUnitDto: { folderPath: 'Acme' },
    });
  });

  it('checks a publish target through the generated operation', async () => {
    const result = { taken: true };
    const getCatalogPublishTarget = vi.fn().mockResolvedValue(result);
    const client = createPublishApiClient({
      getCatalogPublishTarget,
    } as unknown as PublishApi);

    const response = await client.checkPublishTarget(
      'application',
      'applications/b/App__1.0.0',
      'Acme/Team',
      '2.0.0',
    );

    expect(response).toBe(result);
    expect(getCatalogPublishTarget).toHaveBeenCalledWith({
      entityType: 'application',
      entityId: 'applications/b/App__1.0.0',
      folderPath: 'Acme/Team',
      version: '2.0.0',
    });
  });
});
