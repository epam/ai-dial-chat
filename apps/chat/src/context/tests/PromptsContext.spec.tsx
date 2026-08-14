import type {
  PromptListResponseDto,
  PromptResponseDto,
  PublicPromptListResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listPrompts, listPublicPrompts } from '../../server-api/prompts.api';
import { PromptsProvider, usePrompts } from '../PromptsContext';

vi.mock('../../server-api/prompts.api', () => ({
  listPrompts: vi.fn(),
  listPublicPrompts: vi.fn(),
}));

const makePrompt = (id: string): PromptResponseDto => ({
  id,
  bucket: 'my-bucket',
  name: id.split('/').pop() ?? id,
  content: 'Summarize:',
  folderId: id.split('/').slice(0, -1).join('/'),
  createdAt: 1,
  updatedAt: 2,
});

const personalResponse: PromptListResponseDto = {
  prompts: [makePrompt('Work/AI/summarize')],
  folders: [
    { id: 'Work', name: 'Work' },
    { id: 'Work/AI', name: 'AI' },
  ],
  sharedWithMe: [makePrompt('shared-prompt')],
};

const publicResponse: PublicPromptListResponseDto = {
  prompts: [makePrompt('Public/translate')],
  folders: [{ id: 'Public', name: 'Public' }],
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <PromptsProvider>{children}</PromptsProvider>
);

describe('PromptsContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listPrompts).mockResolvedValue(personalResponse);
    vi.mocked(listPublicPrompts).mockResolvedValue(publicResponse);
  });

  it('throws when used outside a PromptsProvider', () => {
    expect(() => renderHook(() => usePrompts())).toThrowError(
      'usePrompts must be used within a PromptsProvider',
    );
  });

  it('loads personal and organisation prompts on mount', async () => {
    const { result } = renderHook(() => usePrompts(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(listPrompts).toHaveBeenCalledOnce();
    expect(listPublicPrompts).toHaveBeenCalledOnce();
    expect(result.current.prompts).toEqual(personalResponse.prompts);
    expect(result.current.folders).toEqual(personalResponse.folders);
    expect(result.current.sharedWithMe).toEqual(personalResponse.sharedWithMe);
    expect(result.current.publicPrompts).toEqual(publicResponse.prompts);
    expect(result.current.publicFolders).toEqual(publicResponse.folders);
    expect(result.current.error).toBeNull();
  });

  it('keeps personal prompts when the organisation list fails', async () => {
    const failure = new Error('502');
    vi.mocked(listPublicPrompts).mockRejectedValue(failure);

    const { result } = renderHook(() => usePrompts(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.prompts).toEqual(personalResponse.prompts);
    expect(result.current.publicPrompts).toEqual([]);
    expect(result.current.error).toBe(failure);
  });

  it('keeps organisation prompts when the personal list fails', async () => {
    const failure = new Error('502');
    vi.mocked(listPrompts).mockRejectedValue(failure);

    const { result } = renderHook(() => usePrompts(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.prompts).toEqual([]);
    expect(result.current.publicPrompts).toEqual(publicResponse.prompts);
    expect(result.current.error).toBe(failure);
  });

  it('treats empty results as success, not an error', async () => {
    vi.mocked(listPrompts).mockResolvedValue({
      prompts: [],
      folders: [],
      sharedWithMe: [],
    });
    vi.mocked(listPublicPrompts).mockResolvedValue({
      prompts: [],
      folders: [],
    });

    const { result } = renderHook(() => usePrompts(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.prompts).toEqual([]);
  });

  it('replaces state from a fresh list on refetchPrompts rather than patching', async () => {
    const { result } = renderHook(() => usePrompts(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    vi.mocked(listPrompts).mockResolvedValue({
      prompts: [makePrompt('Work/ML/summarize')],
      folders: [
        { id: 'Work', name: 'Work' },
        { id: 'Work/ML', name: 'ML' },
      ],
      sharedWithMe: [],
    });

    await act(async () => {
      await result.current.refetchPrompts();
    });

    expect(result.current.prompts.map((p) => p.id)).toEqual([
      'Work/ML/summarize',
    ]);
    expect(result.current.folders.map((f) => f.id)).toEqual([
      'Work',
      'Work/ML',
    ]);
  });

  it('keeps a stable context value across an unrelated parent re-render', async () => {
    const seen: unknown[] = [];
    let bump: (() => void) | undefined;

    const Consumer = () => {
      seen.push(usePrompts());
      return null;
    };

    const Parent = () => {
      const [, setTick] = useState(0);
      bump = () => setTick((tick) => tick + 1);
      return (
        <PromptsProvider>
          <Consumer />
        </PromptsProvider>
      );
    };

    render(<Parent />);
    await waitFor(() => expect(seen.length).toBeGreaterThan(1));

    const before = seen[seen.length - 1];
    act(() => bump?.());

    expect(seen[seen.length - 1]).toBe(before);
  });

  it('does not update state when unmounted before the fetch settles', async () => {
    const errorSpy = vi.spyOn(console, 'error');
    let resolvePersonal: ((value: PromptListResponseDto) => void) | undefined;
    vi.mocked(listPrompts).mockReturnValue(
      new Promise((resolve) => {
        resolvePersonal = resolve;
      }),
    );

    const { unmount } = renderHook(() => usePrompts(), { wrapper });
    unmount();

    await act(async () => {
      resolvePersonal?.(personalResponse);
    });

    expect(errorSpy).not.toHaveBeenCalled();
  });
});
