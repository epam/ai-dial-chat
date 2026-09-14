import type { Plugin } from 'vite';

export const CSP_NONCE_PLACEHOLDER: string;
export const addTrustedStyleNonces: (code: string, id: string) => string | null;
export const trustedStyleNoncePlugin: () => Plugin;
