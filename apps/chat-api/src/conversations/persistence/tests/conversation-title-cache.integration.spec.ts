import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../../dial/dial-client.service';
import type { ConversationResponseDto } from '../../../openapi/openapi-response.dto';
import { ConversationLifecycleService } from '../../lifecycle/conversation-lifecycle.service';
import { ConversationTitleCacheService } from '../../listing/conversation-title-cache.service';
import { ConversationPersistenceService } from '../conversation-persistence.service';

const path = 'gpt-4o__Original';
const id = `conversations/bucket/${path}`;
const body: ConversationResponseDto = {
  id: `bucket/${path}`,
  folderId: 'bucket',
  name: 'Original',
  llmNamingDone: true,
  model: { id: 'gpt-4o' },
  prompt: '',
  temperature: 1,
  messages: [],
  lastActivityDate: 0,
  updatedAt: 0,
  selectedAddons: [],
  assistantModelId: 'gpt-4o',
};
const response = (status = 200) =>
  new Response(null, { status, headers: { etag: '"1"' } });
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe('conversation persistence title cache', () => {
  let cache: ConversationTitleCacheService;
  let persistence: ConversationPersistenceService;
  let lifecycle: ConversationLifecycleService;
  let getConversation: ReturnType<typeof vi.fn>;
  let saveConversation: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    cache = new ConversationTitleCacheService();
    getConversation = vi
      .fn()
      .mockResolvedValue({ data: body, response: response() });
    saveConversation = vi
      .fn()
      .mockResolvedValue({ data: {}, response: response() });
    const dial = {
      client: {
        getConversation,
        saveConversation,
        deleteConversation: vi.fn().mockResolvedValue({ response: response() }),
      },
    } as unknown as DialClientService;
    persistence = new ConversationPersistenceService(
      dial,
      { maybeRenameAfterFirstReply: vi.fn() } as never,
      cache,
    );
    lifecycle = new ConversationLifecycleService(
      dial,
      { updatePin: vi.fn().mockResolvedValue(undefined) } as never,
      persistence,
      {} as never,
      {} as never,
      cache,
    );
  });

  it('warms only a summary on successful get and refreshes it on save', async () => {
    await persistence.getConversation(path, 'token', 'bucket');
    expect(cache.get('token', id)).toEqual({
      name: 'Original',
      llmNamingDone: true,
    });
    await persistence.saveConversation(path, 'token', 'bucket', {
      ...body,
      name: 'Saved title',
    });
    expect(cache.get('token', id)).toEqual({
      name: 'Saved title',
      llmNamingDone: true,
    });
  });

  it('does not let an old successful GET replace a saved title', async () => {
    const oldRead = deferred<{
      data: ConversationResponseDto;
      response: Response;
    }>();
    getConversation.mockReturnValueOnce(oldRead.promise);
    const read = persistence.getConversation(path, 'token', 'bucket');
    await persistence.saveConversation(path, 'token', 'bucket', {
      ...body,
      name: 'Saved title',
    });
    oldRead.resolve({ data: body, response: response() });
    await read;
    expect(cache.get('token', id)?.name).toBe('Saved title');
  });

  it('does not let a late missing read discard a newly saved title', async () => {
    const oldRead = deferred<{ error: string; response: Response }>();
    getConversation.mockReturnValueOnce(oldRead.promise);
    const read = persistence.readConversationWithEtag(path, 'token', 'bucket');
    await persistence.saveConversation(path, 'token', 'bucket', {
      ...body,
      name: 'Created title',
    });
    oldRead.resolve({ error: 'missing', response: response(404) });
    expect(await read).toBeNull();
    expect(cache.get('token', id)?.name).toBe('Created title');
  });

  it('updates cached titles after manual rename and invalidates them after delete', async () => {
    cache.set('token', id, body);
    await lifecycle.renameConversation(
      path,
      'Renamed title',
      'token',
      'bucket',
    );
    expect(cache.get('token', id)?.name).toBe('Renamed title');
    await lifecycle.deleteConversation(path, 'token', 'bucket');
    expect(cache.get('token', id)).toBeUndefined();
  });

  it('updates the projection on conditional naming saves but not rejected writes', async () => {
    const named = { ...body, name: 'LLM title' };
    await persistence.saveConversationIfMatch(
      path,
      'token',
      'bucket',
      named,
      '"1"',
    );
    expect(cache.get('token', id)?.name).toBe('LLM title');
    saveConversation.mockResolvedValueOnce({
      error: 'conflict',
      response: response(412),
    });
    await persistence.saveConversationIfMatch(
      path,
      'token',
      'bucket',
      { ...body, name: 'Rejected title' },
      '"old"',
    );
    expect(cache.get('token', id)?.name).toBe('LLM title');
  });
});
