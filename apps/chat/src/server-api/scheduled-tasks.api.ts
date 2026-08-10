import type {
  CreateScheduledTaskBodyDto,
  CreatedScheduledTaskDto,
  ListScheduledTaskRunsResponseDto,
  ListScheduledTasksResponseDto,
  ScheduledTaskDto,
  UpdateScheduledTaskBodyDto,
  UpdatedScheduledTaskDto,
} from '@epam/chat-api-client';
import type {
  ListScheduledTaskRunsParams,
  ListScheduledTasksParams,
} from '../models/scheduled-tasks';
import { scheduledTasksApi } from './api-client';

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

export const pauseScheduledTask = (
  scheduleId: string,
): Promise<ScheduledTaskDto> =>
  scheduledTasksApi.pauseScheduledTask({ scheduleId });

export const resumeScheduledTask = (
  scheduleId: string,
): Promise<ScheduledTaskDto> =>
  scheduledTasksApi.resumeScheduledTask({ scheduleId });

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
