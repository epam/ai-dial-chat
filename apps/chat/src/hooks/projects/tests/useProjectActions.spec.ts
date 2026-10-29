import {
  ProjectSource,
  ResponseError,
  type ProjectDetailsDto,
} from '@epam/ai-dial-chat-api-client';
import { triggerBrowserDownload } from '@epam/ai-dial-chat-hooks/utils';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteProject,
  downloadProjectArchive,
  downloadProjectContextFile,
} from '../../../server-api/projects.api';
import {
  EntityOperation,
  NotifiableEntity,
} from '../../../types/entity-notification';
import { ROUTES } from '../../../types/routes';
import { useProjectActions } from '../useProjectActions';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  showErrorNotification: vi.fn(),
  notifyOperationSuccess: vi.fn(),
  setPinnedProject: vi.fn(),
  replacePinnedProjectId: vi.fn(),
  pinnedProjectIds: [] as string[],
}));

vi.mock('react-router', () => ({ useNavigate: () => mocks.navigate }));
const translation = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({
  useTranslation: () => translation,
}));
vi.mock('../../../context/NotificationContext', () => ({
  useNotification: () => ({
    showErrorNotification: mocks.showErrorNotification,
  }),
}));
vi.mock('../../useOperationNotification', () => ({
  useOperationNotification: () => ({
    notifyOperationSuccess: mocks.notifyOperationSuccess,
  }),
}));
vi.mock('../../../context/UserConfigContext', () => ({
  useUserConfig: () => ({
    pinnedProjectIds: mocks.pinnedProjectIds,
    setPinnedProject: mocks.setPinnedProject,
    replacePinnedProjectId: mocks.replacePinnedProjectId,
  }),
}));
vi.mock('../../../server-api/projects.api', () => ({
  deleteProject: vi.fn(),
  downloadProjectArchive: vi.fn(),
  downloadProjectContextFile: vi.fn(),
}));
vi.mock('@epam/ai-dial-chat-hooks/utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-chat-hooks/utils')>()),
  triggerBrowserDownload: vi.fn(),
}));

const project: ProjectDetailsDto = {
  id: 'projects/b/q4',
  name: 'q4',
  bucket: 'b',
  path: 'q4',
  source: ProjectSource.Personal,
  description: '',
  instructions: '',
  contextFiles: [],
  etag: '"e1"',
  canEdit: true,
};

const conflict = () =>
  new ResponseError(
    new Response(JSON.stringify({ code: 'project-changed' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

describe('useProjectActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pinnedProjectIds = [];
    mocks.setPinnedProject.mockResolvedValue(undefined);
  });

  it('reports the pinned state and toggles the pin', async () => {
    mocks.pinnedProjectIds = ['projects/b/q4'];
    const { result } = renderHook(() => useProjectActions(project, vi.fn()));

    expect(result.current.isPinned).toBe(true);
    await act(() => result.current.togglePin());

    expect(mocks.setPinnedProject).toHaveBeenCalledWith('projects/b/q4', false);
    expect(result.current.isPinPending).toBe(false);
  });

  it('shows an error toast when the pin cannot be saved', async () => {
    mocks.setPinnedProject.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useProjectActions(project, vi.fn()));

    await act(() => result.current.togglePin());

    expect(mocks.showErrorNotification).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'projects.actions.pinError' }),
    );
  });

  it('downloads the archive and confirms with the saved name', async () => {
    const response = new Response('zip');
    vi.mocked(downloadProjectArchive).mockResolvedValue(response);
    vi.mocked(triggerBrowserDownload).mockResolvedValue('q4.zip');
    const { result } = renderHook(() => useProjectActions(project, vi.fn()));

    await act(() => result.current.downloadArchive());

    expect(triggerBrowserDownload).toHaveBeenCalledWith(response, 'q4.zip');
    expect(mocks.notifyOperationSuccess).toHaveBeenCalledWith(
      NotifiableEntity.Project,
      EntityOperation.Downloaded,
      { name: 'q4.zip' },
    );
  });

  it('downloads one context file under its own name', async () => {
    const response = new Response('a,b');
    vi.mocked(downloadProjectContextFile).mockResolvedValue(response);
    const { result } = renderHook(() => useProjectActions(project, vi.fn()));

    await act(() => result.current.openFile('tickets.csv'));

    expect(downloadProjectContextFile).toHaveBeenCalledWith(
      'projects/b/q4',
      'tickets.csv',
    );
    expect(triggerBrowserDownload).toHaveBeenCalledWith(
      response,
      'tickets.csv',
    );
  });

  it('shows a download error toast when the download fails', async () => {
    vi.mocked(downloadProjectArchive).mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useProjectActions(project, vi.fn()));

    await act(() => result.current.downloadArchive());

    expect(mocks.showErrorNotification).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'projects.actions.downloadError' }),
    );
  });

  it('deletes with the loaded ETag, confirms and returns to the list', async () => {
    vi.mocked(deleteProject).mockResolvedValue(undefined);
    const { result } = renderHook(() => useProjectActions(project, vi.fn()));

    act(() => result.current.requestDelete());
    expect(result.current.isDeleteOpen).toBe(true);
    await act(() => result.current.confirmDelete());

    expect(deleteProject).toHaveBeenCalledWith('projects/b/q4', '"e1"');
    expect(mocks.notifyOperationSuccess).toHaveBeenCalledWith(
      NotifiableEntity.Project,
      EntityOperation.Deleted,
      { name: 'q4' },
    );
    expect(mocks.navigate).toHaveBeenCalledWith(ROUTES.Projects, {
      replace: true,
    });
    expect(result.current.isDeleteOpen).toBe(false);
  });

  it('drops the deleted project from the local pins without a request', async () => {
    vi.mocked(deleteProject).mockResolvedValue(undefined);
    const { result } = renderHook(() => useProjectActions(project, vi.fn()));

    await act(() => result.current.confirmDelete());

    expect(mocks.replacePinnedProjectId).toHaveBeenCalledWith(
      'projects/b/q4',
      null,
    );
    expect(mocks.setPinnedProject).not.toHaveBeenCalled();
  });

  it('keeps its result stable across re-renders with unchanged state', () => {
    const onReload = vi.fn();
    const { result, rerender } = renderHook(() =>
      useProjectActions(project, onReload),
    );
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });

  it('closes the dialog and reloads when the project changed elsewhere', async () => {
    vi.mocked(deleteProject).mockRejectedValue(conflict());
    const onReload = vi.fn();
    const { result } = renderHook(() => useProjectActions(project, onReload));

    act(() => result.current.requestDelete());
    await act(() => result.current.confirmDelete());

    expect(onReload).toHaveBeenCalledOnce();
    expect(result.current.isDeleteOpen).toBe(false);
    expect(mocks.showErrorNotification).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'projects.errors.changedElsewhere' }),
    );
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('keeps the dialog open after any other delete failure', async () => {
    vi.mocked(deleteProject).mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useProjectActions(project, vi.fn()));

    act(() => result.current.requestDelete());
    await act(() => result.current.confirmDelete());

    await waitFor(() => expect(result.current.isDeleting).toBe(false));
    expect(result.current.isDeleteOpen).toBe(true);
    expect(mocks.showErrorNotification).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'projects.actions.deleteError' }),
    );
  });
});
