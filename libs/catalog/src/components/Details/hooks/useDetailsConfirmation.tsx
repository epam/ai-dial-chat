import { ConfirmationPopupVariant } from '@epam/ai-dial-ui-kit';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ConfirmationContent,
  PublishedFolder,
} from '../../../models/details-panel';
import type { DetailsPanelProps } from '../../../models/item-details-props';
import { DetailsConfirmationKind } from '../../../types/details-confirmation';
import { CredentialsLevel } from '../../../types/toolset-auth';
import {
  CONFIRMATIONS_REMOVING_ITEM_FROM_VIEW,
  DEFAULT_DELETE_CONSEQUENCES,
  DEFAULT_REVOKE_SHARE_CONSEQUENCES,
  DEFAULT_UNPUBLISH_CONSEQUENCES,
  DEFAULT_UNSHARE_CONSEQUENCES,
  defaultDeleteApiKeyConfirmMessage,
  resolveUnpublishFolder,
} from '../../../utils/details-panel';
import { getSignedInLevel } from '../../../utils/toolset-credentials';

/** Parameters for {@link useDetailsConfirmation}. */
export interface UseDetailsConfirmationParams extends Pick<
  DetailsPanelProps,
  | 'item'
  | 'isOpen'
  | 'onClose'
  | 'onDelete'
  | 'onUnshare'
  | 'onRevokeShare'
  | 'onLogout'
  | 'onUnpublish'
  | 'texts'
> {
  /** Folders the item is published to, from `useDetailsPublish`. */
  publishedFolders: PublishedFolder[];
  /** Display label of a published folder key, from `useDetailsPublish`. */
  formatFolderLabel: (folderKey: string) => string;
}

/** Confirmation step of the details panel: the pending kind, its handlers, and its copy. */
export const useDetailsConfirmation = ({
  item,
  isOpen,
  onClose,
  onDelete,
  onUnshare,
  onRevokeShare,
  onLogout,
  onUnpublish,
  texts,
  publishedFolders,
  formatFolderLabel,
}: UseDetailsConfirmationParams) => {
  const [confirmation, setConfirmation] =
    useState<DetailsConfirmationKind | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  /* Set alongside `confirmation` only for `DeleteApiKey`, since that step can apply to either credentials slot on the same item. */
  const [pendingApiKeyDeleteLevel, setPendingApiKeyDeleteLevel] =
    useState<CredentialsLevel | null>(null);
  /*
   * Set alongside `confirmation` for `Logout`. The top-level header action
   * has only one signed-in level to log out of, resolved via
   * `getSignedInLevel`; the admin management panel can request either level
   * explicitly since both may be independently signed in.
   */
  const [pendingLogoutLevel, setPendingLogoutLevel] =
    useState<CredentialsLevel | null>(null);
  /*
   * Set alongside `confirmation` for `Unpublish` when the item is published
   * to more than one folder. Held here rather than in `ConfirmationView` so
   * that view stays presentational, and cleared on cancel and on item change.
   */
  const [selectedUnpublishFolder, setSelectedUnpublishFolder] = useState<
    string | null
  >(null);

  useEffect(() => {
    setSelectedUnpublishFolder(null);
    setConfirmation(null);
    setIsConfirming(false);
    setPendingApiKeyDeleteLevel(null);
    setPendingLogoutLevel(null);
  }, [item.id]);

  const handleRequestDelete = useCallback(() => {
    setConfirmation(DetailsConfirmationKind.Delete);
  }, []);

  const handleRequestLogout = useCallback(
    (level?: CredentialsLevel) => {
      setPendingLogoutLevel(
        level ??
          (item.credentials != null
            ? getSignedInLevel(item.credentials)
            : null),
      );
      setConfirmation(DetailsConfirmationKind.Logout);
    },
    [item.credentials],
  );

  const handleRequestUnshare = useCallback(() => {
    setConfirmation(DetailsConfirmationKind.Unshare);
  }, []);

  const handleRequestRevokeShare = useCallback(() => {
    setConfirmation(DetailsConfirmationKind.RevokeAccess);
  }, []);

  const handleRequestUnpublish = useCallback(() => {
    setConfirmation(DetailsConfirmationKind.Unpublish);
  }, []);

  const handleRequestDeleteApiKey = useCallback((level: CredentialsLevel) => {
    setPendingApiKeyDeleteLevel(level);
    setConfirmation(DetailsConfirmationKind.DeleteApiKey);
  }, []);

  const handleCancelConfirmation = useCallback(() => {
    if (isConfirming) return;
    setConfirmation(null);
    setPendingApiKeyDeleteLevel(null);
    setPendingLogoutLevel(null);
    setSelectedUnpublishFolder(null);
  }, [isConfirming]);

  const handleConfirm = useCallback(async () => {
    if (isConfirming || confirmation == null) return;
    setIsConfirming(true);
    try {
      switch (confirmation) {
        case DetailsConfirmationKind.Delete:
          await onDelete?.(item);
          break;
        case DetailsConfirmationKind.Unshare:
          await onUnshare?.(item);
          break;
        case DetailsConfirmationKind.RevokeAccess:
          await onRevokeShare?.(item);
          break;
        case DetailsConfirmationKind.Logout:
          if (pendingLogoutLevel != null) {
            await onLogout?.(item, { level: pendingLogoutLevel });
          }
          break;
        case DetailsConfirmationKind.DeleteApiKey:
          if (pendingApiKeyDeleteLevel != null) {
            await onLogout?.(item, { level: pendingApiKeyDeleteLevel });
          }
          break;
        case DetailsConfirmationKind.Unpublish: {
          /* With one published folder there is nothing to choose, so it is
           * confirmed directly; with several the footer stays disabled until
           * the user picks one. */
          const chosen = resolveUnpublishFolder(
            publishedFolders,
            selectedUnpublishFolder,
          );
          if (chosen != null) {
            await onUnpublish?.(item, chosen.segments);
          }
          break;
        }
      }
      setConfirmation(null);
      setPendingApiKeyDeleteLevel(null);
      setPendingLogoutLevel(null);
      setSelectedUnpublishFolder(null);
      if (CONFIRMATIONS_REMOVING_ITEM_FROM_VIEW.has(confirmation)) {
        onClose();
      }
    } catch {
      /*
       * Failure feedback (e.g. a notification) is the caller's
       * responsibility; the item stays visible and the panel stays open.
       */
      setConfirmation(null);
      setPendingApiKeyDeleteLevel(null);
      setPendingLogoutLevel(null);
      setSelectedUnpublishFolder(null);
    } finally {
      setIsConfirming(false);
    }
  }, [
    isConfirming,
    confirmation,
    pendingApiKeyDeleteLevel,
    pendingLogoutLevel,
    item,
    onDelete,
    onUnshare,
    onRevokeShare,
    onUnpublish,
    selectedUnpublishFolder,
    publishedFolders,
    onLogout,
    onClose,
  ]);

  useEffect(() => {
    if (!isOpen || confirmation == null) return;

    /*
     * Escape backs out of an open confirmation before it closes the panel.
     * Listening in the capture phase and stopping the event there keeps it
     * from the drawer's own dismiss handler, which would close the panel.
     */
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      handleCancelConfirmation();
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, confirmation, handleCancelConfirmation]);

  const confirmationContent = useMemo<ConfirmationContent | null>(() => {
    switch (confirmation) {
      case DetailsConfirmationKind.Delete: {
        const deleteLabel = texts?.deleteActionLabel ?? 'Delete';
        return {
          title: texts?.deleteConfirmTitle ?? deleteLabel,
          message: texts?.deleteConfirmMessage?.(item.name) ?? (
            <>
              Are you sure you want to delete <strong>{item.name}</strong>? This
              action is permanent and cannot be undone.
            </>
          ),
          consequences:
            texts?.deleteConfirmConsequences ?? DEFAULT_DELETE_CONSEQUENCES,
          confirmLabel: deleteLabel,
          loadingStatusLabel: texts?.deletingStatusLabel ?? 'Deleting',
          variant: ConfirmationPopupVariant.Danger,
        };
      }
      case DetailsConfirmationKind.Unshare: {
        const unshareLabel = texts?.unshareLabel ?? 'Remove from My List';
        return {
          title: texts?.unshareConfirmTitle ?? unshareLabel,
          message: texts?.unshareConfirmMessage?.(item.name) ?? (
            <>
              Remove <strong>{item.name}</strong> from your list? You&apos;ll
              need a new invitation to access it again.
            </>
          ),
          consequences:
            texts?.unshareConfirmConsequences ?? DEFAULT_UNSHARE_CONSEQUENCES,
          confirmLabel: unshareLabel,
          loadingStatusLabel: texts?.unsharingStatusLabel ?? 'Removing',
          /* Removal only revokes the caller's own access and is recoverable
           * with a new invitation, so it is not framed as destructive. */
          variant: ConfirmationPopupVariant.Info,
        };
      }
      case DetailsConfirmationKind.RevokeAccess: {
        const revokeShareLabel = texts?.revokeShareLabel ?? 'Revoke access';
        return {
          title: texts?.revokeShareConfirmTitle ?? revokeShareLabel,
          message: texts?.revokeShareConfirmMessage?.(item.name) ?? (
            <>
              Revoke shared access to <strong>{item.name}</strong>? Anyone you
              shared it with will lose access.
            </>
          ),
          consequences:
            texts?.revokeShareConfirmConsequences ??
            DEFAULT_REVOKE_SHARE_CONSEQUENCES,
          confirmLabel: revokeShareLabel,
          loadingStatusLabel:
            texts?.revokingShareStatusLabel ?? 'Revoking access',
          /* Other people irreversibly lose access and the owner must re-share
           * to restore it, so this is framed as destructive — even though the
           * item itself survives untouched for its owner. */
          variant: ConfirmationPopupVariant.Danger,
        };
      }
      case DetailsConfirmationKind.Unpublish: {
        const unpublishLabel = texts?.unpublishLabel ?? 'Unpublish';
        const isSingleFolder = publishedFolders.length === 1;
        const singleFolderLabel = isSingleFolder
          ? formatFolderLabel(publishedFolders[0].key)
          : '';
        const singleFolderMessage = texts?.unpublishConfirmMessage?.(
          item.name,
          singleFolderLabel,
        ) ?? (
          <>
            Unpublish <strong>{item.name}</strong> from "{singleFolderLabel}"?
            The request is submitted for admin approval.
          </>
        );
        const multiFolderMessage = texts?.unpublishSelectFolderMessage?.(
          item.name,
        ) ?? (
          <>
            Choose which folder to unpublish <strong>{item.name}</strong> from.
            The request is submitted for admin approval.
          </>
        );
        return {
          title: texts?.unpublishConfirmTitle ?? unpublishLabel,
          message: isSingleFolder ? singleFolderMessage : multiFolderMessage,
          consequences:
            texts?.unpublishConfirmConsequences ??
            DEFAULT_UNPUBLISH_CONSEQUENCES,
          confirmLabel: unpublishLabel,
          loadingStatusLabel:
            texts?.unpublishingStatusLabel ?? 'Requesting unpublish',
          /* Everyone loses access to the published copy and the owner must
           * publish again to restore it — the same reasoning as revoke, with
           * the same caveat that the source item is untouched. */
          variant: ConfirmationPopupVariant.Danger,
        };
      }
      case DetailsConfirmationKind.Logout: {
        const logoutLabel = texts?.logoutActionLabel ?? 'Log out';
        return {
          title: logoutLabel,
          message:
            texts?.logoutConfirmMessage ?? 'Are you sure you want to log out?',
          consequences: undefined,
          confirmLabel: logoutLabel,
          loadingStatusLabel: texts?.loggingOutStatusLabel ?? 'Logging out',
          variant: ConfirmationPopupVariant.Info,
        };
      }
      case DetailsConfirmationKind.DeleteApiKey: {
        const deleteLabel = texts?.deleteActionLabel ?? 'Delete';
        const level = pendingApiKeyDeleteLevel ?? CredentialsLevel.User;
        return {
          title: deleteLabel,
          message: (
            texts?.deleteApiKeyConfirmMessage ??
            defaultDeleteApiKeyConfirmMessage
          )(level),
          consequences: undefined,
          confirmLabel: deleteLabel,
          loadingStatusLabel: texts?.deletingStatusLabel ?? 'Deleting',
          variant: ConfirmationPopupVariant.Danger,
          /* Removing one credential doesn't warrant a red toolset card — the
           * item itself is unaffected, only the confirm button stays danger. */
          cardVariant: ConfirmationPopupVariant.Info,
        };
      }
      default:
        return null;
    }
  }, [
    confirmation,
    item.name,
    pendingApiKeyDeleteLevel,
    texts,
    publishedFolders,
    formatFolderLabel,
  ]);

  /*
   * Kept separate from `isConfirming`: a confirmation that cannot run yet
   * and one already running are different states, and only the latter also
   * disables the back/cancel control. Today only `Unpublish` can be blocked,
   * and only while it is published to several folders and none is chosen.
   */
  const isConfirmDisabled =
    confirmation === DetailsConfirmationKind.Unpublish &&
    resolveUnpublishFolder(publishedFolders, selectedUnpublishFolder) == null;

  return {
    confirmation,
    isConfirming,
    selectedUnpublishFolder,
    setSelectedUnpublishFolder,
    handleRequestDelete,
    handleRequestLogout,
    handleRequestUnshare,
    handleRequestRevokeShare,
    handleRequestUnpublish,
    handleRequestDeleteApiKey,
    handleCancelConfirmation,
    handleConfirm,
    confirmationContent,
    isConfirmDisabled,
  };
};
