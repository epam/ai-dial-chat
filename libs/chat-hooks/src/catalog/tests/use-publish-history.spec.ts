import type { PublishHistoryEntry } from '@epam/ai-dial-publish-panel';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  usePublishHistory,
  type UsePublishHistoryOptions,
} from '../use-publish-history';

const entry = (folder: string): PublishHistoryEntry => ({
  publishedAt: 1,
  folderPath: [folder],
});
const deferred = <T>() => {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const loadHistory = vi.fn<UsePublishHistoryOptions['loadHistory']>();

const render = (isOpen: boolean, entityId = 'projects/a/q4') =>
  renderHook(
    (props: { isOpen: boolean; entityId: string }) =>
      usePublishHistory({ ...props, loadHistory }),
    { initialProps: { isOpen, entityId } },
  );

describe('usePublishHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads the history of the entity when the panel opens', async () => {
    loadHistory.mockResolvedValue([entry('Team')]);

    const { result } = render(true);

    await waitFor(() => expect(result.current).toEqual([entry('Team')]));
    expect(loadHistory).toHaveBeenCalledWith('projects/a/q4');
  });

  it('reads again on every open, so a publication since the last one shows', async () => {
    loadHistory.mockResolvedValueOnce([]).mockResolvedValueOnce([entry('New')]);
    const { result, rerender } = render(true);
    await waitFor(() => expect(loadHistory).toHaveBeenCalledOnce());

    rerender({ isOpen: false, entityId: 'projects/a/q4' });
    rerender({ isOpen: true, entityId: 'projects/a/q4' });

    await waitFor(() => expect(result.current).toEqual([entry('New')]));
    expect(loadHistory).toHaveBeenCalledTimes(2);
  });

  it('ignores a result that arrives after the panel closed', async () => {
    const pending = deferred<PublishHistoryEntry[]>();
    loadHistory.mockReturnValue(pending.promise);
    const { result, rerender } = render(true);

    rerender({ isOpen: false, entityId: 'projects/a/q4' });
    await act(async () => pending.resolve([entry('Late')]));

    expect(result.current).toEqual([]);
  });

  it('ignores a result that arrives after the entity changed', async () => {
    const first = deferred<PublishHistoryEntry[]>();
    loadHistory
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce([entry('Other')]);
    const { result, rerender } = render(true, 'projects/a/q4');

    rerender({ isOpen: true, entityId: 'projects/a/other' });
    await waitFor(() => expect(result.current).toEqual([entry('Other')]));
    await act(async () => first.resolve([entry('Stale')]));

    expect(result.current).toEqual([entry('Other')]);
  });

  it('shows an empty history when the read fails', async () => {
    loadHistory
      .mockResolvedValueOnce([entry('Team')])
      .mockRejectedValueOnce(new Error('offline'));
    const { result, rerender } = render(true);
    await waitFor(() => expect(result.current).toEqual([entry('Team')]));

    rerender({ isOpen: false, entityId: 'projects/a/q4' });
    rerender({ isOpen: true, entityId: 'projects/a/q4' });

    await waitFor(() => expect(result.current).toEqual([]));
  });
});
