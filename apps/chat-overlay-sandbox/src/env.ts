/** Runtime env var carrying the chat app's overlay host URL in deployed containers. */
export const CHAT_OVERLAY_HOST_ENV_VAR = 'CHAT_OVERLAY_HOST';

/** Vite build-time fallback used for local development without a container. */
export const VITE_CHAT_OVERLAY_HOST_ENV_VAR = 'VITE_CHAT_OVERLAY_HOST';

const normalizeHost = (host: string | undefined): string | null => {
  const trimmed = host?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

/**
 * Reads the chat app's overlay host URL. Deployed static builds read the
 * runtime-generated `/env.js`; local Vite runs keep using the `VITE_` fallback.
 * Returns `null` when unset so callers can render a visible message instead of
 * silently constructing an iframe with an empty `src`.
 */
export const getChatOverlayHost = (): string | null => {
  const runtimeHost =
    typeof window === 'undefined'
      ? null
      : normalizeHost(window.__CHAT_OVERLAY_SANDBOX_CONFIG__?.chatOverlayHost);

  return runtimeHost ?? normalizeHost(import.meta.env.VITE_CHAT_OVERLAY_HOST);
};
