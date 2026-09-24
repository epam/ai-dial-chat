import type {
  CreateScheduledTaskBodyDto,
  CreatedScheduledTaskDto,
  ListScheduledTaskRunsResponseDto,
  ListScheduledTasksResponseDto,
  ScheduledTaskDto,
  UpdateScheduledTaskBodyDto,
  UpdatedScheduledTaskDto,
} from '@epam/ai-dial-chat-api-client';
import { createScheduledTasksApiClient } from '@epam/ai-dial-chat-hooks/scheduled-tasks';
import type {
  ListScheduledTaskRunsParams,
  ListScheduledTasksParams,
} from '../models/scheduled-tasks';
import { scheduledTasksApi } from './api-client';

/* The app owns generated-client configuration; chat-hooks owns scheduler API composition. */
export const schedulerClient = createScheduledTasksApiClient(scheduledTasksApi);

export const listScheduledTasks = ({
  limit,
  offset,
  search,
  sort,
  signal,
}: ListScheduledTasksParams = {}): Promise<ListScheduledTasksResponseDto> =>
  schedulerClient.listScheduledTasks({ limit, offset, search, sort, signal });

export const createScheduledTask = (
  body: CreateScheduledTaskBodyDto,
): Promise<CreatedScheduledTaskDto> =>
  schedulerClient.createScheduledTask(body);

export const getScheduledTask = (
  scheduleId: string,
): Promise<ScheduledTaskDto> => schedulerClient.getScheduledTask(scheduleId);

export const updateScheduledTask = (
  scheduleId: string,
  body: UpdateScheduledTaskBodyDto,
): Promise<UpdatedScheduledTaskDto> =>
  schedulerClient.updateScheduledTask(scheduleId, body);

export const pauseScheduledTask = (
  scheduleId: string,
): Promise<ScheduledTaskDto> => schedulerClient.pauseScheduledTask(scheduleId);

export const resumeScheduledTask = (
  scheduleId: string,
): Promise<ScheduledTaskDto> => schedulerClient.resumeScheduledTask(scheduleId);

export const deleteScheduledTask = (scheduleId: string): Promise<void> =>
  schedulerClient.deleteScheduledTask(scheduleId);

export const listScheduledTaskRuns = ({
  scheduleId,
  limit,
  offset,
  signal,
}: ListScheduledTaskRunsParams): Promise<ListScheduledTaskRunsResponseDto> =>
  schedulerClient.listScheduledTaskRuns({ scheduleId, limit, offset, signal });
