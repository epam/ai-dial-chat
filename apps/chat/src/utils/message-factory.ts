import {
  Message,
  type MessageCustomContent,
  MessageRole,
  StatusEvent,
  StatusMessage,
  StatusMessageCustomContent,
} from '@epam/ai-dial-chat-shared';

interface MessagePair {
  userMessage: Message;
  assistantMessage: Message;
}

export const createMessagePair = (
  content: string,
  customContent?: MessageCustomContent,
  deploymentId?: string | null,
): MessagePair => {
  const now = Date.now();
  const timestamp = new Date(now).toISOString();

  return {
    userMessage: {
      role: MessageRole.User,
      content,
      timestamp,
      ...(customContent && Object.keys(customContent).length
        ? { custom_content: customContent }
        : {}),
    },
    assistantMessage: {
      role: MessageRole.Assistant,
      content: '',
      timestamp,
      ...(deploymentId ? { deploymentId } : {}),
    },
  };
};

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
    id: crypto.randomUUID(),
    role: MessageRole.Status,
    content: '',
    timestamp: new Date().toISOString(),
    deploymentId: newDeploymentId,
    custom_content,
  };
};
