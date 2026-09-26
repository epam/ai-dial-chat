/** Safe wire error: never expose SDK response bodies or credentials. */
export const GENERATION_PERSISTENCE_ERROR = {
  type: 'conversation_save_failed',
  message:
    'The response could not be saved. It is still shown here, but may be lost if you reload or leave this page. Copy it before continuing.',
} as const;
