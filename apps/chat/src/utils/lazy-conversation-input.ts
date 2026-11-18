/*
 * The lazy-load boundary for the conversation composer and the edit-message
 * input. App modules that render on every page import constants, enums and
 * small components from the `@epam/ai-dial-conversation-input` barrel, so the
 * barrel itself sits in the entry chunk. `import()` of that barrel then
 * resolves to a module the entry already holds and splits nothing off, and
 * the namespace access keeps every export alive — the whole input (editor,
 * voice recorder, model selector, attachment button) loaded on every page.
 *
 * Dynamic-importing this module instead names exactly the two components, so
 * the bundler moves them and everything only they use into their own chunk.
 * Lazy call sites import from here, never from the barrel.
 */
export {
  ConversationInput,
  EditMessageInput,
} from '@epam/ai-dial-conversation-input';
