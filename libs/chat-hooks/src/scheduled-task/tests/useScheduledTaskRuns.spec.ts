import type { ListScheduledTaskRunsResponseDto } from '@epam/ai-dial-chat-api-client';
import { ScheduledTaskRunDtoStatusEnum } from '@epam/ai-dial-chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';
import type { ScheduledTasksApiClient } from '../scheduled-tasks-api-client';
import {
  mergeRunsById,
  useScheduledTaskRuns,
} from '../use-scheduled-task-runs';

type RunDto = ListScheduledTaskRunsResponseDto['items'][number];

const makeRun = (overrides: Partial<RunDto> = {}): RunDto =>
  ({
    id: 'run-1',
    status: ScheduledTaskRunDtoStatusEnum.Success,
    startTime: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }) as RunDto;

const makeClient = (listScheduledTaskRuns: Mock): ScheduledTasksApiClient => ({
  listScheduledTaskRuns,
  listScheduledTasks: vi.fn(),
  createScheduledTask: vi.fn(),
  getScheduledTask: vi.fn(),
  updateScheduledTask: vi.fn(),
  pauseScheduledTask: vi.fn(),
  resumeScheduledTask: vi.fn(),
  deleteScheduledTask: vi.fn(),
});

/** Drains the microtask queue under `act`, without moving the fake clock. */
const flush = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

/** Advances the fake clock by `ms`, awaiting any promises timer callbacks create. */
const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

describe('shared useScheduledTaskRuns', () => {
  it.each(['resolve', 'reject'] as const)(
    'ignores a stale initial request that completes with %s after the new task loads',
    async (completion) => {
      let resolveOld!: (page: ListScheduledTaskRunsResponseDto) => void;
      let rejectOld!: (error: Error) => void;
      const oldRequest = new Promise<ListScheduledTaskRunsResponseDto>(
        (resolve, reject) => {
          resolveOld = resolve;
          rejectOld = reject;
        },
      );
      const newPage = {
        items: [{ id: 'new-run' }],
        next: null,
      } as ListScheduledTaskRunsResponseDto;
      const listScheduledTaskRuns = vi
        .fn<ScheduledTasksApiClient['listScheduledTaskRuns']>()
        .mockReturnValueOnce(oldRequest)
        .mockResolvedValueOnce(newPage);
      const client: ScheduledTasksApiClient = {
        listScheduledTaskRuns,
        listScheduledTasks: vi.fn(),
        createScheduledTask: vi.fn(),
        getScheduledTask: vi.fn(),
        updateScheduledTask: vi.fn(),
        pauseScheduledTask: vi.fn(),
        resumeScheduledTask: vi.fn(),
        deleteScheduledTask: vi.fn(),
      };
      const { result, rerender } = renderHook(
        ({ scheduleId }) => useScheduledTaskRuns(client, { scheduleId }),
        { initialProps: { scheduleId: 'old' } },
      );
      expect(listScheduledTaskRuns).toHaveBeenCalledWith(
        expect.objectContaining({ scheduleId: 'old' }),
      );
      const oldSignal = listScheduledTaskRuns.mock.calls[0][0].signal;
      rerender({ scheduleId: 'new' });
      await waitFor(() => expect(result.current.items).toEqual(newPage.items));
      expect(oldSignal?.aborted).toBe(true);

      await act(async () => {
        if (completion === 'resolve') {
          resolveOld({
            items: [{ id: 'old-run' }],
            next: 'old-next',
          } as ListScheduledTaskRunsResponseDto);
        } else {
          rejectOld(new Error('Old request failed'));
        }
        await oldRequest.catch(() => undefined);
      });

      expect(result.current.items).toEqual(newPage.items);
      expect(result.current.initialError).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.hasMore).toBe(false);
      expect(listScheduledTaskRuns).toHaveBeenCalledTimes(2);
    },
  );

  describe('mergeRunsById', () => {
    it('updates an already-known id in place without reordering', () => {
      const current = [makeRun({ id: 'a' }), makeRun({ id: 'b' })];
      const incoming = [
        makeRun({ id: 'a', status: ScheduledTaskRunDtoStatusEnum.Error }),
      ];
      expect(mergeRunsById(current, incoming)).toEqual([
        makeRun({ id: 'a', status: ScheduledTaskRunDtoStatusEnum.Error }),
        makeRun({ id: 'b' }),
      ]);
    });

    it('prepends an id not yet present', () => {
      const current = [makeRun({ id: 'a' })];
      const incoming = [makeRun({ id: 'new' }), makeRun({ id: 'a' })];
      expect(mergeRunsById(current, incoming)).toEqual([
        makeRun({ id: 'new' }),
        makeRun({ id: 'a' }),
      ]);
    });

    it('retains an id absent from the incoming page unchanged', () => {
      const current = [makeRun({ id: 'a' }), makeRun({ id: 'kept' })];
      const incoming = [
        makeRun({ id: 'a', status: ScheduledTaskRunDtoStatusEnum.Error }),
      ];
      expect(mergeRunsById(current, incoming)).toEqual([
        makeRun({ id: 'a', status: ScheduledTaskRunDtoStatusEnum.Error }),
        makeRun({ id: 'kept' }),
      ]);
    });
  });

  describe('background refresh triggers', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      });
    });

    it('polls every 15s while an in-progress run is loaded and stops once it settles', async () => {
      const listScheduledTaskRuns = vi
        .fn<ScheduledTasksApiClient['listScheduledTaskRuns']>()
        .mockResolvedValueOnce({
          items: [
            makeRun({
              id: 'run-1',
              status: ScheduledTaskRunDtoStatusEnum.InProgress,
            }),
          ],
          next: null,
        } as ListScheduledTaskRunsResponseDto)
        .mockResolvedValue({
          items: [
            makeRun({
              id: 'run-1',
              status: ScheduledTaskRunDtoStatusEnum.Success,
            }),
          ],
          next: null,
        } as ListScheduledTaskRunsResponseDto);
      const client = makeClient(listScheduledTaskRuns);

      const { result } = renderHook(() =>
        useScheduledTaskRuns(client, { scheduleId: 'sched' }),
      );
      await flush();
      expect(result.current.isLoading).toBe(false);
      expect(listScheduledTaskRuns).toHaveBeenCalledOnce();

      await advance(15_000);
      expect(listScheduledTaskRuns).toHaveBeenCalledTimes(2);
      expect(result.current.items[0].status).toBe(
        ScheduledTaskRunDtoStatusEnum.Success,
      );

      await advance(15_000);
      expect(listScheduledTaskRuns).toHaveBeenCalledTimes(2);
    });

    it('does not poll while no run is in progress', async () => {
      const listScheduledTaskRuns = vi
        .fn<ScheduledTasksApiClient['listScheduledTaskRuns']>()
        .mockResolvedValue({
          items: [
            makeRun({
              id: 'run-1',
              status: ScheduledTaskRunDtoStatusEnum.Success,
            }),
          ],
          next: null,
        } as ListScheduledTaskRunsResponseDto);
      const client = makeClient(listScheduledTaskRuns);

      renderHook(() => useScheduledTaskRuns(client, { scheduleId: 'sched' }));
      await flush();
      expect(listScheduledTaskRuns).toHaveBeenCalledOnce();

      await advance(15_000 * 3);
      expect(listScheduledTaskRuns).toHaveBeenCalledOnce();
    });

    it("each poll tick's request carries its own AbortController, distinct from the initial fetch's", async () => {
      const listScheduledTaskRuns = vi
        .fn<ScheduledTasksApiClient['listScheduledTaskRuns']>()
        .mockResolvedValue({
          items: [
            makeRun({
              id: 'run-1',
              status: ScheduledTaskRunDtoStatusEnum.InProgress,
            }),
          ],
          next: null,
        } as ListScheduledTaskRunsResponseDto);
      const client = makeClient(listScheduledTaskRuns);

      renderHook(() => useScheduledTaskRuns(client, { scheduleId: 'sched' }));
      await flush();
      const initialSignal = listScheduledTaskRuns.mock.calls[0][0].signal;

      await advance(15_000);
      const pollSignal = listScheduledTaskRuns.mock.calls[1][0].signal;

      expect(pollSignal).not.toBe(initialSignal);
      expect(pollSignal?.aborted).toBe(false);
    });

    it('stops polling after 20 consecutive polls that each fail, without polling indefinitely', async () => {
      const listScheduledTaskRuns = vi
        .fn<ScheduledTasksApiClient['listScheduledTaskRuns']>()
        .mockResolvedValueOnce({
          items: [
            makeRun({
              id: 'run-1',
              status: ScheduledTaskRunDtoStatusEnum.InProgress,
            }),
          ],
          next: null,
        } as ListScheduledTaskRunsResponseDto)
        .mockRejectedValue(new Error('upstream down'));
      const client = makeClient(listScheduledTaskRuns);

      renderHook(() => useScheduledTaskRuns(client, { scheduleId: 'sched' }));
      await flush();

      for (let tick = 0; tick < 21; tick += 1) {
        await advance(15_000);
      }

      expect(listScheduledTaskRuns).toHaveBeenCalledTimes(21);
    });

    it("stops the previous schedule's polling and aborts its in-flight background request when scheduleId changes", async () => {
      const staleRequest = new Promise<ListScheduledTaskRunsResponseDto>(() => {
        // never resolves — asserts the request is aborted, not resolved
      });
      const listScheduledTaskRuns = vi
        .fn<ScheduledTasksApiClient['listScheduledTaskRuns']>()
        .mockResolvedValueOnce({
          items: [
            makeRun({
              id: 'run-1',
              status: ScheduledTaskRunDtoStatusEnum.InProgress,
            }),
          ],
          next: null,
        } as ListScheduledTaskRunsResponseDto)
        .mockReturnValueOnce(staleRequest)
        .mockResolvedValue({
          items: [makeRun({ id: 'run-2' })],
          next: null,
        } as ListScheduledTaskRunsResponseDto);
      const client = makeClient(listScheduledTaskRuns);

      const { rerender } = renderHook(
        ({ scheduleId }) => useScheduledTaskRuns(client, { scheduleId }),
        { initialProps: { scheduleId: 'old' } },
      );
      await flush();

      await advance(15_000);
      const staleSignal = listScheduledTaskRuns.mock.calls[1]?.[0].signal;
      expect(staleSignal?.aborted).toBe(false);

      rerender({ scheduleId: 'new' });
      expect(staleSignal?.aborted).toBe(true);

      await flush();
      await advance(15_000 * 3);
      /* Only the new schedule's initial fetch — the old schedule's polling
         stopped and never resumes. */
      expect(listScheduledTaskRuns).toHaveBeenCalledTimes(3);
    });

    it('stops polling after 20 consecutive polls with no status change', async () => {
      const inProgressPage = {
        items: [
          makeRun({
            id: 'run-1',
            status: ScheduledTaskRunDtoStatusEnum.InProgress,
          }),
        ],
        next: null,
      } as ListScheduledTaskRunsResponseDto;
      const listScheduledTaskRuns = vi
        .fn<ScheduledTasksApiClient['listScheduledTaskRuns']>()
        .mockResolvedValue(inProgressPage);
      const client = makeClient(listScheduledTaskRuns);

      renderHook(() => useScheduledTaskRuns(client, { scheduleId: 'sched' }));
      await flush();

      for (let tick = 0; tick < 21; tick += 1) {
        await advance(15_000);
      }

      /* 1 initial + 20 polls (the 21st scheduled tick never fires: the
         interval was cleared once the 20th no-change poll completed). */
      expect(listScheduledTaskRuns).toHaveBeenCalledTimes(21);
    });

    it('merges a background refresh without resetting pagination or scroll-relevant state', async () => {
      const listScheduledTaskRuns = vi
        .fn<ScheduledTasksApiClient['listScheduledTaskRuns']>()
        .mockResolvedValueOnce({
          items: [
            makeRun({
              id: 'held-back',
              status: ScheduledTaskRunDtoStatusEnum.InProgress,
            }),
          ],
          next: 'next-page',
          count: 5,
        } as ListScheduledTaskRunsResponseDto)
        .mockResolvedValue({
          items: [
            makeRun({
              id: 'held-back',
              status: ScheduledTaskRunDtoStatusEnum.InProgress,
            }),
            makeRun({
              id: 'new',
              status: ScheduledTaskRunDtoStatusEnum.InProgress,
            }),
          ],
          next: 'next-page',
          count: 5,
        } as ListScheduledTaskRunsResponseDto);
      const client = makeClient(listScheduledTaskRuns);

      const { result } = renderHook(() =>
        useScheduledTaskRuns(client, { scheduleId: 'sched' }),
      );
      await flush();
      expect(result.current.hasMore).toBe(true);

      await advance(15_000);

      expect(result.current.items).toHaveLength(2);
      expect(result.current.items.map((run) => run.id)).toEqual([
        'new',
        'held-back',
      ]);
      expect(result.current.hasMore).toBe(true);
    });

    it('schedules a far-future nextRunTime without overflowing setTimeout, firing once at the real target', async () => {
      const listScheduledTaskRuns = vi
        .fn<ScheduledTasksApiClient['listScheduledTaskRuns']>()
        .mockResolvedValue({
          items: [makeRun({ id: 'run-1' })],
          next: null,
        } as ListScheduledTaskRunsResponseDto);
      const client = makeClient(listScheduledTaskRuns);
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

      renderHook(() =>
        useScheduledTaskRuns(client, {
          scheduleId: 'sched',
          nextRunTime: new Date(Date.now() + thirtyDaysMs).toISOString(),
        }),
      );
      await flush();
      expect(listScheduledTaskRuns).toHaveBeenCalledOnce();

      /* A raw setTimeout for 30 days would overflow the 32-bit limit and
         fire almost immediately; the chained scheduler must not fire until
         the real target instead. */
      await advance(thirtyDaysMs - 1_000);
      expect(listScheduledTaskRuns).toHaveBeenCalledOnce();

      await advance(10_000);
      expect(listScheduledTaskRuns).toHaveBeenCalledTimes(2);
    });

    it('does not trigger a redundant refresh from a later loadMore once the one-shot has already claimed nextRunTime', async () => {
      const listScheduledTaskRuns = vi
        .fn<ScheduledTasksApiClient['listScheduledTaskRuns']>()
        .mockResolvedValueOnce({
          items: [makeRun({ id: 'run-1' })],
          next: 'next',
          count: 5,
        } as ListScheduledTaskRunsResponseDto)
        .mockResolvedValueOnce({
          items: [makeRun({ id: 'run-1' })],
          next: 'next',
          count: 5,
        } as ListScheduledTaskRunsResponseDto)
        .mockResolvedValue({
          items: [makeRun({ id: 'run-2' })],
          next: null,
        } as ListScheduledTaskRunsResponseDto);
      const client = makeClient(listScheduledTaskRuns);

      const { result } = renderHook(() =>
        useScheduledTaskRuns(client, {
          scheduleId: 'sched',
          nextRunTime: '2026-01-01T00:00:10.000Z',
        }),
      );
      await flush();
      expect(listScheduledTaskRuns).toHaveBeenCalledOnce();

      // The one-shot fires at t=15s (nextRunTime + 5s).
      await advance(15_000);
      expect(listScheduledTaskRuns).toHaveBeenCalledTimes(2);

      /* A later loadMore, well after nextRunTime has passed, toggles
         isLoading/isLoadingMore — re-running the past-due effect — but must
         not also fire a redundant past-due refresh for the same value. */
      await act(async () => {
        result.current.loadMore();
      });
      await flush();
      expect(listScheduledTaskRuns).toHaveBeenCalledTimes(3);
    });

    it('schedules exactly one refresh 5s after a future nextRunTime', async () => {
      const listScheduledTaskRuns = vi
        .fn<ScheduledTasksApiClient['listScheduledTaskRuns']>()
        .mockResolvedValue({
          items: [makeRun({ id: 'run-1' })],
          next: null,
        } as ListScheduledTaskRunsResponseDto);
      const client = makeClient(listScheduledTaskRuns);

      renderHook(() =>
        useScheduledTaskRuns(client, {
          scheduleId: 'sched',
          nextRunTime: '2026-01-01T00:00:10.000Z',
        }),
      );
      await flush();
      expect(listScheduledTaskRuns).toHaveBeenCalledOnce();

      await advance(14_999);
      expect(listScheduledTaskRuns).toHaveBeenCalledOnce();

      await advance(1);
      expect(listScheduledTaskRuns).toHaveBeenCalledTimes(2);

      await advance(60_000);
      expect(listScheduledTaskRuns).toHaveBeenCalledTimes(2);
    });

    it('still fires the one-shot nextRunTime refresh even if a poll tick clears the in-progress run inside the waiting window', async () => {
      /* Regression: the poll trigger and the one-shot trigger live in
         separate effects specifically so that hasInProgressRun toggling
         inside the (nextRunTime, nextRunTime+5s) window cannot tear down
         and lose the pending one-shot timer — the failure mode when both
         lived in one effect keyed on both dependencies. */
      const listScheduledTaskRuns = vi
        .fn<ScheduledTasksApiClient['listScheduledTaskRuns']>()
        .mockResolvedValueOnce({
          items: [
            makeRun({
              id: 'other-run',
              status: ScheduledTaskRunDtoStatusEnum.InProgress,
            }),
          ],
          next: null,
        } as ListScheduledTaskRunsResponseDto)
        .mockResolvedValueOnce({
          items: [
            makeRun({
              id: 'other-run',
              status: ScheduledTaskRunDtoStatusEnum.Success,
            }),
          ],
          next: null,
        } as ListScheduledTaskRunsResponseDto)
        .mockResolvedValue({
          items: [makeRun({ id: 'new-run' })],
          next: null,
        } as ListScheduledTaskRunsResponseDto);
      const client = makeClient(listScheduledTaskRuns);

      renderHook(() =>
        useScheduledTaskRuns(client, {
          scheduleId: 'sched',
          /* nextRunTime + 5s = 00:00:17 — inside that window, the first poll
             tick at 00:00:15 flips hasInProgressRun to false. */
          nextRunTime: '2026-01-01T00:00:12.000Z',
        }),
      );
      await flush();
      expect(listScheduledTaskRuns).toHaveBeenCalledOnce();

      /* The poll tick at t=15s clears the in-progress run, tearing down the
         poll effect — this must not affect the separately-scheduled
         one-shot. */
      await advance(15_000);
      expect(listScheduledTaskRuns).toHaveBeenCalledTimes(2);

      // The one-shot still fires at t=17s (nextRunTime + 5s).
      await advance(2_000);
      expect(listScheduledTaskRuns).toHaveBeenCalledTimes(3);
    });

    it('refreshes immediately when nextRunTime is already past', async () => {
      const listScheduledTaskRuns = vi
        .fn<ScheduledTasksApiClient['listScheduledTaskRuns']>()
        .mockResolvedValue({
          items: [makeRun({ id: 'run-1' })],
          next: null,
        } as ListScheduledTaskRunsResponseDto);
      const client = makeClient(listScheduledTaskRuns);

      const { result } = renderHook(() =>
        useScheduledTaskRuns(client, {
          scheduleId: 'sched',
          nextRunTime: '2025-12-31T23:59:00.000Z',
        }),
      );
      await flush();
      expect(listScheduledTaskRuns).toHaveBeenCalledTimes(2);
      expect(result.current.isLoading).toBe(false);
    });

    it('defers the past-due immediate refresh until an in-flight initial fetch settles, then issues it as a second request', async () => {
      let resolveInitial!: (page: ListScheduledTaskRunsResponseDto) => void;
      const initialRequest = new Promise<ListScheduledTaskRunsResponseDto>(
        (resolve) => {
          resolveInitial = resolve;
        },
      );
      const listScheduledTaskRuns = vi
        .fn<ScheduledTasksApiClient['listScheduledTaskRuns']>()
        .mockReturnValueOnce(initialRequest)
        .mockResolvedValue({
          items: [makeRun({ id: 'run-1' })],
          next: null,
        } as ListScheduledTaskRunsResponseDto);
      const client = makeClient(listScheduledTaskRuns);

      renderHook(() =>
        useScheduledTaskRuns(client, {
          scheduleId: 'sched',
          nextRunTime: '2025-12-31T23:59:00.000Z',
        }),
      );
      expect(listScheduledTaskRuns).toHaveBeenCalledOnce();

      await act(async () => {
        resolveInitial({
          items: [makeRun({ id: 'run-1' })],
          next: null,
        } as ListScheduledTaskRunsResponseDto);
      });
      await flush();

      expect(listScheduledTaskRuns).toHaveBeenCalledTimes(2);
    });

    it('makes no request while the tab is hidden, and performs one catch-up refresh on return to visible', async () => {
      const listScheduledTaskRuns = vi
        .fn<ScheduledTasksApiClient['listScheduledTaskRuns']>()
        .mockResolvedValue({
          items: [
            makeRun({
              id: 'run-1',
              status: ScheduledTaskRunDtoStatusEnum.InProgress,
            }),
          ],
          next: null,
        } as ListScheduledTaskRunsResponseDto);
      const client = makeClient(listScheduledTaskRuns);

      renderHook(() => useScheduledTaskRuns(client, { scheduleId: 'sched' }));
      await flush();
      expect(listScheduledTaskRuns).toHaveBeenCalledOnce();

      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      });

      await advance(15_000 * 2);
      expect(listScheduledTaskRuns).toHaveBeenCalledOnce();

      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
      await flush();
      expect(listScheduledTaskRuns).toHaveBeenCalledTimes(2);

      document.dispatchEvent(new Event('visibilitychange'));
      await flush();
      expect(listScheduledTaskRuns).toHaveBeenCalledTimes(2);
    });

    it('defers a past-due nextRunTime refresh until the tab becomes visible, when mounted hidden', async () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      });
      const listScheduledTaskRuns = vi
        .fn<ScheduledTasksApiClient['listScheduledTaskRuns']>()
        .mockResolvedValueOnce({
          items: [makeRun({ id: 'run-1' })],
          next: null,
        } as ListScheduledTaskRunsResponseDto)
        .mockResolvedValue({
          items: [makeRun({ id: 'run-2' })],
          next: null,
        } as ListScheduledTaskRunsResponseDto);
      const client = makeClient(listScheduledTaskRuns);

      renderHook(() =>
        useScheduledTaskRuns(client, {
          scheduleId: 'sched',
          nextRunTime: '2025-12-31T23:59:00.000Z',
        }),
      );
      await flush();
      expect(listScheduledTaskRuns).toHaveBeenCalledOnce();

      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
      await flush();
      expect(listScheduledTaskRuns).toHaveBeenCalledTimes(2);
    });

    it('never overlaps a foreground loadMore request', async () => {
      let resolveLoadMore!: (page: ListScheduledTaskRunsResponseDto) => void;
      const loadMoreRequest = new Promise<ListScheduledTaskRunsResponseDto>(
        (resolve) => {
          resolveLoadMore = resolve;
        },
      );
      const listScheduledTaskRuns = vi
        .fn<ScheduledTasksApiClient['listScheduledTaskRuns']>()
        .mockResolvedValueOnce({
          items: [
            makeRun({
              id: 'run-1',
              status: ScheduledTaskRunDtoStatusEnum.InProgress,
            }),
          ],
          next: 'next',
          count: 5,
        } as ListScheduledTaskRunsResponseDto)
        .mockReturnValueOnce(loadMoreRequest);
      const client = makeClient(listScheduledTaskRuns);

      const { result } = renderHook(() =>
        useScheduledTaskRuns(client, { scheduleId: 'sched' }),
      );
      await flush();

      act(() => {
        result.current.loadMore();
      });
      expect(listScheduledTaskRuns).toHaveBeenCalledTimes(2);

      await advance(15_000);
      expect(listScheduledTaskRuns).toHaveBeenCalledTimes(2);

      await act(async () => {
        resolveLoadMore({
          items: [],
          next: null,
        } as unknown as ListScheduledTaskRunsResponseDto);
      });
      await flush();
      expect(result.current.isLoadingMore).toBe(false);
    });

    it('defers to a loadMore that starts while a poll request is still in flight, instead of clobbering its appended page', async () => {
      let resolvePoll!: (page: ListScheduledTaskRunsResponseDto) => void;
      const pollRequest = new Promise<ListScheduledTaskRunsResponseDto>(
        (resolve) => {
          resolvePoll = resolve;
        },
      );
      const listScheduledTaskRuns = vi
        .fn<ScheduledTasksApiClient['listScheduledTaskRuns']>()
        .mockResolvedValueOnce({
          items: [
            makeRun({
              id: 'run-1',
              status: ScheduledTaskRunDtoStatusEnum.InProgress,
            }),
          ],
          next: 'next',
          count: 5,
        } as ListScheduledTaskRunsResponseDto)
        .mockReturnValueOnce(pollRequest)
        .mockResolvedValueOnce({
          items: [makeRun({ id: 'run-2' })],
          next: null,
        } as ListScheduledTaskRunsResponseDto);
      const client = makeClient(listScheduledTaskRuns);

      const { result } = renderHook(() =>
        useScheduledTaskRuns(client, { scheduleId: 'sched' }),
      );
      await flush();

      // The poll tick's request is now in flight (call 2, pending).
      act(() => {
        vi.advanceTimersByTime(15_000);
      });
      expect(listScheduledTaskRuns).toHaveBeenCalledTimes(2);

      /* loadMore starts — synchronously flips isLoadingMore — while the poll
         request is still pending, then resolves (call 3). */
      await act(async () => {
        result.current.loadMore();
      });
      expect(listScheduledTaskRuns).toHaveBeenCalledTimes(3);
      await flush();
      expect(result.current.items.map((run) => run.id)).toEqual([
        'run-1',
        'run-2',
      ]);

      /* The stale poll response now resolves; it must defer rather than
         overwrite loadMore's appended page with a merge computed before it. */
      await act(async () => {
        resolvePoll({
          items: [
            makeRun({
              id: 'run-1',
              status: ScheduledTaskRunDtoStatusEnum.Success,
            }),
          ],
          next: null,
        } as ListScheduledTaskRunsResponseDto);
      });
      await flush();
      expect(result.current.items.map((run) => run.id)).toEqual([
        'run-1',
        'run-2',
      ]);
    });

    it('leaves items and error state untouched when a background refresh fails, and retries on the next tick', async () => {
      const listScheduledTaskRuns = vi
        .fn<ScheduledTasksApiClient['listScheduledTaskRuns']>()
        .mockResolvedValueOnce({
          items: [
            makeRun({
              id: 'run-1',
              status: ScheduledTaskRunDtoStatusEnum.InProgress,
            }),
          ],
          next: null,
        } as ListScheduledTaskRunsResponseDto)
        .mockRejectedValueOnce(new Error('network blip'))
        .mockResolvedValue({
          items: [
            makeRun({
              id: 'run-1',
              status: ScheduledTaskRunDtoStatusEnum.Success,
            }),
          ],
          next: null,
        } as ListScheduledTaskRunsResponseDto);
      const client = makeClient(listScheduledTaskRuns);

      const { result } = renderHook(() =>
        useScheduledTaskRuns(client, { scheduleId: 'sched' }),
      );
      await flush();
      const itemsBeforeFailure = result.current.items;

      await advance(15_000);
      expect(result.current.items).toEqual(itemsBeforeFailure);
      expect(result.current.initialError).toBeNull();
      expect(result.current.loadMoreError).toBeNull();

      await advance(15_000);
      expect(result.current.items[0].status).toBe(
        ScheduledTaskRunDtoStatusEnum.Success,
      );
    });

    it('clears the poll interval and one-shot timeout, and aborts an in-flight background request, on unmount', async () => {
      const pollRequest = new Promise<ListScheduledTaskRunsResponseDto>(() => {
        // never resolves — asserts the request is aborted, not resolved
      });
      const listScheduledTaskRuns = vi
        .fn<ScheduledTasksApiClient['listScheduledTaskRuns']>()
        .mockResolvedValueOnce({
          items: [
            makeRun({
              id: 'run-1',
              status: ScheduledTaskRunDtoStatusEnum.InProgress,
            }),
          ],
          next: null,
        } as ListScheduledTaskRunsResponseDto)
        .mockReturnValueOnce(pollRequest);
      const client = makeClient(listScheduledTaskRuns);

      const { unmount } = renderHook(() =>
        useScheduledTaskRuns(client, { scheduleId: 'sched' }),
      );
      await flush();

      act(() => {
        vi.advanceTimersByTime(15_000);
      });
      const capturedSignal = listScheduledTaskRuns.mock.calls[1]?.[0].signal;
      expect(capturedSignal?.aborted).toBe(false);

      unmount();
      expect(capturedSignal?.aborted).toBe(true);

      await advance(60_000);
      expect(listScheduledTaskRuns).toHaveBeenCalledTimes(2);
    });
  });
});
