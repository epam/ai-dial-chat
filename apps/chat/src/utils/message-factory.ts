import {
  Message,
  MessageFormValue,
  MessageRole,
  StatusEvent,
  StatusMessage,
  StatusMessageCustomContent,
} from '@epam/ai-dial-chat-shared';
import type { AttachmentDto } from '@epam/chat-api-client';

interface MessagePair {
  userMessage: Message;
  assistantMessage: Message;
  assistantMessageId: string;
}

export const createMessagePair = (
  content: string,
  attachments?: AttachmentDto[],
  formValue?: MessageFormValue,
  deploymentId?: string | null,
): MessagePair => {
  const now = Date.now();
  const timestamp = new Date(now).toISOString();
  const assistantMessageId = `stream_${now}`;

  const customContent = {
    ...(attachments?.length ? { attachments } : {}),
    ...(formValue ? { form_value: formValue } : {}),
  };

  return {
    userMessage: {
      id: `msg_${now}`,
      role: MessageRole.User,
      content,
      timestamp,
      ...(Object.keys(customContent).length
        ? { custom_content: customContent }
        : {}),
    },
    assistantMessage: {
      id: assistantMessageId,
      role: MessageRole.Assistant,
      content: '',
      timestamp,
      ...(deploymentId ? { deploymentId } : {}),
    },
    assistantMessageId,
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
