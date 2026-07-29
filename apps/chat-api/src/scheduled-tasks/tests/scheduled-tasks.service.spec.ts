import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../dial/dial-client.service';
import { ScheduledTasksService } from '../scheduled-tasks.service';

const makeConfigService = (schedulerAppId?: string, timeoutMs = 10_000) => ({
  get: vi.fn((key: string) => {
    const config: Record<string, unknown> = {
      SCHEDULER_APP_ID: schedulerAppId,
      SCHEDULER_SERVICE_TIMEOUT_MS: timeoutMs,
    };
    return config[key];
  }),
});

const makeDialClient = (): DialClientService =>
  ({
    baseUrl: 'http://dial-core',
    dialApiVersion: '2025-01-01-preview',
  }) as unknown as DialClientService;

const makeCacheManager = () => ({
  get: vi.fn().mockResolvedValue(undefined),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
});

describe('ScheduledTasksService', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('throws ServiceUnavailableException on first use when SCHEDULER_APP_ID is unset', async () => {
    const service = new ScheduledTasksService(
      makeDialClient(),
      makeConfigService(undefined) as never,
      makeCacheManager() as never,
    );

    await expect(
      service.getScheduledTask('token', 'sched_123'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('builds the routed-deployment URL from SCHEDULER_APP_ID when configured', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'sched_123',
          display_name: 'Daily summary',
          trigger: { date: '2026-07-24T09:00:00.000Z' },
        }),
    });

    const service = new ScheduledTasksService(
      makeDialClient(),
      makeConfigService('scheduler-app') as never,
      makeCacheManager() as never,
    );

    await service.getScheduledTask('token', 'sched_123');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://dial-core/v1/deployments/applications/scheduler-app/route/v1/schedules/sched_123',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('caches list results for the same user within the TTL', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          items: [
            {
              id: 'sched_123',
              display_name: 'Daily summary',
              trigger: { date: '2026-07-24T09:00:00.000Z' },
            },
          ],
        }),
    });
    const cacheManager = makeCacheManager();
    const service = new ScheduledTasksService(
      makeDialClient(),
      makeConfigService('scheduler-app') as never,
      cacheManager as never,
    );

    await service.listScheduledTasks('user-1', 'token');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cacheManager.set).toHaveBeenCalledWith(
      'scheduled-tasks:list:user-1',
      expect.anything(),
      30_000,
    );
  });

  it('resolves items from the paginated {results} envelope the live DIAL Scheduler returns', async () => {
    const debugSpy = vi
      .spyOn(Logger.prototype, 'debug')
      .mockImplementation(() => undefined);
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          count: 1,
          limit: 20,
          offset: 0,
          results: [
            {
              id: 'sched_123',
              display_name: 'Daily summary',
              trigger: { date: '2026-07-24T09:00:00.000Z' },
              next_run_time: '2026-07-28T12:00:00.000Z',
              created_at: '2026-07-23T21:27:07.000Z',
            },
          ],
          next: null,
          previous: null,
        }),
    });
    const service = new ScheduledTasksService(
      makeDialClient(),
      makeConfigService('scheduler-app') as never,
      makeCacheManager() as never,
    );

    const result = await service.listScheduledTasks('user-1', 'token');

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'sched_123',
      displayName: 'Daily summary',
      nextRunTime: '2026-07-28T12:00:00.000Z',
      createdAt: '2026-07-23T21:27:07.000Z',
    });
    expect(result).toMatchObject({
      count: 1,
      limit: 20,
      offset: 0,
      next: null,
      previous: null,
    });
    expect(
      debugSpy.mock.calls.map(([message]) => String(message)).join('\n'),
    ).not.toContain('Daily summary');
  });

  it('invalidates the list cache after a successful create', async () => {
    const debugSpy = vi
      .spyOn(Logger.prototype, 'debug')
      .mockImplementation(() => undefined);
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'sched_123',
          display_name: 'Daily summary',
          trigger: { date: '2026-07-24T09:00:00.000Z' },
        }),
    });
    const cacheManager = makeCacheManager();
    const service = new ScheduledTasksService(
      makeDialClient(),
      makeConfigService('scheduler-app') as never,
      cacheManager as never,
    );

    await service.createScheduledTask('user-1', 'token', {
      displayName: 'Daily summary',
      trigger: { date: '2026-07-24T09:00:00.000Z' },
      model: 'gpt-4.1-mini-2025-04-14',
      prompt: 'Summarize my inbox',
    });

    expect(cacheManager.del).toHaveBeenCalledWith(
      'scheduled-tasks:list:user-1',
    );
    expect(
      debugSpy.mock.calls.map(([message]) => String(message)).join('\n'),
    ).not.toContain('Summarize my inbox');
  });

  it('does not invalidate the list cache when update fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ message: 'not found' }),
    });
    const cacheManager = makeCacheManager();
    const service = new ScheduledTasksService(
      makeDialClient(),
      makeConfigService('scheduler-app') as never,
      cacheManager as never,
    );

    await expect(
      service.updateScheduledTask('user-1', 'token', 'sched_missing', {
        displayName: 'Daily summary',
        trigger: { date: '2026-07-24T09:00:00.000Z' },
        model: 'gpt-4.1-mini-2025-04-14',
        prompt: 'Summarize my inbox',
      }),
    ).rejects.toThrow();

    expect(cacheManager.del).not.toHaveBeenCalled();
  });

  it('aborts when reading a successful response body exceeds the timeout', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: string, options: RequestInit | undefined) =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            new Promise((_resolve, reject) => {
              options?.signal?.addEventListener('abort', () => {
                const error = new Error('aborted');
                error.name = 'AbortError';
                reject(error);
              });
            }),
        }),
    );
    const service = new ScheduledTasksService(
      makeDialClient(),
      makeConfigService('scheduler-app', 25) as never,
      makeCacheManager() as never,
    );

    const request = service
      .getScheduledTask('token', 'sched_123')
      .catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(25);

    await expect(request).resolves.toBeInstanceOf(ServiceUnavailableException);
  });
});
