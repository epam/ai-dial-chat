import {
  MessageRole,
  type Message,
  type StarterOption,
} from '@epam/ai-dial-chat-shared';
import { getStartersFromSchema } from '../../utils/starter-option.js';

/**
 * Returns `true` when the message at `index` is the last assistant message
 * in the list and the assistant is currently streaming a response.
 */
export const isStreamingMessage = (
  role: MessageRole,
  index: number,
  totalCount: number,
  isAssistantTyping: boolean,
): boolean =>
  isAssistantTyping &&
  role === MessageRole.Assistant &&
  index === totalCount - 1;

/**
 * Returns `true` when quick-reply starters should be rendered for this message:
 * it must be an assistant message that is not currently streaming.
 */
export const shouldShowStarters = (
  role: MessageRole,
  index: number,
  totalCount: number,
  isAssistantTyping: boolean,
): boolean =>
  role === MessageRole.Assistant &&
  !isStreamingMessage(role, index, totalCount, isAssistantTyping);

/**
 * Derives the `starters` and `onSelectStarter` props for a `MessageBubble`
 * from the message's `form_schema` and the current streaming state.
 * Returns `undefined` for both when starters should not be shown.
 */
export const getMessageStarterProps = (
  msg: Message,
  index: number,
  totalCount: number,
  isAssistantTyping: boolean,
  onSelectStarter?: (
    starter: StarterOption,
    propertyKey?: string,
    description?: string,
  ) => void,
): {
  starters: StarterOption[] | undefined;
  onSelectStarter: ((starter: StarterOption) => void) | undefined;
} => {
  const { starters, propertyKey, description } = getStartersFromSchema(
    msg.custom_content?.form_schema,
  );
  const canShow = shouldShowStarters(
    msg.role,
    index,
    totalCount,
    isAssistantTyping,
  );
  const activeStarters = canShow && starters.length > 0 ? starters : undefined;
  return {
    starters: activeStarters,
    onSelectStarter:
      activeStarters && onSelectStarter
        ? (s) => onSelectStarter(s, propertyKey, description)
        : undefined,
  };
};
