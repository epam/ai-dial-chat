import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useScheduledTaskRuns } from '../use-scheduled-task-runs';

describe('shared useScheduledTaskRuns', () => {
  it('discards a response from a replaced schedule identity', async () => {
    let resolveFirst!: (page: { items: { id: string }[]; next: null }) => void;
    const listScheduledTaskRuns = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    const client = { listScheduledTaskRuns };
    const { result, rerender } = renderHook(
      ({ scheduleId }) => useScheduledTaskRuns(client as never, { scheduleId }),
      { initialProps: { scheduleId: 'old' } },
    );
    rerender({ scheduleId: 'new' });
    resolveFirst({ items: [{ id: 'old-run' }], next: null });
    await waitFor(() => expect(result.current.items).toEqual([]));
  });
});
