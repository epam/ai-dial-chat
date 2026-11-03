import {
  ProjectSource,
  ResponseError,
  type ProjectDetailsDto,
} from '@epam/ai-dial-chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectsApiClient } from '../projects-api-client';
import { useProject } from '../use-project';
import { useProjectConversations } from '../use-project-conversations';
import { useCreateProject, useSaveProject } from '../use-project-submit';
import { useProjects } from '../use-projects';

const PROJECT_ID = 'projects/b/q4';
const details: ProjectDetailsDto = {
  id: PROJECT_ID,
  name: 'q4',
  bucket: 'b',
  path: 'q4',
  source: ProjectSource.Personal,
  description: '',
  instructions: '',
  contextFiles: [],
  etag: '"e1"',
  contentVersion: '"cv1"',
  conversationCount: 0,
  canEdit: true,
};
const listing = {
  items: [
    {
      id: 'projects/b/alpha',
      name: 'alpha',
      bucket: 'b',
      path: 'alpha',
      source: ProjectSource.Shared,
      updatedAt: 5,
    },
  ],
  incompleteSources: [],
};
const FIELDS = { name: 'Handbook', instructions: '' };
const REQUEST = {
  id: PROJECT_ID,
  fields: FIELDS,
  newFiles: [],
  removedFileNames: ['survey.xlsx'],
  contentVersion: '"cv1"',
};

const rejection = (status: number, body: unknown = {}) =>
  new ResponseError(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
const deferred = <T>() => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};
const pendingForever = () => new Promise<never>(() => undefined);

const client = {
  listProjects: vi.fn(),
  getProject: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  listProjectConversations: vi.fn(),
  getProjectConversationTitles: vi.fn(),
  renameProjectConversation: vi.fn(),
  deleteProjectConversation: vi.fn(),
  markProjectConversationViewed: vi.fn(),
  watchProjects: undefined,
} as unknown as Record<keyof ProjectsApiClient, ReturnType<typeof vi.fn>> &
  ProjectsApiClient;

/* Lifecycle cases the host adapters used to assert: loading edges, cancellation and in-flight state. */
describe('project hooks lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useProject', () => {
    it('loads the project with its id and an abort signal, then stops loading', async () => {
      client.getProject.mockResolvedValue(details);

      const { result } = renderHook(() => useProject(client, PROJECT_ID, true));

      expect(result.current.isLoading).toBe(true);
      await waitFor(() => expect(result.current.project).toEqual(details));
      expect(result.current.isLoading).toBe(false);
      expect(client.getProject).toHaveBeenCalledWith(
        PROJECT_ID,
        expect.any(AbortSignal),
      );
    });

    it('reports a failure other than 404 as an error and reloads on retry', async () => {
      client.getProject
        .mockRejectedValueOnce(rejection(503))
        .mockResolvedValueOnce(details);

      const { result } = renderHook(() => useProject(client, PROJECT_ID, true));

      await waitFor(() => expect(result.current.hasError).toBe(true));
      expect(result.current.isNotFound).toBe(false);
      act(() => result.current.retry());
      expect(result.current.isLoading).toBe(true);
      await waitFor(() => expect(result.current.project).toEqual(details));
      expect(client.getProject).toHaveBeenCalledTimes(2);
    });

    it('sends no request while disabled or without an id', () => {
      const { result, rerender } = renderHook(
        ({ id, enabled }) => useProject(client, id, enabled),
        { initialProps: { id: null as string | null, enabled: true } },
      );
      expect(result.current.isLoading).toBe(false);

      rerender({ id: PROJECT_ID, enabled: false });

      expect(result.current.isLoading).toBe(false);
      expect(client.getProject).not.toHaveBeenCalled();
    });

    it('aborts the request on unmount', () => {
      client.getProject.mockReturnValue(pendingForever());

      const { unmount } = renderHook(() =>
        useProject(client, PROJECT_ID, true),
      );
      const signal = client.getProject.mock.calls[0][1] as AbortSignal;
      unmount();

      expect(signal.aborted).toBe(true);
    });
  });

  describe('useProjects', () => {
    /* A direct load of /projects starts disabled until the app config is ready;
     * the first enabled render must already be loading, never the empty list. */
    it('is loading on the very first render after being enabled', () => {
      client.listProjects.mockReturnValue(deferred<typeof listing>().promise);
      const renders: Array<{ isLoading: boolean; enabled: boolean }> = [];

      const { rerender } = renderHook(
        ({ enabled }: { enabled: boolean }) => {
          const state = useProjects(client, enabled);
          renders.push({ isLoading: state.isLoading, enabled });
          return state;
        },
        { initialProps: { enabled: false } },
      );
      rerender({ enabled: true });

      expect(
        renders
          .filter(({ enabled }) => enabled)
          .every(({ isLoading }) => isLoading),
      ).toBe(true);
      expect(client.listProjects).toHaveBeenCalledOnce();
    });

    it('reports an error and is loading again as soon as retry is called', async () => {
      const second = deferred<typeof listing>();
      client.listProjects
        .mockRejectedValueOnce(new Error('Bad gateway'))
        .mockReturnValueOnce(second.promise);

      const { result } = renderHook(() => useProjects(client, true));

      await waitFor(() => expect(result.current.hasError).toBe(true));
      expect(result.current.projects).toEqual([]);

      act(() => result.current.retry());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.hasError).toBe(false);

      await act(async () => second.resolve(listing));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.projects).toHaveLength(1);
      expect(client.listProjects).toHaveBeenCalledTimes(2);
    });

    it('aborts the pending request when disabled and ignores its late result', async () => {
      const pending = deferred<typeof listing>();
      client.listProjects.mockReturnValue(pending.promise);

      const { result, rerender } = renderHook(
        ({ enabled }: { enabled: boolean }) => useProjects(client, enabled),
        { initialProps: { enabled: true } },
      );
      const signal = client.listProjects.mock.calls[0][0] as AbortSignal;

      rerender({ enabled: false });
      await act(async () => pending.resolve(listing));

      expect(signal.aborted).toBe(true);
      expect(result.current.projects).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('useCreateProject', () => {
    it('resolves the created project, sends the abort signal and clears the submitting state', async () => {
      const project = {
        id: 'projects/b/Handbook',
        name: 'Handbook',
        bucket: 'b',
        path: 'Handbook',
      };
      client.createProject.mockResolvedValue(project);
      const { result } = renderHook(() => useCreateProject(client));

      let outcome: unknown;
      await act(async () => {
        outcome = await result.current.create(FIELDS, []);
      });

      expect(outcome).toEqual({ isCreated: true, project });
      expect(result.current.isSubmitting).toBe(false);
      expect(client.createProject).toHaveBeenCalledWith(
        FIELDS,
        [],
        expect.any(AbortSignal),
      );
    });

    it('reports isSubmitting while the request is in flight', () => {
      client.createProject.mockReturnValue(pendingForever());
      const { result } = renderHook(() => useCreateProject(client));

      act(() => {
        void result.current.create(FIELDS, []);
      });

      expect(result.current.isSubmitting).toBe(true);
    });

    it('aborts the request on unmount and reports it as aborted', async () => {
      let signal: AbortSignal | undefined;
      client.createProject.mockImplementation(
        (_fields, _files, requestSignal: AbortSignal) => {
          signal = requestSignal;
          return new Promise((_resolve, reject) => {
            requestSignal.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            );
          });
        },
      );
      const { result, unmount } = renderHook(() => useCreateProject(client));

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

  describe('useSaveProject', () => {
    it('aborts the request on unmount and reports it as aborted', async () => {
      let rejectRequest: (error: unknown) => void = () => undefined;
      client.updateProject.mockImplementation(
        () =>
          new Promise((_resolve, reject) => {
            rejectRequest = reject;
          }),
      );
      const { result, unmount } = renderHook(() => useSaveProject(client));

      let pending: Promise<unknown> | undefined;
      act(() => {
        pending = result.current.save(REQUEST);
      });
      const signal = client.updateProject.mock.calls[0][1] as AbortSignal;
      unmount();
      rejectRequest(new DOMException('aborted', 'AbortError'));

      expect(signal.aborted).toBe(true);
      await expect(pending).resolves.toEqual({
        isSaved: false,
        isAborted: true,
      });
    });
  });

  describe('useProjectConversations', () => {
    it('aborts the list request when the view unmounts', () => {
      client.listProjectConversations.mockReturnValue(pendingForever());

      const { unmount } = renderHook(() =>
        useProjectConversations(client, PROJECT_ID),
      );
      const signal = client.listProjectConversations.mock
        .calls[0][1] as AbortSignal;
      unmount();

      expect(signal.aborted).toBe(true);
    });
  });
});
