/** How the history panel resolves pending titles for one identity session. */
export enum ConversationTitleTransport {
  Stream = 'stream',
  /** An older backend answered the stream route with 404/405. */
  Json = 'json',
}

/** How one finite title stream request ended. */
export enum ConversationTitleRequestEnd {
  Complete = 'complete',
  /** Ended early; IDs without an outcome may go in the next request. */
  Budget = 'budget',
  /** The stream route is missing; retry the same IDs over JSON. */
  Unsupported = 'unsupported',
  /** Fatal, malformed, interrupted or cancelled: stop the attempt. */
  Stopped = 'stopped',
}
