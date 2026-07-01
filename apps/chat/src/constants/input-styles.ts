import type { ConversationInputStyles } from '@epam/ai-dial-conversation-input';

/** Shared visual style for ConversationInput. */
export const CONVERSATION_INPUT_STYLES: ConversationInputStyles = {
  colors: {
    input: {
      background: 'var(--bg-layer-0, #fcfcfc)',
      placeholder: 'var(--text-tertiary, var(--text-secondary, #9fa6bd))',
      border: 'rgba(0, 0, 0, 0.07)',
      borderHover: 'rgba(0, 0, 0, 0.12)',
      borderFocus: 'rgba(125, 164, 255, 0.5)',
      shadow: '0 8px 24px rgba(16, 24, 40, 0.08)',
      shadowFocus: '0 8px 24px rgba(16, 24, 40, 0.08)',
    },
  },
};
