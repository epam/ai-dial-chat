import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectsI18nKeys } from '../../constants/translation-keys';
import {
  attachToProjectGeneration,
  deleteProjectConversation,
  getProjectConversation,
  markProjectConversationViewed,
  saveProjectConversation,
} from '../../server-api/project-conversations.api';
import { createProjectConversationDataSource } from '../project-conversation-data-source';

vi.mock('../../server-api/project-conversations.api', () => ({
  attachToProjectGeneration: vi.fn(),
  deleteProjectConversation: vi.fn(),
  getProjectConversation: vi.fn(),
  markProjectConversationViewed: vi.fn(),
  saveProjectConversation: vi.fn(),
}));

const PROJECT_ID = 'projects/a1b2c3/q4';
const ID = `${PROJECT_ID}/conversations/gpt-4o__Hi__1`;
const PATH = 'a1b2c3/q4/conversations/gpt-4o__Hi__1';

const create = (canEdit = true) =>
  createProjectConversationDataSource({ projectId: PROJECT_ID, canEdit });

/* The behaviour of the source is covered where it lives, in `chat-hooks`; this checks the app's bindings. */
describe('createProjectConversationDataSource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('streams through the project base path with the app session', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await create().transport.stopCompletion({ generationId: 'g1', path: PATH });

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/projects/${encodeURIComponent(PROJECT_ID)}/conversations/completions/stop`,
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('reads, saves, deletes and attaches through the project requests', async () => {
    const source = create();
    const body = { id: ID } as never;
    const signal = new AbortController().signal;

    await source.getConversation(ID, signal);
    await source.saveConversation(PATH, body);
    await source.handlersApi.deleteConversation({ path: PATH });
    await source.transport.attachToGeneration(PATH, signal);

    expect(getProjectConversation).toHaveBeenCalledWith(ID, signal);
    expect(saveProjectConversation).toHaveBeenCalledWith(ID, body);
    expect(deleteProjectConversation).toHaveBeenCalledWith(ID);
    expect(attachToProjectGeneration).toHaveBeenCalledWith(
      PROJECT_ID,
      PATH,
      signal,
    );
  });

  it('routes inside the project and names the project not-found message', () => {
    const source = create(false);

    expect(source.getConversationRoute(ID)).toBe(
      '/projects/chat/a1b2c3/q4/conversations/gpt-4o__Hi__1',
    );
    expect(source.getExitRoute()).toBe('/projects/view/a1b2c3/q4');
    expect(source.notFoundMessageKey).toBe(ProjectsI18nKeys.ChatNotFound);
    expect(source.isReadOnly(ID)).toBe(true);
    expect(create(true).isReadOnly(ID)).toBe(false);
  });

  it('marks the open chat viewed through the project requests', async () => {
    vi.mocked(markProjectConversationViewed).mockResolvedValue(undefined);

    await create().listSync.markViewed(ID);

    expect(markProjectConversationViewed).toHaveBeenCalledWith(ID);
  });
});
