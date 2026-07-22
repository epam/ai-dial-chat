/** Name of the Vite-prefixed env var carrying the chat app's overlay host URL. */
export const CHAT_OVERLAY_HOST_ENV_VAR = 'VITE_CHAT_OVERLAY_HOST';

/**
 * Reads the chat app's overlay host URL from the environment. Returns `null`
 * (rather than throwing) when unset so callers can render a visible message
 * instead of silently constructing an iframe with an empty `src`.
 */
export const getChatOverlayHost = (): string | null => {
  const host = import.meta.env.VITE_CHAT_OVERLAY_HOST;
  return host && host.length > 0 ? host : null;
};
