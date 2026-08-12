import { BadRequestException } from '@nestjs/common';
import { ConversationResponseDto } from '../../openapi/openapi-response.dto';
import {
  ConversationMessageDto,
  ConversationMessageRole,
} from '../dto/conversation-message.dto';
import { MessageCustomContentDto } from '../dto/message-custom-content.dto';
import { CompletionMode } from '../dto/send-completion.dto';

const makeUserMessage = (
  content: string,
  customContent?: MessageCustomContentDto,
): ConversationMessageDto => ({
  id: crypto.randomUUID(),
  role: ConversationMessageRole.User,
  content,
  timestamp: new Date().toISOString(),
  ...(customContent &&
    Object.keys(customContent).length > 0 && {
      custom_content: {
        attachments: customContent.attachments,
        configuration_value: customContent.configuration_value,
        form_value: customContent.form_value,
        state: customContent.state,
      },
    }),
});

/**
 * Strips `custom_content.state` from every message. A stateful app's `state`
 * is deployment-specific, so switching the deployment invalidates every
 * previously accumulated value in the conversation — matching the old UI's
 * `clearStateForMessages`, which clears the whole message list rather than a
 * single turn.
 */
const clearStateFromMessages = (
  messages: ConversationMessageDto[],
): ConversationMessageDto[] =>
  messages.map((msg) =>
    msg.custom_content?.state === undefined
      ? msg
      : { ...msg, custom_content: { ...msg.custom_content, state: undefined } },
  );

const makeAssistantPlaceholder = (
  deploymentId: string,
): ConversationMessageDto => ({
  id: crypto.randomUUID(),
  role: ConversationMessageRole.Assistant,
  content: '',
  timestamp: new Date().toISOString(),
  deploymentId,
});

const assertMessageIndexInRange = (
  messageIndex: number,
  messageCount: number,
): void => {
  if (messageIndex >= messageCount) {
    throw new BadRequestException(
      `messageIndex ${messageIndex} is out of range for a ${messageCount}-message conversation`,
    );
  }
};

const assertMessageIndexRole = (
  messages: ConversationMessageDto[],
  messageIndex: number,
  expectedRole: ConversationMessageRole,
  mode: CompletionMode,
): void => {
  if (messages[messageIndex]?.role !== expectedRole) {
    throw new BadRequestException(
      `messageIndex ${messageIndex} must reference a message with role "${expectedRole}" for ${mode} mode`,
    );
  }
};

/**
 * Builds the initial conversation state for each completion mode, returning
 * the modified conversation and the index of the assistant placeholder.
 *
 * Caller is responsible for persisting the returned conversation before
 * opening the upstream stream.
 */
export const buildConversationHistory = (
  mode: CompletionMode,
  conversation: ConversationResponseDto,
  message: string | undefined,
  messageIndex: number | undefined,
  customContent: MessageCustomContentDto | undefined,
  model: string,
): { conversation: ConversationResponseDto; assistantMessageIndex: number } => {
  const messages = [...conversation.messages];

  if (mode === CompletionMode.Append) {
    const userMessage = makeUserMessage(message ?? '', customContent);
    const assistantPlaceholder = makeAssistantPlaceholder(model);
    messages.push(userMessage, assistantPlaceholder);
    return {
      conversation: { ...conversation, messages },
      assistantMessageIndex: messages.length - 1,
    };
  }

  if (mode === CompletionMode.ContinueLastUser) {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role !== ConversationMessageRole.User && message != null) {
      messages.push(makeUserMessage(message, customContent));
    }
    const assistantPlaceholder = makeAssistantPlaceholder(model);
    messages.push(assistantPlaceholder);
    return {
      conversation: { ...conversation, messages },
      assistantMessageIndex: messages.length - 1,
    };
  }

  if (mode === CompletionMode.Regenerate) {
    if (messageIndex == null) {
      throw new BadRequestException(
        'messageIndex is required for regenerate mode',
      );
    }
    assertMessageIndexInRange(messageIndex, messages.length);
    assertMessageIndexRole(
      messages,
      messageIndex,
      ConversationMessageRole.Assistant,
      mode,
    );
    // Truncate up to (but not including) messageIndex, then append assistant placeholder
    const isModelChange = model !== conversation.model.id;
    const truncated = isModelChange
      ? clearStateFromMessages(messages.slice(0, messageIndex))
      : messages.slice(0, messageIndex);
    const assistantPlaceholder = makeAssistantPlaceholder(model);
    truncated.push(assistantPlaceholder);
    return {
      conversation: { ...conversation, messages: truncated },
      assistantMessageIndex: truncated.length - 1,
    };
  }

  if (mode === CompletionMode.Edit) {
    if (messageIndex == null) {
      throw new BadRequestException('messageIndex is required for edit mode');
    }
    assertMessageIndexInRange(messageIndex, messages.length);
    assertMessageIndexRole(
      messages,
      messageIndex,
      ConversationMessageRole.User,
      mode,
    );
    // Truncate up to (but not including) messageIndex, then append new user message + assistant placeholder
    const truncated = messages.slice(0, messageIndex);
    const userMessage = makeUserMessage(message ?? '', customContent);
    const assistantPlaceholder = makeAssistantPlaceholder(model);
    truncated.push(userMessage, assistantPlaceholder);
    return {
      conversation: { ...conversation, messages: truncated },
      assistantMessageIndex: truncated.length - 1,
    };
  }

  throw new BadRequestException(`Unknown completion mode: ${mode as string}`);
};
