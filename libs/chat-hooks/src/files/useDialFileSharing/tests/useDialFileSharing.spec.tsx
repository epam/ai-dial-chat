import type { DialFile } from '@epam/ai-dial-react-file-manager';
import { DialFileNodeType } from '@epam/ai-dial-react-file-manager';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FileManagerNotificationReason } from '../../dial-file-manager.types';
import type { DialFilesApi } from '../../dial-files-api';
import type { UseDialFileSharingOptions } from '../useDialFileSharing';
import { useDialFileSharing } from '../useDialFileSharing';

const BUCKET = 'test-bucket';
const OWNER_BUCKET = 'owner-bucket';

const makeFilesApi = (): DialFilesApi =>
  ({
    discardShared: vi.fn(),
    revokeAccess: vi.fn(),
  }) as unknown as DialFilesApi;

const renderSharing = (overrides: Partial<UseDialFileSharingOptions> = {}) => {
  const bumpRetry = vi.fn();
  const onNotification = vi.fn();
  const filesApi = overrides.filesApi ?? makeFilesApi();
  const { result } = renderHook(() =>
    useDialFileSharing({
      filesApi,
      bucket: BUCKET,
      rootLabel: 'My files',
      bumpRetry,
      onNotification,
      ...overrides,
    }),
  );
  return { result, bumpRetry, onNotification, filesApi };
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('useDialFileSharing', () => {
  describe('onUnshareFiles and onRemoveFilesAccess', () => {
    const sharedWithMeFile: DialFile = {
      id: `files/${OWNER_BUCKET}/team-docs/`,
      name: 'team-docs',
      path: '/Shared with me/team-docs/',
      parentPath: '/Shared with me',
      nodeType: DialFileNodeType.FOLDER,
      folderId: `${OWNER_BUCKET}:files/${OWNER_BUCKET}/team-docs/`,
      bucket: OWNER_BUCKET,
    };

    const myOwnedFile: DialFile = {
      id: `files/${BUCKET}/report.pdf`,
      name: 'report.pdf',
      path: '/My files/report.pdf',
      parentPath: '/My files',
      nodeType: DialFileNodeType.ITEM,
      folderId: `${BUCKET}:`,
      bucket: BUCKET,
    };

    it('onUnshareFiles calls discardShared and triggers a retry with no notification on success', async () => {
      const { result, bumpRetry, onNotification, filesApi } = renderSharing();
      vi.mocked(filesApi.discardShared).mockResolvedValue({ success: true });

      act(() => result.current.onUnshareFiles([sharedWithMeFile]));

      await waitFor(() =>
        expect(filesApi.discardShared).toHaveBeenCalledWith([
          { bucket: OWNER_BUCKET, path: 'team-docs/' },
        ]),
      );
      await waitFor(() => expect(bumpRetry).toHaveBeenCalled());
      expect(onNotification).not.toHaveBeenCalled();
    });

    it('onUnshareFiles shows an UnshareFailed notification on failure', async () => {
      const { result, onNotification, filesApi } = renderSharing();
      vi.mocked(filesApi.discardShared).mockRejectedValue(new Error('failed'));

      act(() => result.current.onUnshareFiles([sharedWithMeFile]));

      await waitFor(() =>
        expect(onNotification).toHaveBeenCalledWith({
          variant: NotificationVariant.Error,
          reason: FileManagerNotificationReason.UnshareFailed,
        }),
      );
    });

    it('onRemoveFilesAccess calls revokeAccess and triggers a retry with no notification on success', async () => {
      const { result, bumpRetry, onNotification, filesApi } = renderSharing();
      vi.mocked(filesApi.revokeAccess).mockResolvedValue({ success: true });

      act(() => result.current.onRemoveFilesAccess([myOwnedFile]));

      await waitFor(() =>
        expect(filesApi.revokeAccess).toHaveBeenCalledWith([
          { bucket: BUCKET, path: 'report.pdf' },
        ]),
      );
      await waitFor(() => expect(bumpRetry).toHaveBeenCalled());
      expect(onNotification).not.toHaveBeenCalled();
    });

    it('onRemoveFilesAccess shows a RemoveAccessFailed notification on failure', async () => {
      const { result, onNotification, filesApi } = renderSharing();
      vi.mocked(filesApi.revokeAccess).mockRejectedValue(new Error('failed'));

      act(() => result.current.onRemoveFilesAccess([myOwnedFile]));

      await waitFor(() =>
        expect(onNotification).toHaveBeenCalledWith({
          variant: NotificationVariant.Error,
          reason: FileManagerNotificationReason.RemoveAccessFailed,
        }),
      );
    });

    it('resolves bucket/path correctly for a batch of items', async () => {
      const { result, filesApi } = renderSharing();
      vi.mocked(filesApi.discardShared).mockResolvedValue({ success: true });

      const secondSharedFile: DialFile = {
        id: `files/${OWNER_BUCKET}/notes.txt`,
        name: 'notes.txt',
        path: '/Shared with me/notes.txt',
        parentPath: '/Shared with me',
        nodeType: DialFileNodeType.ITEM,
        folderId: `${OWNER_BUCKET}:`,
        bucket: OWNER_BUCKET,
      };

      act(() =>
        result.current.onUnshareFiles([sharedWithMeFile, secondSharedFile]),
      );

      await waitFor(() =>
        expect(filesApi.discardShared).toHaveBeenCalledWith([
          { bucket: OWNER_BUCKET, path: 'team-docs/' },
          { bucket: OWNER_BUCKET, path: 'notes.txt' },
        ]),
      );
    });
  });
});
