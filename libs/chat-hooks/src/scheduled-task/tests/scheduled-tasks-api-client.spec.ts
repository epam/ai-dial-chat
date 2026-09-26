import { describe, expect, it, vi } from 'vitest';
import { createScheduledTasksApiClient } from '../scheduled-tasks-api-client';

const configuredClient = {
  listScheduledTasks: vi.fn(),
  listScheduledTaskRuns: vi.fn(),
  createScheduledTask: vi.fn(),
  getScheduledTask: vi.fn(),
  updateScheduledTask: vi.fn(),
  pauseScheduledTask: vi.fn(),
  resumeScheduledTask: vi.fn(),
  deleteScheduledTask: vi.fn(),
};

describe('createScheduledTasksApiClient', () => {
  it('retains skills and explicit removal across the configured operation boundary', async () => {
    const api = createScheduledTasksApiClient(configuredClient);
    const body = {
      displayName: 'Report',
      model: 'model',
      prompt: '',
      skillUrl: 'skills/public/report',
      trigger: { date: '2026-12-01T09:00:00Z' },
    };
    configuredClient.createScheduledTask.mockResolvedValue({
      id: 'task',
      ...body,
    });
    expect(await api.createScheduledTask(body)).toMatchObject({
      skillUrl: body.skillUrl,
      prompt: '',
    });
    await api.updateScheduledTask('task', {
      ...body,
      prompt: 'Instructions',
      skillUrl: null,
    });
    expect(configuredClient.updateScheduledTask).toHaveBeenCalledWith({
      scheduleId: 'task',
      updateScheduledTaskBodyDto: {
        ...body,
        prompt: 'Instructions',
        skillUrl: null,
      },
    });
  });
  it('forwards list parameters and the abort signal to the configured client', async () => {
    configuredClient.listScheduledTasks.mockResolvedValue({
      items: [],
      next: null,
    });
    const signal = new AbortController().signal;

    await createScheduledTasksApiClient(configuredClient).listScheduledTasks({
      limit: 20,
      offset: 0,
      search: 'review',
      signal,
    });

    expect(configuredClient.listScheduledTasks).toHaveBeenCalledWith(
      { limit: 20, offset: 0, search: 'review' },
      { signal },
    );
  });

  it('does not convert a malformed successful response into an empty page', async () => {
    configuredClient.listScheduledTasks.mockResolvedValue({ next: null });

    await expect(
      createScheduledTasksApiClient(configuredClient).listScheduledTasks(),
    ).rejects.toThrow('malformed page response');
  });
});
