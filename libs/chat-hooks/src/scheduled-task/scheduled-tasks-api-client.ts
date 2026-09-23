import type {
  CreateScheduledTaskBodyDto,
  CreatedScheduledTaskDto,
  ListScheduledTaskRunsResponseDto,
  ListScheduledTasksResponseDto,
  ListScheduledTasksSortEnum,
  ScheduledTaskDto,
  UpdateScheduledTaskBodyDto,
  UpdatedScheduledTaskDto,
} from '@epam/ai-dial-chat-api-client';

/** Narrow configured generated-client surface required by scheduler hooks. */
export interface ScheduledTasksConfiguredClient {
  listScheduledTasks: (
    request: {
      limit?: number;
      offset?: number;
      search?: string;
      sort?: ListScheduledTasksSortEnum;
    },
    options?: RequestInit,
  ) => Promise<ListScheduledTasksResponseDto>;
  listScheduledTaskRuns: (
    request: { scheduleId: string; limit?: number; offset?: number },
    options?: RequestInit,
  ) => Promise<ListScheduledTaskRunsResponseDto>;
  createScheduledTask: (request: {
    createScheduledTaskBodyDto: CreateScheduledTaskBodyDto;
  }) => Promise<CreatedScheduledTaskDto>;
  getScheduledTask: (request: {
    scheduleId: string;
  }) => Promise<ScheduledTaskDto>;
  updateScheduledTask: (request: {
    scheduleId: string;
    updateScheduledTaskBodyDto: UpdateScheduledTaskBodyDto;
  }) => Promise<UpdatedScheduledTaskDto>;
  pauseScheduledTask: (request: {
    scheduleId: string;
  }) => Promise<ScheduledTaskDto>;
  resumeScheduledTask: (request: {
    scheduleId: string;
  }) => Promise<ScheduledTaskDto>;
  deleteScheduledTask: (request: { scheduleId: string }) => Promise<void>;
}

/** App-agnostic request options accepted by the scheduler facade. */
export interface ScheduledTasksListRequest {
  limit?: number;
  offset?: number;
  search?: string;
  sort?: ListScheduledTasksSortEnum;
  signal?: AbortSignal;
}

export interface ScheduledTaskRunsListRequest {
  scheduleId: string;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

export interface ScheduledTasksApiClient {
  listScheduledTasks: (
    request?: ScheduledTasksListRequest,
  ) => Promise<ListScheduledTasksResponseDto>;
  listScheduledTaskRuns: (
    request: ScheduledTaskRunsListRequest,
  ) => Promise<ListScheduledTaskRunsResponseDto>;
  createScheduledTask: (
    body: CreateScheduledTaskBodyDto,
  ) => Promise<CreatedScheduledTaskDto>;
  getScheduledTask: (scheduleId: string) => Promise<ScheduledTaskDto>;
  updateScheduledTask: (
    scheduleId: string,
    body: UpdateScheduledTaskBodyDto,
  ) => Promise<UpdatedScheduledTaskDto>;
  pauseScheduledTask: (scheduleId: string) => Promise<ScheduledTaskDto>;
  resumeScheduledTask: (scheduleId: string) => Promise<ScheduledTaskDto>;
  deleteScheduledTask: (scheduleId: string) => Promise<void>;
}

const ensurePage = <T extends { items?: unknown }>(response: T): T => {
  if (!Array.isArray(response.items)) {
    throw new TypeError(
      'Scheduled tasks API returned a malformed page response',
    );
  }
  return response;
};

/**
 * Composes scheduler operations over an already configured generated client.
 * Authentication, base URL, CSRF, and retries remain host responsibilities.
 */
export const createScheduledTasksApiClient = (
  client: ScheduledTasksConfiguredClient,
): ScheduledTasksApiClient => ({
  listScheduledTasks: async ({ signal, ...request } = {}) =>
    ensurePage(
      await client.listScheduledTasks(request, signal ? { signal } : undefined),
    ),
  listScheduledTaskRuns: async ({ signal, ...request }) =>
    ensurePage(
      await client.listScheduledTaskRuns(
        request,
        signal ? { signal } : undefined,
      ),
    ),
  createScheduledTask: (body) =>
    client.createScheduledTask({ createScheduledTaskBodyDto: body }),
  getScheduledTask: (scheduleId) => client.getScheduledTask({ scheduleId }),
  updateScheduledTask: (scheduleId, body) =>
    client.updateScheduledTask({
      scheduleId,
      updateScheduledTaskBodyDto: body,
    }),
  pauseScheduledTask: (scheduleId) => client.pauseScheduledTask({ scheduleId }),
  resumeScheduledTask: (scheduleId) =>
    client.resumeScheduledTask({ scheduleId }),
  deleteScheduledTask: (scheduleId) =>
    client.deleteScheduledTask({ scheduleId }),
});
