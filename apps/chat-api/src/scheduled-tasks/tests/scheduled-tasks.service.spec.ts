import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../dial/dial-client.service';
import { ScheduledTasksService } from '../scheduled-tasks.service';

const makeConfigService = (
  schedulerAppId?: string,
  timeoutMs = 10_000,
  schedulerServiceId: string | undefined = 'my-oauth-service',
) => ({
  get: vi.fn((key: string) => {
    const config: Record<string, unknown> = {
      SCHEDULER_APP_ID: schedulerAppId,
      SCHEDULER_SERVICE_ID: schedulerServiceId,
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
      'scheduled-tasks:list:user-1:0::0::firstToRun',
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
      'http://dial-core/v1/deployments/applications/scheduler-app/route/v1/schedules/?limit=12&offset=24&name=inbox&order_by=next_run_time&order_dir=asc',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(cacheManager.set).toHaveBeenCalledWith(
      'scheduled-tasks:list:user-1:0:12:24:inbox:firstToRun',
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
      'scheduled-tasks:list:user-1:0::0:a%3Ab:firstToRun',
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
      'http://dial-core/v1/deployments/applications/scheduler-app/route/v1/schedules/?order_by=next_run_time&order_dir=asc',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it.each([
    ['firstToRun', 'next_run_time', 'asc'],
    ['lastToRun', 'next_run_time', 'desc'],
    ['newest', 'created_at', 'desc'],
    ['nameAZ', 'name', 'asc'],
  ] as const)(
    'maps sort=%s to order_by=%s&order_dir=%s upstream',
    async (sort, orderBy, orderDir) => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });
      const service = new ScheduledTasksService(
        makeDialClient(),
        makeConfigService('scheduler-app') as never,
        makeCacheManager() as never,
      );

      await service.listScheduledTasks('user-1', 'token', {
        sort: sort as never,
      });

      expect(fetchMock).toHaveBeenCalledWith(
        `http://dial-core/v1/deployments/applications/scheduler-app/route/v1/schedules/?order_by=${orderBy}&order_dir=${orderDir}`,
        expect.objectContaining({ method: 'GET' }),
      );
    },
  );

  it('defaults to the firstToRun mapping when sort is omitted', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    });
    const service = new ScheduledTasksService(
      makeDialClient(),
      makeConfigService('scheduler-app') as never,
      makeCacheManager() as never,
    );

    await service.listScheduledTasks('user-1', 'token');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://dial-core/v1/deployments/applications/scheduler-app/route/v1/schedules/?order_by=next_run_time&order_dir=asc',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('caches different sort values under different cache keys', async () => {
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
      sort: 'nameAZ' as never,
    });
    await service.listScheduledTasks('user-1', 'token', {
      sort: 'newest' as never,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cacheManager.set).toHaveBeenCalledWith(
      'scheduled-tasks:list:user-1:0::0::nameAZ',
      expect.anything(),
      30_000,
    );
    expect(cacheManager.set).toHaveBeenCalledWith(
      'scheduled-tasks:list:user-1:0::0::newest',
      expect.anything(),
      30_000,
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

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sentBody = JSON.parse(requestInit.body as string);
    expect(sentBody.service_id).toBe('my-oauth-service');
    expect(sentBody.properties).toMatchObject({
      create_conversation: true,
      stream: false,
      extra_headers: {},
      retry: null,
      timeout: null,
    });
    expect(sentBody.properties.payload).not.toHaveProperty('stream');
  });

  it('throws ServiceUnavailableException on create when SCHEDULER_SERVICE_ID is unset', async () => {
    const service = new ScheduledTasksService(
      makeDialClient(),
      makeConfigService('scheduler-app', 10_000, '') as never,
      makeCacheManager() as never,
    );

    await expect(
      service.createScheduledTask('user-1', 'token', {
        displayName: 'Daily summary',
        trigger: { date: '2026-07-24T09:00:00.000Z' },
        model: 'gpt-4.1-mini-2025-04-14',
        prompt: 'Summarize my inbox',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws ServiceUnavailableException on update when SCHEDULER_SERVICE_ID is unset', async () => {
    const service = new ScheduledTasksService(
      makeDialClient(),
      makeConfigService('scheduler-app', 10_000, '') as never,
      makeCacheManager() as never,
    );

    await expect(
      service.updateScheduledTask('user-1', 'token', 'sched_123', {
        displayName: 'Daily summary',
        trigger: { date: '2026-07-24T09:00:00.000Z' },
        model: 'gpt-4.1-mini-2025-04-14',
        prompt: 'Summarize my inbox',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is unaffected by a missing SCHEDULER_SERVICE_ID on list and get', async () => {
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
      makeConfigService('scheduler-app', 10_000, '') as never,
      makeCacheManager() as never,
    );

    await expect(
      service.getScheduledTask('token', 'sched_123'),
    ).resolves.toMatchObject({ id: 'sched_123' });
    await expect(
      service.listScheduledTasks('user-1', 'token'),
    ).resolves.toBeDefined();
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

  describe('listScheduledTaskRuns', () => {
    it('forwards limit/offset with explicit created_at desc ordering', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });
      const service = new ScheduledTasksService(
        makeDialClient(),
        makeConfigService('scheduler-app') as never,
        makeCacheManager() as never,
      );

      await service.listScheduledTaskRuns('token', 'sched_123', {
        limit: 20,
        offset: 40,
      });

      expect(fetchMock).toHaveBeenCalledWith(
        'http://dial-core/v1/deployments/applications/scheduler-app/route/v1/schedules/sched_123/runs?limit=20&offset=40&order_by=created_at&order_dir=desc',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('defaults limit/offset to 20/0 when omitted', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });
      const service = new ScheduledTasksService(
        makeDialClient(),
        makeConfigService('scheduler-app') as never,
        makeCacheManager() as never,
      );

      await service.listScheduledTaskRuns('token', 'sched_123');

      expect(fetchMock).toHaveBeenCalledWith(
        'http://dial-core/v1/deployments/applications/scheduler-app/route/v1/schedules/sched_123/runs?limit=20&offset=0&order_by=created_at&order_dir=desc',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('maps upstream statuses to the BFF enum and resolves runs from results', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            count: 4,
            limit: 20,
            offset: 0,
            results: [
              {
                id: 'run_1',
                status: 'success',
                start_time: '2026-07-24T09:00:00.000Z',
                end_time: '2026-07-24T09:01:39.000Z',
              },
              {
                id: 'run_2',
                status: 'error',
                start_time: '2026-07-24T09:00:00.000Z',
                end_time: '2026-07-24T09:00:05.000Z',
              },
              {
                id: 'run_3',
                status: 'in_progress',
                start_time: '2026-07-24T09:00:00.000Z',
                end_time: null,
              },
              {
                id: 'run_4',
                status: 'missed',
                start_time: '2026-07-24T09:00:00.000Z',
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

      const result = await service.listScheduledTaskRuns('token', 'sched_123');

      expect(result.items.map((item) => item.status)).toEqual([
        'Success',
        'Error',
        'InProgress',
        'Missed',
      ]);
      expect(result.items[0].durationSeconds).toBe(99);
      expect(result.items[2].durationSeconds).toBeUndefined();
      expect(result).toMatchObject({ count: 4, limit: 20, offset: 0 });
    });

    it('resolves an empty items array when results is absent', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });
      const service = new ScheduledTasksService(
        makeDialClient(),
        makeConfigService('scheduler-app') as never,
        makeCacheManager() as never,
      );

      const result = await service.listScheduledTaskRuns('token', 'sched_123');

      expect(result.items).toEqual([]);
    });

    it('is not cached — repeated calls always hit fetch again', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });
      const service = new ScheduledTasksService(
        makeDialClient(),
        makeConfigService('scheduler-app') as never,
        makeCacheManager() as never,
      );

      await service.listScheduledTaskRuns('token', 'sched_123');
      await service.listScheduledTaskRuns('token', 'sched_123');

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('throws ServiceUnavailableException when SCHEDULER_APP_ID is unset', async () => {
      const service = new ScheduledTasksService(
        makeDialClient(),
        makeConfigService(undefined) as never,
        makeCacheManager() as never,
      );

      await expect(
        service.listScheduledTaskRuns('token', 'sched_123'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('pauseScheduledTask / resumeScheduledTask', () => {
    it('pause calls the exact upstream pause URL with the bearer token, then refreshes via getScheduledTask', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'sched_123',
              display_name: 'Daily summary',
              trigger_type: 'cron',
              next_run_time: null,
            }),
        });
      const service = new ScheduledTasksService(
        makeDialClient(),
        makeConfigService('scheduler-app') as never,
        makeCacheManager() as never,
      );

      const result = await service.pauseScheduledTask(
        'user-1',
        'token',
        'sched_123',
      );

      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        'http://dial-core/v1/deployments/applications/scheduler-app/route/v1/schedules/sched_123/pause',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer token' }),
        }),
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        'http://dial-core/v1/deployments/applications/scheduler-app/route/v1/schedules/sched_123',
        expect.objectContaining({ method: 'GET' }),
      );
      expect(result.isActive).toBe(false);
    });

    it('resume calls the exact upstream resume URL and returns isActive true with the recalculated nextRunTime', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'sched_123',
              display_name: 'Daily summary',
              trigger_type: 'cron',
              next_run_time: '2026-07-28T12:00:00.000Z',
            }),
        });
      const service = new ScheduledTasksService(
        makeDialClient(),
        makeConfigService('scheduler-app') as never,
        makeCacheManager() as never,
      );

      const result = await service.resumeScheduledTask(
        'user-1',
        'token',
        'sched_123',
      );

      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        'http://dial-core/v1/deployments/applications/scheduler-app/route/v1/schedules/sched_123/resume',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(result.isActive).toBe(true);
      expect(result.nextRunTime).toBe('2026-07-28T12:00:00.000Z');
    });

    it('invalidates the list cache only after a successful pause', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ id: 'sched_123', display_name: 'Daily summary' }),
      });
      const cacheManager = makeCacheManager();
      const service = new ScheduledTasksService(
        makeDialClient(),
        makeConfigService('scheduler-app') as never,
        cacheManager as never,
      );

      await service.pauseScheduledTask('user-1', 'token', 'sched_123');

      expect(cacheManager.set).toHaveBeenCalledWith(
        'scheduled-tasks:list-epoch:user-1',
        1,
        24 * 60 * 60 * 1000,
      );
    });

    it('does not invalidate the list cache when the pause action itself fails', async () => {
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
        service.pauseScheduledTask('user-1', 'token', 'sched_missing'),
      ).rejects.toThrow();

      expect(cacheManager.set).not.toHaveBeenCalledWith(
        'scheduled-tasks:list-epoch:user-1',
        expect.anything(),
        expect.anything(),
      );
    });

    it('does not invalidate the list cache when the resume action itself fails', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.resolve({ message: 'upstream error' }),
      });
      const cacheManager = makeCacheManager();
      const service = new ScheduledTasksService(
        makeDialClient(),
        makeConfigService('scheduler-app') as never,
        cacheManager as never,
      );

      await expect(
        service.resumeScheduledTask('user-1', 'token', 'sched_123'),
      ).rejects.toThrow();

      expect(cacheManager.set).not.toHaveBeenCalledWith(
        'scheduled-tasks:list-epoch:user-1',
        expect.anything(),
        expect.anything(),
      );
    });

    it('still returns 200 with the requested isActive and still invalidates the cache when the post-mutation refresh fails', async () => {
      const debugSpy = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          json: () => Promise.resolve({ message: 'upstream error' }),
        });
      const cacheManager = makeCacheManager();
      const service = new ScheduledTasksService(
        makeDialClient(),
        makeConfigService('scheduler-app') as never,
        cacheManager as never,
      );

      const result = await service.resumeScheduledTask(
        'user-1',
        'token',
        'sched_123',
      );

      expect(result.isActive).toBe(true);
      expect(cacheManager.set).toHaveBeenCalledWith(
        'scheduled-tasks:list-epoch:user-1',
        1,
        24 * 60 * 60 * 1000,
      );
      debugSpy.mockRestore();
    });

    it('throws ServiceUnavailableException on pause/resume when SCHEDULER_APP_ID is unset', async () => {
      const service = new ScheduledTasksService(
        makeDialClient(),
        makeConfigService(undefined) as never,
        makeCacheManager() as never,
      );

      await expect(
        service.pauseScheduledTask('user-1', 'token', 'sched_123'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(
        service.resumeScheduledTask('user-1', 'token', 'sched_123'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(fetchMock).not.toHaveBeenCalled();
    });
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
