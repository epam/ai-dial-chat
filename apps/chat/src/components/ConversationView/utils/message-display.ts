import {
  MessageRole,
  type Message,
  type StarterOption,
  type StatusMessage,
} from '@epam/ai-dial-chat-shared';
import { getStartersFromSchema } from '../../../utils/starter-option';
import { safeDecodeURIComponent } from '../../../utils/string-utils';

/*
 * Extracts a human-readable name from a raw deployment ID.
 *
 * IDs follow the pattern:
 *   applications/<bucket>/<url-encoded-name>__<version>
 *
 * Examples:
 *   "applications/.../My%20Agent__0.0.1" → "My Agent 0.0.1"
 *   "gpt-4o"                                    → "gpt-4o"
 */
const parseDeploymentDisplayName = (id: string): string => {
  const lastSegment = id.split('/').pop() ?? id;
  const decoded = safeDecodeURIComponent(lastSegment);
  const separatorIndex = decoded.lastIndexOf('__');
  if (separatorIndex === -1) return decoded;
  const name = decoded.slice(0, separatorIndex);
  const version = decoded.slice(separatorIndex + 2);
  return version ? `${name} ${version}` : name;
};

/**
 * Resolves display props for a `MessageRole.Status` message.
 * Returns `undefined` for non-status messages.
 * Accepts pre-translated strings so i18n stays in the caller.
 */
export const getStatusMessageProps = (
  msg: StatusMessage,
  deploymentLookup: Record<string, { displayName: string }>,
  titleText: string,
  formatBodyText: (from: string, to: string) => string,
): { statusTitleText: string; statusBodyText: string } => {
  const customContent = msg.custom_content;
  const prevName = customContent?.previous_deployment_id
    ? (deploymentLookup[customContent.previous_deployment_id]?.displayName ??
      parseDeploymentDisplayName(customContent.previous_deployment_id))
    : null;
  const newName = customContent?.new_deployment_id
    ? (deploymentLookup[customContent.new_deployment_id]?.displayName ??
      parseDeploymentDisplayName(customContent.new_deployment_id))
    : '';
  return {
    statusTitleText: titleText,
    statusBodyText: formatBodyText(prevName ?? '…', newName),
  };
};

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
