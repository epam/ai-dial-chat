/** Safe wire error: never expose SDK response bodies or credentials. */
export const GENERATION_PERSISTENCE_ERROR = {
  type: 'conversation_save_failed',
  message:
    'The response could not be saved. It is still shown here, but may be lost if you reload or leave this page. Copy it before continuing.',
} as const;

/** Terminal markers the rejected write of a stopped, aborted, or failed answer carried. */
export interface GenerationPersistenceTerminalMarker {
  /** Error text the failed write stored; `''` asks the client for its localized fallback. */
  streamErrorMessage?: string;
  /** Set when the rejected write recorded a user stop. */
  wasStoppedByUser?: boolean;
}

/**
 * Builds the completion-stream persistence error, adding the rejected write's
 * HTTP status and terminal markers when there are any. Only the status code
 * is carried, never the storage response body.
 * @param status - HTTP status of the rejected terminal write, or `undefined`
 * @param marker - terminal markers of an answer that did not complete, so a
 *   client recovery save writes the same outcome
 */
export const buildGenerationPersistenceError = (
  status: number | undefined,
  marker?: GenerationPersistenceTerminalMarker,
): typeof GENERATION_PERSISTENCE_ERROR &
  GenerationPersistenceTerminalMarker & { status?: number } => ({
  ...GENERATION_PERSISTENCE_ERROR,
  ...(status != null ? { status } : {}),
  ...(marker?.streamErrorMessage != null
    ? { streamErrorMessage: marker.streamErrorMessage }
    : {}),
  ...(marker?.wasStoppedByUser ? { wasStoppedByUser: true } : {}),
});
