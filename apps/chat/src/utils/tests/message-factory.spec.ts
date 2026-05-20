import { MessageRole } from '@epam/chat-shared';
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
});
