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
});
