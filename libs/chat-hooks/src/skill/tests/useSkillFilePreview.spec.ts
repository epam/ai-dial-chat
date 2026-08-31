import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SkillFileContent } from '../skill-file-preview';
import {
  SkillPreviewErrorKind,
  useSkillFilePreview,
} from '../useSkillFilePreview';

const makeContent = (): SkillFileContent => ({
  bytes: new Uint8Array([1, 2, 3]),
  mimeType: 'text/plain',
});

describe('useSkillFilePreview', () => {
  const onLoadFile = vi.fn<(fileId: string) => Promise<SkillFileContent>>();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts in loading state before the promise resolves', () => {
    onLoadFile.mockReturnValue(new Promise(() => undefined));

    const { result } = renderHook(() =>
      useSkillFilePreview({ fileId: 'file-1', onLoadFile }),
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.content).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('returns content and clears loading after a successful load', async () => {
    const content = makeContent();
    onLoadFile.mockResolvedValue(content);

    const { result } = renderHook(() =>
      useSkillFilePreview({ fileId: 'file-1', onLoadFile }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.content).toBe(content);
    expect(result.current.error).toBeNull();
  });

  it('classifies a 403 rejection as Forbidden', async () => {
    onLoadFile.mockRejectedValue({ status: 403 });

    const { result } = renderHook(() =>
      useSkillFilePreview({ fileId: 'file-1', onLoadFile }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe(SkillPreviewErrorKind.Forbidden);
    expect(result.current.content).toBeNull();
  });

  it('classifies a non-403 rejection as Generic', async () => {
    onLoadFile.mockRejectedValue({ status: 500 });

    const { result } = renderHook(() =>
      useSkillFilePreview({ fileId: 'file-1', onLoadFile }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe(SkillPreviewErrorKind.Generic);
    expect(result.current.content).toBeNull();
  });

  it('classifies a rejection with no status as Generic', async () => {
    onLoadFile.mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() =>
      useSkillFilePreview({ fileId: 'file-1', onLoadFile }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe(SkillPreviewErrorKind.Generic);
  });

  it('resets state and triggers a new load when fileId changes', async () => {
    const content1 = makeContent();
    const content2: SkillFileContent = {
      bytes: new Uint8Array([9]),
      mimeType: 'application/json',
    };
    onLoadFile.mockResolvedValueOnce(content1).mockResolvedValueOnce(content2);

    const { result, rerender } = renderHook(
      ({ fileId }) => useSkillFilePreview({ fileId, onLoadFile }),
      { initialProps: { fileId: 'file-1' } },
    );

    await waitFor(() => expect(result.current.content).toBe(content1));

    rerender({ fileId: 'file-2' });

    /* State resets to loading on the new id. */
    expect(result.current.isLoading).toBe(true);
    expect(result.current.content).toBeNull();

    await waitFor(() => expect(result.current.content).toBe(content2));
    expect(onLoadFile).toHaveBeenCalledTimes(2);
    expect(onLoadFile).toHaveBeenNthCalledWith(1, 'file-1');
    expect(onLoadFile).toHaveBeenNthCalledWith(2, 'file-2');
  });

  it('does not update state after unmount', async () => {
    let settle: (v: SkillFileContent) => void = () => undefined;
    const deferred = new Promise<SkillFileContent>((res) => {
      settle = res;
    });
    onLoadFile.mockReturnValue(deferred);

    const { result, unmount } = renderHook(() =>
      useSkillFilePreview({ fileId: 'file-1', onLoadFile }),
    );

    unmount();
    settle(makeContent());

    await new Promise((resolve) => setTimeout(resolve, 0));

    /* State must remain in the loading snapshot captured before unmount. */
    expect(result.current.isLoading).toBe(true);
    expect(result.current.content).toBeNull();
  });

  it('discards the stale resolution when fileId changes before the first load settles', async () => {
    let settleFirst: (v: SkillFileContent) => void = () => undefined;
    const firstDeferred = new Promise<SkillFileContent>((res) => {
      settleFirst = res;
    });
    const secondContent = makeContent();
    onLoadFile
      .mockReturnValueOnce(firstDeferred)
      .mockResolvedValueOnce(secondContent);

    const { result, rerender } = renderHook(
      ({ fileId }) => useSkillFilePreview({ fileId, onLoadFile }),
      { initialProps: { fileId: 'file-1' } },
    );

    /* Switch to file-2 before file-1 resolves. */
    rerender({ fileId: 'file-2' });

    await waitFor(() => expect(result.current.content).toBe(secondContent));

    /* Now resolve the stale first load — must not overwrite second content. */
    settleFirst({ bytes: new Uint8Array([0xff]), mimeType: 'image/png' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result.current.content).toBe(secondContent);
  });
});
