import { ServiceUnavailableException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScheduledTaskRunStatus } from '../dto/scheduled-task-run.dto';
import { ScheduledTaskRateLimitException } from '../scheduled-task-rate-limit.exception';
import {
  createScheduledTasksService,
  makeCacheManager,
  makeConfigService,
  makeDialClient,
  makeSchedulerConsent,
} from './scheduled-tasks.fixtures';

let fetchMock: ReturnType<typeof vi.fn>;

describe('ScheduledTasksService', () => {
  beforeEach(() => {
    fetchMock = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('listScheduledTaskRuns', () => {
    it('forwards limit/offset with explicit created_at desc ordering', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });
      const service = createScheduledTasksService(
        makeDialClient(fetchMock),
        makeConfigService('scheduler-app') as never,
        makeCacheManager() as never,
        { resolveDeploymentItem: vi.fn() } as never,
        makeSchedulerConsent() as never,
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
      const service = createScheduledTasksService(
        makeDialClient(fetchMock),
        makeConfigService('scheduler-app') as never,
        makeCacheManager() as never,
        { resolveDeploymentItem: vi.fn() } as never,
        makeSchedulerConsent() as never,
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
      const service = createScheduledTasksService(
        makeDialClient(fetchMock),
        makeConfigService('scheduler-app') as never,
        makeCacheManager() as never,
        { resolveDeploymentItem: vi.fn() } as never,
        makeSchedulerConsent() as never,
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
      const service = createScheduledTasksService(
        makeDialClient(fetchMock),
        makeConfigService('scheduler-app') as never,
        makeCacheManager() as never,
        { resolveDeploymentItem: vi.fn() } as never,
        makeSchedulerConsent() as never,
      );

      const result = await service.listScheduledTaskRuns('token', 'sched_123');

      expect(result.items).toEqual([]);
    });

    it('reads the detail route of each failed run to fill in errorText', async () => {
      const listUrl =
        'http://dial-core/v1/deployments/applications/scheduler-app/route/v1/schedules/sched_123/runs?limit=20&offset=0&order_by=created_at&order_dir=desc';
      fetchMock.mockImplementation((url: string) => {
        if (url === listUrl) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                results: [
                  {
                    id: 'run_ok',
                    status: 'success',
                    start_time: '2026-07-24T09:00:00.000Z',
                  },
                  {
                    id: 'run_failed',
                    status: 'error',
                    start_time: '2026-07-24T09:00:00.000Z',
                  },
                ],
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'run_failed',
              status: 'error',
              start_time: '2026-07-24T09:00:00.000Z',
              result: { error_text: 'target request failed with 502' },
            }),
        });
      });
      const service = createScheduledTasksService(
        makeDialClient(fetchMock),
        makeConfigService('scheduler-app') as never,
        makeCacheManager() as never,
        { resolveDeploymentItem: vi.fn() } as never,
        makeSchedulerConsent() as never,
      );

      const result = await service.listScheduledTaskRuns('token', 'sched_123');

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/schedules/sched_123/runs/run_failed'),
        expect.objectContaining({ method: 'GET' }),
      );
      expect(result.items[0]).not.toHaveProperty('errorText');
      expect(result.items[1].errorText).toBe('target request failed with 502');
    });

    it('keeps a failed run without errorText when its detail read fails', async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [
                {
                  id: 'run_failed',
                  status: 'error',
                  start_time: '2026-07-24T09:00:00.000Z',
                },
              ],
            }),
        })
        .mockRejectedValueOnce(new Error('network down'));
      const service = createScheduledTasksService(
        makeDialClient(fetchMock),
        makeConfigService('scheduler-app') as never,
        makeCacheManager() as never,
        { resolveDeploymentItem: vi.fn() } as never,
        makeSchedulerConsent() as never,
      );

      const result = await service.listScheduledTaskRuns('token', 'sched_123');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].status).toBe('Error');
      expect(result.items[0]).not.toHaveProperty('errorText');
    });

    describe('failed-run error details fan-out', () => {
      const makeService = () =>
        createScheduledTasksService(
          makeDialClient(fetchMock),
          makeConfigService('scheduler-app') as never,
          makeCacheManager() as never,
          { resolveDeploymentItem: vi.fn() } as never,
          makeSchedulerConsent() as never,
        );

      /* Routes the list URL to `listRuns` and every per-run URL to a detail
         carrying `error_text` (or `detailBody` when supplied). */
      const mockScheduler = (
        listRuns: { id: string; status: string }[],
        detailBody?: (runId: string) => unknown,
      ) => {
        fetchMock.mockImplementation((url: string) => {
          const runMatch = /\/runs\/([^/?]+)$/.exec(url);
          if (runMatch) {
            const runId = decodeURIComponent(runMatch[1]);
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve(
                  detailBody?.(runId) ?? {
                    id: runId,
                    status: 'error',
                    start_time: '2026-07-24T09:00:00.000Z',
                    result: { error_text: `failed: ${runId}` },
                  },
                ),
            });
          }
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                results: listRuns.map((run) => ({
                  ...run,
                  start_time: '2026-07-24T09:00:00.000Z',
                })),
              }),
          });
        });
      };

      const detailCalls = () =>
        fetchMock.mock.calls.filter(([url]) => /\/runs\/[^/?]+$/.test(url))
          .length;

      it('serves a repeated list call from cache without re-reading run details', async () => {
        mockScheduler([{ id: 'run_failed', status: 'error' }]);
        const service = makeService();

        await service.listScheduledTaskRuns('token', 'sched_123');
        const second = await service.listScheduledTaskRuns(
          'token',
          'sched_123',
        );

        expect(detailCalls()).toBe(1);
        expect(second.items[0].errorText).toBe('failed: run_failed');
      });

      it('caches a failed run that has no error_text so it is not re-read', async () => {
        mockScheduler([{ id: 'run_failed', status: 'error' }], (runId) => ({
          id: runId,
          status: 'error',
          start_time: '2026-07-24T09:00:00.000Z',
          result: null,
        }));
        const service = makeService();

        await service.listScheduledTaskRuns('token', 'sched_123');
        const second = await service.listScheduledTaskRuns(
          'token',
          'sched_123',
        );

        expect(detailCalls()).toBe(1);
        expect(second.items[0]).not.toHaveProperty('errorText');
      });

      it('re-reads a run whose previous detail read failed', async () => {
        let attempt = 0;
        mockScheduler([{ id: 'run_failed', status: 'error' }], (runId) => {
          attempt += 1;
          if (attempt === 1) {
            throw new Error('network down');
          }
          return {
            id: runId,
            status: 'error',
            start_time: '2026-07-24T09:00:00.000Z',
            result: { error_text: 'recovered' },
          };
        });
        const service = makeService();

        await service.listScheduledTaskRuns('token', 'sched_123');
        const second = await service.listScheduledTaskRuns(
          'token',
          'sched_123',
        );

        expect(detailCalls()).toBe(2);
        expect(second.items[0].errorText).toBe('recovered');
      });

      it('reads at most 10 run details per list call, newest first', async () => {
        const runs = Array.from({ length: 15 }, (_, index) => ({
          id: `run_${index}`,
          status: 'error',
        }));
        mockScheduler(runs);
        const service = makeService();

        const result = await service.listScheduledTaskRuns(
          'token',
          'sched_123',
          {
            limit: 15,
          },
        );

        expect(detailCalls()).toBe(10);
        expect(result.items[9].errorText).toBe('failed: run_9');
        expect(result.items[10]).not.toHaveProperty('errorText');
      });

      it('does not read details for runs that did not fail', async () => {
        mockScheduler([
          { id: 'run_ok', status: 'success' },
          { id: 'run_running', status: 'in_progress' },
          { id: 'run_missed', status: 'missed' },
        ]);
        const service = makeService();

        await service.listScheduledTaskRuns('token', 'sched_123');

        expect(detailCalls()).toBe(0);
      });
    });

    it('is not cached — repeated calls always hit fetch again', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });
      const service = createScheduledTasksService(
        makeDialClient(fetchMock),
        makeConfigService('scheduler-app') as never,
        makeCacheManager() as never,
        { resolveDeploymentItem: vi.fn() } as never,
        makeSchedulerConsent() as never,
      );

      await service.listScheduledTaskRuns('token', 'sched_123');
      await service.listScheduledTaskRuns('token', 'sched_123');

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('throws ServiceUnavailableException when SCHEDULER_APP_ID is unset', async () => {
      const service = createScheduledTasksService(
        makeDialClient(fetchMock),
        makeConfigService(undefined) as never,
        makeCacheManager() as never,
        { resolveDeploymentItem: vi.fn() } as never,
        makeSchedulerConsent() as never,
      );

      await expect(
        service.listScheduledTaskRuns('token', 'sched_123'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('getScheduledTaskRun', () => {
    it.each(['4', 'Wed, 30 Sep 2026 10:00:00 GMT'])(
      'preserves Retry-After %s and the mapped Scheduler error',
      async (retryAfter) => {
        fetchMock.mockResolvedValue(
          new Response(
            JSON.stringify({
              message: 'Too many requests',
              code: 'rate_limited',
            }),
            { status: 429, headers: { 'Retry-After': retryAfter } },
          ),
        );
        const service = createScheduledTasksService(
          makeDialClient(fetchMock),
          makeConfigService('scheduler-app') as never,
          makeCacheManager() as never,
          { resolveDeploymentItem: vi.fn() } as never,
          makeSchedulerConsent() as never,
        );
        const error = await service
          .getScheduledTaskRun('token', 'sched_123', 'run_123')
          .catch((error: unknown) => error);
        expect(error).toBeInstanceOf(ScheduledTaskRateLimitException);
        expect(error).toMatchObject({
          status: 429,
          retryAfter,
          response: {
            upstreamMessage: 'Too many requests',
            upstreamCode: 'rate_limited',
          },
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
      },
    );

    it('omits an invalid retry header without losing the rate-limit status', async () => {
      fetchMock.mockResolvedValue(
        new Response('{}', {
          status: 429,
          headers: { 'Retry-After': 'invalid-delay' },
        }),
      );
      const service = createScheduledTasksService(
        makeDialClient(fetchMock),
        makeConfigService('scheduler-app') as never,
        makeCacheManager() as never,
        { resolveDeploymentItem: vi.fn() } as never,
        makeSchedulerConsent() as never,
      );
      const error = await service
        .getScheduledTaskRun('token', 'sched_123', 'run_123')
        .catch((error: unknown) => error);
      expect(error).toMatchObject({ status: 429 });
      expect(
        (error as ScheduledTaskRateLimitException).retryAfter,
      ).toBeUndefined();
    });
    it('reads and maps one run without caching it', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            id: 'run_123',
            status: 'error',
            start_time: '2026-09-30T09:00:00Z',
            end_time: '2026-09-30T09:00:01Z',
            conversation_id: null,
            result: { stage: 'credentials', detail: 'not exposed' },
          }),
      });
      const service = createScheduledTasksService(
        makeDialClient(fetchMock),
        makeConfigService('scheduler-app') as never,
        makeCacheManager() as never,
        { resolveDeploymentItem: vi.fn() } as never,
        makeSchedulerConsent() as never,
      );

      await expect(
        service.getScheduledTaskRun('token', 'sched_123', 'run_123'),
      ).resolves.toMatchObject({
        id: 'run_123',
        status: ScheduledTaskRunStatus.Error,
        durationSeconds: 1,
        resultStage: 'credentials',
      });
      await service.getScheduledTaskRun('token', 'sched_123', 'run_123');

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://dial-core/v1/deployments/applications/scheduler-app/route/v1/schedules/sched_123/runs/run_123',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it.each([404, 429, 502])(
      'preserves upstream status %i for an unknown or unavailable run',
      async (status) => {
        fetchMock.mockResolvedValue({
          ok: false,
          status,
          json: () => Promise.resolve({}),
        });
        const service = createScheduledTasksService(
          makeDialClient(fetchMock),
          makeConfigService('scheduler-app') as never,
          makeCacheManager() as never,
          { resolveDeploymentItem: vi.fn() } as never,
          makeSchedulerConsent() as never,
        );

        await expect(
          service.getScheduledTaskRun('token', 'sched_123', 'run_123'),
        ).rejects.toMatchObject({ status });
      },
    );

    it('maps an unreachable Scheduler to 503', async () => {
      fetchMock.mockRejectedValue(
        Object.assign(new Error('unreachable'), { name: 'AbortError' }),
      );
      const service = createScheduledTasksService(
        makeDialClient(fetchMock),
        makeConfigService('scheduler-app') as never,
        makeCacheManager() as never,
        { resolveDeploymentItem: vi.fn() } as never,
        makeSchedulerConsent() as never,
      );

      await expect(
        service.getScheduledTaskRun('token', 'sched_123', 'run_123'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('does not contact Scheduler when its application id is missing', async () => {
      const service = createScheduledTasksService(
        makeDialClient(fetchMock),
        makeConfigService(undefined) as never,
        makeCacheManager() as never,
        { resolveDeploymentItem: vi.fn() } as never,
        makeSchedulerConsent() as never,
      );

      await expect(
        service.getScheduledTaskRun('token', 'sched_123', 'run_123'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
