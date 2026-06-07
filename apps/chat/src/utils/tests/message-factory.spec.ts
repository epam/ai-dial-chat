import { MessageRole, StatusEvent } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import {
  createMessagePair,
  createDeploymentChangedMessage,
} from '../message-factory';

describe('createMessagePair', () => {
  it('should create a user and assistant message pair', () => {
    const result = createMessagePair('Hello');

    expect(result.userMessage.role).toBe(MessageRole.User);
    expect(result.userMessage.content).toBe('Hello');
    expect(result.assistantMessage.role).toBe(MessageRole.Assistant);
    expect(result.assistantMessage.content).toBe('');
  });

  it('should use expected id prefixes', () => {
    const result = createMessagePair('Test');

    expect(result.userMessage.id).toMatch(/^msg_/);
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

  it('should set deploymentId on assistant message when provided', () => {
    const result = createMessagePair('Hello', undefined, undefined, 'gpt-4');

    expect(result.assistantMessage.deploymentId).toBe('gpt-4');
  });

  it('should not set deploymentId on assistant message when omitted', () => {
    const result = createMessagePair('Hello');

    expect(result.assistantMessage.deploymentId).toBeUndefined();
  });
});

describe('createModelChangedMessage', () => {
  it('should create a status message with correct role', () => {
    const msg = createDeploymentChangedMessage('gpt-3', 'gpt-4');

    expect(msg.role).toBe(MessageRole.Status);
  });

  it('should set deploymentId to the new deployment', () => {
    const msg = createDeploymentChangedMessage('gpt-3', 'gpt-4');

    expect(msg.deploymentId).toBe('gpt-4');
  });

  it('should store previous and new deployment IDs in custom_content', () => {
    const msg = createDeploymentChangedMessage('gpt-3', 'gpt-4');

    expect(msg.custom_content?.event_type).toBe(StatusEvent.ModelChanged);
    expect(msg.custom_content?.previous_deployment_id).toBe('gpt-3');
    expect(msg.custom_content?.new_deployment_id).toBe('gpt-4');
  });

  it('should accept null as previous deployment', () => {
    const msg = createDeploymentChangedMessage(null, 'gpt-4');

    expect(msg.custom_content?.previous_deployment_id).toBeNull();
  });

  it('should produce a non-empty id', () => {
    const msg = createDeploymentChangedMessage(null, 'gpt-4');

    expect(msg.id).toBeTruthy();
  });
});
