import { MessageRole } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import { createMessagePair } from '../message-factory';

describe('createMessagePair', () => {
  it('should create a user and assistant message pair', () => {
    const result = createMessagePair({ content: 'Hello' });

    expect(result.userMessage.role).toBe(MessageRole.User);
    expect(result.userMessage.content).toBe('Hello');
    expect(result.assistantMessage.role).toBe(MessageRole.Assistant);
    expect(result.assistantMessage.content).toBe('');
  });

  it('should provide assistantMessageId matching assistant message id', () => {
    const result = createMessagePair({ content: 'Test' });

    expect(result.assistantMessage.id).toBe(result.assistantMessageId);
  });

  it('should use expected id prefixes', () => {
    const result = createMessagePair({ content: 'Test' });

    expect(result.userMessage.id).toMatch(/^msg_/);
    expect(result.assistantMessageId).toMatch(/^stream_/);
  });

  it('should attach custom_content.attachments to the user message when provided', () => {
    const attachment = {
      type: 'application/pdf',
      title: 'doc.pdf',
      url: 'files/bucket/doc.pdf',
    };
    const result = createMessagePair({
      content: 'See attached',
      attachments: [attachment],
    });

    expect(result.userMessage.custom_content?.attachments).toEqual([attachment]);
  expect(result.assistantMessage.custom_content).toBeUndefined();
  });

  it('should omit custom_content when no attachments are provided', () => {
    const result = createMessagePair({ content: 'Hello' });

    expect(result.userMessage.custom_content).toBeUndefined();
  });

  it('should omit custom_content when attachments is an empty array', () => {
    const result = createMessagePair({ content: 'Hello', attachments: [] });

    expect(result.userMessage.custom_content).toBeUndefined();
  });
});
