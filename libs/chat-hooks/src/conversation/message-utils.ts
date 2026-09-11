import {
  Message,
  MessageRole,
  ResponseFormat,
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
 * Returns the deployment the conversation was last running on: scanning
 * backwards, the `new_deployment_id` of a `model_changed` status message or
 * the `deploymentId` a message carries in its own right, whichever comes
 * later. `null` when neither is present.
 *
 * Reading only the status messages loses the switch whenever a regenerate or
 * an edit truncates past one: the marker is appended at the end of the
 * timeline, so truncating at an earlier message drops it, and the model the
 * user picked reverted on the next page load even though the answer had been
 * regenerated on it (issue #8712). The assistant message the backend writes
 * carries the deployment that produced it, which survives that truncation
 * because it *is* the regenerated message.
 */
export const getLastDeploymentId = (messages: Message[]): string | null => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (
      isStatusMessage(msg) &&
      msg.custom_content?.event_type === StatusEvent.ModelChanged
    ) {
      return msg.custom_content.new_deployment_id;
    }
    if (msg.deploymentId) return msg.deploymentId;
  }
  return null;
};

/** True when `message` is an assistant message carrying at least one stage. */
export const messageHasStages = (message: Message): boolean =>
  message.role === MessageRole.Assistant &&
  (message.custom_content?.stages?.length ?? 0) > 0;

/**
 * Returns the `configuration_value` stored on the last user message, or
 * `undefined` if none exists. Used to restore the tools menu toggle state
 * when a conversation is (re-)loaded, mirroring `getLastDeploymentId`.
 */
export const getLastUserMessageToolConfiguration = (
  messages: Message[],
): Record<string, unknown> | undefined => {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === MessageRole.User) {
      return messages[i].custom_content?.configuration_value;
    }
  }
  return undefined;
};

/**
 * Normalises a stored response-format string to the current enum. Legacy data
 * may contain `'Markdown'` or `'PlainText'` (capital-first) instead of the
 * current enum values `'markdown'` / `'plain_text'`.
 */
export const normalizeResponseFormat = (
  value: string | undefined,
): ResponseFormat => {
  const lower = (value ?? '').toLowerCase().replace(/[^a-z]/g, '');
  if (lower === 'plaintext') return ResponseFormat.PlainText;
  return ResponseFormat.Markdown;
};
