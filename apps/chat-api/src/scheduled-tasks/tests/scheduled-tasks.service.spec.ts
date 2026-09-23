import {
  BadGatewayException,
  ForbiddenException,
  ConflictException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../dial/dial-client.service';
import { ScheduledTasksService } from '../scheduled-tasks.service';
import { ScheduledTaskErrorCode } from '../types/scheduled-task-error-code.enum';

let fetchMock: ReturnType<typeof vi.fn>;

describe('scheduled task skill persistence and validation', () => {
  const body = {
    displayName: 'Skill task',
    model: 'model',
    prompt: '',
    trigger: { date: '2026-12-01T09:00:00Z' },
    skillUrl: 'skills/public/report',
  };
  const setup = (support: boolean | undefined = true) => {
    let saved = {
      id: 'task',
      display_name: body.displayName,
      trigger: body.trigger,
      properties: {
        payload: {
          model: body.model,
          messages: [
            {
              role: 'user',
              content: '',
              custom_content: { skills: [{ url: body.skillUrl }] },
            },
          ],
        },
      },
    };
    fetchMock = vi.fn((_url, init) => {
      if (init.method !== 'GET') saved = { ...saved, ...JSON.parse(init.body) };
      return Promise.resolve({ ok: true, json: async () => saved });
    });
    const cache = makeCacheManager();
    const deployments = {
      resolveDeploymentItem: vi
        .fn()
        .mockResolvedValue({ features: { skillsSupported: support } }),
    };
    const service = new ScheduledTasksService(
      makeDialClient(),
      makeConfigService('scheduler') as never,
      cache as never,
      deployments as never,
    );
    return { service, cache, deployments };
  };

  it.each(['model', 'applications/bucket/agent'])(
    'round-trips a skill-only task for %s with the session identity',
    async (model) => {
      const { service, deployments } = setup();
      expect(
        await service.createScheduledTask(
          'user',
          'token',
          { ...body, model },
          'bucket',
        ),
      ).toMatchObject({ prompt: '', skillUrl: body.skillUrl });
      expect(deployments.resolveDeploymentItem).toHaveBeenCalledWith(
        model,
        'token',
        'bucket',
      );
      expect(await service.getScheduledTask('token', 'task')).toMatchObject({
        skillUrl: body.skillUrl,
      });
      expect(
        await service.updateScheduledTask('user', 'token', 'task', {
          ...body,
          skillUrl: undefined,
        }),
      ).toMatchObject({ skillUrl: body.skillUrl });
      expect(
        await service.updateScheduledTask('user', 'token', 'task', {
          ...body,
          skillUrl: 'skills/public/other',
        }),
      ).toMatchObject({ skillUrl: 'skills/public/other' });
      expect(
        await service.updateScheduledTask('user', 'token', 'task', {
          ...body,
          prompt: 'Instructions',
          skillUrl: null,
        }),
      ).toMatchObject({ prompt: 'Instructions', skillUrl: undefined });
      const sent = JSON.parse(fetchMock.mock.calls.at(-1)![1].body);
      expect(sent.properties.payload.messages[0]).not.toHaveProperty(
        'custom_content',
      );
    },
  );

  it.each([false, undefined])(
    'rejects unsupported or missing capability %s without mutation',
    async (support) => {
      const { service, deployments, cache } = setup();
      deployments.resolveDeploymentItem.mockResolvedValue({
        features: { skillsSupported: support },
      });
      await expect(
        service.createScheduledTask('user', 'token', body),
      ).rejects.toMatchObject({
        response: {
          code: ScheduledTaskErrorCode.SkillUnsupported,
          field: 'skillUrl',
        },
      });
      expect(fetchMock).not.toHaveBeenCalled();
      await expect(
        service.updateScheduledTask('user', 'token', 'task', {
          ...body,
          skillUrl: undefined,
        }),
      ).rejects.toMatchObject({
        response: { code: ScheduledTaskErrorCode.SkillUnsupported },
      });
      expect(
        fetchMock.mock.calls.every(([, init]) => init.method === 'GET'),
      ).toBe(true);
      expect(cache.set).not.toHaveBeenCalled();
    },
  );

  it('rejects empty content on create and removal of the only content on update', async () => {
    const { service, cache, deployments } = setup();
    await expect(
      service.createScheduledTask('user', 'token', {
        ...body,
        prompt: '  ',
        skillUrl: null,
      }),
    ).rejects.toMatchObject({
      response: { code: ScheduledTaskErrorCode.InstructionsOrSkillRequired },
    });
    await expect(
      service.updateScheduledTask('user', 'token', 'task', {
        ...body,
        skillUrl: null,
      }),
    ).rejects.toMatchObject({
      response: { code: ScheduledTaskErrorCode.InstructionsOrSkillRequired },
    });
    expect(deployments.resolveDeploymentItem).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('does not require deployment lookup for instructions only', async () => {
    const { service, deployments } = setup();
    await service.createScheduledTask('user', 'token', {
      ...body,
      prompt: 'Instructions',
      skillUrl: undefined,
    });
    expect(deployments.resolveDeploymentItem).not.toHaveBeenCalled();
  });

  it.each([
    null,
    new NotFoundException(),
    new ForbiddenException(),
    new BadGatewayException(),
    new ServiceUnavailableException(),
  ])('preserves lookup failures without mutation: %s', async (failure) => {
    const { service, deployments, cache } = setup();
    if (failure) deployments.resolveDeploymentItem.mockRejectedValue(failure);
    else deployments.resolveDeploymentItem.mockResolvedValue(null);
    const result = service.createScheduledTask('user', 'token', body);
    if (
      !failure ||
      failure instanceof NotFoundException ||
      failure instanceof ForbiddenException
    ) {
      await expect(result).rejects.toMatchObject({
        response: { code: ScheduledTaskErrorCode.DeploymentUnavailable },
        status: failure?.getStatus() ?? 404,
      });
    } else await expect(result).rejects.toBe(failure);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });
});

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
    fetchCore: fetchMock,
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
  beforeEach(() => {
    fetchMock = vi.fn();
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
      { resolveDeploymentItem: vi.fn() } as never,
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
      { resolveDeploymentItem: vi.fn() } as never,
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
              // a future one-time schedule: neither candidate-gate arm fires, so
              // no completed-state runs check distracts from the caching assertions
              trigger: { date: '2030-07-24T09:00:00.000Z' },
              next_run_time: '2030-07-24T09:00:00.000Z',
            },
          ],
        }),
    });
    const cacheManager = makeCacheManager();
    const service = new ScheduledTasksService(
      makeDialClient(),
      makeConfigService('scheduler-app') as never,
      cacheManager as never,
      { resolveDeploymentItem: vi.fn() } as never,
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
      { resolveDeploymentItem: vi.fn() } as never,
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
      { resolveDeploymentItem: vi.fn() } as never,
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
      { resolveDeploymentItem: vi.fn() } as never,
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
        { resolveDeploymentItem: vi.fn() } as never,
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
      { resolveDeploymentItem: vi.fn() } as never,
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
      { resolveDeploymentItem: vi.fn() } as never,
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
      { resolveDeploymentItem: vi.fn() } as never,
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
      { resolveDeploymentItem: vi.fn() } as never,
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
      { resolveDeploymentItem: vi.fn() } as never,
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
      { resolveDeploymentItem: vi.fn() } as never,
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
      { resolveDeploymentItem: vi.fn() } as never,
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
      { resolveDeploymentItem: vi.fn() } as never,
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
      { resolveDeploymentItem: vi.fn() } as never,
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
      { resolveDeploymentItem: vi.fn() } as never,
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
      { resolveDeploymentItem: vi.fn() } as never,
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
        { resolveDeploymentItem: vi.fn() } as never,
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
        { resolveDeploymentItem: vi.fn() } as never,
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
        { resolveDeploymentItem: vi.fn() } as never,
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
        { resolveDeploymentItem: vi.fn() } as never,
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
        { resolveDeploymentItem: vi.fn() } as never,
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
        { resolveDeploymentItem: vi.fn() } as never,
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
        { resolveDeploymentItem: vi.fn() } as never,
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
        { resolveDeploymentItem: vi.fn() } as never,
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
        { resolveDeploymentItem: vi.fn() } as never,
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
        { resolveDeploymentItem: vi.fn() } as never,
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
        { resolveDeploymentItem: vi.fn() } as never,
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
        { resolveDeploymentItem: vi.fn() } as never,
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
        { resolveDeploymentItem: vi.fn() } as never,
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

  describe('deleteScheduledTask', () => {
    it('calls the exact upstream DELETE URL with no body and invalidates the list cache', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 204 });
      const cacheManager = makeCacheManager();
      const service = new ScheduledTasksService(
        makeDialClient(),
        makeConfigService('scheduler-app') as never,
        cacheManager as never,
        { resolveDeploymentItem: vi.fn() } as never,
      );

      await service.deleteScheduledTask('user-1', 'token', 'sched_123');

      expect(fetchMock).toHaveBeenCalledWith(
        'http://dial-core/v1/deployments/applications/scheduler-app/route/v1/schedules/sched_123',
        expect.objectContaining({
          method: 'DELETE',
          body: undefined,
          headers: expect.objectContaining({ Authorization: 'Bearer token' }),
        }),
      );
      expect(cacheManager.set).toHaveBeenCalledWith(
        'scheduled-tasks:list-epoch:user-1',
        1,
        24 * 60 * 60 * 1000,
      );
    });

    it('does not attempt to parse a JSON body from the 204 response', async () => {
      const jsonSpy = vi.fn();
      fetchMock.mockResolvedValue({ ok: true, status: 204, json: jsonSpy });
      const service = new ScheduledTasksService(
        makeDialClient(),
        makeConfigService('scheduler-app') as never,
        makeCacheManager() as never,
        { resolveDeploymentItem: vi.fn() } as never,
      );

      await expect(
        service.deleteScheduledTask('user-1', 'token', 'sched_123'),
      ).resolves.toBeUndefined();
      expect(jsonSpy).not.toHaveBeenCalled();
    });

    it('propagates a 404 as NotFoundException and does not invalidate the list cache', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve('schedule not found'),
      });
      const cacheManager = makeCacheManager();
      const service = new ScheduledTasksService(
        makeDialClient(),
        makeConfigService('scheduler-app') as never,
        cacheManager as never,
        { resolveDeploymentItem: vi.fn() } as never,
      );

      await expect(
        service.deleteScheduledTask('user-1', 'token', 'sched_missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(cacheManager.set).not.toHaveBeenCalledWith(
        'scheduled-tasks:list-epoch:user-1',
        expect.anything(),
        expect.anything(),
      );
    });

    it('propagates a 409 as ConflictException and does not invalidate the list cache', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 409,
        json: () => Promise.resolve('schedule already deleted'),
      });
      const cacheManager = makeCacheManager();
      const service = new ScheduledTasksService(
        makeDialClient(),
        makeConfigService('scheduler-app') as never,
        cacheManager as never,
        { resolveDeploymentItem: vi.fn() } as never,
      );

      await expect(
        service.deleteScheduledTask('user-1', 'token', 'sched_123'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(cacheManager.set).not.toHaveBeenCalledWith(
        'scheduled-tasks:list-epoch:user-1',
        expect.anything(),
        expect.anything(),
      );
    });

    it('propagates a 502 as BadGatewayException and does not invalidate the list cache', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.resolve('could not unregister job'),
      });
      const cacheManager = makeCacheManager();
      const service = new ScheduledTasksService(
        makeDialClient(),
        makeConfigService('scheduler-app') as never,
        cacheManager as never,
        { resolveDeploymentItem: vi.fn() } as never,
      );

      await expect(
        service.deleteScheduledTask('user-1', 'token', 'sched_123'),
      ).rejects.toBeInstanceOf(BadGatewayException);
      expect(cacheManager.set).not.toHaveBeenCalledWith(
        'scheduled-tasks:list-epoch:user-1',
        expect.anything(),
        expect.anything(),
      );
    });

    it('maps a network/timeout error to ServiceUnavailableException', async () => {
      fetchMock.mockRejectedValue(new Error('network down'));
      const service = new ScheduledTasksService(
        makeDialClient(),
        makeConfigService('scheduler-app') as never,
        makeCacheManager() as never,
        { resolveDeploymentItem: vi.fn() } as never,
      );

      await expect(
        service.deleteScheduledTask('user-1', 'token', 'sched_123'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('throws ServiceUnavailableException when SCHEDULER_APP_ID is unset', async () => {
      const service = new ScheduledTasksService(
        makeDialClient(),
        makeConfigService(undefined) as never,
        makeCacheManager() as never,
        { resolveDeploymentItem: vi.fn() } as never,
      );

      await expect(
        service.deleteScheduledTask('user-1', 'token', 'sched_123'),
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
      { resolveDeploymentItem: vi.fn() } as never,
    );

    const request = service
      .getScheduledTask('token', 'sched_123')
      .catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(25);

    await expect(request).resolves.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('ScheduledTasksService — isCompleted derivation', () => {
  beforeEach(() => {
    fetchMock = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const listItem = (overrides: Record<string, unknown> = {}) => ({
    id: 'sched_once',
    display_name: 'One-time report',
    trigger_type: 'date',
    next_run_time: null as string | null,
    created_at: '2026-07-23T21:27:07.000Z',
    ...overrides,
  });

  const runsUrlFor = (scheduleId: string) =>
    `http://dial-core/v1/deployments/applications/scheduler-app/route/v1/schedules/${scheduleId}/runs?limit=1&offset=0&order_by=created_at&order_dir=desc`;

  const runsResponse = (results: Record<string, unknown>[]) => ({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ results, count: results.length }),
  });

  const listResponse = (results: Record<string, unknown>[]) => ({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ results, count: results.length }),
  });

  const routeFetch = (
    listItems: Record<string, unknown>[],
    runsByScheduleId: Record<string, Record<string, unknown>[]>,
  ) => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/runs?')) {
        const scheduleId = url.split('/schedules/')[1]?.split('/runs')[0];
        return Promise.resolve(
          runsResponse(runsByScheduleId[scheduleId] ?? []),
        );
      }
      return Promise.resolve(listResponse(listItems));
    });
  };

  const makeService = () =>
    new ScheduledTasksService(
      makeDialClient(),
      makeConfigService('scheduler-app') as never,
      makeCacheManager() as never,
    );

  it('marks a one-time schedule with a terminal success run as completed', async () => {
    routeFetch([listItem()], {
      sched_once: [
        {
          id: 'run_1',
          status: 'success',
          start_time: '2026-07-24T09:00:00.000Z',
        },
      ],
    });

    const { items } = await makeService().listScheduledTasks('user-1', 'token');

    expect(items[0]?.isCompleted).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      runsUrlFor('sched_once'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('marks a one-time schedule with a terminal error run as completed', async () => {
    routeFetch([listItem()], {
      sched_once: [
        {
          id: 'run_1',
          status: 'error',
          start_time: '2026-07-24T09:00:00.000Z',
        },
      ],
    });

    const { items } = await makeService().listScheduledTasks('user-1', 'token');

    expect(items[0]?.isCompleted).toBe(true);
  });

  it('marks a one-time schedule with an in-progress newest run as not completed', async () => {
    routeFetch([listItem()], {
      sched_once: [
        {
          id: 'run_1',
          status: 'in_progress',
          start_time: '2026-07-24T09:00:00.000Z',
        },
      ],
    });

    const { items } = await makeService().listScheduledTasks('user-1', 'token');

    expect(items[0]?.isCompleted).toBe(false);
  });

  it('marks a paused one-time schedule with no runs as not completed', async () => {
    routeFetch([listItem()], {});

    const { items } = await makeService().listScheduledTasks('user-1', 'token');

    expect(items[0]?.isCompleted).toBe(false);
  });

  it('marks a one-time schedule whose newest run is missed as not completed', async () => {
    routeFetch([listItem()], {
      sched_once: [
        {
          id: 'run_1',
          status: 'missed',
          start_time: '2026-07-24T09:00:00.000Z',
        },
      ],
    });

    const { items } = await makeService().listScheduledTasks('user-1', 'token');

    expect(items[0]?.isCompleted).toBe(false);
  });

  it('marks a future one-time schedule as not completed without a runs call', async () => {
    routeFetch([listItem({ next_run_time: '2030-01-01T09:00:00.000Z' })], {});

    const { items } = await makeService().listScheduledTasks('user-1', 'token');

    expect(items[0]?.isCompleted).toBe(false);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('marks an unbounded recurring schedule as not completed without a runs call', async () => {
    routeFetch(
      [
        listItem({
          id: 'sched_cron',
          trigger_type: 'cron',
          next_run_time: null,
        }),
      ],
      {},
    );

    const { items } = await makeService().listScheduledTasks('user-1', 'token');

    expect(items[0]?.isCompleted).toBe(false);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('marks an active recurring schedule as not completed without a runs call', async () => {
    routeFetch(
      [
        listItem({
          id: 'sched_cron_active',
          trigger_type: 'cron',
          next_run_time: '2030-01-01T09:00:00.000Z',
        }),
      ],
      {},
    );

    const { items } = await makeService().listScheduledTasks('user-1', 'token');

    expect(items[0]?.isCompleted).toBe(false);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('marks a recurring schedule paused within a still-open window as not completed', async () => {
    routeFetch(
      [
        listItem({
          id: 'sched_cron_paused_window',
          trigger_type: 'cron',
          next_run_time: null,
          trigger: {
            cron: {
              fields: { hour: '9', minute: '0' },
              end_date: '2030-12-31T23:59:59.999Z',
            },
          },
        }),
      ],
      {},
    );

    const { items } = await makeService().listScheduledTasks('user-1', 'token');

    expect(items[0]?.isCompleted).toBe(false);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('marks an expired-window recurring schedule completed without a runs call on the list path', async () => {
    routeFetch(
      [
        listItem({
          id: 'sched_cron_expired',
          trigger_type: 'cron',
          next_run_time: null,
          trigger: {
            cron: {
              fields: { hour: '6', minute: '0' },
              start_date: '2026-08-31T21:00:00Z',
              end_date: '2026-09-22T20:59:59.999000Z',
            },
          },
        }),
      ],
      {},
    );

    const { items } = await makeService().listScheduledTasks('user-1', 'token');

    expect(items[0]?.isCompleted).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('degrades isCompleted to undefined and warns when the runs call fails, without failing the list', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/runs?')) {
        return Promise.resolve({
          ok: false,
          status: 502,
          json: () => Promise.resolve({}),
        });
      }
      return Promise.resolve(listResponse([listItem()]));
    });
    const warnSpy = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    const { items } = await makeService().listScheduledTasks('user-1', 'token');

    expect(items[0]?.isCompleted).toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('skips the runs checks entirely when the list is served from cache', async () => {
    routeFetch([listItem()], {
      sched_once: [
        {
          id: 'run_1',
          status: 'success',
          start_time: '2026-07-24T09:00:00.000Z',
        },
      ],
    });
    const service = makeService();

    await service.listScheduledTasks('user-1', 'token');
    const callsAfterFirstList = fetchMock.mock.calls.length;
    const second = await service.listScheduledTasks('user-1', 'token');

    expect(fetchMock.mock.calls.length).toBe(callsAfterFirstList);
    expect(second.items[0]?.isCompleted).toBe(true);
  });

  it('computes isCompleted on the get path with the same rule', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/runs?')) {
        return Promise.resolve(
          runsResponse([
            {
              id: 'run_1',
              status: 'success',
              start_time: '2026-07-24T09:00:00.000Z',
            },
          ]),
        );
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            id: 'sched_once',
            display_name: 'One-time report',
            trigger: { date: '2026-07-24T09:00:00.000Z' },
            trigger_type: 'date',
            next_run_time: null,
          }),
      });
    });

    const task = await makeService().getScheduledTask('token', 'sched_once');

    expect(task.isCompleted).toBe(true);
  });

  it('marks a get-path one-time schedule with a future trigger date as not a candidate', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/runs?')) {
        return Promise.resolve(runsResponse([]));
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            id: 'sched_future',
            display_name: 'Future one-time report',
            trigger: { date: '2030-01-01T09:00:00.000Z' },
            trigger_type: 'date',
            next_run_time: '2030-01-01T09:00:00.000Z',
          }),
      });
    });

    const task = await makeService().getScheduledTask('token', 'sched_future');

    expect(task.isCompleted).toBe(false);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('marks a get-path expired recurring schedule completed from the nested trigger alone (no trigger_type)', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            id: 'sched_window',
            display_name: 'Test task 1',
            trigger: {
              date: null,
              cron: {
                fields: { hour: '6', minute: '0' },
                start_date: '2026-08-31T21:00:00Z',
                end_date: '2026-09-22T20:59:59.999000Z',
              },
            },
            next_run_time: null,
          }),
      }),
    );

    const task = await makeService().getScheduledTask('token', 'sched_window');

    expect(task.isCompleted).toBe(true);
    // the expired-window shape is conclusive from the schedule fields — no runs call
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
