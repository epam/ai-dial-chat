import { afterEach, describe, expect, it, vi } from 'vitest';
import { conversationsApi } from '../api-client';
import {
  createConversation,
  generateConversationTitle,
  getConversation,
  listConversations,
  saveConversation,
} from '../conversations.api';

describe('createConversation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls conversationsApi with firstMessage and deploymentId', async () => {
    const spy = vi
      .spyOn(conversationsApi, 'createConversation')
      .mockResolvedValue({} as never);

    await createConversation('Hello', 'dep-1');

    expect(spy).toHaveBeenCalledWith({
      createConversationDto: { firstMessage: 'Hello', deploymentId: 'dep-1' },
    });
  });

  it('includes attachments when provided', async () => {
    const spy = vi
      .spyOn(conversationsApi, 'createConversation')
      .mockResolvedValue({} as never);
    const attachments = [{ type: 'application/pdf', title: 'doc.pdf' }];

    await createConversation('Hello', 'dep-1', attachments);

    expect(spy).toHaveBeenCalledWith({
      createConversationDto: {
        firstMessage: 'Hello',
        deploymentId: 'dep-1',
        custom_content: {
          attachments,
        },
      },
    });
  });

  it('omits attachments when array is empty', async () => {
    const spy = vi
      .spyOn(conversationsApi, 'createConversation')
      .mockResolvedValue({} as never);

    await createConversation('Hello', 'dep-1', []);

    expect(spy).toHaveBeenCalledWith({
      createConversationDto: { firstMessage: 'Hello', deploymentId: 'dep-1' },
    });
  });

  it('includes deployment configuration when provided', async () => {
    const spy = vi
      .spyOn(conversationsApi, 'createConversation')
      .mockResolvedValue({} as never);

    await createConversation('Hello', 'dep-1', [], { starter: 0 });

    expect(spy).toHaveBeenCalledWith({
      createConversationDto: {
        firstMessage: 'Hello',
        deploymentId: 'dep-1',
        custom_content: {
          configuration_value: { starter: 0 },
        },
      },
    });
  });

  it('includes form value when provided', async () => {
    const spy = vi
      .spyOn(conversationsApi, 'createConversation')
      .mockResolvedValue({} as never);

    await createConversation('Hello', 'dep-1', [], undefined, { button: 1 });

    expect(spy).toHaveBeenCalledWith({
      createConversationDto: {
        firstMessage: 'Hello',
        deploymentId: 'dep-1',
        custom_content: {
          form_value: { button: 1 },
        },
      },
    });
  });
});

describe('generateConversationTitle', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls conversationsApi with the conversation path', async () => {
    const spy = vi
      .spyOn(conversationsApi, 'generateConversationTitle')
      .mockResolvedValue({ name: 'Generated name' });

    const result = await generateConversationTitle('gpt-4o__Chat__uuid');

    expect(spy).toHaveBeenCalledWith({ path: 'gpt-4o__Chat__uuid' });
    expect(result).toEqual({ name: 'Generated name' });
  });
});

describe('listConversations', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requests up to 1000 conversations by default', async () => {
    const spy = vi
      .spyOn(conversationsApi, 'listConversations')
      .mockResolvedValue({ items: [] });

    await listConversations();

    expect(spy).toHaveBeenCalledWith({
      limit: 1000,
      nextToken: undefined,
      path: undefined,
    });
  });

  it('preserves an explicitly provided limit', async () => {
    const spy = vi
      .spyOn(conversationsApi, 'listConversations')
      .mockResolvedValue({ items: [] });

    await listConversations({ limit: 50 });

    expect(spy).toHaveBeenCalledWith({
      limit: 50,
      nextToken: undefined,
      path: undefined,
    });
  });

  it('passes an AbortSignal through to the generated client when provided', async () => {
    const spy = vi
      .spyOn(conversationsApi, 'listConversations')
      .mockResolvedValue({ items: [] });
    const controller = new AbortController();

    await listConversations({}, controller.signal);

    expect(spy).toHaveBeenCalledWith(
      { limit: 1000, nextToken: undefined, path: undefined },
      { signal: controller.signal },
    );
  });
});

describe('getConversation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls conversationsApi with the conversation path', async () => {
    const spy = vi
      .spyOn(conversationsApi, 'getConversation')
      .mockResolvedValue({} as never);

    await getConversation('bucket/chat.json');

    expect(spy).toHaveBeenCalledWith({ path: 'bucket/chat.json' });
  });

  it('passes an AbortSignal through to the generated client when provided', async () => {
    const spy = vi
      .spyOn(conversationsApi, 'getConversation')
      .mockResolvedValue({} as never);
    const controller = new AbortController();

    await getConversation('bucket/chat.json', controller.signal);

    expect(spy).toHaveBeenCalledWith(
      { path: 'bucket/chat.json' },
      { signal: controller.signal },
    );
  });
});

describe('saveConversation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls conversationsApi with the path and conversation body', async () => {
    const spy = vi
      .spyOn(conversationsApi, 'saveConversation')
      .mockResolvedValue({} as never);
    const conversation = { id: 'bucket/chat.json' } as never;

    await saveConversation('bucket/chat.json', conversation);

    expect(spy).toHaveBeenCalledWith({
      path: 'bucket/chat.json',
      saveConversationBodyDto: { conversation },
    });
  });

  it('passes an AbortSignal through to the generated client when provided', async () => {
    const spy = vi
      .spyOn(conversationsApi, 'saveConversation')
      .mockResolvedValue({} as never);
    const controller = new AbortController();
    const conversation = { id: 'bucket/chat.json' } as never;

    await saveConversation('bucket/chat.json', conversation, controller.signal);

    expect(spy).toHaveBeenCalledWith(
      {
        path: 'bucket/chat.json',
        saveConversationBodyDto: { conversation },
      },
      { signal: controller.signal },
    );
  });
});
