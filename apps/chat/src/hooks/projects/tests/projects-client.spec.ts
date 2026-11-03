import { beforeEach, describe, expect, it, vi } from 'vitest';
import { markProjectConversationViewed } from '../../../server-api/project-conversations.api';
import {
  projectsClient,
  projectViewedWriter,
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

  it('notifies nobody and rejects the caller when the write fails', async () => {
    vi.mocked(markProjectConversationViewed).mockRejectedValue(
      new Error('offline'),
    );
    const listener = vi.fn();
    const unsubscribe = subscribeProjectConversationViewed(listener);

    await expect(
      projectsClient.markProjectConversationViewed?.(C),
    ).rejects.toThrow('offline');

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('notifies nobody for a dropped write', async () => {
    let releaseFirst!: () => void;
    vi.mocked(markProjectConversationViewed)
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            releaseFirst = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    const listener = vi.fn();
    const unsubscribe = subscribeProjectConversationViewed(listener);

    const first = projectViewedWriter.enqueue('first');
    const dropped = projectViewedWriter.enqueue(C);
    projectViewedWriter.drop(C);
    await vi.waitFor(() => expect(releaseFirst).toBeTypeOf('function'));
    releaseFirst();
    await Promise.all([first, dropped]);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith('first');
    unsubscribe();
  });

  it('keeps notifying the others when a listener throws', async () => {
    vi.mocked(markProjectConversationViewed).mockResolvedValue(undefined);
    const failing = vi.fn(() => {
      throw new Error('listener bug');
    });
    const listener = vi.fn();
    const unsubscribeFailing = subscribeProjectConversationViewed(failing);
    const unsubscribe = subscribeProjectConversationViewed(listener);

    await expect(
      projectsClient.markProjectConversationViewed?.(C),
    ).resolves.toBeUndefined();

    expect(listener).toHaveBeenCalledWith(C);
    unsubscribeFailing();
    unsubscribe();
  });

  it('stops notifying a removed listener', async () => {
    vi.mocked(markProjectConversationViewed).mockResolvedValue(undefined);
    const listener = vi.fn();
    const unsubscribe = subscribeProjectConversationViewed(listener);
    unsubscribe();

    await projectsClient.markProjectConversationViewed?.(C);

    expect(listener).not.toHaveBeenCalled();
  });
});
