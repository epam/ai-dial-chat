/** Whether an export includes the conversation's attachments. */
export enum ConversationExportMode {
  WithAttachments = 'withAttachments',
  WithoutAttachments = 'withoutAttachments',
}

import {
  ConversationTransferErrorCode,
  ConversationTransferWarningCode,
} from '@epam/ai-dial-chat-shared';

/** Which export file was produced, used to derive its file name/extension. */
export enum ExportFileNameKind {
  SingleConversation = 'chat_conversation',
  SingleConversationWithAttachments = 'chat_with_attachments',
  AllConversationsHistory = 'chat_conversations_history',
}

/** Structured, translation-free error report for a transfer job. */
export interface ConversationTransferErrorEvent {
  jobId: string;
  code: ConversationTransferErrorCode;
  /** Conversation title(s) relevant to the error, when applicable. */
  titles?: string[];
  /** Resolved trace id for the failing request, when the host's `resolveErrorTraceId` supplies one. */
  traceId?: string;
}

/*
 * Canonically declared in `@epam/ai-dial-chat-shared`, because
 * `ConversationTransferJob.warningCode`/`.errorCode` are typed by them and
 * `chat-shared` may not import from `chat-hooks`. Re-exported here so
 * existing `chat-hooks` import paths keep resolving.
 */
export { ConversationTransferErrorCode, ConversationTransferWarningCode };

/** Structured, translation-free warning report for a transfer job. */
export interface ConversationTransferWarningEvent {
  jobId: string;
  code: ConversationTransferWarningCode;
  /** Names relevant to the warning (e.g. skipped attachment file names). */
  names?: string[];
}

/** Structured, translation-free success report for a transfer job. */
export interface ConversationTransferSuccessEvent {
  jobId: string;
  /** Conversation title(s) affected, when applicable. */
  titles?: string[];
}
