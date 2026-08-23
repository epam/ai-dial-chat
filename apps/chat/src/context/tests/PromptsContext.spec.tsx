import type {
  PromptListResponseDto,
  PromptResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listPrompts } from '../../server-api/prompts.api';
import { PromptsProvider, usePrompts } from '../PromptsContext';

vi.mock('../../server-api/prompts.api', () => ({ listPrompts: vi.fn() }));

const makePrompt = (id: string, bucket = 'my-bucket'): PromptResponseDto => ({
  id,
  bucket,
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
  sharedWithMe: [makePrompt('shared-prompt', 'owner-bucket')],
  publicPrompts: [makePrompt('Public/translate', 'public')],
  publicFolders: [{ id: 'Public', name: 'Public' }],
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <PromptsProvider>{children}</PromptsProvider>
);

describe('PromptsContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listPrompts).mockResolvedValue(aggregateResponse);
  });

  it('throws when used outside a PromptsProvider', () => {
    expect(() => renderHook(() => usePrompts())).toThrowError(
      'usePrompts must be used within a PromptsProvider',
    );
  });

  it('loads personal, shared, and organisation prompts with one request', async () => {
    const { result } = renderHook(() => usePrompts(), { wrapper });

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

  it('settles with the aggregate request error', async () => {
    const failure = new Error('502');
    vi.mocked(listPrompts).mockRejectedValue(failure);

    const { result } = renderHook(() => usePrompts(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.prompts).toEqual([]);
    expect(result.current.publicPrompts).toEqual([]);
    expect(result.current.error).toBe(failure);
  });

  it('replaces every namespace from a fresh aggregate response', async () => {
    const { result } = renderHook(() => usePrompts(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    vi.mocked(listPrompts).mockResolvedValue({
      prompts: [makePrompt('Work/ML/summarize')],
      folders: [{ id: 'Work/ML', name: 'ML' }],
      sharedWithMe: [],
      publicPrompts: [],
      publicFolders: [],
    });

    await act(async () => result.current.refetchPrompts());

    expect(result.current.prompts.map((prompt) => prompt.id)).toEqual([
      'Work/ML/summarize',
    ]);
    expect(result.current.sharedWithMe).toEqual([]);
    expect(result.current.publicPrompts).toEqual([]);
  });
});
