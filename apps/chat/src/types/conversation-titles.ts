/** How the history panel resolves pending titles for one identity session. */
export enum ConversationTitleTransport {
  Stream = 'stream',
  /** An older backend answered the stream route with 404/405. */
  Json = 'json',
}
