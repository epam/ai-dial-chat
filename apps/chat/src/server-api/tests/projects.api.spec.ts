import { ProjectSource } from '@epam/ai-dial-chat-api-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { projectsApi } from '../api-client';
import { createProject, listProjects } from '../projects.api';

vi.mock('../api-client', () => ({
  projectsApi: { listProjects: vi.fn(), createProject: vi.fn() },
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

  it('creates a project with JSON file names paired to the files and the caller signal', async () => {
    const signal = new AbortController().signal;
    const created = {
      id: 'projects/b/Q4',
      name: 'Q4',
      bucket: 'b',
      path: 'Q4',
    };
    const tickets = new File(['a,b'], 'tickets.csv', { type: 'text/csv' });
    const survey = new File(['x'], 'survey.xlsx');
    vi.mocked(projectsApi.createProject).mockResolvedValue(created);

    await expect(
      createProject(
        { name: 'Q4', description: 'About Q4', instructions: '## Steps' },
        [tickets, survey],
        signal,
      ),
    ).resolves.toBe(created);
    expect(projectsApi.createProject).toHaveBeenCalledWith(
      {
        name: 'Q4',
        description: 'About Q4',
        instructions: '## Steps',
        fileNames: '["tickets.csv","survey.xlsx"]',
        files: [tickets, survey],
      },
      { signal },
    );
  });

  it('sends an empty file list for a name-only project', async () => {
    vi.mocked(projectsApi.createProject).mockResolvedValue({
      id: 'projects/b/p',
      name: 'p',
      bucket: 'b',
      path: 'p',
    });

    await createProject({ name: 'p', description: '', instructions: '' }, []);

    expect(projectsApi.createProject).toHaveBeenCalledWith({
      name: 'p',
      description: '',
      instructions: '',
      fileNames: '[]',
      files: [],
    });
  });
});
