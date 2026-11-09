import {
  ProjectSource,
  type ProjectDetailsDto,
} from '@epam/ai-dial-chat-api-client';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { discardSharedCatalogItem } from '../../../server-api/share.api';
import { ROUTES } from '../../../types/routes';
import { useProjectRemoveFromList } from '../useProjectRemoveFromList';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  showErrorNotification: vi.fn(),
  showSuccessNotification: vi.fn(),
  setPinnedProject: vi.fn(),
  replacePinnedProjectId: vi.fn(),
}));

vi.mock('react-router', () => ({ useNavigate: () => mocks.navigate }));
const translation = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({
  useTranslation: () => translation,
}));
vi.mock('../../../context/NotificationContext', () => ({
  useNotification: () => ({
    showErrorNotification: mocks.showErrorNotification,
    showSuccessNotification: mocks.showSuccessNotification,
  }),
}));
vi.mock('../../../context/UserConfigContext', () => ({
  useUserConfig: () => ({
    setPinnedProject: mocks.setPinnedProject,
    replacePinnedProjectId: mocks.replacePinnedProjectId,
  }),
}));
vi.mock('../../../server-api/share.api', () => ({
  discardSharedCatalogItem: vi.fn(),
}));
vi.mock('@epam/ai-dial-chat-hooks', () => ({
  getApiErrorDetails: vi.fn().mockResolvedValue({ traceId: 'trace-1' }),
}));

const project: ProjectDetailsDto = {
  id: 'projects/owner/q4',
  name: 'q4',
  bucket: 'owner',
  path: 'q4',
  source: ProjectSource.Shared,
  description: '',
  instructions: '',
  contextFiles: [],
  etag: '"e1"',
  contentVersion: '"cv1"',
  conversationCount: 0,
  canEdit: false,
  canManage: false,
};

describe('useProjectRemoveFromList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setPinnedProject.mockResolvedValue(undefined);
  });

  it('discards the share, unpins, toasts and leaves for the Projects list', async () => {
    vi.mocked(discardSharedCatalogItem).mockResolvedValue({ success: true });
    const onSettled = vi.fn();
    const { result } = renderHook(() =>
      useProjectRemoveFromList(project, { onSettled }),
    );

    await act(() => result.current.confirmRemove());

    expect(discardSharedCatalogItem).toHaveBeenCalledOnce();
    expect(discardSharedCatalogItem).toHaveBeenCalledWith('projects/owner/q4');
    expect(mocks.setPinnedProject).toHaveBeenCalledWith(
      'projects/owner/q4',
      false,
    );
    expect(mocks.showSuccessNotification).toHaveBeenCalledOnce();
    expect(onSettled).toHaveBeenCalledOnce();
    expect(mocks.navigate).toHaveBeenCalledWith(ROUTES.Projects, {
      replace: true,
    });
    expect(result.current.isRemoving).toBe(false);
  });

  it('keeps the route when leaveOnRemove is false', async () => {
    vi.mocked(discardSharedCatalogItem).mockResolvedValue({ success: true });
    const { result } = renderHook(() =>
      useProjectRemoveFromList(project, { leaveOnRemove: false }),
    );

    await act(() => result.current.confirmRemove());

    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('mirrors the unpin locally when the pin write fails', async () => {
    vi.mocked(discardSharedCatalogItem).mockResolvedValue({ success: true });
    mocks.setPinnedProject.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useProjectRemoveFromList(project));

    await act(() => result.current.confirmRemove());

    expect(mocks.replacePinnedProjectId).toHaveBeenCalledWith(
      'projects/owner/q4',
      null,
    );
    expect(mocks.showSuccessNotification).toHaveBeenCalledOnce();
  });

  it('shows an error with the trace id and changes nothing when the discard fails', async () => {
    vi.mocked(discardSharedCatalogItem).mockRejectedValue(new Error('403'));
    const onSettled = vi.fn();
    const { result } = renderHook(() =>
      useProjectRemoveFromList(project, { onSettled }),
    );

    await act(() => result.current.confirmRemove());

    expect(mocks.showErrorNotification).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'trace-1' }),
    );
    expect(mocks.setPinnedProject).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.showSuccessNotification).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledOnce();
    expect(result.current.isRemoving).toBe(false);
  });

  it('sends one request when confirmed twice while pending', async () => {
    let resolve: (value: { success: boolean }) => void = () => undefined;
    vi.mocked(discardSharedCatalogItem).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const { result } = renderHook(() => useProjectRemoveFromList(project));

    let first!: Promise<void>;
    await act(async () => {
      first = result.current.confirmRemove();
      await result.current.confirmRemove();
    });
    expect(result.current.isRemoving).toBe(true);
    await act(async () => {
      resolve({ success: true });
      await first;
    });

    expect(discardSharedCatalogItem).toHaveBeenCalledOnce();
  });

  it('does nothing without a project', async () => {
    const { result } = renderHook(() => useProjectRemoveFromList(null));

    await act(() => result.current.confirmRemove());

    expect(discardSharedCatalogItem).not.toHaveBeenCalled();
  });
});
