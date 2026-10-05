import type { ListFilesItemDto } from '@epam/ai-dial-chat-api-client';
import { ListFilesItemDtoNodeTypeEnum } from '@epam/ai-dial-chat-api-client';
import { DialFileManagerActionProfile } from '@epam/ai-dial-chat-shared';
import {
  DialFileManagerActions,
  DialFileManagerTabs,
  DialFileNodeType,
  FileManagerColumnKey,
} from '@epam/ai-dial-react-file-manager';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialFileManagerSection } from '../../dial-file-manager.model';
import { FileManagerNotificationReason } from '../../dial-file-manager.types';
import type { DialFilesApi } from '../../dial-files-api';
import { DownloadDestinationType } from '../../download-destination';
import type { UseDialFileManagerSectionsOptions } from '../useDialFileManagerSections';
import { useDialFileManagerSections } from '../useDialFileManagerSections';

const BUCKET = 'test-bucket';
const OWNER_BUCKET = 'owner-bucket';

const SECTIONS: DialFileManagerSection[] = [
  { tab: DialFileManagerTabs.MyFiles, rootLabel: 'My files' },
  { tab: DialFileManagerTabs.Shared, rootLabel: 'Shared' },
  { tab: DialFileManagerTabs.Organization, rootLabel: 'Organization' },
];

const LABELS: Partial<Record<DialFileManagerActions, string>> = {
  [DialFileManagerActions.Download]: 'Download',
  [DialFileManagerActions.Delete]: 'Delete',
  [DialFileManagerActions.Rename]: 'Rename',
  [DialFileManagerActions.Copy]: 'Copy',
  [DialFileManagerActions.Move]: 'Move',
  [DialFileManagerActions.Duplicate]: 'Duplicate',
  [DialFileManagerActions.RemoveAccess]: 'Remove access',
  [DialFileManagerActions.Unshare]: 'Unshare',
  [DialFileManagerActions.Info]: 'Info',
};

const folder = (
  name: string,
  overrides: Partial<ListFilesItemDto> = {},
): ListFilesItemDto => ({
  name,
  path: `files/${BUCKET}/${name}/`,
  folderId: `${BUCKET}:files/${BUCKET}/${name}/`,
  nodeType: ListFilesItemDtoNodeTypeEnum.Folder,
  bucket: BUCKET,
  ...overrides,
});

const sharedRootItem = folder('team-docs', {
  path: `files/${OWNER_BUCKET}/team-docs/`,
  folderId: `${OWNER_BUCKET}:files/${OWNER_BUCKET}/team-docs/`,
  bucket: OWNER_BUCKET,
  permissions: ['READ', 'WRITE'],
  author: 'Owner User',
});

const makeFilesApi = (): DialFilesApi => ({
  listFiles: vi.fn(),
  listPublicFiles: vi.fn(),
  listSharedFiles: vi.fn(),
  listSharedByMe: vi.fn(),
  getFileMetadata: vi.fn(),
  uploadFile: vi.fn(),
  uploadArchive: vi.fn(),
  createFolder: vi.fn(),
  deleteFiles: vi.fn(),
  renameFiles: vi.fn(),
  copyFiles: vi.fn(),
  moveFiles: vi.fn(),
  downloadFile: vi.fn(),
  downloadArchive: vi.fn(),
  revokeAccess: vi.fn(),
  discardShared: vi.fn(),
});

let filesApi: DialFilesApi;
let onNotification: ReturnType<typeof vi.fn>;

const buildOptions = (
  overrides: Partial<UseDialFileManagerSectionsOptions> = {},
): UseDialFileManagerSectionsOptions => ({
  filesApi,
  bucket: BUCKET,
  activeTab: DialFileManagerTabs.All,
  sections: SECTIONS,
  actionProfile: DialFileManagerActionProfile.Full,
  labels: LABELS,
  locale: 'en',
  disabledNewButtonTooltip: 'No permission to create',
  downloadDestination: {
    resolveDestination: vi
      .fn()
      .mockResolvedValue({ type: DownloadDestinationType.Blob }),
    triggerDownload: vi.fn(),
  },
  buildValidationErrorMessage: (error) => error.reason,
  onNotification:
    onNotification as UseDialFileManagerSectionsOptions['onNotification'],
  ...overrides,
});

const renderSections = (
  overrides: Partial<UseDialFileManagerSectionsOptions> = {},
) =>
  renderHook(
    (props: Partial<UseDialFileManagerSectionsOptions>) =>
      useDialFileManagerSections(buildOptions(props)),
    { initialProps: overrides },
  );

const waitForSettled = async (result: {
  current: { isLoading: boolean };
}): Promise<void> => {
  await waitFor(() => expect(result.current.isLoading).toBe(false));
};

beforeEach(() => {
  filesApi = makeFilesApi();
  onNotification = vi.fn();
  vi.mocked(filesApi.listFiles).mockImplementation((query) =>
    Promise.resolve(
      query.bucket === OWNER_BUCKET
        ? {
            bucket: OWNER_BUCKET,
            path: query.path ?? '',
            items: [],
            permissions: ['READ', 'WRITE'],
          }
        : {
            bucket: BUCKET,
            path: query.path ?? '',
            items: query.path
              ? []
              : [folder('reports'), folder('Shared stuff')],
            permissions: ['READ', 'WRITE'],
          },
    ),
  );
  vi.mocked(filesApi.listSharedFiles).mockResolvedValue({
    bucket: '',
    path: '',
    items: [sharedRootItem],
  });
  vi.mocked(filesApi.listPublicFiles).mockResolvedValue({
    bucket: 'public',
    path: '',
    items: [],
  });
  vi.mocked(filesApi.listSharedByMe).mockResolvedValue({
    bucket: BUCKET,
    path: '',
    items: [],
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useDialFileManagerSections', () => {
  describe('single tab', () => {
    it('returns the Shared section alone and leaves the other sections idle', async () => {
      const { result } = renderSections({
        activeTab: DialFileManagerTabs.Shared,
      });
      await waitForSettled(result);

      expect(result.current.sectionTab).toBe(DialFileManagerTabs.Shared);
      expect(result.current.items.map((item) => item.path)).toEqual([
        '/Shared',
      ]);
      expect(filesApi.listSharedFiles).toHaveBeenCalled();
      expect(filesApi.listFiles).not.toHaveBeenCalled();
      expect(filesApi.listPublicFiles).not.toHaveBeenCalled();
    });
  });

  describe('All view', () => {
    it('renders one top-level folder per section and browses My files first', async () => {
      const { result } = renderSections();
      await waitForSettled(result);

      expect(result.current.items.map((item) => item.path)).toEqual([
        '/My files',
        '/Shared',
        '/Organization',
      ]);
      expect(result.current.path).toBe('/My files');
      expect(result.current.sectionTab).toBe(DialFileManagerTabs.MyFiles);
    });

    it('never loads a section the host did not enable', async () => {
      const { result } = renderSections({ sections: SECTIONS.slice(0, 2) });
      await waitForSettled(result);

      expect(result.current.items.map((item) => item.path)).toEqual([
        '/My files',
        '/Shared',
      ]);
      expect(filesApi.listPublicFiles).not.toHaveBeenCalled();
    });

    it('keeps a stable hook order when the enabled sections change', async () => {
      const { result, rerender } = renderSections();
      await waitForSettled(result);

      rerender({ sections: SECTIONS.slice(0, 1) });

      expect(result.current.items.map((item) => item.path)).toEqual([
        '/My files',
      ]);
    });

    it('expands a shared folder through the Shared section only', async () => {
      const { result } = renderSections();
      await waitForSettled(result);

      act(() =>
        result.current.onExpandedPathsChange(new Set(['/Shared/team-docs'])),
      );

      await waitFor(() =>
        expect(filesApi.listFiles).toHaveBeenCalledWith(
          expect.objectContaining({ bucket: OWNER_BUCKET }),
        ),
      );
      expect(result.current.expandedPaths.has('/Shared/team-docs')).toBe(true);
    });
  });

  describe('per-section rules on All', () => {
    it('applies Shared rules inside a nested shared folder', async () => {
      const { result } = renderSections();
      await waitForSettled(result);

      act(() => result.current.onPathChange('/Shared/team-docs/'));
      await waitFor(() =>
        expect(result.current.path).toBe('/Shared/team-docs/'),
      );
      await waitForSettled(result);

      expect(result.current.sectionTab).toBe(DialFileManagerTabs.Shared);
      expect(result.current.visibleColumns).toContain(
        FileManagerColumnKey.Author,
      );
      expect(result.current.uploadEnabled).toBe(true);
      expect(result.current.actionLabels).not.toHaveProperty(
        DialFileManagerActions.Delete,
      );
    });

    it('disables upload at the Shared root', async () => {
      const { result } = renderSections();
      await waitForSettled(result);

      act(() => result.current.onPathChange('/Shared'));

      await waitFor(() =>
        expect(result.current.sectionTab).toBe(DialFileManagerTabs.Shared),
      );
      expect(result.current.uploadEnabled).toBe(false);
    });

    it('keeps Organization read-only', async () => {
      const { result } = renderSections();
      await waitForSettled(result);

      act(() => result.current.onPathChange('/Organization'));
      await waitFor(() =>
        expect(result.current.sectionTab).toBe(
          DialFileManagerTabs.Organization,
        ),
      );

      expect(result.current.uploadEnabled).toBe(false);
      expect(Object.keys(result.current.actionLabels).sort()).toEqual(
        [DialFileManagerActions.Download, DialFileManagerActions.Info].sort(),
      );
    });

    it('offers the same My files actions as the My files tab', async () => {
      const { result: allTab } = renderSections();
      const { result: myFilesTab } = renderSections({
        activeTab: DialFileManagerTabs.MyFiles,
      });
      await waitForSettled(allTab);
      await waitForSettled(myFilesTab);

      expect(allTab.current.actionLabels).toEqual(
        myFilesTab.current.actionLabels,
      );
      expect(allTab.current.actionLabels).toHaveProperty(
        DialFileManagerActions.Delete,
      );
    });

    it('keeps a My files folder named like a section in My files', async () => {
      const { result } = renderSections();
      await waitForSettled(result);

      act(() => result.current.onPathChange('/My files/Shared stuff/'));

      await waitFor(() =>
        expect(result.current.path).toBe('/My files/Shared stuff/'),
      );
      expect(result.current.sectionTab).toBe(DialFileManagerTabs.MyFiles);
    });
  });

  describe('operation routing on All', () => {
    it('deletes through the section that owns the items', async () => {
      vi.mocked(filesApi.deleteFiles).mockResolvedValue({
        results: [{ path: 'reports/old.pdf', success: true }],
      });
      const { result } = renderSections();
      await waitForSettled(result);
      act(() => result.current.onPathChange('/Organization'));

      act(() =>
        result.current.onDeleteFiles(
          [
            {
              sourceUrl: '/My files/reports/old.pdf',
              nodeType: DialFileNodeType.ITEM,
            },
          ],
          '/My files/reports',
        ),
      );

      await waitFor(() => expect(filesApi.deleteFiles).toHaveBeenCalledOnce());
    });

    it('splits a delete spanning two sections into one request per section', async () => {
      vi.mocked(filesApi.deleteFiles).mockResolvedValue({ results: [] });
      const { result } = renderSections();
      await waitForSettled(result);

      act(() =>
        result.current.onDeleteFiles(
          [
            {
              sourceUrl: '/My files/reports/old.pdf',
              nodeType: DialFileNodeType.ITEM,
            },
            {
              sourceUrl: '/Shared/team-docs/plan.pdf',
              nodeType: DialFileNodeType.ITEM,
            },
          ],
          '/My files/reports',
        ),
      );

      await waitFor(() =>
        expect(filesApi.deleteFiles).toHaveBeenCalledTimes(2),
      );
      expect(filesApi.deleteFiles).toHaveBeenCalledWith([
        expect.objectContaining({ bucket: BUCKET, name: 'old.pdf' }),
      ]);
      expect(filesApi.deleteFiles).toHaveBeenCalledWith([
        expect.objectContaining({ bucket: OWNER_BUCKET, name: 'plan.pdf' }),
      ]);
    });

    it('downloads files from two sections through their own sections', async () => {
      vi.mocked(filesApi.downloadFile).mockImplementation(() =>
        Promise.resolve(new Response('x')),
      );
      const { result } = renderSections();
      await waitForSettled(result);

      act(() =>
        result.current.onDownloadFiles([
          {
            name: 'old.pdf',
            path: '/My files/reports/old.pdf',
            folderId: `${BUCKET}:files/${BUCKET}/reports/`,
            bucket: BUCKET,
            nodeType: DialFileNodeType.ITEM,
          },
          {
            name: 'plan.pdf',
            path: '/Shared/team-docs/plan.pdf',
            folderId: `${OWNER_BUCKET}:files/${OWNER_BUCKET}/team-docs/`,
            bucket: OWNER_BUCKET,
            nodeType: DialFileNodeType.ITEM,
          },
        ]),
      );

      await waitFor(() =>
        expect(filesApi.downloadFile).toHaveBeenCalledTimes(2),
      );
      expect(filesApi.downloadFile).toHaveBeenCalledWith(
        BUCKET,
        expect.stringContaining('reports/old.pdf'),
      );
      expect(filesApi.downloadFile).toHaveBeenCalledWith(
        OWNER_BUCKET,
        expect.stringContaining('team-docs/plan.pdf'),
      );
    });

    it('keeps the upload queue visible after navigating to another section', async () => {
      vi.mocked(filesApi.uploadFile).mockImplementation(
        () => new Promise(() => undefined),
      );
      const { result } = renderSections();
      await waitForSettled(result);

      act(() =>
        result.current.onUploadFiles(
          [{ name: 'a.pdf', fileContent: new File(['a'], 'a.pdf') }],
          '/My files',
        ),
      );
      await waitFor(() =>
        expect(result.current.uploadBatchState).not.toBeNull(),
      );

      act(() => result.current.onPathChange('/Organization'));

      await waitFor(() =>
        expect(result.current.sectionTab).toBe(
          DialFileManagerTabs.Organization,
        ),
      );
      expect(result.current.uploadBatchState?.files[0]?.name).toBe('a.pdf');
      expect(result.current.isAnyOperationInProgress).toBe(true);
    });

    it('refuses to copy from Organization into My files', async () => {
      const { result } = renderSections();
      await waitForSettled(result);

      act(() =>
        result.current.onCopyFiles(
          [
            {
              sourceUrl: '/Organization/docs/a.pdf',
              destinationUrl: '/My files/a.pdf',
              nodeType: DialFileNodeType.ITEM,
            },
          ],
          '/My files',
        ),
      );

      expect(filesApi.copyFiles).not.toHaveBeenCalled();
      expect(onNotification).toHaveBeenCalledOnce();
      expect(onNotification).toHaveBeenCalledWith({
        variant: NotificationVariant.Warning,
        reason: FileManagerNotificationReason.CrossSectionTransferUnsupported,
      });
    });

    it('moves within My files', async () => {
      vi.mocked(filesApi.moveFiles).mockImplementation(
        () => new Promise(() => undefined),
      );
      const { result } = renderSections();
      await waitForSettled(result);

      act(() =>
        result.current.onMoveToFiles(
          [
            {
              sourceUrl: '/My files/a/draft.pdf',
              destinationUrl: '/My files/b/draft.pdf',
              nodeType: DialFileNodeType.ITEM,
            },
          ],
          '/My files/a',
          '/My files/b',
        ),
      );

      await waitFor(() => expect(filesApi.moveFiles).toHaveBeenCalledOnce());
      expect(onNotification).not.toHaveBeenCalledWith(
        expect.objectContaining({
          reason: FileManagerNotificationReason.CrossSectionTransferUnsupported,
        }),
      );
    });
  });

  describe('cross-section copy and move', () => {
    it('refuses a copy whose items come from two sections', async () => {
      const { result } = renderSections();
      await waitForSettled(result);

      act(() =>
        result.current.onCopyFiles(
          [
            {
              sourceUrl: '/My files/a.pdf',
              destinationUrl: '/My files/b/a.pdf',
              nodeType: DialFileNodeType.ITEM,
            },
            {
              sourceUrl: '/Organization/docs/b.pdf',
              destinationUrl: '/My files/b/b.pdf',
              nodeType: DialFileNodeType.ITEM,
            },
          ],
          '/My files/b',
        ),
      );

      expect(filesApi.copyFiles).not.toHaveBeenCalled();
      expect(onNotification).toHaveBeenCalledWith({
        variant: NotificationVariant.Warning,
        reason: FileManagerNotificationReason.CrossSectionTransferUnsupported,
      });
    });

    it('ignores an empty copy without a warning', async () => {
      const { result } = renderSections();
      await waitForSettled(result);

      act(() => result.current.onCopyFiles([], '/My files'));

      expect(filesApi.copyFiles).not.toHaveBeenCalled();
      expect(onNotification).not.toHaveBeenCalled();
    });
  });

  describe('sections outside the browsed one', () => {
    it('reports a failed Shared root once while My files is browsed', async () => {
      vi.mocked(filesApi.listSharedFiles).mockRejectedValue(new Error('500'));
      const { result, rerender } = renderSections();
      await waitForSettled(result);

      await waitFor(() =>
        expect(onNotification).toHaveBeenCalledWith({
          variant: NotificationVariant.Error,
          reason: FileManagerNotificationReason.FolderLoadFailed,
        }),
      );
      rerender({});
      expect(onNotification).toHaveBeenCalledOnce();
      expect(result.current.sectionTab).toBe(DialFileManagerTabs.MyFiles);
      expect(result.current.error).toBeNull();

      act(() => result.current.onPathChange('/Shared'));

      await waitFor(() => expect(result.current.error).not.toBeNull());
    });

    it('shows a loading root while another section is browsed', async () => {
      vi.mocked(filesApi.listPublicFiles).mockImplementation(
        () => new Promise(() => undefined),
      );
      const { result } = renderSections();
      await waitForSettled(result);

      expect(result.current.folderPopupLoadingPaths.has('/Organization')).toBe(
        true,
      );
    });
  });

  describe('root labels', () => {
    it('falls back to the tab id for a repeated or slash-containing label', async () => {
      const { result } = renderSections({
        sections: [
          { tab: DialFileManagerTabs.MyFiles, rootLabel: 'Files' },
          { tab: DialFileManagerTabs.Shared, rootLabel: 'Files' },
          { tab: DialFileManagerTabs.Organization, rootLabel: 'Org/Public' },
        ],
      });
      await waitForSettled(result);

      expect(result.current.items.map((item) => item.path)).toEqual([
        '/Files',
        `/${DialFileManagerTabs.Shared}`,
        `/${DialFileManagerTabs.Organization}`,
      ]);
    });
  });

  describe('tab switches', () => {
    it('resets a My files subfolder when switching from All to My files', async () => {
      const { result, rerender } = renderSections();
      await waitForSettled(result);
      act(() => result.current.onPathChange('/My files/reports/'));
      await waitFor(() =>
        expect(result.current.path).toBe('/My files/reports/'),
      );

      rerender({ activeTab: DialFileManagerTabs.MyFiles });

      await waitFor(() => expect(result.current.path).toBe('/My files'));
      expect(result.current.expandedPaths.size).toBe(0);
    });

    it('browses My files again after returning to All', async () => {
      const { result, rerender } = renderSections();
      await waitForSettled(result);
      act(() => result.current.onPathChange('/Shared'));
      await waitFor(() =>
        expect(result.current.sectionTab).toBe(DialFileManagerTabs.Shared),
      );

      rerender({ activeTab: DialFileManagerTabs.MyFiles });
      rerender({ activeTab: DialFileManagerTabs.All });

      await waitFor(() => expect(result.current.path).toBe('/My files'));
      expect(result.current.sectionTab).toBe(DialFileManagerTabs.MyFiles);
    });
  });
});
