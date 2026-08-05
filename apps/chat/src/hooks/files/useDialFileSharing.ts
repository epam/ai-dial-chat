import type { DialFile } from '@epam/ai-dial-react-file-manager';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import type {
  DiscardSharedItemDto,
  RevokeAccessItemDto,
} from '@epam/chat-api-client';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DialFileManagerI18nKeys } from '../../constants/translation-keys';
import { discardShared, revokeAccess } from '../../server-api/files.api';
import { resolveDialFileApiPath } from '../../utils/resolve-dial-file-api-path';

export interface UseDialFileSharingOptions {
  bucket: string;
  rootLabel: string;
  bumpRetry: () => void;
  onNotification?: (notification: {
    variant: NotificationVariant;
    title?: string;
    message: string;
  }) => void;
}

export interface UseDialFileSharingResult {
  isUnsharing: boolean;
  isRemovingAccess: boolean;
  onUnshareFiles: (files: DialFile[]) => void;
  onRemoveFilesAccess: (files: DialFile[]) => void;
}

/*
 * Manages the unshare/remove-access mutations. Bumps `useDialFileListing`'s
 * shared retry counter after each mutation settles rather than holding its own
 * cache copy (design.md D1).
 */
export const useDialFileSharing = ({
  bucket,
  rootLabel,
  bumpRetry,
  onNotification,
}: UseDialFileSharingOptions): UseDialFileSharingResult => {
  const { t } = useTranslation();

  const [isUnsharing, setIsUnsharing] = useState(false);
  const [isRemovingAccess, setIsRemovingAccess] = useState(false);

  const onUnshareFiles = useCallback(
    (files: DialFile[]) => {
      if (files.length === 0) return;

      const run = async () => {
        setIsUnsharing(true);
        const dtos: DiscardSharedItemDto[] = files.map((file) => {
          const itemBucket = file.bucket ?? bucket;
          return {
            bucket: itemBucket,
            path: resolveDialFileApiPath(file, itemBucket, rootLabel),
          };
        });

        try {
          await discardShared(dtos);
          bumpRetry();
        } catch {
          onNotification?.({
            variant: NotificationVariant.Error,
            message: t(DialFileManagerI18nKeys.UnshareError),
          });
        } finally {
          setIsUnsharing(false);
        }
      };
      void run();
    },
    [bucket, rootLabel, onNotification, t, bumpRetry],
  );

  const onRemoveFilesAccess = useCallback(
    (files: DialFile[]) => {
      if (files.length === 0) return;

      const run = async () => {
        setIsRemovingAccess(true);
        const dtos: RevokeAccessItemDto[] = files.map((file) => {
          const itemBucket = file.bucket ?? bucket;
          return {
            bucket: itemBucket,
            path: resolveDialFileApiPath(file, itemBucket, rootLabel),
          };
        });

        try {
          await revokeAccess(dtos);
          bumpRetry();
        } catch {
          onNotification?.({
            variant: NotificationVariant.Error,
            message: t(DialFileManagerI18nKeys.RemoveAccessError),
          });
        } finally {
          setIsRemovingAccess(false);
        }
      };
      void run();
    },
    [bucket, rootLabel, onNotification, t, bumpRetry],
  );

  return {
    isUnsharing,
    isRemovingAccess,
    onUnshareFiles,
    onRemoveFilesAccess,
  };
};
