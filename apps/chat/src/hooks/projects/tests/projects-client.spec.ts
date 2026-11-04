import { beforeEach, describe, expect, it, vi } from 'vitest';
import { markProjectConversationViewed } from '../../../server-api/project-conversations.api';
import {
  projectsClient,
  subscribeProjectConversationViewed,
} from '../projects-client';

vi.mock('../../../server-api/project-conversations.api', () => ({
  attachToProjectGeneration: vi.fn(),
  createProjectConversation: vi.fn(),
  deleteProjectConversation: vi.fn(),
  getProjectConversation: vi.fn(),
  getProjectConversationTitles: vi.fn(),
  listProjectConversations: vi.fn(),
  markProjectConversationViewed: vi.fn(),
  renameProjectConversation: vi.fn(),
  saveProjectConversation: vi.fn(),
}));
vi.mock('../../../server-api/projects.api', () => ({
  createProject: vi.fn(),
  deleteProject: vi.fn(),
  downloadProjectArchive: vi.fn(),
  downloadProjectContextFile: vi.fn(),
  getProject: vi.fn(),
  listProjectArtifacts: vi.fn(),
  listProjects: vi.fn(),
  updateProject: vi.fn(),
  watchProjects: vi.fn(),
}));

const C = 'projects/b/q4/conversations/c1';

/* The writer's listener rules are covered by `createSerializedKeyedWriter`'s own suite. */
describe('subscribeProjectConversationViewed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('notifies a listener once a viewed write succeeds', async () => {
    vi.mocked(markProjectConversationViewed).mockResolvedValue(undefined);
    const listener = vi.fn();
    const unsubscribe = subscribeProjectConversationViewed(listener);

    await projectsClient.markProjectConversationViewed?.(C);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(C);
    unsubscribe();
  });
});
