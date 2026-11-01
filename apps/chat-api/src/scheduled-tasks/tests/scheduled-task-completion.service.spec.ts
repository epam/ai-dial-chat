import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createScheduledTasksService,
  makeCacheManager,
  makeConfigService,
  makeDialClient,
  makeSchedulerConsent,
} from './scheduled-tasks.fixtures';

let fetchMock: ReturnType<typeof vi.fn>;

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
    createScheduledTasksService(
      makeDialClient(fetchMock),
      makeConfigService('scheduler-app') as never,
      makeCacheManager() as never,
      { resolveDeploymentItem: vi.fn() } as never,
      makeSchedulerConsent() as never,
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
