/** Vite local-development override for the chat app's overlay host URL. */
export const VITE_CHAT_OVERLAY_HOST_ENV_VAR = 'VITE_CHAT_OVERLAY_HOST';

const normalizeHost = (host: string | undefined): string | null => {
  const trimmed = host?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

/**
 * Reads the chat app's overlay host URL. Production builds are served by
 * `chat-api` under `/overlay-sandbox/`, so the embedded chat is same-origin.
 * Local Vite runs can override that with the `VITE_` fallback.
 * Returns `null` only when neither source is available so callers can render a
 * visible message instead of silently constructing an iframe with an empty
 * `src`.
 */
export const getChatOverlayHost = (): string | null => {
  const currentOrigin =
    typeof window === 'undefined'
      ? null
      : normalizeHost(window.location.origin);

  return normalizeHost(import.meta.env.VITE_CHAT_OVERLAY_HOST) ?? currentOrigin;
};
