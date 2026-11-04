import {
  ProjectCreateErrorCode,
  ProjectSource,
  ResponseError,
} from '@epam/ai-dial-chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getProjectFormError,
  ProjectFormErrorField,
  ProjectFormErrorReason,
} from '../project-form-errors';
import { ProjectRefreshOutcome } from '../project-refresh';
import type { ProjectsApiClient } from '../projects-api-client';
import { useProject } from '../use-project';
import { ProjectActionError, useProjectActions } from '../use-project-actions';
import { useProjectConversations } from '../use-project-conversations';
import { useCreateProject, useSaveProject } from '../use-project-submit';
import { useProjects } from '../use-projects';

const PROJECT_ID = 'projects/a1b2c3/q4';
const details = {
  id: PROJECT_ID,
  name: 'q4',
  bucket: 'a1b2c3',
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

const rejection = (status: number, body: unknown = {}) =>
  new ResponseError(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

const client = {
  listProjects: vi.fn(),
  getProject: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  downloadProjectArchive: vi.fn(),
  downloadProjectContextFile: vi.fn(),
  listProjectConversations: vi.fn(),
  getProjectConversationTitles: vi.fn(),
  renameProjectConversation: vi.fn(),
  deleteProjectConversation: vi.fn(),
  markProjectConversationViewed: vi.fn(),
} as unknown as Record<keyof ProjectsApiClient, ReturnType<typeof vi.fn>> &
  ProjectsApiClient;

describe('project hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useProjects', () => {
    it('maps the listing to cards and sources', async () => {
      client.listProjects.mockResolvedValue({
        items: [details],
        incompleteSources: ['organization'],
      });

      const { result } = renderHook(() => useProjects(client, true));

      expect(result.current.isLoading).toBe(true);
      await waitFor(() => expect(result.current.projects).toHaveLength(1));
      expect(result.current.projects[0]).toMatchObject({ id: PROJECT_ID });
      expect(result.current.incompleteSources).toEqual(['organization']);
    });

    it('sends nothing while disabled', () => {
      renderHook(() => useProjects(client, false));

      expect(client.listProjects).not.toHaveBeenCalled();
    });
  });

  describe('useProject', () => {
    it('reports a 404 as not found and retries on demand', async () => {
      client.getProject
        .mockRejectedValueOnce(rejection(404))
        .mockResolvedValueOnce(details);
      const { result } = renderHook(() => useProject(client, PROJECT_ID, true));

      await waitFor(() => expect(result.current.isNotFound).toBe(true));
      expect(result.current.hasError).toBe(false);
      act(() => result.current.retry());

      await waitFor(() => expect(result.current.project).toEqual(details));
    });

    it('refreshes silently without entering the loading state', async () => {
      const updated = { ...details, instructions: 'New', etag: '"e2"' };
      client.getProject
        .mockResolvedValueOnce(details)
        .mockResolvedValueOnce(updated);
      const { result } = renderHook(() => useProject(client, PROJECT_ID, true));
      await waitFor(() => expect(result.current.project).toEqual(details));

      let outcome: ProjectRefreshOutcome | undefined;
      const loadingStates: boolean[] = [];
      await act(async () => {
        const pending = result.current.refresh();
        loadingStates.push(result.current.isLoading);
        outcome = await pending;
      });

      expect(outcome).toBe(ProjectRefreshOutcome.Updated);
      expect(loadingStates).toEqual([false]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.project).toEqual(updated);
    });

    it('keeps the project and reports a failed refresh', async () => {
      client.getProject
        .mockResolvedValueOnce(details)
        .mockRejectedValueOnce(rejection(503));
      const { result } = renderHook(() => useProject(client, PROJECT_ID, true));
      await waitFor(() => expect(result.current.project).toEqual(details));

      let outcome: ProjectRefreshOutcome | undefined;
      await act(async () => {
        outcome = await result.current.refresh();
      });

      expect(outcome).toBe(ProjectRefreshOutcome.Failed);
      expect(result.current.project).toEqual(details);
      expect(result.current.hasError).toBe(false);
    });

    it('reports a refresh that finds the project gone as not found', async () => {
      client.getProject
        .mockResolvedValueOnce(details)
        .mockRejectedValueOnce(rejection(404));
      const { result } = renderHook(() => useProject(client, PROJECT_ID, true));
      await waitFor(() => expect(result.current.project).toEqual(details));

      let outcome: ProjectRefreshOutcome | undefined;
      await act(async () => {
        outcome = await result.current.refresh();
      });

      expect(outcome).toBe(ProjectRefreshOutcome.NotFound);
      expect(result.current.isNotFound).toBe(false);
      expect(result.current.project).toEqual(details);
    });

    it('skips a refresh while no project is loaded', async () => {
      client.getProject.mockReturnValue(new Promise(() => undefined));
      const { result } = renderHook(() => useProject(client, PROJECT_ID, true));

      await expect(result.current.refresh()).resolves.toBe(
        ProjectRefreshOutcome.Skipped,
      );
      expect(client.getProject).toHaveBeenCalledOnce();
    });
  });

  describe('useCreateProject and useSaveProject', () => {
    it('normalises a rejection into its status and code', async () => {
      client.createProject.mockRejectedValue(
        rejection(409, { code: ProjectCreateErrorCode.NameTaken }),
      );
      const { result } = renderHook(() => useCreateProject(client));

      let outcome:
        Awaited<ReturnType<typeof result.current.create>> | undefined;
      await act(async () => {
        outcome = await result.current.create(
          { name: 'q4', description: '', instructions: '' },
          [],
        );
      });

      expect(outcome).toMatchObject({
        isCreated: false,
        isAborted: false,
        status: 409,
        code: ProjectCreateErrorCode.NameTaken,
      });
      expect(result.current.isSubmitting).toBe(false);
    });

    it('saves with the request and resolves the saved project', async () => {
      const saved = { id: PROJECT_ID, name: 'q4' };
      client.updateProject.mockResolvedValue(saved);
      const request = {
        id: PROJECT_ID,
        fields: { name: 'q4', description: '', instructions: '' },
        newFiles: [],
        removedFileNames: [],
        contentVersion: '"cv1"',
      };
      const { result } = renderHook(() => useSaveProject(client));

      let outcome: Awaited<ReturnType<typeof result.current.save>> | undefined;
      await act(async () => {
        outcome = await result.current.save(request);
      });

      expect(outcome).toEqual({ isSaved: true, project: saved });
      expect(client.updateProject).toHaveBeenCalledWith(
        request,
        expect.any(AbortSignal),
      );
    });
  });

  describe('useProjectConversations', () => {
    const row = (id: string, extra: object = {}) => ({
      id,
      name: id,
      title: id,
      ...extra,
    });
    const rows = (from: number, count: number, extra: object = {}) =>
      Array.from({ length: count }, (_, i) => row(`c${from + i}`, extra));
    const pendingRows = (from: number, count: number) =>
      rows(from, count, { isTitlePending: true });

    it('loads, renames and removes rows in place', async () => {
      client.listProjectConversations.mockResolvedValue({
        items: [
          { id: 'c1', name: 'n1', title: 'First', author: 'Valery' },
          { id: 'c2', name: 'n2', title: 'Second' },
        ],
      });
      client.renameProjectConversation.mockResolvedValue({ name: 'Renamed' });
      client.deleteProjectConversation.mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useProjectConversations(client, PROJECT_ID),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(() => result.current.rename('c1', 'Renamed'));
      await act(() => result.current.remove('c2'));

      expect(result.current.items).toEqual([
        { id: 'c1', title: 'Renamed', authorName: 'Valery' },
      ]);
      expect(client.listProjectConversations).toHaveBeenCalledWith(
        PROJECT_ID,
        expect.any(AbortSignal),
      );
    });

    it('shows the first 20 rows of the whole list', async () => {
      client.listProjectConversations.mockResolvedValue({
        items: [...rows(0, 20), ...pendingRows(20, 5)],
      });
      const { result } = renderHook(() =>
        useProjectConversations(client, PROJECT_ID),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.items).toHaveLength(20);
      expect(result.current.hasMore).toBe(true);
      expect(client.listProjectConversations).toHaveBeenCalledOnce();
    });

    it('shows 20 more rows after reading the titles the list left pending', async () => {
      client.listProjectConversations.mockResolvedValue({
        items: [...rows(0, 20), ...pendingRows(20, 25)],
      });
      client.getProjectConversationTitles.mockImplementation(
        async (_projectId: string, names: string[]) => ({
          items: names.map((name) => row(name, { title: `Title ${name}` })),
        }),
      );
      const { result } = renderHook(() =>
        useProjectConversations(client, PROJECT_ID),
      );
      await waitFor(() => expect(result.current.hasMore).toBe(true));

      await act(() => result.current.loadMore());

      expect(client.getProjectConversationTitles).toHaveBeenCalledWith(
        PROJECT_ID,
        rows(20, 20).map(({ name }) => name),
        expect.any(AbortSignal),
      );
      expect(result.current.items).toHaveLength(40);
      expect(result.current.items[20].title).toBe('Title c20');
      expect(result.current.hasMore).toBe(true);
      expect(result.current.isLoadingMore).toBe(false);
      expect(client.listProjectConversations).toHaveBeenCalledOnce();

      await act(() => result.current.loadMore());

      expect(result.current.items).toHaveLength(45);
      expect(result.current.hasMore).toBe(false);
    });

    it('ignores a second See more while the first one reads titles', async () => {
      client.listProjectConversations.mockResolvedValue({
        items: [...rows(0, 20), ...pendingRows(20, 5)],
      });
      client.getProjectConversationTitles.mockImplementation(
        async (_projectId: string, names: string[]) => ({
          items: names.map((name) => row(name)),
        }),
      );
      const { result } = renderHook(() =>
        useProjectConversations(client, PROJECT_ID),
      );
      await waitFor(() => expect(result.current.hasMore).toBe(true));

      await act(async () => {
        await Promise.all([
          result.current.loadMore(),
          result.current.loadMore(),
        ]);
      });

      expect(client.getProjectConversationTitles).toHaveBeenCalledOnce();
      expect(result.current.items).toHaveLength(25);
    });

    it('shows more rows without a request when their titles are known', async () => {
      client.listProjectConversations.mockResolvedValue({ items: rows(0, 30) });
      const { result } = renderHook(() =>
        useProjectConversations(client, PROJECT_ID),
      );
      await waitFor(() => expect(result.current.hasMore).toBe(true));

      await act(() => result.current.loadMore());

      expect(result.current.items).toHaveLength(30);
      expect(client.getProjectConversationTitles).not.toHaveBeenCalled();
    });

    it('rejects a failed title read and keeps showing the same rows', async () => {
      client.listProjectConversations.mockResolvedValue({
        items: [...rows(0, 20), ...pendingRows(20, 1)],
      });
      client.getProjectConversationTitles.mockRejectedValueOnce(rejection(503));
      const { result } = renderHook(() =>
        useProjectConversations(client, PROJECT_ID),
      );
      await waitFor(() => expect(result.current.hasMore).toBe(true));

      await act(async () => {
        await expect(result.current.loadMore()).rejects.toBeInstanceOf(
          ResponseError,
        );
      });

      expect(result.current.items).toHaveLength(20);
      expect(result.current.hasMore).toBe(true);
      expect(result.current.isLoadingMore).toBe(false);
    });

    it('maps the unread state of each row', async () => {
      client.listProjectConversations.mockResolvedValue({
        items: [row('c1', { isUnread: true }), row('c2', { isUnread: false })],
      });
      const { result } = renderHook(() =>
        useProjectConversations(client, PROJECT_ID),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.items).toEqual([
        { id: 'c1', title: 'c1', authorName: undefined, isUnread: true },
        { id: 'c2', title: 'c2', authorName: undefined },
      ]);
    });

    it('refreshes silently, adding a new row without the loading state', async () => {
      client.listProjectConversations
        .mockResolvedValueOnce({ items: [row('c1')] })
        .mockResolvedValueOnce({ items: [row('c2'), row('c1')] });
      const { result } = renderHook(() =>
        useProjectConversations(client, PROJECT_ID),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const loadingStates: boolean[] = [];
      await act(async () => {
        const pending = result.current.refresh();
        loadingStates.push(result.current.isLoading);
        await pending;
      });

      expect(loadingStates).toEqual([false]);
      expect(result.current.items.map((item) => item.id)).toEqual(['c2', 'c1']);
      expect(client.getProjectConversationTitles).not.toHaveBeenCalled();
    });

    it('keeps the shown rows after a refresh and reads their pending titles', async () => {
      client.listProjectConversations
        .mockResolvedValueOnce({
          items: [...rows(0, 20), ...pendingRows(20, 5)],
        })
        .mockResolvedValueOnce({
          items: [...rows(0, 20), ...pendingRows(20, 5)],
        });
      client.getProjectConversationTitles.mockImplementation(
        async (_projectId: string, names: string[]) => ({
          items: names.map((name) => row(name, { title: `Title ${name}` })),
        }),
      );
      const { result } = renderHook(() =>
        useProjectConversations(client, PROJECT_ID),
      );
      await waitFor(() => expect(result.current.hasMore).toBe(true));
      await act(() => result.current.loadMore());
      client.getProjectConversationTitles.mockClear();

      await act(() => result.current.refresh());

      expect(result.current.items).toHaveLength(25);
      expect(result.current.items[24].title).toBe('Title c24');
      expect(client.getProjectConversationTitles).toHaveBeenCalledOnce();
    });

    it('keeps the rows when a refresh fails', async () => {
      client.listProjectConversations
        .mockResolvedValueOnce({ items: [row('c1')] })
        .mockRejectedValueOnce(rejection(503));
      const { result } = renderHook(() =>
        useProjectConversations(client, PROJECT_ID),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(() => result.current.refresh());

      expect(result.current.items.map((item) => item.id)).toEqual(['c1']);
      expect(result.current.hasError).toBe(false);
    });

    it('reads the title of a row a delete brings into view', async () => {
      client.listProjectConversations.mockResolvedValue({
        items: [...rows(0, 20), ...pendingRows(20, 1)],
      });
      client.deleteProjectConversation.mockResolvedValue(undefined);
      client.getProjectConversationTitles.mockResolvedValue({
        items: [row('c20', { title: 'Title c20' })],
      });
      const { result } = renderHook(() =>
        useProjectConversations(client, PROJECT_ID),
      );
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(() => result.current.remove('c0'));

      await waitFor(() =>
        expect(result.current.items[19].title).toBe('Title c20'),
      );
      expect(result.current.hasMore).toBe(false);
      expect(client.getProjectConversationTitles).toHaveBeenCalledWith(
        PROJECT_ID,
        ['c20'],
        expect.any(AbortSignal),
      );
    });

    it('marks a row read at once and records it through the client', async () => {
      client.listProjectConversations.mockResolvedValue({
        items: [row('c1', { isUnread: true, updatedAt: 10 })],
      });
      client.markProjectConversationViewed.mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useProjectConversations(client, PROJECT_ID),
      );
      await waitFor(() => expect(result.current.items[0]?.isUnread).toBe(true));

      act(() => result.current.markViewed('c1'));

      expect(result.current.items[0].isUnread).toBeFalsy();
      expect(client.markProjectConversationViewed).toHaveBeenCalledWith('c1');
    });

    it('keeps a marked row read when a stale read still reports it unread', async () => {
      client.listProjectConversations
        .mockResolvedValueOnce({
          items: [row('c1', { isUnread: true, updatedAt: 10 })],
        })
        .mockResolvedValueOnce({
          items: [row('c1', { isUnread: true, updatedAt: 10 })],
        });
      client.markProjectConversationViewed.mockRejectedValue(rejection(503));
      const { result } = renderHook(() =>
        useProjectConversations(client, PROJECT_ID),
      );
      await waitFor(() => expect(result.current.items[0]?.isUnread).toBe(true));

      act(() => result.current.markViewed('c1'));
      await act(() => result.current.refresh());

      expect(result.current.items[0].isUnread).toBeFalsy();
    });

    it('shows a marked row unread again once a newer version is listed', async () => {
      client.listProjectConversations
        .mockResolvedValueOnce({
          items: [row('c1', { isUnread: true, updatedAt: 10 })],
        })
        .mockResolvedValueOnce({
          items: [row('c1', { isUnread: true, updatedAt: 20 })],
        });
      client.markProjectConversationViewed.mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useProjectConversations(client, PROJECT_ID),
      );
      await waitFor(() => expect(result.current.items[0]?.isUnread).toBe(true));

      act(() => result.current.markViewed('c1'));
      await act(() => result.current.refresh());

      expect(result.current.items[0].isUnread).toBe(true);
    });

    it('shows an error and loads again on retry', async () => {
      client.listProjectConversations
        .mockRejectedValueOnce(rejection(503))
        .mockResolvedValueOnce({
          items: [{ id: 'c1', name: 'n1', title: 'First' }],
        });
      const { result } = renderHook(() =>
        useProjectConversations(client, PROJECT_ID),
      );
      await waitFor(() => expect(result.current.hasError).toBe(true));

      act(() => result.current.retry());

      await waitFor(() => expect(result.current.items).toHaveLength(1));
      expect(result.current.hasError).toBe(false);
    });

    it('settles empty without a request while no project is known', async () => {
      const { result } = renderHook(() =>
        useProjectConversations(client, null),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(client.listProjectConversations).not.toHaveBeenCalled();
    });
  });

  describe('useProjectActions', () => {
    const handlers = () => ({
      isPinned: false,
      setPinned: vi.fn(async () => undefined),
      saveFile: vi.fn(async (_response: Response, name: string) => name),
      onArchiveDownloaded: vi.fn(),
      onDeleted: vi.fn(),
      onError: vi.fn(),
      onReload: vi.fn(),
    });

    it('downloads the archive under the sanitised project name', async () => {
      const response = new Response('zip');
      client.downloadProjectArchive.mockResolvedValue(response);
      const host = handlers();
      const { result } = renderHook(() =>
        useProjectActions(client, details, host),
      );

      await act(() => result.current.downloadArchive());

      expect(host.saveFile).toHaveBeenCalledWith(response, 'q4.zip');
      expect(host.onArchiveDownloaded).toHaveBeenCalledWith('q4.zip');
    });

    it('deletes with the contentVersion and hands the project to the host', async () => {
      client.deleteProject.mockResolvedValue(undefined);
      const host = handlers();
      const { result } = renderHook(() =>
        useProjectActions(client, details, host),
      );

      act(() => result.current.requestDelete());
      await act(() => result.current.confirmDelete());

      expect(client.deleteProject).toHaveBeenCalledWith(PROJECT_ID, '"cv1"');
      expect(host.onDeleted).toHaveBeenCalledWith(details);
      expect(result.current.isDeleteOpen).toBe(false);
    });

    it('reloads when the delete lost to a concurrent change', async () => {
      client.deleteProject.mockRejectedValue(
        rejection(409, { code: ProjectCreateErrorCode.ProjectChanged }),
      );
      const host = handlers();
      const { result } = renderHook(() =>
        useProjectActions(client, details, host),
      );

      await act(() => result.current.confirmDelete());

      expect(host.onError).toHaveBeenCalledWith(
        ProjectActionError.ChangedElsewhere,
        undefined,
      );
      expect(host.onReload).toHaveBeenCalledOnce();
      expect(host.onDeleted).not.toHaveBeenCalled();
    });

    it('reports a cancel and a success to a host that owns the delete dialog', async () => {
      client.deleteProject.mockResolvedValue(undefined);
      const host = handlers();
      const onDeleteOpenChange = vi.fn();
      const { result } = renderHook(() =>
        useProjectActions(client, details, {
          ...host,
          isDeleteOpen: true,
          onDeleteOpenChange,
        }),
      );

      expect(result.current.isDeleteOpen).toBe(true);
      act(() => result.current.cancelDelete());
      expect(onDeleteOpenChange).toHaveBeenLastCalledWith(false);
      /* The host did not close it, so it stays open. */
      expect(result.current.isDeleteOpen).toBe(true);

      onDeleteOpenChange.mockClear();
      await act(() => result.current.confirmDelete());

      expect(onDeleteOpenChange).toHaveBeenCalledExactlyOnceWith(false);
      expect(host.onDeleted).toHaveBeenCalledWith(details);
    });

    it('reports a conflict close to a host that owns the delete dialog', async () => {
      client.deleteProject.mockRejectedValue(
        rejection(409, { code: ProjectCreateErrorCode.ProjectChanged }),
      );
      const host = handlers();
      const onDeleteOpenChange = vi.fn();
      const { result } = renderHook(() =>
        useProjectActions(client, details, {
          ...host,
          isDeleteOpen: true,
          onDeleteOpenChange,
        }),
      );

      await act(() => result.current.confirmDelete());

      expect(onDeleteOpenChange).toHaveBeenCalledExactlyOnceWith(false);
      expect(host.onReload).toHaveBeenCalledOnce();
    });

    it('keeps a failed delete open for a host that owns the delete dialog', async () => {
      client.deleteProject.mockRejectedValue(rejection(500, {}));
      const host = handlers();
      const onDeleteOpenChange = vi.fn();
      const { result } = renderHook(() =>
        useProjectActions(client, details, {
          ...host,
          isDeleteOpen: true,
          onDeleteOpenChange,
        }),
      );

      await act(() => result.current.confirmDelete());

      expect(onDeleteOpenChange).not.toHaveBeenCalled();
      expect(host.onError).toHaveBeenCalledWith(
        ProjectActionError.Delete,
        undefined,
      );
    });

    it('reports a failed pin change', async () => {
      const host = handlers();
      host.setPinned.mockRejectedValue(new Error('down'));
      const { result } = renderHook(() =>
        useProjectActions(client, details, host),
      );

      await act(() => result.current.togglePin());

      expect(host.setPinned).toHaveBeenCalledWith(PROJECT_ID, true);
      expect(host.onError).toHaveBeenCalledWith(
        ProjectActionError.Pin,
        undefined,
      );
    });
  });
});

describe('getProjectFormError', () => {
  it('maps a rejection code to its form field and reason', () => {
    expect(getProjectFormError(ProjectCreateErrorCode.NameTaken)).toEqual({
      field: ProjectFormErrorField.Name,
      reason: ProjectFormErrorReason.NameTaken,
    });
    expect(getProjectFormError(ProjectCreateErrorCode.FileTooLarge)).toEqual({
      field: ProjectFormErrorField.Context,
      reason: ProjectFormErrorReason.FilesRejected,
    });
  });

  it('leaves a toast-only code and no code unmapped', () => {
    expect(
      getProjectFormError(ProjectCreateErrorCode.ProjectChanged),
    ).toBeNull();
    expect(getProjectFormError(undefined)).toBeNull();
  });
});
