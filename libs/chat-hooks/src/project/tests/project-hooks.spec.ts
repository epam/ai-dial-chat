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
  renameProjectConversation: vi.fn(),
  deleteProjectConversation: vi.fn(),
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
    it('loads, renames and removes rows in place', async () => {
      client.listProjectConversations.mockResolvedValue({
        items: [
          { id: 'c1', name: 'n1', title: 'First', author: 'Valery' },
          { id: 'c2', name: 'n2', title: 'Second' },
        ],
        hasMore: false,
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
