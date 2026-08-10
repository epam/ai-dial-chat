import {
  ScheduledTaskRunDtoStatusEnum,
  type ListScheduledTaskRunsResponseDto,
} from '@epam/chat-api-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { scheduledTasksApi } from '../api-client';
import {
  createScheduledTask,
  getScheduledTask,
  listScheduledTaskRuns,
  listScheduledTasks,
  pauseScheduledTask,
  resumeScheduledTask,
  updateScheduledTask,
} from '../scheduled-tasks.api';

const mockSchedule = {
  id: 'sched_123',
  displayName: 'Daily summary',
  trigger: { date: '2026-07-24T09:00:00.000Z' },
};

const createBody = {
  displayName: 'Daily summary',
  trigger: { date: '2026-07-24T09:00:00.000Z' },
  model: 'gpt-4.1-mini-2025-04-14',
  prompt: 'Summarize my inbox',
  stream: true,
};

describe('scheduled-tasks.api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('listScheduledTasks delegates to the generated ScheduledTasksApi', async () => {
    const mockResponse = { items: [mockSchedule] };
    const spy = vi
      .spyOn(scheduledTasksApi, 'listScheduledTasks')
      .mockResolvedValue(mockResponse);

    const result = await listScheduledTasks();

    expect(spy).toHaveBeenCalledWith(
      { limit: undefined, offset: undefined, search: undefined },
      undefined,
    );
    expect(result).toEqual(mockResponse);
  });

  it('listScheduledTasks forwards limit/offset/search and an AbortSignal', async () => {
    const mockResponse = { items: [mockSchedule] };
    const spy = vi
      .spyOn(scheduledTasksApi, 'listScheduledTasks')
      .mockResolvedValue(mockResponse);
    const controller = new AbortController();

    await listScheduledTasks({
      limit: 12,
      offset: 24,
      search: 'inbox',
      signal: controller.signal,
    });

    expect(spy).toHaveBeenCalledWith(
      { limit: 12, offset: 24, search: 'inbox' },
      { signal: controller.signal },
    );
  });

  it('createScheduledTask delegates with the request body wrapped', async () => {
    const spy = vi
      .spyOn(scheduledTasksApi, 'createScheduledTask')
      .mockResolvedValue(mockSchedule);

    const result = await createScheduledTask(createBody);

    expect(spy).toHaveBeenCalledWith({
      createScheduledTaskBodyDto: createBody,
    });
    expect(result).toEqual(mockSchedule);
  });

  it('getScheduledTask delegates with the scheduleId', async () => {
    const spy = vi
      .spyOn(scheduledTasksApi, 'getScheduledTask')
      .mockResolvedValue(mockSchedule);

    const result = await getScheduledTask('sched_123');

    expect(spy).toHaveBeenCalledWith({ scheduleId: 'sched_123' });
    expect(result).toEqual(mockSchedule);
  });

  it('updateScheduledTask delegates with the scheduleId and body wrapped', async () => {
    const spy = vi
      .spyOn(scheduledTasksApi, 'updateScheduledTask')
      .mockResolvedValue(mockSchedule);

    const result = await updateScheduledTask('sched_123', createBody);

    expect(spy).toHaveBeenCalledWith({
      scheduleId: 'sched_123',
      updateScheduledTaskBodyDto: createBody,
    });
    expect(result).toEqual(mockSchedule);
  });

  it('listScheduledTaskRuns delegates to the generated ScheduledTasksApi', async () => {
    const mockResponse: ListScheduledTaskRunsResponseDto = {
      items: [
        {
          id: 'run_1',
          status: ScheduledTaskRunDtoStatusEnum.Success,
          startTime: '2026-07-24T09:00:00.000Z',
        },
      ],
    };
    const spy = vi
      .spyOn(scheduledTasksApi, 'listScheduledTaskRuns')
      .mockResolvedValue(mockResponse);

    const result = await listScheduledTaskRuns({ scheduleId: 'sched_123' });

    expect(spy).toHaveBeenCalledWith(
      { scheduleId: 'sched_123', limit: undefined, offset: undefined },
      undefined,
    );
    expect(result).toEqual(mockResponse);
  });

  it('listScheduledTaskRuns forwards limit/offset and an AbortSignal', async () => {
    const mockResponse = { items: [] };
    const spy = vi
      .spyOn(scheduledTasksApi, 'listScheduledTaskRuns')
      .mockResolvedValue(mockResponse);
    const controller = new AbortController();

    await listScheduledTaskRuns({
      scheduleId: 'sched_123',
      limit: 20,
      offset: 40,
      signal: controller.signal,
    });

    expect(spy).toHaveBeenCalledWith(
      { scheduleId: 'sched_123', limit: 20, offset: 40 },
      { signal: controller.signal },
    );
  });

  it('pauseScheduledTask delegates with the scheduleId', async () => {
    const pausedSchedule = { ...mockSchedule, isActive: false };
    const spy = vi
      .spyOn(scheduledTasksApi, 'pauseScheduledTask')
      .mockResolvedValue(pausedSchedule);

    const result = await pauseScheduledTask('sched_123');

    expect(spy).toHaveBeenCalledWith({ scheduleId: 'sched_123' });
    expect(result).toEqual(pausedSchedule);
  });

  it('resumeScheduledTask delegates with the scheduleId', async () => {
    const resumedSchedule = {
      ...mockSchedule,
      isActive: true,
      nextRunTime: '2026-07-28T12:00:00.000Z',
    };
    const spy = vi
      .spyOn(scheduledTasksApi, 'resumeScheduledTask')
      .mockResolvedValue(resumedSchedule);

    const result = await resumeScheduledTask('sched_123');

    expect(spy).toHaveBeenCalledWith({ scheduleId: 'sched_123' });
    expect(result).toEqual(resumedSchedule);
  });
});
