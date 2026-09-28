/*
 * Length limits shared by every entity type (prompts, skills, toolsets,
 * applications, scheduled tasks). The chat frontend mirrors these numbers in
 * `@epam/ai-dial-chat-shared` (`ENTITY_*_MAX_LENGTH`) so it can reject an
 * over-long value inline before a request is made.
 */
export const ENTITY_NAME_MAX_LENGTH = 256;
export const ENTITY_DESCRIPTION_MAX_LENGTH = 2000;
export const ENTITY_INSTRUCTIONS_MAX_LENGTH = 50000;
