import { ResponseError } from '@epam/ai-dial-chat-api-client';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProject } from '../../../server-api/projects.api';
import {
  type CreateProjectOutcome,
  useCreateProject,
} from '../useCreateProject';

vi.mock('../../../server-api/projects.api', () => ({
  createProject: vi.fn(),
}));

const FIELDS = { name: 'Handbook', description: '', instructions: '' };

const responseError = (status: number, body: unknown) =>
  new ResponseError(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

describe('useCreateProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves the created project and clears the submitting state', async () => {
    const project = {
      id: 'projects/b/Handbook',
      name: 'Handbook',
      bucket: 'b',
      path: 'Handbook',
    };
    vi.mocked(createProject).mockResolvedValue(project);
    const { result } = renderHook(() => useCreateProject());

    let outcome: CreateProjectOutcome | undefined;
    await act(async () => {
      outcome = await result.current.create(FIELDS, []);
    });

    expect(outcome).toEqual({ isCreated: true, project });
    expect(result.current.isSubmitting).toBe(false);
    expect(createProject).toHaveBeenCalledWith(
      FIELDS,
      [],
      expect.any(AbortSignal),
    );
  });

  it('reports isSubmitting while the request is in flight', async () => {
    vi.mocked(createProject).mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => useCreateProject());

    act(() => {
      void result.current.create(FIELDS, []);
    });

    expect(result.current.isSubmitting).toBe(true);
  });

  it('returns the status and domain code of a rejected request', async () => {
    vi.mocked(createProject).mockRejectedValue(
      responseError(409, {
        statusCode: 409,
        error: 'Conflict',
        code: 'name-taken',
        field: 'name',
        message: 'A project with this name already exists',
      }),
    );
    const { result } = renderHook(() => useCreateProject());

    let outcome: CreateProjectOutcome | undefined;
    await act(async () => {
      outcome = await result.current.create(FIELDS, []);
    });

    expect(outcome).toEqual({
      isCreated: false,
      isAborted: false,
      status: 409,
      code: 'name-taken',
    });
  });

  it('returns a status without a code for an upstream failure', async () => {
    vi.mocked(createProject).mockRejectedValue(
      responseError(503, {
        statusCode: 503,
        message: 'DIAL Core is unreachable',
      }),
    );
    const { result } = renderHook(() => useCreateProject());

    let outcome: CreateProjectOutcome | undefined;
    await act(async () => {
      outcome = await result.current.create(FIELDS, []);
    });

    expect(outcome).toMatchObject({ isCreated: false, status: 503 });
    expect(outcome).not.toHaveProperty('code', expect.anything());
  });

  it('aborts the request on unmount and reports it as aborted', async () => {
    let signal: AbortSignal | undefined;
    vi.mocked(createProject).mockImplementation(
      (_fields, _files, requestSignal) => {
        signal = requestSignal;
        return new Promise((_resolve, reject) => {
          requestSignal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        });
      },
    );
    const { result, unmount } = renderHook(() => useCreateProject());

    let pending: Promise<unknown> | undefined;
    act(() => {
      pending = result.current.create(FIELDS, []);
    });
    unmount();

    expect(signal?.aborted).toBe(true);
    await expect(pending).resolves.toEqual({
      isCreated: false,
      isAborted: true,
    });
  });
});
