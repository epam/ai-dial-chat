/** The lazily loaded module that renders one conversation message. */
export type ConversationMessageItemModule =
  typeof import('../components/ConversationView/ConversationMessageItem');

let loadedModule: ConversationMessageItemModule | undefined;
let pendingLoad: Promise<ConversationMessageItemModule> | undefined;

const importModule = async (): Promise<ConversationMessageItemModule> => {
  try {
    const module =
      await import('../components/ConversationView/ConversationMessageItem');
    loadedModule = module;
    return module;
  } catch (error) {
    // A failed chunk request is not cached, so the next caller can retry.
    pendingLoad = undefined;
    throw error;
  }
};

/**
 * Starts loading the message renderer chunk, once; later calls return the same
 * promise. The chunk carries the message bubbles, stages and citations, and
 * with them the markdown engine (unified, micromark, `hast-util-raw`), which a
 * conversation without messages — the home page — never renders.
 */
export const loadConversationMessageItem =
  (): Promise<ConversationMessageItemModule> => {
    pendingLoad ??= importModule();
    return pendingLoad;
  };

/** Returns the message renderer module when it has already loaded, otherwise `undefined`. */
export const getLoadedConversationMessageItem = ():
  ConversationMessageItemModule | undefined => loadedModule;
