import { ResponseError } from '@epam/ai-dial-chat-api-client';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateProject } from '../../../server-api/projects.api';
import { type SaveProjectOutcome, useSaveProject } from '../useSaveProject';

vi.mock('../../../server-api/projects.api', () => ({
  updateProject: vi.fn(),
}));

const REQUEST = {
  id: 'projects/b/q4',
  fields: { name: 'Q4 launch', description: 'd', instructions: 'i' },
  newFiles: [new File(['%PDF-'], 'retro.pdf')],
  removedFileNames: ['survey.xlsx'],
  contentVersion: '"cv1"',
};

const responseError = (status: number, body: unknown) =>
  new ResponseError(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

describe('useSaveProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends one update with the loaded contentVersion and resolves the saved project', async () => {
    const saved = {
      id: 'projects/b/Q4 launch',
      name: 'Q4 launch',
      bucket: 'b',
      path: 'Q4 launch',
      etag: '"e2"',
      isPinned: false,
    };
    vi.mocked(updateProject).mockResolvedValue(saved);
    const { result } = renderHook(() => useSaveProject());

    let outcome: SaveProjectOutcome | undefined;
    await act(async () => {
      outcome = await result.current.save(REQUEST);
    });

    expect(outcome).toEqual({ isSaved: true, project: saved });
    expect(updateProject).toHaveBeenCalledWith(
      'projects/b/q4',
      REQUEST.fields,
      REQUEST.newFiles,
      ['survey.xlsx'],
      '"cv1"',
      expect.any(AbortSignal),
    );
    expect(result.current.isSubmitting).toBe(false);
  });

  it('normalises a rejection into its status and code', async () => {
    vi.mocked(updateProject).mockRejectedValue(
      responseError(409, { code: 'project-changed' }),
    );
    const { result } = renderHook(() => useSaveProject());

    let outcome: SaveProjectOutcome | undefined;
    await act(async () => {
      outcome = await result.current.save(REQUEST);
    });

    expect(outcome).toMatchObject({
      isSaved: false,
      isAborted: false,
      status: 409,
      code: 'project-changed',
    });
  });

  it('aborts the request on unmount and reports it as aborted', async () => {
    let rejectRequest: (error: unknown) => void = () => undefined;
    vi.mocked(updateProject).mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectRequest = reject;
        }),
    );
    const { result, unmount } = renderHook(() => useSaveProject());

    let pending: Promise<SaveProjectOutcome> | undefined;
    act(() => {
      pending = result.current.save(REQUEST);
    });
    const signal = vi.mocked(updateProject).mock.calls[0][5] as AbortSignal;
    unmount();
    rejectRequest(new DOMException('aborted', 'AbortError'));

    expect(signal.aborted).toBe(true);
    await expect(pending).resolves.toEqual({ isSaved: false, isAborted: true });
  });
});
