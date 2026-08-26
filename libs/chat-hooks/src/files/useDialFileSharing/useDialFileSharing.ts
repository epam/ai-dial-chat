import type { DialFile } from '@epam/ai-dial-react-file-manager';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { useCallback, useState } from 'react';
import { FileManagerNotificationReason } from '../dial-file-manager.types';
import type { FileManagerNotification } from '../dial-file-manager.types';
import type { DialFilesApi } from '../dial-files-api';
import { resolveDialFileApiPath } from '../resolve-dial-file-api-path';

/** Options accepted by `useDialFileSharing`. */
export interface UseDialFileSharingOptions {
  /** Injected operation port used for every sharing network call. */
  filesApi: DialFilesApi;
  /** DIAL Core bucket to browse (used only for the my_files tab). */
  bucket: string;
  /** Display name for the root folder node. */
  rootLabel: string;
  /** Forces `useDialFileListing`'s fetch effect to re-run after a mutation settles. */
  bumpRetry: () => void;
  /** Called when a sharing mutation fails and should surface a toast notification. */
  onNotification?: (notification: FileManagerNotification) => void;
}

/** Values returned by `useDialFileSharing`. */
export interface UseDialFileSharingResult {
  isUnsharing: boolean;
  isRemovingAccess: boolean;
  onUnshareFiles: (files: DialFile[]) => void;
  onRemoveFilesAccess: (files: DialFile[]) => void;
}

/**
 * Manages the unshare/remove-access mutations. Bumps `useDialFileListing`'s
 * shared retry counter after each mutation settles rather than holding its
 * own cache copy.
 */
export const useDialFileSharing = ({
  filesApi,
  bucket,
  rootLabel,
  bumpRetry,
  onNotification,
}: UseDialFileSharingOptions): UseDialFileSharingResult => {
  const [isUnsharing, setIsUnsharing] = useState(false);
  const [isRemovingAccess, setIsRemovingAccess] = useState(false);

  const onUnshareFiles = useCallback(
    (files: DialFile[]) => {
      if (files.length === 0) return;

      const run = async () => {
        setIsUnsharing(true);
        const dtos = files.map((file) => {
          const itemBucket = file.bucket ?? bucket;
          return {
            bucket: itemBucket,
            path: resolveDialFileApiPath(file, itemBucket, rootLabel),
          };
        });

        try {
          await filesApi.discardShared(dtos);
          bumpRetry();
        } catch {
          onNotification?.({
            variant: NotificationVariant.Error,
            reason: FileManagerNotificationReason.UnshareFailed,
          });
        } finally {
          setIsUnsharing(false);
        }
      };
      void run();
    },
    [bucket, rootLabel, onNotification, filesApi, bumpRetry],
  );

  const onRemoveFilesAccess = useCallback(
    (files: DialFile[]) => {
      if (files.length === 0) return;

      const run = async () => {
        setIsRemovingAccess(true);
        const dtos = files.map((file) => {
          const itemBucket = file.bucket ?? bucket;
          return {
            bucket: itemBucket,
            path: resolveDialFileApiPath(file, itemBucket, rootLabel),
          };
        });

        try {
          await filesApi.revokeAccess(dtos);
          bumpRetry();
        } catch {
          onNotification?.({
            variant: NotificationVariant.Error,
            reason: FileManagerNotificationReason.RemoveAccessFailed,
          });
        } finally {
          setIsRemovingAccess(false);
        }
      };
      void run();
    },
    [bucket, rootLabel, onNotification, filesApi, bumpRetry],
  );

  return {
    isUnsharing,
    isRemovingAccess,
    onUnshareFiles,
    onRemoveFilesAccess,
  };
};
