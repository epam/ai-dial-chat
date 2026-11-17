/** Chat's application identifier in client-config and in Config Studio. */
export const CHAT_APP_ID = 'ai-dial-chat';

/**
 * Chat's former identifier, a deprecated alias of `CHAT_APP_ID`. It is
 * accepted wherever an application identifier is read from a request or the
 * environment, never as a Config Studio snapshot's `appId`.
 */
export const LEGACY_CHAT_APP_ID = 'chat-ui';

/** The identifier with the legacy alias replaced by `CHAT_APP_ID`. */
export const canonicalAppId = (appId: string): string =>
  appId === LEGACY_CHAT_APP_ID ? CHAT_APP_ID : appId;
