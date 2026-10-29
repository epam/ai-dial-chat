import { createChatStreamApi } from '@epam/ai-dial-chat-hooks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  attachToProjectGeneration,
  deleteProjectConversation,
  getProjectConversation,
  saveProjectConversation,
} from '../../server-api/project-conversations.api';
import { createProjectConversationDataSource } from '../project-conversation-data-source';

vi.mock('@epam/ai-dial-chat-hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-chat-hooks')>()),
  createChatStreamApi: vi.fn(() => ({
    streamCompletion: vi.fn(),
    stopCompletion: vi.fn(),
  })),
}));
vi.mock('../../server-api/project-conversations.api', () => ({
  attachToProjectGeneration: vi.fn(),
  deleteProjectConversation: vi.fn(),
  getProjectConversation: vi.fn(),
  saveProjectConversation: vi.fn(),
}));

const PROJECT_ID = 'projects/a1b2c3/q4';
const ID = `${PROJECT_ID}/conversations/gpt-4o__Hi__1`;
const PATH = 'a1b2c3/q4/conversations/gpt-4o__Hi__1';

const create = (canEdit = true) =>
  createProjectConversationDataSource({ projectId: PROJECT_ID, canEdit });

describe('createProjectConversationDataSource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('streams through the project base path', () => {
    create();

    expect(createChatStreamApi).toHaveBeenCalledWith(
      expect.objectContaining({
        completionsBasePath: `/api/v1/projects/${encodeURIComponent(PROJECT_ID)}/conversations`,
      }),
    );
  });

  it('maps stream paths back to the conversation id on save and delete', async () => {
    const source = create();
    const body = { id: ID } as never;

    await source.saveConversation(PATH, body);
    await source.handlersApi.saveConversation({
      path: PATH,
      saveConversationBodyDto: { conversation: body },
    });
    await source.handlersApi.deleteConversation({ path: PATH });

    expect(saveProjectConversation).toHaveBeenNthCalledWith(1, ID, body);
    expect(saveProjectConversation).toHaveBeenNthCalledWith(2, ID, body);
    expect(deleteProjectConversation).toHaveBeenCalledWith(ID);
  });

  it('attaches through the project endpoint', async () => {
    const signal = new AbortController().signal;
    await create().transport.attachToGeneration(PATH, signal);

    expect(attachToProjectGeneration).toHaveBeenCalledWith(
      PROJECT_ID,
      PATH,
      signal,
    );
  });

  it('opens no subscription for the conversation watch', async () => {
    const stream = await create().transport.watchConversation(
      PATH,
      new AbortController().signal,
    );
    const { done } = await stream.getReader().read();

    expect(done).toBe(true);
  });

  it('routes inside the project and never syncs the sidebar or duplicates', () => {
    const source = create(false);

    expect(source.getConversationRoute(ID)).toBe(
      '/projects/chat/a1b2c3/q4/conversations/gpt-4o__Hi__1',
    );
    expect(source.getExitRoute()).toBe('/projects/view/a1b2c3/q4');
    expect(source.isReadOnly(ID)).toBe(true);
    expect(create(true).isReadOnly(ID)).toBe(false);
    expect(source.listSync).toBeNull();
    expect(source.canDuplicate).toBe(false);
  });

  it('re-reads the conversation until its title changes', async () => {
    vi.useFakeTimers();
    vi.mocked(getProjectConversation)
      .mockResolvedValueOnce({ name: 'Hi' } as never)
      .mockResolvedValueOnce({ name: 'Greeting' } as never);
    const onUpdated = vi.fn();

    create().watchTitle(ID, 'Hi', onUpdated);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(onUpdated).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2_000);

    expect(onUpdated).toHaveBeenCalledWith('Greeting');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(getProjectConversation).toHaveBeenCalledTimes(2);
  });

  it('stops re-reading after the cleanup or five attempts', async () => {
    vi.useFakeTimers();
    vi.mocked(getProjectConversation).mockResolvedValue({
      name: 'Hi',
    } as never);

    create().watchTitle(ID, 'Hi', vi.fn());
    await vi.advanceTimersByTimeAsync(20_000);
    expect(getProjectConversation).toHaveBeenCalledTimes(5);

    vi.mocked(getProjectConversation).mockClear();
    const cleanup = create().watchTitle(ID, 'Hi', vi.fn());
    cleanup();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(getProjectConversation).not.toHaveBeenCalled();
  });
});
