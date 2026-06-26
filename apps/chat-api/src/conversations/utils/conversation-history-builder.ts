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
        form_value: customContent.form_value,
      },
    }),
});

const makeAssistantPlaceholder = (): ConversationMessageDto => ({
  id: crypto.randomUUID(),
  role: ConversationMessageRole.Assistant,
  content: '',
  timestamp: new Date().toISOString(),
});

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
): { conversation: ConversationResponseDto; assistantMessageIndex: number } => {
  const messages = [...conversation.messages];

  if (mode === CompletionMode.Append) {
    const userMessage = makeUserMessage(message ?? '', customContent);
    const assistantPlaceholder = makeAssistantPlaceholder();
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
    const assistantPlaceholder = makeAssistantPlaceholder();
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
    // Truncate up to (but not including) messageIndex, then append assistant placeholder
    const truncated = messages.slice(0, messageIndex);
    const assistantPlaceholder = makeAssistantPlaceholder();
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
    // Truncate up to (but not including) messageIndex, then append new user message + assistant placeholder
    const truncated = messages.slice(0, messageIndex);
    const userMessage = makeUserMessage(message ?? '', customContent);
    const assistantPlaceholder = makeAssistantPlaceholder();
    truncated.push(userMessage, assistantPlaceholder);
    return {
      conversation: { ...conversation, messages: truncated },
      assistantMessageIndex: truncated.length - 1,
    };
  }

  throw new BadRequestException(`Unknown completion mode: ${mode as string}`);
};
