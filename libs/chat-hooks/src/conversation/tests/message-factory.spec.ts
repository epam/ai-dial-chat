import { MessageRole, StatusEvent } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import { createDeploymentChangedMessage } from '../message-factory';

describe('createDeploymentChangedMessage', () => {
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
