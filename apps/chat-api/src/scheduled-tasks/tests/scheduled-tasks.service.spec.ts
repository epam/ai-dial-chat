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

const makeCacheManager = () => {
  const store = new Map<string, unknown>();
  return {
    get: vi.fn((key: string) => Promise.resolve(store.get(key))),
    set: vi.fn((key: string, value: unknown) => {
      store.set(key, value);
      return Promise.resolve(value);
    }),
    del: vi.fn((key: string) => {
      store.delete(key);
      return Promise.resolve(true);
    }),
  };
};

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
      'scheduled-tasks:list:user-1:0::0:',
      expect.anything(),
      30_000,
    );
  });

  it('forwards limit/offset/search (as name) to the upstream request, and caches per query variant', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    });
    const cacheManager = makeCacheManager();
    const service = new ScheduledTasksService(
      makeDialClient(),
      makeConfigService('scheduler-app') as never,
      cacheManager as never,
    );

    await service.listScheduledTasks('user-1', 'token', {
      limit: 12,
      offset: 24,
      search: 'inbox',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://dial-core/v1/deployments/applications/scheduler-app/route/v1/schedules/?limit=12&offset=24&name=inbox',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(cacheManager.set).toHaveBeenCalledWith(
      'scheduled-tasks:list:user-1:0:12:24:inbox',
      expect.anything(),
      30_000,
    );
  });

  it('percent-encodes a search value containing a colon in the cache key', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    });
    const cacheManager = makeCacheManager();
    const service = new ScheduledTasksService(
      makeDialClient(),
      makeConfigService('scheduler-app') as never,
      cacheManager as never,
    );

    await service.listScheduledTasks('user-1', 'token', {
      search: 'a:b',
    });

    expect(cacheManager.set).toHaveBeenCalledWith(
      'scheduled-tasks:list:user-1:0::0:a%3Ab',
      expect.anything(),
      30_000,
    );
  });

  it('does not send an upstream name param when search is empty', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    });
    const service = new ScheduledTasksService(
      makeDialClient(),
      makeConfigService('scheduler-app') as never,
      makeCacheManager() as never,
    );

    await service.listScheduledTasks('user-1', 'token', { search: '' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://dial-core/v1/deployments/applications/scheduler-app/route/v1/schedules/',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('bypasses a differently-parameterized cached variant for the same user', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    });
    const cacheManager = makeCacheManager();
    const service = new ScheduledTasksService(
      makeDialClient(),
      makeConfigService('scheduler-app') as never,
      cacheManager as never,
    );

    await service.listScheduledTasks('user-1', 'token', { search: 'daily' });
    await service.listScheduledTasks('user-1', 'token', { search: 'weekly' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reuses the cached response for an identical query within the TTL', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    });
    const cacheManager = makeCacheManager();
    const service = new ScheduledTasksService(
      makeDialClient(),
      makeConfigService('scheduler-app') as never,
      cacheManager as never,
    );

    await service.listScheduledTasks('user-1', 'token', { search: 'daily' });
    await service.listScheduledTasks('user-1', 'token', { search: 'daily' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
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

    expect(cacheManager.set).toHaveBeenCalledWith(
      'scheduled-tasks:list-epoch:user-1',
      1,
      24 * 60 * 60 * 1000,
    );
    expect(
      debugSpy.mock.calls.map(([message]) => String(message)).join('\n'),
    ).not.toContain('Summarize my inbox');
  });

  it('invalidating the list cache makes a previously cached list variant unreachable', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    });
    const cacheManager = makeCacheManager();
    const service = new ScheduledTasksService(
      makeDialClient(),
      makeConfigService('scheduler-app') as never,
      cacheManager as never,
    );

    await service.listScheduledTasks('user-1', 'token');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await service.createScheduledTask('user-1', 'token', {
      displayName: 'Daily summary',
      trigger: { date: '2026-07-24T09:00:00.000Z' },
      model: 'gpt-4.1-mini-2025-04-14',
      prompt: 'Summarize my inbox',
    });

    await service.listScheduledTasks('user-1', 'token');
    expect(fetchMock).toHaveBeenCalledTimes(3);
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

    expect(cacheManager.set).not.toHaveBeenCalledWith(
      'scheduled-tasks:list-epoch:user-1',
      expect.anything(),
      expect.anything(),
    );
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
