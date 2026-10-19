/** Safe wire error: never expose SDK response bodies or credentials. */
export const GENERATION_PERSISTENCE_ERROR = {
  type: 'conversation_save_failed',
  message:
    'The response could not be saved. It is still shown here, but may be lost if you reload or leave this page. Copy it before continuing.',
} as const;

/**
 * Builds the completion-stream persistence error, adding the rejected write's
 * HTTP status when there is one. Only the status code is carried, never the
 * storage response body.
 * @param status - HTTP status of the rejected terminal write of a completed
 *   answer, or `undefined`
 */
export const buildGenerationPersistenceError = (
  status: number | undefined,
): typeof GENERATION_PERSISTENCE_ERROR & { status?: number } =>
  status == null
    ? { ...GENERATION_PERSISTENCE_ERROR }
    : { ...GENERATION_PERSISTENCE_ERROR, status };
