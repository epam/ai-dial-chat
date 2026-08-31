import type {
  PromptListResponseDto,
  PromptResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockedFunction,
} from 'vitest';
import {
  usePromptsState,
  type UsePromptsStateParams,
} from '../usePromptsState';

const makePrompt = (id: string): PromptResponseDto => ({
  id,
  name: id.split('/').pop() ?? id,
  content: 'Summarize:',
  folderId: id.split('/').slice(0, -1).join('/'),
  createdAt: 1,
  updatedAt: 2,
});

const aggregateResponse: PromptListResponseDto = {
  prompts: [makePrompt('Work/AI/summarize')],
  folders: [
    { id: 'Work', name: 'Work' },
    { id: 'Work/AI', name: 'AI' },
  ],
  sharedWithMe: [makePrompt('shared-prompt')],
  publicPrompts: [makePrompt('Public/translate')],
  publicFolders: [{ id: 'Public', name: 'Public' }],
};

describe('usePromptsState', () => {
  let listPrompts: MockedFunction<UsePromptsStateParams['listPrompts']>;

  beforeEach(() => {
    vi.clearAllMocks();
    listPrompts = vi.fn().mockResolvedValue(aggregateResponse);
  });

  it('calls listPrompts exactly once on mount and populates all five namespaces', async () => {
    const { result } = renderHook(() => usePromptsState({ listPrompts }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(listPrompts).toHaveBeenCalledOnce();
    expect(result.current.prompts).toEqual(aggregateResponse.prompts);
    expect(result.current.folders).toEqual(aggregateResponse.folders);
    expect(result.current.sharedWithMe).toEqual(aggregateResponse.sharedWithMe);
    expect(result.current.publicPrompts).toEqual(
      aggregateResponse.publicPrompts,
    );
    expect(result.current.publicFolders).toEqual(
      aggregateResponse.publicFolders,
    );
    expect(result.current.error).toBeNull();
  });

  it('defaults absent publicPrompts and publicFolders to empty arrays', async () => {
    listPrompts.mockResolvedValueOnce({
      prompts: [],
      folders: [],
      sharedWithMe: [],
    });

    const { result } = renderHook(() => usePromptsState({ listPrompts }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.publicPrompts).toEqual([]);
    expect(result.current.publicFolders).toEqual([]);
  });

  it('sets error and keeps empty arrays when mount fetch rejects', async () => {
    const failure = new Error('502');
    listPrompts.mockRejectedValueOnce(failure);

    const { result } = renderHook(() => usePromptsState({ listPrompts }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe(failure);
    expect(result.current.prompts).toEqual([]);
    expect(result.current.publicPrompts).toEqual([]);
  });

  it('causes no post-unmount state update when the component unmounts before the fetch settles', async () => {
    let resolveLoad!: (value: PromptListResponseDto) => void;
    listPrompts.mockReturnValueOnce(
      new Promise<PromptListResponseDto>((resolve) => {
        resolveLoad = resolve;
      }),
    );

    const { unmount } = renderHook(() => usePromptsState({ listPrompts }));
    unmount();

    /* Resolve after unmount — no error should be thrown. */
    expect(() => resolveLoad(aggregateResponse)).not.toThrow();
  });

  it('replaces all five namespaces and clears error on refetch success', async () => {
    const failure = new Error('initial error');
    listPrompts.mockRejectedValueOnce(failure);

    const { result } = renderHook(() => usePromptsState({ listPrompts }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe(failure);

    const fresh: PromptListResponseDto = {
      prompts: [makePrompt('Work/ML/summarize')],
      folders: [{ id: 'Work/ML', name: 'ML' }],
      sharedWithMe: [],
      publicPrompts: [],
      publicFolders: [],
    };
    listPrompts.mockResolvedValueOnce(fresh);

    await act(async () => result.current.refetch());

    expect(result.current.prompts.map((p) => p.id)).toEqual([
      'Work/ML/summarize',
    ]);
    expect(result.current.sharedWithMe).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('refetchPublicPrompts is the same function reference as refetch', async () => {
    const { result } = renderHook(() => usePromptsState({ listPrompts }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.refetchPublicPrompts).toBe(result.current.refetch);
  });

  it('result object identity is stable across unrelated re-renders', async () => {
    const { result, rerender } = renderHook(() =>
      usePromptsState({ listPrompts }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const before = result.current;
    rerender();

    expect(result.current).toBe(before);
  });
});
