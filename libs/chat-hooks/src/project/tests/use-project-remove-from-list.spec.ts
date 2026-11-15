import {
  ProjectSource,
  type ProjectDetailsDto,
} from '@epam/ai-dial-chat-api-client';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProjectRemoveFromList } from '../use-project-remove-from-list';

const project: ProjectDetailsDto = {
  id: 'projects/owner/q4',
  name: 'q4',
  bucket: 'owner',
  path: 'q4',
  source: ProjectSource.Shared,
  description: '',
  instructions: '',
  contextFiles: [],
  etag: '"e1"',
  contentVersion: '"cv1"',
  conversationCount: 0,
  canEdit: false,
  canManage: false,
};

const makeHandlers = () => ({
  discardShared: vi.fn().mockResolvedValue({ success: true }),
  setPinned: vi.fn().mockResolvedValue(undefined),
  onUnpinFailed: vi.fn(),
  onRemoved: vi.fn(),
  onError: vi.fn(),
  onSettled: vi.fn(),
});

describe('useProjectRemoveFromList', () => {
  let handlers: ReturnType<typeof makeHandlers>;

  beforeEach(() => {
    handlers = makeHandlers();
  });

  it('discards the share, unpins and reports the removal after settling', async () => {
    const { result } = renderHook(() =>
      useProjectRemoveFromList(project, handlers),
    );

    await act(() => result.current.confirmRemove());

    expect(handlers.discardShared).toHaveBeenCalledOnce();
    expect(handlers.discardShared).toHaveBeenCalledWith('projects/owner/q4');
    expect(handlers.setPinned).toHaveBeenCalledWith('projects/owner/q4', false);
    expect(handlers.onSettled).toHaveBeenCalledOnce();
    expect(handlers.onRemoved).toHaveBeenCalledWith(project);
    expect(handlers.onSettled.mock.invocationCallOrder[0]).toBeLessThan(
      handlers.onRemoved.mock.invocationCallOrder[0],
    );
    expect(handlers.onError).not.toHaveBeenCalled();
    expect(result.current.isRemoving).toBe(false);
  });

  it('still reports the removal when the unpin cannot be saved', async () => {
    handlers.setPinned.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() =>
      useProjectRemoveFromList(project, handlers),
    );

    await act(() => result.current.confirmRemove());

    expect(handlers.onUnpinFailed).toHaveBeenCalledWith(project);
    expect(handlers.onRemoved).toHaveBeenCalledOnce();
    expect(handlers.onError).not.toHaveBeenCalled();
  });

  it('reports the failure and changes nothing else when the discard rejects', async () => {
    handlers.discardShared.mockRejectedValue(new Error('403'));
    const { result } = renderHook(() =>
      useProjectRemoveFromList(project, handlers),
    );

    await act(() => result.current.confirmRemove());

    expect(handlers.onError).toHaveBeenCalledWith(project, undefined);
    expect(handlers.setPinned).not.toHaveBeenCalled();
    expect(handlers.onRemoved).not.toHaveBeenCalled();
    expect(handlers.onSettled).toHaveBeenCalledOnce();
    expect(result.current.isRemoving).toBe(false);
  });

  it('sends one request when confirmed twice while pending', async () => {
    let resolve: (value: unknown) => void = () => undefined;
    handlers.discardShared.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const { result } = renderHook(() =>
      useProjectRemoveFromList(project, handlers),
    );

    let first!: Promise<void>;
    await act(async () => {
      first = result.current.confirmRemove();
      await result.current.confirmRemove();
    });
    expect(result.current.isRemoving).toBe(true);
    await act(async () => {
      resolve({ success: true });
      await first;
    });

    expect(handlers.discardShared).toHaveBeenCalledOnce();
  });

  it('does nothing without a project', async () => {
    const { result } = renderHook(() =>
      useProjectRemoveFromList(null, handlers),
    );

    await act(() => result.current.confirmRemove());

    expect(handlers.discardShared).not.toHaveBeenCalled();
  });
});
