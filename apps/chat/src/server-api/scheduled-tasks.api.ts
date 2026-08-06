import type {
  CreateScheduledTaskBodyDto,
  CreatedScheduledTaskDto,
  ListScheduledTaskRunsResponseDto,
  ListScheduledTasksResponseDto,
  ListScheduledTasksSortEnum,
  ScheduledTaskDto,
  UpdateScheduledTaskBodyDto,
  UpdatedScheduledTaskDto,
} from '@epam/chat-api-client';
import { scheduledTasksApi } from './api-client';

export interface ListScheduledTasksParams {
  limit?: number;
  offset?: number;
  search?: string;
  sort?: ListScheduledTasksSortEnum;
  signal?: AbortSignal;
}

export const listScheduledTasks = ({
  limit,
  offset,
  search,
  sort,
  signal,
}: ListScheduledTasksParams = {}): Promise<ListScheduledTasksResponseDto> =>
  scheduledTasksApi.listScheduledTasks(
    { limit, offset, search, sort },
    signal ? { signal } : undefined,
  );

export const createScheduledTask = (
  body: CreateScheduledTaskBodyDto,
): Promise<CreatedScheduledTaskDto> =>
  scheduledTasksApi.createScheduledTask({ createScheduledTaskBodyDto: body });

export const getScheduledTask = (
  scheduleId: string,
): Promise<ScheduledTaskDto> =>
  scheduledTasksApi.getScheduledTask({ scheduleId });

export const updateScheduledTask = (
  scheduleId: string,
  body: UpdateScheduledTaskBodyDto,
): Promise<UpdatedScheduledTaskDto> =>
  scheduledTasksApi.updateScheduledTask({
    scheduleId,
    updateScheduledTaskBodyDto: body,
  });

export interface ListScheduledTaskRunsParams {
  scheduleId: string;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

export const listScheduledTaskRuns = ({
  scheduleId,
  limit,
  offset,
  signal,
}: ListScheduledTaskRunsParams): Promise<ListScheduledTaskRunsResponseDto> =>
  scheduledTasksApi.listScheduledTaskRuns(
    { scheduleId, limit, offset },
    signal ? { signal } : undefined,
  );
