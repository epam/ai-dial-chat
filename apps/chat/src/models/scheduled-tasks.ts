import type { ListScheduledTasksSortEnum } from '@epam/chat-api-client';

/** Params for `listScheduledTasks`. */
export interface ListScheduledTasksParams {
  limit?: number;
  offset?: number;
  search?: string;
  sort?: ListScheduledTasksSortEnum;
  signal?: AbortSignal;
}

/** Params for `listScheduledTaskRuns`. */
export interface ListScheduledTaskRunsParams {
  scheduleId: string;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}
