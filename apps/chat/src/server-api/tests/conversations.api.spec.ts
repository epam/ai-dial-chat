import { afterEach, describe, expect, it, vi } from 'vitest';
import { conversationsApi } from '../api-client';
import {
  createConversation,
  generateConversationTitle,
  listConversations,
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
});
