import { SkillFileNodeKind } from '@epam/ai-dial-skill-editor';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  useSkillFilePreviewSyncController,
  SkillFilePreviewState,
  type SkillFilePreviewSyncOptions,
} from '../useSkillFilePreviewSyncController';

const setup = () => {
  let token = 0;
  const beginRequest = () => {
    const id = ++token;
    return () => id === token;
  };
  const options: SkillFilePreviewSyncOptions = {
    node: { name: 'a.txt', path: 'a.txt', kind: SkillFileNodeKind.File },
    content: { bytes: new Uint8Array([1]), mimeType: 'text/plain' },
    canvasAttachmentId: 'resource-a',
    contentRevision: 0,
    isCanvasOpen: false,
    isCanvasLoading: false,
    beginRequest,
    openAttachmentCanvas: vi.fn().mockResolvedValue(true),
    closeCanvas: vi.fn(),
  };
  return options;
};
describe('skill preview controller', () => {
  it('reopens on content revision and resource replacement', async () => {
    const options = setup();
    const { rerender } = renderHook(
      (props) => useSkillFilePreviewSyncController(props),
      { initialProps: options },
    );
    await waitFor(() =>
      expect(options.openAttachmentCanvas).toHaveBeenCalledTimes(1),
    );
    rerender({ ...options, contentRevision: 1 });
    await waitFor(() =>
      expect(options.openAttachmentCanvas).toHaveBeenCalledTimes(2),
    );
    rerender({ ...options, canvasAttachmentId: 'resource-b' });
    await waitFor(() =>
      expect(options.openAttachmentCanvas).toHaveBeenCalledTimes(3),
    );
  });
  it('keeps failure stable until retry or a new revision', async () => {
    const options = setup();
    vi.mocked(options.openAttachmentCanvas).mockResolvedValue(false);
    const { result, rerender } = renderHook(
      (props) => useSkillFilePreviewSyncController(props),
      { initialProps: options },
    );
    await waitFor(() =>
      expect(result.current.state).toBe(SkillFilePreviewState.Error),
    );
    rerender({ ...options });
    expect(options.openAttachmentCanvas).toHaveBeenCalledTimes(1);
    act(() => result.current.retry());
    await waitFor(() =>
      expect(options.openAttachmentCanvas).toHaveBeenCalledTimes(2),
    );
    rerender({ ...options, contentRevision: 1 });
    await waitFor(() =>
      expect(options.openAttachmentCanvas).toHaveBeenCalledTimes(3),
    );
  });
  it('does not close or commit over a newer foreign canvas owner', async () => {
    const options = setup();
    let settle!: (value: boolean) => void;
    vi.mocked(options.openAttachmentCanvas).mockImplementation(
      () =>
        new Promise((resolve) => {
          settle = resolve;
        }),
    );
    const { result, unmount } = renderHook(() =>
      useSkillFilePreviewSyncController(options),
    );
    const guard = vi.mocked(options.openAttachmentCanvas).mock.calls[0][2];
    options.beginRequest();
    expect(guard()).toBe(false);
    await act(async () => settle(false));
    expect(result.current.state).not.toBe(SkillFilePreviewState.Error);
    unmount();
    expect(options.closeCanvas).not.toHaveBeenCalled();
  });
  it('retires a pending request when selection becomes empty', () => {
    const options = setup();
    const { result, rerender } = renderHook(
      (props) => useSkillFilePreviewSyncController(props),
      { initialProps: options },
    );
    const guard = vi.mocked(options.openAttachmentCanvas).mock.calls[0][2];
    rerender({ ...options, node: undefined });
    expect(guard()).toBe(false);
    expect(options.closeCanvas).toHaveBeenCalledOnce();
    expect(result.current.state).toBe(SkillFilePreviewState.Idle);
  });

  it('retires A to B to A requests and its final request on unmount', () => {
    const options = setup();
    const { rerender, unmount } = renderHook(
      (props) => useSkillFilePreviewSyncController(props),
      { initialProps: options },
    );
    const first = vi.mocked(options.openAttachmentCanvas).mock.calls[0][2];
    rerender({ ...options, canvasAttachmentId: 'b' });
    const second = vi.mocked(options.openAttachmentCanvas).mock.calls[1][2];
    rerender({ ...options });
    const third = vi.mocked(options.openAttachmentCanvas).mock.calls[2][2];
    expect(first()).toBe(false);
    expect(second()).toBe(false);
    expect(third()).toBe(true);
    unmount();
    expect(third()).toBe(false);
    expect(options.closeCanvas).toHaveBeenCalledOnce();
  });
});
