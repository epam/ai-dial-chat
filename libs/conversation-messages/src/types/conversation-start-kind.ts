/** Which form a conversation start label takes, by local calendar day relative to now. */
export enum ConversationStartKind {
  /** The start is on the current local calendar day. */
  Today = 'today',
  /** The start is on the previous local calendar day. */
  Yesterday = 'yesterday',
  /** The start is older; shown as a full date and time. */
  Absolute = 'absolute',
}
