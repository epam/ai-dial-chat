import type { StarterOption } from '@epam/ai-dial-chat-shared';

interface QuickAppConversationStartersSettings {
  starters: StarterOption[];
  introText: string | undefined;
  isChatMessageInputDisabled: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === 'object' && !Array.isArray(value);

const getTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

export const getQuickAppConversationStarters = (
  conversationStarters: unknown,
): QuickAppConversationStartersSettings => {
  if (
    !isRecord(conversationStarters) ||
    !Array.isArray(conversationStarters.starters)
  ) {
    return {
      starters: [],
      introText: undefined,
      isChatMessageInputDisabled: false,
    };
  }

  const shouldSubmit = conversationStarters.autoSubmit !== false;
  const starters = conversationStarters.starters
    .filter(isRecord)
    .map((starter) => ({
      title: getTrimmedString(starter.title),
      text: getTrimmedString(starter.text),
    }))
    .filter(
      (starter): starter is { title: string; text: string } =>
        starter.title != null && starter.text != null,
    )
    .map(
      (starter, index): StarterOption => ({
        const: index,
        title: starter.title,
        'dial:widgetOptions': {
          populateText: starter.text,
          submit: shouldSubmit,
          confirmationMessage: null,
        },
      }),
    );

  return {
    starters,
    introText: getTrimmedString(conversationStarters.introText),
    isChatMessageInputDisabled:
      conversationStarters.chatMessageInputDisabled === true,
  };
};
