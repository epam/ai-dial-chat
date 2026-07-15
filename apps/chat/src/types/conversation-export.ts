/** Format the user chose when exporting a single conversation. */
export enum ConversationExportMode {
  WithAttachments = 'withAttachments',
  WithoutAttachments = 'withoutAttachments',
}

/** Discriminates the file-naming template used for a given export operation. */
export enum ExportFileNameKind {
  SingleConversation = 'chat_conversation',
  SingleConversationWithAttachments = 'chat_with_attachments',
  AllConversationsHistory = 'chat_conversations_history',
}

/** Lifecycle status of a queued export job shown in the export queue panel. */
export enum ExportJobStatus {
  InProgress = 'inProgress',
  Success = 'success',
  Failed = 'failed',
}
