import {
  ScheduledTaskRunDtoStatusEnum,
  type ScheduledTaskRunDto,
} from '@epam/ai-dial-chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  mergeScheduledTaskRuns,
  ScheduledTaskRunStatusFeedback,
  useStartScheduledTask,
} from '../useStartScheduledTask';

const startScheduledTaskMock = vi.fn();
const getScheduledTaskRunMock = vi.fn();

vi.mock('../../../server-api/scheduled-tasks.api', () => ({
  startScheduledTask: (scheduleId: string) =>
    startScheduledTaskMock(scheduleId),
  getScheduledTaskRun: (
    scheduleId: string,
    runId: string,
    signal: AbortSignal,
  ) => getScheduledTaskRunMock(scheduleId, runId, signal),
}));

const inProgressRun: ScheduledTaskRunDto = {
  id: 'run_1',
  status: ScheduledTaskRunDtoStatusEnum.InProgress,
  startTime: '2026-09-30T09:00:00Z',
};

const flushEffects = async (): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('useStartScheduledTask', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    startScheduledTaskMock.mockReset();
    getScheduledTaskRunMock.mockReset();
    vi.useRealTimers();
  });

  it('sends one request during a synchronous double activation and retains its accepted run', async () => {
    startScheduledTaskMock.mockResolvedValue(inProgressRun);
    const { result } = renderHook(() =>
      useStartScheduledTask({
        scheduleId: 'sched_123',
        enabled: true,
        canStart: true,
      }),
    );

    await act(async () => {
      await Promise.all([result.current.start(), result.current.start()]);
    });

    expect(startScheduledTaskMock).toHaveBeenCalledTimes(1);
    expect(startScheduledTaskMock).toHaveBeenCalledWith('sched_123');
    expect(result.current.acceptedRuns).toEqual([inProgressRun]);
    expect(result.current.isStarting).toBe(false);
  });

  it('ignores an accepted response after navigation to another task', async () => {
    let resolveStart: (run: ScheduledTaskRunDto) => void;
    startScheduledTaskMock.mockReturnValue(
      new Promise<ScheduledTaskRunDto>((resolve) => {
        resolveStart = resolve;
      }),
    );
    const { result, rerender } = renderHook(
      ({ scheduleId }) =>
        useStartScheduledTask({ scheduleId, enabled: true, canStart: true }),
      { initialProps: { scheduleId: 'sched_123' } },
    );

    act(() => {
      void result.current.start();
    });
    rerender({ scheduleId: 'sched_456' });
    await act(async () => resolveStart(inProgressRun));

    await waitFor(() => expect(result.current.isStarting).toBe(false));
    expect(result.current.acceptedRuns).toEqual([]);
  });

  it('does not start an ineligible schedule', async () => {
    const { result } = renderHook(() =>
      useStartScheduledTask({
        scheduleId: 'sched_123',
        enabled: true,
        canStart: false,
      }),
    );

    await act(async () => expect(await result.current.start()).toBeUndefined());

    expect(startScheduledTaskMock).not.toHaveBeenCalled();
  });

  it.each(['accepted', 'rejected'])(
    'ignores a %s POST after unmount',
    async (outcome) => {
      let resolve!: (run: ScheduledTaskRunDto) => void;
      let reject!: (error: Error) => void;
      startScheduledTaskMock.mockReturnValue(
        new Promise<ScheduledTaskRunDto>((yes, no) => {
          resolve = yes;
          reject = no;
        }),
      );
      const { result, unmount } = renderHook(() =>
        useStartScheduledTask({
          scheduleId: 'sched_123',
          enabled: true,
          canStart: true,
        }),
      );
      let pending!: ReturnType<typeof result.current.start>;
      act(() => {
        pending = result.current.start();
      });
      unmount();
      await act(async () => {
        if (outcome === 'accepted') resolve(inProgressRun);
        else reject(new Error('late failure'));
        expect(await pending).toBeUndefined();
      });
    },
  );

  it('ignores a rejected POST after the feature is disabled', async () => {
    let reject!: (error: Error) => void;
    startScheduledTaskMock.mockReturnValue(
      new Promise((_resolve, no) => {
        reject = no;
      }),
    );
    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useStartScheduledTask({
          scheduleId: 'sched_123',
          enabled,
          canStart: true,
        }),
      { initialProps: { enabled: true } },
    );
    let pending!: ReturnType<typeof result.current.start>;
    act(() => {
      pending = result.current.start();
    });
    rerender({ enabled: false });
    await act(async () => {
      reject(new Error('late failure'));
      expect(await pending).toBeUndefined();
    });
  });

  it('retains the catch-up GET result when an earlier polling timer would fire', async () => {
    vi.useFakeTimers();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    startScheduledTaskMock.mockResolvedValue(inProgressRun);
    let resolve!: (run: ScheduledTaskRunDto) => void;
    getScheduledTaskRunMock.mockReturnValue(
      new Promise<ScheduledTaskRunDto>((yes) => {
        resolve = yes;
      }),
    );
    const { result } = renderHook(() =>
      useStartScheduledTask({
        scheduleId: 'sched_123',
        enabled: true,
        canStart: true,
      }),
    );
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(getScheduledTaskRunMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    await act(async () => {
      resolve({
        ...inProgressRun,
        status: ScheduledTaskRunDtoStatusEnum.Success,
      });
    });
    expect(result.current.acceptedRuns[0].status).toBe(
      ScheduledTaskRunDtoStatusEnum.Success,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(70_000);
    });
    expect(getScheduledTaskRunMock).toHaveBeenCalledTimes(1);
    expect(result.current.statusFeedback).toBeUndefined();
  });

  it('aborts a pending status read at the deadline and ignores its late result', async () => {
    vi.useFakeTimers();
    startScheduledTaskMock.mockResolvedValue(inProgressRun);
    let resolve!: (run: ScheduledTaskRunDto) => void;
    getScheduledTaskRunMock.mockReturnValue(
      new Promise<ScheduledTaskRunDto>((yes) => {
        resolve = yes;
      }),
    );
    const { result } = renderHook(() =>
      useStartScheduledTask({
        scheduleId: 'sched_123',
        enabled: true,
        canStart: true,
      }),
    );
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(68_000);
    });
    expect(result.current.statusFeedback).toBe('delayed');
    expect(result.current.isRefreshingStatus).toBe(false);
    expect(
      (getScheduledTaskRunMock.mock.calls[0][2] as AbortSignal).aborted,
    ).toBe(true);
    await act(async () => {
      resolve({
        ...inProgressRun,
        status: ScheduledTaskRunDtoStatusEnum.Success,
      });
    });
    expect(result.current.acceptedRuns).toEqual([inProgressRun]);
    getScheduledTaskRunMock.mockResolvedValue({
      ...inProgressRun,
      status: ScheduledTaskRunDtoStatusEnum.Success,
    });
    await act(async () => result.current.refreshStatus());
    expect(result.current.acceptedRuns[0].status).toBe(
      ScheduledTaskRunDtoStatusEnum.Success,
    );
    expect(startScheduledTaskMock).toHaveBeenCalledTimes(1);
  });

  it('blocks a known history run but permits another start after its polled completion', async () => {
    vi.useFakeTimers();
    startScheduledTaskMock.mockResolvedValue(inProgressRun);
    getScheduledTaskRunMock.mockResolvedValue({
      ...inProgressRun,
      status: ScheduledTaskRunDtoStatusEnum.Success,
    });
    const { result, rerender } = renderHook(
      ({ loadedRuns }) =>
        useStartScheduledTask({
          scheduleId: 'sched_123',
          enabled: true,
          canStart: true,
          loadedRuns,
        }),
      { initialProps: { loadedRuns: [inProgressRun] } },
    );
    await act(async () => {
      expect(await result.current.start()).toBeUndefined();
    });
    expect(startScheduledTaskMock).not.toHaveBeenCalled();
    rerender({ loadedRuns: [] });
    await act(async () => {
      await result.current.start();
    });
    rerender({ loadedRuns: [inProgressRun] });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    startScheduledTaskMock.mockResolvedValue({ ...inProgressRun, id: 'run_2' });
    await act(async () => {
      await result.current.start();
    });
    expect(startScheduledTaskMock).toHaveBeenCalledTimes(2);
    expect(result.current.acceptedRuns.map((run) => run.id)).toEqual([
      'run_2',
      'run_1',
    ]);
  });

  it('polls an accepted in-progress run once every two seconds and stops on a terminal response', async () => {
    vi.useFakeTimers();
    startScheduledTaskMock.mockResolvedValue(inProgressRun);
    const completedRun: ScheduledTaskRunDto = {
      ...inProgressRun,
      status: ScheduledTaskRunDtoStatusEnum.Success,
      endTime: '2026-09-30T09:00:01Z',
    };
    getScheduledTaskRunMock.mockResolvedValue(completedRun);
    const { result } = renderHook(() =>
      useStartScheduledTask({
        scheduleId: 'sched_123',
        enabled: true,
        canStart: true,
      }),
    );

    await act(async () => {
      await result.current.start();
      await vi.advanceTimersByTimeAsync(2_000);
    });
    await flushEffects();

    expect(getScheduledTaskRunMock).toHaveBeenCalledWith(
      'sched_123',
      'run_1',
      expect.any(AbortSignal),
    );
    expect(result.current.acceptedRuns).toEqual([completedRun]);
    expect(result.current.terminalRun).toEqual(completedRun);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(getScheduledTaskRunMock).toHaveBeenCalledTimes(1);
  });

  it('does not overlap status GET requests and aborts a stale request on navigation', async () => {
    vi.useFakeTimers();
    startScheduledTaskMock.mockResolvedValue(inProgressRun);
    let resolveRun: (run: ScheduledTaskRunDto) => void;
    getScheduledTaskRunMock.mockReturnValue(
      new Promise<ScheduledTaskRunDto>((resolve) => {
        resolveRun = resolve;
      }),
    );
    const { result, rerender } = renderHook(
      ({ scheduleId }) =>
        useStartScheduledTask({ scheduleId, enabled: true, canStart: true }),
      { initialProps: { scheduleId: 'sched_123' } },
    );

    await act(async () => {
      await result.current.start();
      await vi.advanceTimersByTimeAsync(4_000);
    });
    expect(getScheduledTaskRunMock).toHaveBeenCalledTimes(1);

    const signal = getScheduledTaskRunMock.mock.calls[0]?.[2] as AbortSignal;
    rerender({ scheduleId: 'sched_456' });
    expect(signal.aborted).toBe(true);

    await act(async () => resolveRun(inProgressRun));
    expect(result.current.acceptedRuns).toEqual([]);
  });

  it('honors Retry-After for a transient polling failure without retrying POST', async () => {
    vi.useFakeTimers();
    startScheduledTaskMock.mockResolvedValue(inProgressRun);
    getScheduledTaskRunMock
      .mockRejectedValueOnce({
        response: new Response(null, {
          status: 429,
          headers: { 'Retry-After': '4' },
        }),
      })
      .mockResolvedValue(inProgressRun);
    const { result } = renderHook(() =>
      useStartScheduledTask({
        scheduleId: 'sched_123',
        enabled: true,
        canStart: true,
      }),
    );

    await act(async () => {
      await result.current.start();
      await vi.advanceTimersByTimeAsync(2_000);
    });
    await flushEffects();
    expect(result.current.statusFeedback).toBe('unavailable');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_999);
    });
    expect(getScheduledTaskRunMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(getScheduledTaskRunMock).toHaveBeenCalledTimes(2);
    expect(startScheduledTaskMock).toHaveBeenCalledTimes(1);
  });

  it.each(['seconds', 'date'])(
    'does not bypass a Retry-After %s backoff on visibility or manual refresh',
    async (format) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-30T10:00:00Z'));
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
      startScheduledTaskMock.mockResolvedValue(inProgressRun);
      getScheduledTaskRunMock
        .mockRejectedValueOnce({
          response: new Response(null, {
            status: 429,
            headers: {
              'Retry-After':
                format === 'seconds' ? '4' : 'Wed, 30 Sep 2026 10:00:06 GMT',
            },
          }),
        })
        .mockResolvedValue(inProgressRun);
      const { result } = renderHook(() =>
        useStartScheduledTask({
          scheduleId: 'sched_123',
          enabled: true,
          canStart: true,
        }),
      );
      await act(async () => {
        await result.current.start();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000);
      });
      await flushEffects();
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
        result.current.refreshStatus();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3_999);
      });
      expect(getScheduledTaskRunMock).toHaveBeenCalledTimes(1);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(getScheduledTaskRunMock).toHaveBeenCalledTimes(2);
      expect(result.current.statusFeedback).toBeUndefined();
      expect(startScheduledTaskMock).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['seconds', 'date'])(
    'allows a manual GET after a Retry-After %s delay beyond the polling deadline expires',
    async (format) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-30T10:00:00Z'));
      startScheduledTaskMock.mockResolvedValue(inProgressRun);
      const completedRun = {
        ...inProgressRun,
        status: ScheduledTaskRunDtoStatusEnum.Success,
      };
      getScheduledTaskRunMock
        .mockRejectedValueOnce({
          response: new Response(null, {
            status: 429,
            headers: {
              'Retry-After':
                format === 'seconds' ? '90' : 'Wed, 30 Sep 2026 10:01:32 GMT',
            },
          }),
        })
        .mockResolvedValue(completedRun);
      const { result } = renderHook(() =>
        useStartScheduledTask({
          scheduleId: 'sched_123',
          enabled: true,
          canStart: true,
        }),
      );
      await act(async () => {
        await result.current.start();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000);
      });
      await flushEffects();
      expect(result.current.statusFeedback).toBe(
        ScheduledTaskRunStatusFeedback.Delayed,
      );
      expect(result.current.isRefreshingStatus).toBe(false);

      await act(async () => result.current.refreshStatus());
      expect(getScheduledTaskRunMock).toHaveBeenCalledTimes(1);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(89_999);
        result.current.refreshStatus();
      });
      expect(getScheduledTaskRunMock).toHaveBeenCalledTimes(1);
      expect(result.current.acceptedRuns).toEqual([inProgressRun]);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(getScheduledTaskRunMock).toHaveBeenCalledTimes(1);
      await act(async () => result.current.refreshStatus());
      expect(getScheduledTaskRunMock).toHaveBeenCalledTimes(2);
      expect(result.current.acceptedRuns).toEqual([completedRun]);
      expect(result.current.statusFeedback).toBeUndefined();
      expect(startScheduledTaskMock).toHaveBeenCalledTimes(1);
    },
  );

  it.each([401, 403, 404])(
    'stops fast polling after a terminal status request error: %i',
    async (status) => {
      vi.useFakeTimers();
      startScheduledTaskMock.mockResolvedValue(inProgressRun);
      getScheduledTaskRunMock.mockRejectedValue({
        response: new Response(null, { status }),
      });
      const { result } = renderHook(() =>
        useStartScheduledTask({
          scheduleId: 'sched_123',
          enabled: true,
          canStart: true,
        }),
      );

      await act(async () => {
        await result.current.start();
        await vi.advanceTimersByTimeAsync(2_000);
        await vi.advanceTimersByTimeAsync(10_000);
      });
      await flushEffects();

      expect(result.current.statusFeedback).toBe('unavailable');
      expect(getScheduledTaskRunMock).toHaveBeenCalledTimes(1);
      expect(startScheduledTaskMock).toHaveBeenCalledTimes(1);
    },
  );

  it('pauses polling while hidden and performs one catch-up request when visible', async () => {
    vi.useFakeTimers();
    startScheduledTaskMock.mockResolvedValue(inProgressRun);
    getScheduledTaskRunMock.mockResolvedValue(inProgressRun);
    const visibilityDescriptor = Object.getOwnPropertyDescriptor(
      document,
      'visibilityState',
    );
    let isHidden = true;
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (isHidden ? 'hidden' : 'visible'),
    });
    const { result } = renderHook(() =>
      useStartScheduledTask({
        scheduleId: 'sched_123',
        enabled: true,
        canStart: true,
      }),
    );

    try {
      await act(async () => {
        await result.current.start();
        await vi.advanceTimersByTimeAsync(4_000);
      });
      expect(getScheduledTaskRunMock).not.toHaveBeenCalled();

      isHidden = false;
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(getScheduledTaskRunMock).toHaveBeenCalledTimes(1);
    } finally {
      if (visibilityDescriptor) {
        Object.defineProperty(
          document,
          'visibilityState',
          visibilityDescriptor,
        );
      } else {
        delete (document as { visibilityState?: string }).visibilityState;
      }
    }
  });

  it('keeps an in-progress row after its fast-polling deadline and refreshes it with GET only', async () => {
    vi.useFakeTimers();
    startScheduledTaskMock.mockResolvedValue(inProgressRun);
    getScheduledTaskRunMock.mockResolvedValue(inProgressRun);
    const { result } = renderHook(() =>
      useStartScheduledTask({
        scheduleId: 'sched_123',
        enabled: true,
        canStart: true,
      }),
    );

    await act(async () => {
      await result.current.start();
      await vi.advanceTimersByTimeAsync(70_000);
    });

    expect(result.current.acceptedRuns).toEqual([inProgressRun]);
    expect(result.current.statusFeedback).toBe('delayed');
    const callsAtDeadline = getScheduledTaskRunMock.mock.calls.length;

    await act(async () => {
      await result.current.refreshStatus();
    });
    expect(getScheduledTaskRunMock).toHaveBeenCalledTimes(callsAtDeadline + 1);
    expect(startScheduledTaskMock).toHaveBeenCalledTimes(1);
  });

  it('stops fast polling when ordinary history learns a terminal state', async () => {
    vi.useFakeTimers();
    startScheduledTaskMock.mockResolvedValue(inProgressRun);
    const completedRun: ScheduledTaskRunDto = {
      ...inProgressRun,
      status: ScheduledTaskRunDtoStatusEnum.Error,
      resultStage: 'credentials',
    };
    const { result, rerender } = renderHook(
      ({ loadedRuns }) =>
        useStartScheduledTask({
          scheduleId: 'sched_123',
          enabled: true,
          canStart: true,
          loadedRuns,
        }),
      { initialProps: { loadedRuns: [] as ScheduledTaskRunDto[] } },
    );

    await act(async () => result.current.start());
    rerender({ loadedRuns: [completedRun] });

    expect(result.current.terminalRun).toEqual(completedRun);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });
    expect(getScheduledTaskRunMock).not.toHaveBeenCalled();
  });
});

describe('mergeScheduledTaskRuns', () => {
  it('keeps accepted runs at the top, deduplicates ids, and preserves a terminal status', () => {
    const completedRun = {
      ...inProgressRun,
      status: ScheduledTaskRunDtoStatusEnum.Success,
      endTime: '2026-09-30T09:00:01Z',
    };

    expect(
      mergeScheduledTaskRuns(
        [inProgressRun],
        [completedRun, { ...inProgressRun, id: 'run_0' }],
      ),
    ).toEqual([completedRun, { ...inProgressRun, id: 'run_0' }]);
  });
});
