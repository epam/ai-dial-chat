import { ProjectSource } from '@epam/ai-dial-chat-api-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { projectsApi } from '../api-client';
import { listProjects } from '../projects.api';

vi.mock('../api-client', () => ({
  projectsApi: { listProjects: vi.fn() },
}));

describe('Projects adapter', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns the listing through the normal generated method with the caller signal', async () => {
    const signal = new AbortController().signal;
    const listing = {
      items: [
        {
          id: 'projects/b/alpha',
          name: 'alpha',
          bucket: 'b',
          path: 'alpha',
          source: ProjectSource.Personal,
        },
      ],
      incompleteSources: [],
    };
    vi.mocked(projectsApi.listProjects).mockResolvedValue(listing);

    await expect(listProjects({ signal })).resolves.toBe(listing);
    expect(projectsApi.listProjects).toHaveBeenCalledWith({ signal });
  });

  it('propagates errors to the caller', async () => {
    const error = new Error('Unavailable');
    vi.mocked(projectsApi.listProjects).mockRejectedValue(error);

    await expect(listProjects()).rejects.toBe(error);
  });
});
