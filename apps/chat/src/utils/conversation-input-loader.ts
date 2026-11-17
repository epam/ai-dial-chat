/** The lazily loaded module that holds the conversation composer and the edit-message input. */
export type ConversationInputModule =
  typeof import('./lazy-conversation-input');

let loadedModule: ConversationInputModule | undefined;
let pendingLoad: Promise<ConversationInputModule> | undefined;

const importModule = async (): Promise<ConversationInputModule> => {
  try {
    const module = await import('./lazy-conversation-input');
    loadedModule = module;
    return module;
  } catch (error) {
    // A failed chunk request is not cached, so the next caller can retry.
    pendingLoad = undefined;
    throw error;
  }
};

/** Starts loading the composer chunk, once; later calls return the same promise. */
export const loadConversationInput = (): Promise<ConversationInputModule> => {
  pendingLoad ??= importModule();
  return pendingLoad;
};

/** Returns the composer module when it has already loaded, otherwise `undefined`. */
export const getLoadedConversationInput = ():
  ConversationInputModule | undefined => loadedModule;
