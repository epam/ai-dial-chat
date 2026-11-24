import { act, renderHook, waitFor } from '@testing-library/react';
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

    expect(onPublish).toHaveBeenCalledWith(item, [], '', false);
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

    expect(onPublish).toHaveBeenCalledWith(item, ['Shared'], '', false);
    expect(onPublishSuccess).toHaveBeenCalledWith(item, ['Shared'], false);
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

  it('calls onPublishError with the item, folder path, and rejection reason when onPublish rejects', async () => {
    const rejection = new Error('Failed to fetch');
    const onPublish = vi.fn().mockRejectedValue(rejection);
    const onPublishError = vi.fn();
    const { result } = renderHook(() =>
      usePublishFlow({
        item,
        history,
        folderItems,
        onPublish,
        onPublishError,
      }),
    );

    act(() => {
      result.current.setSelectedFolderPath(['Shared']);
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(onPublishError).toHaveBeenCalledOnce();
    expect(onPublishError).toHaveBeenCalledWith(item, ['Shared'], rejection);
  });

  it('does not call onPublishError when the publish request succeeds', async () => {
    const onPublishError = vi.fn();
    const { result } = renderHook(() =>
      usePublishFlow({
        item,
        history,
        folderItems,
        onPublish: vi.fn().mockResolvedValue(undefined),
        onPublishError,
      }),
    );

    act(() => {
      result.current.setSelectedFolderPath(['Shared']);
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(onPublishError).not.toHaveBeenCalled();
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

  it('starts with the credentials opt-in cleared', () => {
    const { result } = renderHook(() =>
      usePublishFlow({
        item,
        history,
        folderItems,
        onPublish: vi.fn().mockResolvedValue(undefined),
      }),
    );

    expect(result.current.publishCredentials).toBe(false);
  });

  /*
   * The legacy bug this guards ([#5074](https://github.com/epam/ai-dial-chat/issues/5074)): the option survived a publish and
   * the next open started with it already ticked.
   */
  it('clears the credentials opt-in on reset', () => {
    const { result } = renderHook(() =>
      usePublishFlow({
        item,
        history,
        folderItems,
        onPublish: vi.fn().mockResolvedValue(undefined),
      }),
    );

    act(() => {
      result.current.setPublishCredentials(true);
    });
    expect(result.current.publishCredentials).toBe(true);

    act(() => {
      result.current.reset();
    });

    expect(result.current.publishCredentials).toBe(false);
  });

  /* It is never pre-filled — selecting it is a deliberate act. */
  it('does not pre-select the option from a history entry that carried shared credentials', () => {
    const historyWithCredentials: PublishHistoryEntry[] = [
      {
        version: '4.0.1',
        publishedAt: Date.now(),
        folderPath: ['Shared'],
        publishCredentials: true,
      },
    ];
    const { result } = renderHook(() =>
      usePublishFlow({
        item,
        history: historyWithCredentials,
        folderItems,
        onPublish: vi.fn().mockResolvedValue(undefined),
      }),
    );

    act(() => {
      result.current.setSelectedFolderPath(['Shared']);
    });

    expect(result.current.hasExistingPublicationInFolder).toBe(true);
    expect(result.current.publishCredentials).toBe(false);
  });

  it('passes the credentials opt-in to onPublish as its fourth argument', async () => {
    const onPublish = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      usePublishFlow({ item, history, folderItems, onPublish }),
    );

    act(() => {
      result.current.setSelectedFolderPath(['Shared']);
      result.current.setPublishCredentials(true);
    });
    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(onPublish).toHaveBeenCalledWith(item, ['Shared'], '', true);
  });

  it('calls onPublish with the item, folder path, author and credentials opt-in in that order', async () => {
    const onPublish = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      usePublishFlow({ item, history, folderItems, onPublish }),
    );

    act(() => {
      result.current.setSelectedFolderPath(['Shared', 'Data Science']);
      result.current.setAuthor('DIAL Team');
      result.current.setPublishCredentials(true);
    });
    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(onPublish).toHaveBeenCalledOnce();
    expect(onPublish).toHaveBeenCalledWith(
      item,
      ['Shared', 'Data Science'],
      'DIAL Team',
      true,
    );
  });

  /* A three-parameter host callback stays assignable and simply ignores the credentials opt-in. */
  it('accepts a host callback that declares only the first three parameters', async () => {
    const onPublish = vi.fn(
      async (
        _item: PublishFlowItem,
        _folderPath: string[],
        _author: string,
      ): Promise<void> => undefined,
    );
    const { result } = renderHook(() =>
      usePublishFlow({ item, history, folderItems, onPublish }),
    );

    act(() => {
      result.current.setSelectedFolderPath(['Shared']);
    });
    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(onPublish).toHaveBeenCalledWith(item, ['Shared'], '', false);
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

  describe('target check', () => {
    const FREE_FOLDER = ['Shared'];
    const deferred = <T>() => {
      let resolve!: (value: T) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };
    const setup = (
      onCheckTargetExists: (
        item: PublishFlowItem,
        folderPath: string[],
      ) => Promise<boolean>,
      extra: Partial<Parameters<typeof usePublishFlow>[0]> = {},
      flowItem: PublishFlowItem = item,
    ) =>
      renderHook(
        ({ current }: { current: PublishFlowItem }) =>
          usePublishFlow({
            item: current,
            history,
            folderItems,
            onPublish: vi.fn().mockResolvedValue(undefined),
            onCheckTargetExists,
            ...extra,
          }),
        { initialProps: { current: flowItem } },
      );

    it('checks once when a folder is selected and reports the answer', async () => {
      const check = vi.fn().mockResolvedValue(true);
      const { result } = setup(check);

      act(() => result.current.setSelectedFolderPath(FREE_FOLDER));

      expect(result.current.isTargetChecking).toBe(true);
      await waitFor(() => expect(result.current.isTargetTaken).toBe(true));
      expect(result.current.isTargetChecking).toBe(false);
      expect(check).toHaveBeenCalledTimes(1);
      expect(check).toHaveBeenCalledWith(item, FREE_FOLDER);
    });

    it('does not check while no folder is selected', () => {
      const check = vi.fn().mockResolvedValue(true);
      setup(check);

      expect(check).not.toHaveBeenCalled();
    });

    it('checks again when the item version changes', async () => {
      const check = vi.fn().mockResolvedValue(false);
      const { result, rerender } = setup(check);
      act(() => result.current.setSelectedFolderPath(FREE_FOLDER));
      await waitFor(() => expect(result.current.isTargetChecking).toBe(false));

      rerender({ current: { version: '5.0.0' } });

      await waitFor(() => expect(check).toHaveBeenCalledTimes(2));
      expect(check).toHaveBeenLastCalledWith({ version: '5.0.0' }, FREE_FOLDER);
    });

    it('discards an answer that arrives after another folder was selected', async () => {
      const first = deferred<boolean>();
      const check = vi
        .fn()
        .mockReturnValueOnce(first.promise)
        .mockResolvedValueOnce(false);
      const { result } = setup(check);

      act(() => result.current.setSelectedFolderPath(FREE_FOLDER));
      act(() =>
        result.current.setSelectedFolderPath(['Shared', 'Data Science']),
      );
      await act(async () => first.resolve(true));

      expect(result.current.isTargetTaken).toBe(false);
    });

    it('does not check a folder where the own history already holds the version', () => {
      const check = vi.fn().mockResolvedValue(true);
      const { result } = setup(check);

      act(() =>
        result.current.setSelectedFolderPath(['Shared', 'Data Science']),
      );

      expect(check).not.toHaveBeenCalled();
      expect(result.current.isTargetChecking).toBe(false);
    });

    it('does not check a folder created in this session or one beneath it', async () => {
      const check = vi.fn().mockResolvedValue(true);
      const { result } = setup(check, {
        onCreateFolder: vi.fn().mockResolvedValue(undefined),
      });

      await act(async () => {
        await result.current.handleCreateFolder(['Shared'], 'Fresh');
      });
      act(() => result.current.setSelectedFolderPath(['Shared', 'Fresh']));
      act(() =>
        result.current.setSelectedFolderPath(['Shared', 'Fresh', 'Inner']),
      );

      expect(check).not.toHaveBeenCalled();
      expect(result.current.isTargetTaken).toBe(false);
    });

    it('leaves submit unblocked and sets no submit error when the check rejects', async () => {
      const check = vi.fn().mockRejectedValue(new Error('offline'));
      const { result } = setup(check);

      act(() => result.current.setSelectedFolderPath(FREE_FOLDER));

      await waitFor(() => expect(result.current.isTargetChecking).toBe(false));
      expect(result.current.isTargetTaken).toBe(false);
      expect(result.current.hasSubmitError).toBe(false);
    });

    it('marks the target taken instead of a submit error when the host recognises the rejection', async () => {
      class TakenError extends Error {}
      const onPublishError = vi.fn();
      const { result } = setup(vi.fn().mockResolvedValue(false), {
        onPublish: vi.fn().mockRejectedValue(new TakenError()),
        isTargetTakenError: (error) => error instanceof TakenError,
        onPublishError,
      });
      act(() => result.current.setSelectedFolderPath(FREE_FOLDER));
      await waitFor(() => expect(result.current.isTargetChecking).toBe(false));

      let submitted = true;
      await act(async () => {
        submitted = await result.current.handleSubmit();
      });

      expect(submitted).toBe(false);
      expect(result.current.isTargetTaken).toBe(true);
      expect(result.current.hasSubmitError).toBe(false);
      expect(onPublishError).toHaveBeenCalledTimes(1);
    });

    it('keeps a generic submit error for a rejection the host does not recognise', async () => {
      const { result } = setup(vi.fn().mockResolvedValue(false), {
        onPublish: vi.fn().mockRejectedValue(new Error('boom')),
        isTargetTakenError: () => false,
      });
      act(() => result.current.setSelectedFolderPath(FREE_FOLDER));
      await waitFor(() => expect(result.current.isTargetChecking).toBe(false));

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(result.current.hasSubmitError).toBe(true);
      expect(result.current.isTargetTaken).toBe(false);
    });

    it('discards an answer that arrives after the item version changed', async () => {
      const first = deferred<boolean>();
      const check = vi
        .fn()
        .mockReturnValueOnce(first.promise)
        .mockResolvedValueOnce(false);
      const { result, rerender } = setup(check);
      act(() => result.current.setSelectedFolderPath(FREE_FOLDER));

      rerender({ current: { version: '5.0.0' } });
      await act(async () => first.resolve(true));

      expect(result.current.isTargetTaken).toBe(false);
    });

    it('never checks when the host supplies no check', () => {
      const { result } = renderHook(() =>
        usePublishFlow({
          item,
          history,
          folderItems,
          onPublish: vi.fn().mockResolvedValue(undefined),
        }),
      );

      act(() => result.current.setSelectedFolderPath(FREE_FOLDER));

      expect(result.current.isTargetChecking).toBe(false);
      expect(result.current.isTargetTaken).toBe(false);
    });

    it('checks a folder again after the host fails to create it', async () => {
      const check = vi.fn().mockResolvedValue(false);
      const { result } = setup(check, {
        onCreateFolder: vi.fn().mockRejectedValue(new Error('denied')),
      });

      await act(async () => {
        await result.current.handleCreateFolder(['Shared'], 'Fresh');
      });
      act(() => result.current.setSelectedFolderPath(['Shared', 'Fresh']));

      await waitFor(() => expect(check).toHaveBeenCalledTimes(1));
    });

    it('keeps a taken target found on submit when a later answer for the same folder is free', async () => {
      class TakenError extends Error {}
      const deferredCheck = deferred<boolean>();
      const check = vi
        .fn()
        .mockResolvedValueOnce(false)
        .mockReturnValue(deferredCheck.promise);
      const { result, rerender } = setup(check, {
        onPublish: vi.fn().mockRejectedValue(new TakenError()),
        isTargetTakenError: (error) => error instanceof TakenError,
      });
      act(() => result.current.setSelectedFolderPath(FREE_FOLDER));
      await waitFor(() => expect(result.current.isTargetChecking).toBe(false));
      await act(async () => {
        await result.current.handleSubmit();
      });
      expect(result.current.isTargetTaken).toBe(true);

      rerender({ current: { version: '5.0.0' } });
      rerender({ current: item });
      await act(async () => deferredCheck.resolve(false));

      expect(result.current.isTargetTaken).toBe(true);
    });

    it('does not carry a taken answer to another item with the same folder and version', async () => {
      const check = vi
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValue(false);
      const first = { id: 'applications/a/one', version: '1.0.0' };
      const { result, rerender } = setup(check, {}, first);
      act(() => result.current.setSelectedFolderPath(FREE_FOLDER));
      await waitFor(() => expect(result.current.isTargetTaken).toBe(true));

      rerender({ current: { id: 'applications/a/two', version: '1.0.0' } });

      await waitFor(() => expect(check).toHaveBeenCalledTimes(2));
      expect(check).toHaveBeenLastCalledWith(
        { id: 'applications/a/two', version: '1.0.0' },
        FREE_FOLDER,
      );
      await waitFor(() => expect(result.current.isTargetTaken).toBe(false));
    });

    it('clears the taken state on reset', async () => {
      const { result } = setup(vi.fn().mockResolvedValue(true));
      act(() => result.current.setSelectedFolderPath(FREE_FOLDER));
      await waitFor(() => expect(result.current.isTargetTaken).toBe(true));

      act(() => result.current.reset());

      expect(result.current.isTargetTaken).toBe(false);
      expect(result.current.isTargetChecking).toBe(false);
    });
  });

  describe('author', () => {
    const renderWithAuthor = (defaultAuthor?: string) =>
      renderHook(
        ({ author }: { author?: string }) =>
          usePublishFlow({
            item,
            history,
            folderItems,
            defaultAuthor: author,
            onPublish: vi.fn().mockResolvedValue(undefined),
          }),
        { initialProps: { author: defaultAuthor } },
      );

    it('seeds the author from defaultAuthor', () => {
      const { result } = renderWithAuthor('Daniil Pavlov');

      expect(result.current.author).toBe('Daniil Pavlov');
    });

    it('leaves the author empty when defaultAuthor is omitted', async () => {
      const onPublish = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        usePublishFlow({ item, history, folderItems, onPublish }),
      );

      expect(result.current.author).toBe('');

      act(() => {
        result.current.setSelectedFolderPath(['Shared']);
      });
      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(onPublish).toHaveBeenCalledWith(item, ['Shared'], '', false);
    });

    it('replaces an untouched author when defaultAuthor resolves later', () => {
      const { result, rerender } = renderWithAuthor('');

      rerender({ author: 'Daniil Pavlov' });

      expect(result.current.author).toBe('Daniil Pavlov');
    });

    it('does not overwrite an edited author when defaultAuthor changes', () => {
      const { result, rerender } = renderWithAuthor('Daniil Pavlov');

      act(() => {
        result.current.setAuthor('DIAL Team');
      });
      rerender({ author: 'Someone Else' });

      expect(result.current.author).toBe('DIAL Team');
    });

    it('forwards the trimmed author to onPublish', async () => {
      const onPublish = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        usePublishFlow({
          item,
          history,
          folderItems,
          defaultAuthor: 'Daniil Pavlov',
          onPublish,
        }),
      );

      act(() => {
        result.current.setSelectedFolderPath(['Shared']);
        result.current.setAuthor('  DIAL Team  ');
      });

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(onPublish).toHaveBeenCalledWith(
        item,
        ['Shared'],
        'DIAL Team',
        false,
      );
    });

    it('restores the prefill on reset and resumes syncing defaultAuthor', () => {
      const { result, rerender } = renderWithAuthor('Daniil Pavlov');

      act(() => {
        result.current.setAuthor('DIAL Team');
      });
      act(() => {
        result.current.reset();
      });

      expect(result.current.author).toBe('Daniil Pavlov');

      rerender({ author: 'Someone Else' });

      expect(result.current.author).toBe('Someone Else');
    });
  });

  describe('direct write', () => {
    const DIRECT = ['Delivery', 'Teams'];
    const REQUEST = ['Shared'];
    const canPublishDirectlyTo = (path: string[]) => path[0] === 'Delivery';
    const render = (
      overrides: Partial<Parameters<typeof usePublishFlow>[0]> = {},
    ) => {
      const onPublish = vi.fn().mockResolvedValue(undefined);
      const onPublishDirectly = vi.fn().mockResolvedValue(undefined);
      const onPublishSuccess = vi.fn();
      const view = renderHook(() =>
        usePublishFlow({
          item,
          history,
          folderItems,
          onPublish,
          onPublishDirectly,
          canPublishDirectlyTo,
          onPublishSuccess,
          ...overrides,
        }),
      );
      return { ...view, onPublish, onPublishDirectly, onPublishSuccess };
    };

    it('writes directly, not through onPublish, and reports success', async () => {
      const { result, onPublish, onPublishDirectly, onPublishSuccess } =
        render();
      act(() => result.current.setSelectedFolderPath(DIRECT));

      expect(result.current.isDirectWrite).toBe(true);
      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(onPublishDirectly).toHaveBeenCalledWith(item, DIRECT);
      expect(onPublish).not.toHaveBeenCalled();
      expect(onPublishSuccess).toHaveBeenCalledWith(item, DIRECT, true);
    });

    it('files a request for a folder the predicate refuses', async () => {
      const { result, onPublish, onPublishDirectly } = render();
      act(() => result.current.setSelectedFolderPath(REQUEST));

      expect(result.current.isDirectWrite).toBe(false);
      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(onPublish).toHaveBeenCalledOnce();
      expect(onPublishDirectly).not.toHaveBeenCalled();
    });

    it('stays on the request path when onPublishDirectly is omitted', () => {
      const { result } = render({ onPublishDirectly: undefined });
      act(() => result.current.setSelectedFolderPath(DIRECT));

      expect(result.current.isDirectWrite).toBe(false);
    });

    it('stays on the request path when canPublishDirectlyTo is omitted', async () => {
      const { result, onPublish } = render({ canPublishDirectlyTo: undefined });
      act(() => result.current.setSelectedFolderPath(DIRECT));

      expect(result.current.isDirectWrite).toBe(false);
      await act(async () => {
        await result.current.handleSubmit();
      });
      expect(onPublish).toHaveBeenCalledOnce();
    });

    it('is not direct without a selected folder', () => {
      const { result } = render();

      expect(result.current.isDirectWrite).toBe(false);
    });

    it('marks the folder taken when the direct write is rejected as a taken target', async () => {
      const taken = new Error('taken');
      const onPublishError = vi.fn();
      const { result } = render({
        onPublishDirectly: vi.fn().mockRejectedValue(taken),
        isTargetTakenError: (error) => error === taken,
        onPublishError,
      });
      act(() => result.current.setSelectedFolderPath(DIRECT));

      let isOk = true;
      await act(async () => {
        isOk = await result.current.handleSubmit();
      });

      expect(isOk).toBe(false);
      expect(result.current.isTargetTaken).toBe(true);
      expect(result.current.hasSubmitError).toBe(false);
      expect(onPublishError).toHaveBeenCalledWith(item, DIRECT, taken);
    });

    it('sets hasSubmitError for any other direct failure', async () => {
      const { result } = render({
        onPublishDirectly: vi.fn().mockRejectedValue(new Error('boom')),
      });
      act(() => result.current.setSelectedFolderPath(DIRECT));

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(result.current.hasSubmitError).toBe(true);
    });

    it('ignores the history marker for a direct folder', () => {
      const { result } = render({
        history: [{ version: '4.0.1', publishedAt: 1, folderPath: DIRECT }],
      });
      act(() => result.current.setSelectedFolderPath(DIRECT));

      expect(result.current.hasExistingPublicationInFolder).toBe(false);
    });

    it('still asks the taken-target check for a direct folder whose history holds the item', async () => {
      const onCheckTargetExists = vi.fn().mockResolvedValue(true);
      const { result } = render({
        history: [{ version: '4.0.1', publishedAt: 1, folderPath: DIRECT }],
        onCheckTargetExists,
      });
      act(() => result.current.setSelectedFolderPath(DIRECT));

      await waitFor(() => expect(result.current.isTargetTaken).toBe(true));
      expect(onCheckTargetExists).toHaveBeenCalledWith(item, DIRECT);
    });

    it('clears the credentials choice on entering a direct folder', () => {
      const { result } = render();
      act(() => result.current.setSelectedFolderPath(REQUEST));
      act(() => result.current.setPublishCredentials(true));
      expect(result.current.publishCredentials).toBe(true);

      act(() => result.current.setSelectedFolderPath(DIRECT));

      expect(result.current.publishCredentials).toBe(false);
    });
  });
});
