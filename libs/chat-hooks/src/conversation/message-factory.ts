import {
  generateUUID,
  MessageRole,
  StatusEvent,
  StatusMessage,
  StatusMessageCustomContent,
} from '@epam/ai-dial-chat-shared';

/**
 * Creates a status message recording a deployment change in the conversation timeline.
 * Status messages are never forwarded to DIAL Core.
 */
export const createDeploymentChangedMessage = (
  previousDeploymentId: string | null,
  newDeploymentId: string,
): StatusMessage => {
  const custom_content: StatusMessageCustomContent = {
    event_type: StatusEvent.ModelChanged,
    previous_deployment_id: previousDeploymentId,
    new_deployment_id: newDeploymentId,
  };
  return {
    id: generateUUID(),
    role: MessageRole.Status,
    content: '',
    timestamp: new Date().toISOString(),
    deploymentId: newDeploymentId,
    custom_content,
  };
};
