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

  it('should not set ids in message pair', () => {
    const result = createMessagePair('Test');

    expect(result.userMessage.id).toBeUndefined();
    expect(result.assistantMessage.id).toBeUndefined();
  });

  it('should include form_value in custom_content when provided', () => {
    const result = createMessagePair('Pick a number', {
      form_value: { button: 1 },
    });

    expect(result.userMessage.custom_content?.form_value).toEqual({
      button: 1,
    });
  });

  it('should include configuration_value in custom_content when provided', () => {
    const result = createMessagePair('Research this', {
      configuration_value: { deep_research: true },
    });

    expect(result.userMessage.custom_content?.configuration_value).toEqual({
      deep_research: true,
    });
  });

  it('should not set custom_content when no attachments or formValue', () => {
    const result = createMessagePair('Hello');

    expect(result.userMessage.custom_content).toBeUndefined();
  });

  it('should set deploymentId on assistant message when provided', () => {
    const result = createMessagePair('Hello', undefined, 'gpt-4');

    expect(result.assistantMessage.deploymentId).toBe('gpt-4');
  });

  it('should not set deploymentId on assistant message when omitted', () => {
    const result = createMessagePair('Hello');

    expect(result.assistantMessage.deploymentId).toBeUndefined();
  });
});
