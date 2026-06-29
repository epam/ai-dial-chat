import type { ConversationInputStyles } from '@epam/ai-dial-conversation-input';

/** Shared visual style for ConversationInput — matches the Catalog browse search bar. */
export const CONVERSATION_INPUT_STYLES: ConversationInputStyles = {
  colors: {
    input: {
      background: 'var(--bg-layer-0, #fcfcfc)',
      placeholder: 'var(--text-tertiary, var(--text-secondary, #575F73))',
      border: 'var(--stroke-secondary, #d1dbea)',
      borderHover: 'var(--stroke-accent-primary)',
      borderFocus: 'var(--stroke-accent-primary)',
      shadow: 'none',
      shadowFocus: '0 0 0 4px var(--bg-accent-primary-alpha)',
    },
  },
};
