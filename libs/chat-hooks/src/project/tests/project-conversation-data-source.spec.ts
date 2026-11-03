import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NO_CONVERSATION_LIST_SYNC } from '../../conversation/conversation-data-source';
import { createChatStreamApi } from '../../conversation/create-chat-stream-api';
import { createSerializedKeyedWriter } from '../../shared/serialized-writer';
import { createProjectConversationDataSource } from '../project-conversation-data-source';

vi.mock('../../conversation/create-chat-stream-api', () => ({
  createChatStreamApi: vi.fn(() => ({
    streamCompletion: vi.fn(),
    stopCompletion: vi.fn(),
  })),
}));

const PROJECT_ID = 'projects/a1b2c3/q4';
const ID = `${PROJECT_ID}/conversations/gpt-4o__Hi__1`;
const PATH = 'a1b2c3/q4/conversations/gpt-4o__Hi__1';
const BASE_PATH = `/host/projects/${encodeURIComponent(PROJECT_ID)}/conversations`;

const client = {
  getProjectConversation: vi.fn(),
  saveProjectConversation: vi.fn(),
  deleteProjectConversation: vi.fn(),
  attachToProjectGeneration: vi.fn(),
};
const getCsrfToken = vi.fn(() => 'csrf');
const setCsrfToken = vi.fn();
const writeViewed = vi.fn();
const viewedWriter = createSerializedKeyedWriter(writeViewed);
const getConversationRoute = vi.fn((id: string) => `/chat/${id}`);
const getExitRoute = vi.fn(() => '/view/q4');

const create = (canEdit = true, notFoundMessageKey?: string) =>
  createProjectConversationDataSource({
    projectId: PROJECT_ID,
    canEdit,
    client,
    stream: { getCsrfToken, setCsrfToken, completionsBasePath: BASE_PATH },
    routes: { getConversationRoute, getExitRoute },
    viewedWriter,
    notFoundMessageKey,
  });

describe('createProjectConversationDataSource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('streams through the base path and CSRF accessors the host supplies', () => {
    create();

    expect(createChatStreamApi).toHaveBeenCalledWith(
      expect.objectContaining({
        completionsBasePath: BASE_PATH,
        getCsrfToken,
        setCsrfToken,
        getTimezone: expect.any(Function),
      }),
    );
  });

  it('maps stream paths back to the conversation id on save and delete', async () => {
    const source = create();
    const body = { id: ID } as never;

    await source.saveConversation(PATH, body);
    await source.saveConversation(ID, body);
    await source.handlersApi.saveConversation({
      path: PATH,
      saveConversationBodyDto: { conversation: body },
    });
    await source.handlersApi.deleteConversation({ path: PATH });

    expect(client.saveProjectConversation).toHaveBeenNthCalledWith(1, ID, body);
    expect(client.saveProjectConversation).toHaveBeenNthCalledWith(2, ID, body);
    expect(client.saveProjectConversation).toHaveBeenNthCalledWith(3, ID, body);
    expect(client.deleteProjectConversation).toHaveBeenCalledWith(ID);
  });

  it('attaches through the project endpoint', async () => {
    const signal = new AbortController().signal;
    await create().transport.attachToGeneration(PATH, signal);

    expect(client.attachToProjectGeneration).toHaveBeenCalledWith(
      PROJECT_ID,
      PATH,
      signal,
    );
  });

  it('polls the conversation watch with update events until aborted', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const stream = await create().transport.watchConversation(
      PATH,
      controller.signal,
    );
    const reader = stream.getReader();

    const first = reader.read();
    await vi.advanceTimersByTimeAsync(5_000);
    const { value } = await first;
    expect(new TextDecoder().decode(value)).toBe(
      'data: {"action":"UPDATE"}\n\n',
    );

    const second = reader.read();
    controller.abort();
    expect((await second).done).toBe(true);
  });

  it('routes through the host builders and never syncs the sidebar or duplicates', () => {
    const source = create(false, 'projects.chat.notFound');

    expect(source.getConversationRoute(ID)).toBe(`/chat/${ID}`);
    expect(source.getExitRoute()).toBe('/view/q4');
    expect(source.notFoundMessageKey).toBe('projects.chat.notFound');
    expect(source.isReadOnly(ID)).toBe(true);
    expect(create(true).isReadOnly(ID)).toBe(false);
    expect(source.listSync).toMatchObject({
      updateTitle: NO_CONVERSATION_LIST_SYNC.updateTitle,
      bumpActivity: NO_CONVERSATION_LIST_SYNC.bumpActivity,
      remove: NO_CONVERSATION_LIST_SYNC.remove,
      refresh: NO_CONVERSATION_LIST_SYNC.refresh,
      shouldMarkOpenChatViewed: true,
    });
    expect(source.canDuplicate).toBe(false);
  });

  it('marks the open chat viewed through the supplied writer and drops a waiting mark when a generation starts', async () => {
    let releaseFirst!: () => void;
    writeViewed
      .mockReturnValueOnce(
        new Promise<void>((resolve) => {
          releaseFirst = resolve;
        }),
      )
      .mockResolvedValue(undefined);
    const { listSync } = create();
    const other = 'projects/a1b2c3/q4/conversations/gpt-4o__Other__2';

    const first = listSync.markViewed(other);
    const second = listSync.markViewed(ID);
    listSync.markUnread(ID);
    releaseFirst();
    await Promise.all([first, second]);

    expect(writeViewed.mock.calls).toEqual([[other]]);
  });

  it('re-reads the conversation until its title changes', async () => {
    vi.useFakeTimers();
    client.getProjectConversation
      .mockResolvedValueOnce({ name: 'Hi' })
      .mockResolvedValueOnce({ name: 'Greeting' });
    const onUpdated = vi.fn();

    create().watchTitle(ID, 'Hi', onUpdated);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(onUpdated).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2_000);

    expect(onUpdated).toHaveBeenCalledWith('Greeting');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(client.getProjectConversation).toHaveBeenCalledTimes(2);
  });

  it('stops re-reading after the cleanup or five attempts', async () => {
    vi.useFakeTimers();
    client.getProjectConversation.mockResolvedValue({ name: 'Hi' });

    create().watchTitle(ID, 'Hi', vi.fn());
    await vi.advanceTimersByTimeAsync(20_000);
    expect(client.getProjectConversation).toHaveBeenCalledTimes(5);

    client.getProjectConversation.mockClear();
    const cleanup = create().watchTitle(ID, 'Hi', vi.fn());
    cleanup();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(client.getProjectConversation).not.toHaveBeenCalled();
  });
});
