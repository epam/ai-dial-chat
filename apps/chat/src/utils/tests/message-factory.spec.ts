import { MessageRole } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import { createMessagePair } from '../message-factory';

describe('createMessagePair', () => {
  it('should create a user and assistant message pair', () => {
    const result = createMessagePair('Hello');

    expect(result.userMessage.role).toBe(MessageRole.User);
    expect(result.userMessage.content).toBe('Hello');
    expect(result.assistantMessage.role).toBe(MessageRole.Assistant);
    expect(result.assistantMessage.content).toBe('');
  });

  it('should provide assistantMessageId matching assistant message id', () => {
    const result = createMessagePair('Test');

    expect(result.assistantMessage.id).toBe(result.assistantMessageId);
  });

  it('should use expected id prefixes', () => {
    const result = createMessagePair('Test');

    expect(result.userMessage.id).toMatch(/^msg_/);
    expect(result.assistantMessageId).toMatch(/^stream_/);
  });

  it('should include form_value in custom_content when provided', () => {
    const result = createMessagePair('Pick a number', undefined, {
      button: 1,
    });

    expect(result.userMessage.custom_content?.form_value).toEqual({
      button: 1,
    });
  });

  it('should not set custom_content when no attachments or formValue', () => {
    const result = createMessagePair('Hello');

    expect(result.userMessage.custom_content).toBeUndefined();
  });
});
