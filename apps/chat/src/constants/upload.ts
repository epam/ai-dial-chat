/*
 * Must exceed ConversationInput's inter-upload interval (60 000 ms / MAX_UPLOADS_PER_MINUTE = 600 ms)
 * so that all failures from a single batch are accumulated before the notification fires.
 */
export const NETWORK_ERROR_DEBOUNCE_MS = 700;
