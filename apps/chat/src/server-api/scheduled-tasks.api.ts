import type {
  CreateScheduledTaskBodyDto,
  CreatedScheduledTaskDto,
  ListScheduledTasksResponseDto,
  ScheduledTaskDto,
  UpdateScheduledTaskBodyDto,
  UpdatedScheduledTaskDto,
} from '@epam/chat-api-client';
import { scheduledTasksApi } from './api-client';

export const listScheduledTasks = (
  signal?: AbortSignal,
): Promise<ListScheduledTasksResponseDto> =>
  scheduledTasksApi.listScheduledTasks(signal ? { signal } : undefined);

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
