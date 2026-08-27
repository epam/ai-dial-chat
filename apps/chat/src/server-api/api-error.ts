/*
 * Temporary re-export while apps/chat's 21 consumers are migrated to import
 * directly from `@epam/ai-dial-chat-hooks`. Remove this file once every
 * consumer imports from the package directly (see design.md Decision D10).
 */
export {
  getApiErrorDetails,
  getApiErrorMessage,
  getApiErrorStatus,
  isConversationNotFoundError,
  type ApiErrorDetails,
} from '@epam/ai-dial-chat-hooks';
