import type { DialFile } from '@epam/ai-dial-ui-kit';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import type {
  DiscardSharedItemDto,
  RevokeAccessItemDto,
  ShareFilesDtoPermissionEnum,
} from '@epam/chat-api-client';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DialFileManagerI18nKeys } from '../../constants/translation-keys';
import {
  discardShared,
  revokeAccess,
  shareFiles,
} from '../../server-api/files.api';
import { resolveDialFileApiPath } from '../../utils/resolve-dial-file-api-path';
import { findDialFileByPath } from './dial-file-manager-path.util';

export interface ShareTarget {
  bucket: string;
  path: string;
  name: string;
}

export interface UseDialFileSharingOptions {
  bucket: string;
  rootLabel: string;
  /** Current hierarchical tree, used to resolve the target of `onManagePermissions` by path. */
  items: DialFile[];
  bumpRetry: () => void;
  onNotification?: (notification: {
    variant: NotificationVariant;
    title?: string;
    message: string;
  }) => void;
}

export interface UseDialFileSharingResult {
  shareTarget: ShareTarget | null;
  isSharing: boolean;
  isUnsharing: boolean;
  isRemovingAccess: boolean;
  onManagePermissions: (path?: string) => void;
  onCloseShareModal: () => void;
  onCreateShareLink: (
    permission: ShareFilesDtoPermissionEnum,
  ) => Promise<string>;
  onUnshareFiles: (files: DialFile[]) => void;
  onRemoveFilesAccess: (files: DialFile[]) => void;
}

/**
 * Manages the ShareFileModal target and the share/unshare/remove-access
 * mutations. Bumps `useDialFileListing`'s shared retry counter after each
 * mutation settles rather than holding its own cache copy (design.md D1).
 */
export const useDialFileSharing = ({
  bucket,
  rootLabel,
  items,
  bumpRetry,
  onNotification,
}: UseDialFileSharingOptions): UseDialFileSharingResult => {
  const { t } = useTranslation();

  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const shareAbortControllerRef = useRef<AbortController | null>(null);
  const [isUnsharing, setIsUnsharing] = useState(false);
  const [isRemovingAccess, setIsRemovingAccess] = useState(false);

  const onManagePermissions = useCallback(
    (targetPath?: string) => {
      if (targetPath == null) return;
      const root = items[0];
      const target = findDialFileByPath(root?.items ?? [], targetPath);
      if (target == null) return;
      const targetBucket = target.bucket ?? bucket;
      setShareTarget({
        bucket: targetBucket,
        path: resolveDialFileApiPath(target, targetBucket, rootLabel),
        name: target.name,
      });
    },
    [bucket, items, rootLabel],
  );

  const onCloseShareModal = useCallback(() => {
    shareAbortControllerRef.current?.abort();
    shareAbortControllerRef.current = null;
    setIsSharing(false);
    setShareTarget(null);
  }, []);

  const onCreateShareLink = useCallback(
    async (permission: ShareFilesDtoPermissionEnum): Promise<string> => {
      if (shareTarget == null) {
        throw new Error('No share target selected');
      }
      const controller = new AbortController();
      shareAbortControllerRef.current = controller;
      setIsSharing(true);
      try {
        const { invitationLink } = await shareFiles(
          [{ bucket: shareTarget.bucket, path: shareTarget.path }],
          permission,
          controller.signal,
        );
        bumpRetry();
        return invitationLink;
      } finally {
        if (shareAbortControllerRef.current === controller) {
          shareAbortControllerRef.current = null;
          setIsSharing(false);
        }
      }
    },
    [shareTarget, bumpRetry],
  );

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
    shareTarget,
    isSharing,
    isUnsharing,
    isRemovingAccess,
    onManagePermissions,
    onCloseShareModal,
    onCreateShareLink,
    onUnshareFiles,
    onRemoveFilesAccess,
  };
};
