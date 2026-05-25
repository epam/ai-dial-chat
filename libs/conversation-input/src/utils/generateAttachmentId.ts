/**
 * Generates a unique identifier for an attachment, combining the current
 * timestamp with a random alphanumeric suffix.
 */
export const generateAttachmentId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;
