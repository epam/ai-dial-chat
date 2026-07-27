import type { DialFile } from '@epam/ai-dial-ui-kit';
import { DialFileNodeType, NotificationVariant } from '@epam/ai-dial-ui-kit';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as filesApi from '../../../../server-api/files.api';
import type { UseDialFileSharingOptions } from '../../useDialFileSharing';
import { useDialFileSharing } from '../../useDialFileSharing';

vi.mock('../../../../server-api/files.api');

const mockDiscardShared = vi.mocked(filesApi.discardShared);
const mockRevokeAccess = vi.mocked(filesApi.revokeAccess);

const BUCKET = 'test-bucket';
const OWNER_BUCKET = 'owner-bucket';

const renderSharing = (overrides: Partial<UseDialFileSharingOptions> = {}) => {
  const bumpRetry = vi.fn();
  const onNotification = vi.fn();
  const { result } = renderHook(() =>
    useDialFileSharing({
      bucket: BUCKET,
      rootLabel: 'My files',
      bumpRetry,
      onNotification,
      ...overrides,
    }),
  );
  return { result, bumpRetry, onNotification };
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

    it('onUnshareFiles calls discardShared and triggers a retry with no toast on success', async () => {
      mockDiscardShared.mockResolvedValue({ success: true });

      const { result, bumpRetry, onNotification } = renderSharing();

      act(() => result.current.onUnshareFiles([sharedWithMeFile]));

      await waitFor(() =>
        expect(mockDiscardShared).toHaveBeenCalledWith([
          { bucket: OWNER_BUCKET, path: 'team-docs/' },
        ]),
      );
      await waitFor(() => expect(bumpRetry).toHaveBeenCalled());
      expect(onNotification).not.toHaveBeenCalled();
    });

    it('onUnshareFiles shows an error toast on failure', async () => {
      mockDiscardShared.mockRejectedValue(new Error('failed'));

      const { result, onNotification } = renderSharing();

      act(() => result.current.onUnshareFiles([sharedWithMeFile]));

      await waitFor(() =>
        expect(onNotification).toHaveBeenCalledWith(
          expect.objectContaining({ variant: NotificationVariant.Error }),
        ),
      );
    });

    it('onRemoveFilesAccess calls revokeAccess and triggers a retry with no toast on success', async () => {
      mockRevokeAccess.mockResolvedValue({ success: true });

      const { result, bumpRetry, onNotification } = renderSharing();

      act(() => result.current.onRemoveFilesAccess([myOwnedFile]));

      await waitFor(() =>
        expect(mockRevokeAccess).toHaveBeenCalledWith([
          { bucket: BUCKET, path: 'report.pdf' },
        ]),
      );
      await waitFor(() => expect(bumpRetry).toHaveBeenCalled());
      expect(onNotification).not.toHaveBeenCalled();
    });

    it('onRemoveFilesAccess shows an error toast on failure', async () => {
      mockRevokeAccess.mockRejectedValue(new Error('failed'));

      const { result, onNotification } = renderSharing();

      act(() => result.current.onRemoveFilesAccess([myOwnedFile]));

      await waitFor(() =>
        expect(onNotification).toHaveBeenCalledWith(
          expect.objectContaining({ variant: NotificationVariant.Error }),
        ),
      );
    });

    it('resolves bucket/path correctly for a batch of items', async () => {
      mockDiscardShared.mockResolvedValue({ success: true });

      const secondSharedFile: DialFile = {
        id: `files/${OWNER_BUCKET}/notes.txt`,
        name: 'notes.txt',
        path: '/Shared with me/notes.txt',
        parentPath: '/Shared with me',
        nodeType: DialFileNodeType.ITEM,
        folderId: `${OWNER_BUCKET}:`,
        bucket: OWNER_BUCKET,
      };

      const { result } = renderSharing();

      act(() =>
        result.current.onUnshareFiles([sharedWithMeFile, secondSharedFile]),
      );

      await waitFor(() =>
        expect(mockDiscardShared).toHaveBeenCalledWith([
          { bucket: OWNER_BUCKET, path: 'team-docs/' },
          { bucket: OWNER_BUCKET, path: 'notes.txt' },
        ]),
      );
    });
  });
});
