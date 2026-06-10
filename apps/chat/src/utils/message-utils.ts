import {
  Message,
  MessageRole,
  StatusEvent,
  isStatusMessage,
} from '@epam/ai-dial-chat-shared';

/**
 * Returns `true` when `message` is the actively-streaming assistant response.
 * Only the last message in the list can be streaming, and only while
 * `isAssistantTyping` is `true`.
 */
export const isMessageStreaming = (
  message: Message,
  messageIndex: number,
  totalMessages: number,
  isAssistantTyping: boolean,
): boolean =>
  isAssistantTyping &&
  messageIndex === totalMessages - 1 &&
  message.role === MessageRole.Assistant;

/**
 * Returns the `new_deployment_id` from the last `model_changed` status message
 * in the list, or `null` if none exists.
 */
export const getLastDeploymentId = (messages: Message[]): string | null => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (isStatusMessage(msg)) {
      if (msg.custom_content?.event_type === StatusEvent.ModelChanged) {
        return msg.custom_content.new_deployment_id;
      }
    }
  }
  return null;
};

export const messageHasStages = (message: Message): boolean =>
  message.role === MessageRole.Assistant &&
  (message.custom_content?.stages?.length ?? 0) > 0;
