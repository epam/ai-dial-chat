import type {
  CreateScheduledTaskBodyDto,
  CreatedScheduledTaskDto,
  ListScheduledTasksResponseDto,
  ScheduledTaskDto,
  UpdateScheduledTaskBodyDto,
  UpdatedScheduledTaskDto,
} from '@epam/chat-api-client';
import { scheduledTasksApi } from './api-client';

export interface ListScheduledTasksParams {
  limit?: number;
  offset?: number;
  search?: string;
  signal?: AbortSignal;
}

export const listScheduledTasks = ({
  limit,
  offset,
  search,
  signal,
}: ListScheduledTasksParams = {}): Promise<ListScheduledTasksResponseDto> =>
  scheduledTasksApi.listScheduledTasks(
    { limit, offset, search },
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
