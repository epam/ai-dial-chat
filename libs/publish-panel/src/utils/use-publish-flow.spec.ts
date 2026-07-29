import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PublishFolderNode, PublishHistoryEntry } from '../models/publish';
import { PublishFlowItem, usePublishFlow } from './use-publish-flow';

const item: PublishFlowItem = {
  version: '4.0.1',
};

const folderItems: PublishFolderNode[] = [
  {
    path: ['Shared'],
    name: 'Shared',
    children: [{ path: ['Shared', 'Data Science'], name: 'Data Science' }],
  },
];

const history: PublishHistoryEntry[] = [
  {
    version: '4.0.1',
    publishedAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
    publishedBy: 'you',
    folderPath: ['Shared', 'Data Science'],
  },
];

describe('usePublishFlow', () => {
  it('starts with no folder selected and no existing version detected', () => {
    const { result } = renderHook(() =>
      usePublishFlow({
        item,
        history,
        folderItems,
        onPublish: vi.fn().mockResolvedValue(undefined),
      }),
    );

    expect(result.current.selectedFolderPath).toBeUndefined();
    expect(result.current.hasExistingPublicationInFolder).toBe(false);
    expect(result.current.hasWriteAccess).toBe(true);
  });

  it('detects an existing version once the matching folder is selected', () => {
    const { result } = renderHook(() =>
      usePublishFlow({
        item,
        history,
        folderItems,
        onPublish: vi.fn().mockResolvedValue(undefined),
      }),
    );

    act(() => {
      result.current.setSelectedFolderPath(['Shared', 'Data Science']);
    });

    expect(result.current.hasExistingPublicationInFolder).toBe(true);
  });

  it('does not flag an existing version for a different folder', () => {
    const { result } = renderHook(() =>
      usePublishFlow({
        item,
        history,
        folderItems,
        onPublish: vi.fn().mockResolvedValue(undefined),
      }),
    );

    act(() => {
      result.current.setSelectedFolderPath(['Shared']);
    });

    expect(result.current.hasExistingPublicationInFolder).toBe(false);
  });

  it('resolves hasWriteAccess from the provided predicate once a folder is selected', () => {
    const { result } = renderHook(() =>
      usePublishFlow({
        item,
        history,
        folderItems,
        hasWriteAccess: (path) => !path.includes('Production'),
        onPublish: vi.fn().mockResolvedValue(undefined),
      }),
    );

    act(() => {
      result.current.setSelectedFolderPath(['Shared', 'Production']);
    });

    expect(result.current.hasWriteAccess).toBe(false);
  });

  it('treats [] (bucket root) as a valid selection, distinct from undefined', () => {
    const onPublish = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      usePublishFlow({ item, history, folderItems, onPublish }),
    );

    act(() => {
      result.current.setSelectedFolderPath([]);
    });

    expect(result.current.selectedFolderPath).toEqual([]);
    expect(result.current.hasWriteAccess).toBe(true);
  });

  it('submits to the root when [] is selected', async () => {
    const onPublish = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      usePublishFlow({ item, history, folderItems, onPublish }),
    );

    act(() => {
      result.current.setSelectedFolderPath([]);
    });
    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(onPublish).toHaveBeenCalledWith(item, []);
  });

  it('adds a locally created folder and reports it to the host', () => {
    const onCreateFolder = vi.fn();
    const { result } = renderHook(() =>
      usePublishFlow({
        item,
        history,
        folderItems,
        onCreateFolder,
        onPublish: vi.fn().mockResolvedValue(undefined),
      }),
    );

    act(() => {
      result.current.handleCreateFolder(['Shared'], 'Releases');
    });

    expect(onCreateFolder).toHaveBeenCalledWith(['Shared'], 'Releases');
    expect(
      result.current.folderItems[0].children?.some(
        (child) => child.name === 'Releases',
      ),
    ).toBe(true);
  });

  it('rolls back the optimistic folder and sets hasSubmitError when onCreateFolder rejects', async () => {
    const onCreateFolder = vi
      .fn()
      .mockRejectedValue(new Error('create failed'));
    const { result } = renderHook(() =>
      usePublishFlow({
        item,
        history,
        folderItems,
        onCreateFolder,
        onPublish: vi.fn().mockResolvedValue(undefined),
      }),
    );

    await act(async () => {
      await result.current.handleCreateFolder(['Shared'], 'Releases');
    });

    expect(
      result.current.folderItems[0].children?.some(
        (child) => child.name === 'Releases',
      ),
    ).toBe(false);
    expect(result.current.hasSubmitError).toBe(true);
  });

  it('calls onPublish and onPublishSuccess with the item and selected folder path', async () => {
    const onPublish = vi.fn().mockResolvedValue(undefined);
    const onPublishSuccess = vi.fn();
    const { result } = renderHook(() =>
      usePublishFlow({
        item,
        history,
        folderItems,
        onPublish,
        onPublishSuccess,
      }),
    );

    act(() => {
      result.current.setSelectedFolderPath(['Shared']);
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(onPublish).toHaveBeenCalledWith(item, ['Shared']);
    expect(onPublishSuccess).toHaveBeenCalledWith(item, ['Shared']);
  });

  it('does nothing when submitting without a selected folder', async () => {
    const onPublish = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      usePublishFlow({ item, history, folderItems, onPublish }),
    );

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(onPublish).not.toHaveBeenCalled();
  });

  it('sets isSubmitting while the publish request is in flight', async () => {
    let resolvePublish: () => void = () => undefined;
    const onPublish = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvePublish = resolve;
        }),
    );
    const { result } = renderHook(() =>
      usePublishFlow({ item, history, folderItems, onPublish }),
    );

    act(() => {
      result.current.setSelectedFolderPath(['Shared']);
    });

    let submitPromise: Promise<boolean> = Promise.resolve(true);
    act(() => {
      submitPromise = result.current.handleSubmit();
    });

    expect(result.current.isSubmitting).toBe(true);

    await act(async () => {
      resolvePublish();
      await submitPromise;
    });

    expect(result.current.isSubmitting).toBe(false);
  });

  it('sets hasSubmitError and resolves handleSubmit to false when onPublish rejects', async () => {
    const onPublish = vi.fn().mockRejectedValue(new Error('network error'));
    const onPublishSuccess = vi.fn();
    const { result } = renderHook(() =>
      usePublishFlow({
        item,
        history,
        folderItems,
        onPublish,
        onPublishSuccess,
      }),
    );

    act(() => {
      result.current.setSelectedFolderPath(['Shared']);
    });

    let isSuccess = true;
    await act(async () => {
      isSuccess = await result.current.handleSubmit();
    });

    expect(isSuccess).toBe(false);
    expect(result.current.hasSubmitError).toBe(true);
    expect(result.current.isSubmitting).toBe(false);
    expect(onPublishSuccess).not.toHaveBeenCalled();
  });

  it('clears hasSubmitError on reset', async () => {
    const onPublish = vi.fn().mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() =>
      usePublishFlow({ item, history, folderItems, onPublish }),
    );

    act(() => {
      result.current.setSelectedFolderPath(['Shared']);
    });

    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(result.current.hasSubmitError).toBe(true);

    act(() => {
      result.current.reset();
    });

    expect(result.current.hasSubmitError).toBe(false);
  });

  it('re-syncs folderItems when the host-supplied folderItems prop changes (e.g. after a lazy fetch)', () => {
    const { result, rerender } = renderHook(
      ({ folderItems: items }) =>
        usePublishFlow({
          item,
          history,
          folderItems: items,
          onPublish: vi.fn().mockResolvedValue(undefined),
        }),
      { initialProps: { folderItems } },
    );

    expect(
      result.current.folderItems[0].children?.some(
        (child) => child.name === 'Data Science',
      ),
    ).toBe(true);

    const updatedFolderItems: PublishFolderNode[] = [
      {
        path: ['Shared'],
        name: 'Shared',
        children: [
          { path: ['Shared', 'Data Science'], name: 'Data Science' },
          { path: ['Shared', 'Newly Fetched'], name: 'Newly Fetched' },
        ],
      },
    ];
    rerender({ folderItems: updatedFolderItems });

    expect(
      result.current.folderItems[0].children?.some(
        (child) => child.name === 'Newly Fetched',
      ),
    ).toBe(true);
  });

  it('resets folder selection and locally created folders', () => {
    const { result } = renderHook(() =>
      usePublishFlow({
        item,
        history,
        folderItems,
        onPublish: vi.fn().mockResolvedValue(undefined),
      }),
    );

    act(() => {
      result.current.setSelectedFolderPath(['Shared']);
      result.current.handleCreateFolder(['Shared'], 'Releases');
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.selectedFolderPath).toBeUndefined();
    expect(
      result.current.folderItems[0].children?.some(
        (child) => child.name === 'Releases',
      ),
    ).toBe(false);
  });
});
