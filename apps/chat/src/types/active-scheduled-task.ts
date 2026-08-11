/** Resolution status of scheduler metadata for the currently routed conversation. */
export enum ActiveScheduledTaskStatus {
  Resolving = 'resolving',
  NotATaskConversation = 'not-a-task-conversation',
  TaskConversation = 'task-conversation',
}

/** Fetch status of the active task's own details (separate from its run history). */
export enum ActiveScheduledTaskDetailState {
  Idle = 'idle',
  Loading = 'loading',
  Error = 'error',
  Unavailable = 'unavailable',
  Success = 'success',
}
