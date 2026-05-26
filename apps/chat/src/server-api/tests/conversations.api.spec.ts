import { afterEach, describe, expect, it, vi } from 'vitest';
import { conversationsApi } from '../api-client';
import { createConversation } from '../conversations.api';

describe('createConversation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls conversationsApi with firstMessage and catalogItemId', async () => {
    const spy = vi
      .spyOn(conversationsApi, 'createConversation')
      .mockResolvedValue({} as never);

    await createConversation('Hello', 'dep-1');

    expect(spy).toHaveBeenCalledWith({
      createConversationDto: { firstMessage: 'Hello', catalogItemId: 'dep-1' },
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
        catalogItemId: 'dep-1',
        attachments,
      },
    });
  });

  it('omits attachments when array is empty', async () => {
    const spy = vi
      .spyOn(conversationsApi, 'createConversation')
      .mockResolvedValue({} as never);

    await createConversation('Hello', 'dep-1', []);

    expect(spy).toHaveBeenCalledWith({
      createConversationDto: { firstMessage: 'Hello', catalogItemId: 'dep-1' },
    });
  });
});
