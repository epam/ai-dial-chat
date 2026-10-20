/** How a conversation row presents its leading slot and metrics. */
export enum ConversationRowVariant {
  /** Deployment avatar (or `leadingIcon`) with a trailing unread dot — the panel's rows. */
  Avatar = 'avatar',
  /** Leading status dot with no avatar — the navigation sidebar's rows. */
  Indicator = 'indicator',
}
