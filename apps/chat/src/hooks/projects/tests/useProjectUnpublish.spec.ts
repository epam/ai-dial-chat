import { useUnpublishableFolders } from '@epam/ai-dial-chat-hooks';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CatalogPublishEntityType,
  publishApiClient,
  unpublishCatalogEntity,
} from '../../../server-api/publish.api';
import {
  EntityOperation,
  NotifiableEntity,
} from '../../../types/entity-notification';
import { useProjectUnpublish } from '../useProjectUnpublish';

const mocks = vi.hoisted(() => ({
  notifyOperationSuccess: vi.fn(),
  showPublishError: vi.fn(),
  refresh: vi.fn(),
}));

const translation = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({
  useTranslation: () => translation,
}));
vi.mock('../../useOperationNotification', () => ({
  useOperationNotification: () => ({
    notifyOperationSuccess: mocks.notifyOperationSuccess,
  }),
}));
vi.mock('../../publish/usePublishErrorNotification', () => ({
  usePublishErrorNotification: () => mocks.showPublishError,
}));
vi.mock('@epam/ai-dial-chat-hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-chat-hooks')>()),
  useUnpublishableFolders: vi.fn(),
}));
vi.mock('../../../server-api/publish.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../server-api/publish.api')>()),
  unpublishCatalogEntity: vi.fn(),
}));

const OWN_ID = 'projects/bucket-1/Sales';
const ownProject = { id: OWN_ID, name: 'Sales' };

const givenFolders = (folders: string[][], isResolved = true) => {
  vi.mocked(useUnpublishableFolders).mockReturnValue({
    isResolved,
    folders,
    refresh: mocks.refresh,
  });
};

const renderUnpublish = () =>
  renderHook(() => useProjectUnpublish({ project: ownProject, isAdmin: true }));

const openDialog = (folders: string[][]) => {
  givenFolders(folders);
  const view = renderUnpublish();
  act(() => view.result.current.requestUnpublish());
  return view;
};

describe('useProjectUnpublish', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(unpublishCatalogEntity).mockResolvedValue({} as never);
  });

  it('never treats the project as owned, so a personal project is not offered Unpublish', () => {
    givenFolders([], false);

    const { result } = renderUnpublish();

    expect(useUnpublishableFolders).toHaveBeenCalledWith(
      publishApiClient,
      {
        entityType: CatalogPublishEntityType.Project,
        entityId: OWN_ID,
        isOwner: false,
      },
      true,
    );
    expect(result.current.isPublishStateResolved).toBe(false);
  });

  it('passes no target while the project is loading', () => {
    givenFolders([], false);

    renderHook(() => useProjectUnpublish({ project: null, isAdmin: false }));

    expect(useUnpublishableFolders).toHaveBeenCalledWith(
      publishApiClient,
      null,
      false,
    );
  });

  it('opens the dialog with the project name and joined folders', () => {
    const { result } = openDialog([['Organization', 'Data']]);

    expect(result.current.dialog).toMatchObject({
      isOpen: true,
      name: 'Sales',
      folders: ['Organization/Data'],
      selectedFolder: null,
    });
  });

  it('does not open the dialog for an unpublished project', () => {
    const { result } = openDialog([]);

    expect(result.current.dialog.isOpen).toBe(false);
  });

  it('unpublishes from the only folder, reports a pending request and refreshes', async () => {
    const { result } = openDialog([['Organization', 'Data']]);

    await act(() => result.current.dialog.onConfirm());

    expect(unpublishCatalogEntity).toHaveBeenCalledWith(
      CatalogPublishEntityType.Project,
      OWN_ID,
      { folderPath: 'Organization/Data' },
    );
    expect(mocks.notifyOperationSuccess).toHaveBeenCalledOnce();
    expect(mocks.notifyOperationSuccess).toHaveBeenCalledWith(
      NotifiableEntity.Project,
      EntityOperation.UnpublishRequested,
      { name: 'Sales', folder: 'Data' },
    );
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(result.current.dialog.isOpen).toBe(false);
  });

  it('sends the public root as an empty folder path', async () => {
    const { result } = openDialog([[]]);

    await act(() => result.current.dialog.onConfirm());

    expect(unpublishCatalogEntity).toHaveBeenCalledWith(
      CatalogPublishEntityType.Project,
      OWN_ID,
      { folderPath: '' },
    );
  });

  it('unpublishes from the folder the user picked', async () => {
    const { result } = openDialog([
      ['Organization', 'Data'],
      ['Organization', 'Sales'],
    ]);

    act(() =>
      result.current.dialog.onSelectedFolderChange('Organization/Sales'),
    );
    await act(() => result.current.dialog.onConfirm());

    expect(unpublishCatalogEntity).toHaveBeenCalledWith(
      CatalogPublishEntityType.Project,
      OWN_ID,
      { folderPath: 'Organization/Sales' },
    );
    expect(result.current.dialog.selectedFolder).toBeNull();
  });

  it('reports a failure through the shared publish error notification', async () => {
    const error = new Error('forbidden');
    vi.mocked(unpublishCatalogEntity).mockRejectedValue(error);
    const { result } = openDialog([['Organization', 'Data']]);

    await act(() => result.current.dialog.onConfirm());

    expect(mocks.showPublishError).toHaveBeenCalledWith(
      error,
      EntityOperation.UnpublishRequested,
    );
    expect(mocks.notifyOperationSuccess).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(result.current.dialog.isOpen).toBe(false);
  });

  it('closes the dialog without a request on cancel', () => {
    const { result } = openDialog([['Organization', 'Data']]);

    act(() => result.current.dialog.onClose());

    expect(result.current.dialog.isOpen).toBe(false);
    expect(unpublishCatalogEntity).not.toHaveBeenCalled();
  });
});
