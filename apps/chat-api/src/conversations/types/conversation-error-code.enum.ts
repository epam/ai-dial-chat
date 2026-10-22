export enum ConversationErrorCode {
  DuplicateModelHidden = 'conversationDuplicateModelHidden',
  /** The model a completion, share or publish would use is hidden through `HIDDEN_ENTITY_TAGS`. */
  ModelHidden = 'conversationModelHidden',
  /** A file the conversation's attachments reference no longer exists, so publishing it would leave a dead link. */
  AttachmentMissing = 'conversationAttachmentMissing',
}
