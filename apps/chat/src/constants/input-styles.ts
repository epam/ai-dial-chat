import type { ConversationInputStyles } from '@epam/ai-dial-conversation-input';

const BASE_COLORS: ConversationInputStyles['colors'] = {
  input: {
    background: 'var(--bg-layer-0, #fcfcfc)',
    placeholder: 'var(--text-tertiary, var(--text-secondary, #9fa6bd))',
    border: 'rgba(0, 0, 0, 0.05)',
    borderHover: 'rgba(0, 0, 0, 0.12)',
    borderFocus:
      'color-mix(in srgb, var(--stroke-accent-primary, #7da4ff) 50%, transparent)',
    shadow: '0 8px 24px rgba(16, 24, 40, 0.08)',
    shadowFocus: '0 8px 24px rgba(16, 24, 40, 0.08)',
  },
};

/** Styles for `ConversationInput` inside an active conversation. */
export const CONVERSATION_VIEW_INPUT_STYLES: ConversationInputStyles = {
  colors: BASE_COLORS,
  typography: {
    input: { fontClassName: 'dial-body-paragraph-text' },
  },
};

/** Styles for `ConversationInput` on the new-chat landing route. */
export const CONVERSATION_ROUTE_INPUT_STYLES: ConversationInputStyles = {
  colors: BASE_COLORS,
  typography: { welcomeClassName: 'dial-display2-text' },
};
