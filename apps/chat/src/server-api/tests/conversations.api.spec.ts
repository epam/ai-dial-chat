import { afterEach, describe, expect, it, vi } from 'vitest';
import { conversationsApi } from '../api-client';
import { createConversation } from '../conversations.api';

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
