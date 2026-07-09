import type { ConversationInputStyles } from '@epam/ai-dial-conversation-input';

/** Styles for `ConversationInput` inside an active conversation. */
export const CONVERSATION_VIEW_INPUT_STYLES: ConversationInputStyles = {
  typography: {
    input: { fontClassName: 'dial-body-paragraph-text' },
  },
};

/** Styles for `ConversationInput` on the new-chat landing route. */
export const CONVERSATION_ROUTE_INPUT_STYLES: ConversationInputStyles = {
  typography: { welcomeClassName: 'dial-display2-text' },
};
