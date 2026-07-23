/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAT_OVERLAY_HOST?: string;
}

interface Window {
  __CHAT_OVERLAY_SANDBOX_CONFIG__?: {
    chatOverlayHost?: string;
  };
}
