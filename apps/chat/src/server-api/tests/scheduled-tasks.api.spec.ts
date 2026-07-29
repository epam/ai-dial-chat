import { afterEach, describe, expect, it, vi } from 'vitest';
import { scheduledTasksApi } from '../api-client';
import {
  createScheduledTask,
  getScheduledTask,
  listScheduledTasks,
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

    expect(spy).toHaveBeenCalledOnce();
    expect(result).toEqual(mockResponse);
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
});
