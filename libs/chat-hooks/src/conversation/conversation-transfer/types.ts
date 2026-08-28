/** Whether an export includes the conversation's attachments. */
export enum ConversationExportMode {
  WithAttachments = 'withAttachments',
  WithoutAttachments = 'withoutAttachments',
}

/** Which export file was produced, used to derive its file name/extension. */
export enum ExportFileNameKind {
  SingleConversation = 'chat_conversation',
  SingleConversationWithAttachments = 'chat_with_attachments',
  AllConversationsHistory = 'chat_conversations_history',
}

/** Library-owned reason a transfer job failed. */
export enum ConversationTransferErrorCode {
  Unauthorized = 'unauthorized',
  NotFound = 'notFound',
  UnsupportedFormat = 'unsupportedFormat',
  MissingBucket = 'missingBucket',
  Unknown = 'unknown',
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

/** Library-owned reason a transfer job reports a non-fatal warning. */
export enum ConversationTransferWarningCode {
  AttachmentSkipped = 'attachmentSkipped',
}

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
