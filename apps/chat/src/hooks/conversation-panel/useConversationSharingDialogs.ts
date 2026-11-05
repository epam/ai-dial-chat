import { type ConversationListItemDto } from '@epam/ai-dial-chat-api-client';
import { useAsyncConfirmDialog } from '@epam/ai-dial-chat-hooks';
import { useShareRecipientsCount } from '@epam/ai-dial-chat-hooks/sharing';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { ConversationPanelI18nKeys } from '../../constants/translation-keys';
import { useConversations } from '../../context/ConversationsContext';
import { useNotification } from '../../context/NotificationContext';
import { usePublishErrorNotification } from '../../hooks/publish/usePublishErrorNotification';
import { useConversationPublishHistory } from '../../hooks/useConversationPublishHistory/useConversationPublishHistory';
import { useOperationNotification } from '../../hooks/useOperationNotification';
import { shareApi } from '../../server-api/api-client';
import { unpublishConversation } from '../../server-api/conversation-publish.api';
import {
  discardSharedCatalogItem,
  revokeSharedAccess,
} from '../../server-api/share.api';
import {
  EntityOperation,
  NotifiableEntity,
} from '../../types/entity-notification';
import { ROUTES } from '../../types/routes';
import { conversationIdsMatch } from '../../utils/conversation-id-match';
import { getPublishFolderLabel } from '../../utils/publish';

interface DialogParams {
  items: ConversationListItemDto[];
  panelActiveConversationId: string | undefined;
}

/**
 * The sharing-related flows of the conversation panel: the unshare, revoke
 * and unpublish confirm dialogs, the share popup and publish panel state,
 * share-recipient counts and publish history, with their confirm/close
 * handlers and the share and publish API calls behind them. Reads the
 * conversations, navigation, notification and i18n contexts itself.
 */
export const useConversationSharingDialogs = ({
  items,
  panelActiveConversationId,
}: DialogParams) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showSuccessNotification } = useNotification();
  const { notifyOperationSuccess } = useOperationNotification();
  const { refreshConversations } = useConversations();

  const {
    pending: pendingUnshareId,
    isPending: isUnsharePending,
    isRunning: isUnsharing,
    error: unshareError,
    open: openUnshareDialog,
    close: closeUnshareDialog,
    confirm: confirmUnshareDialog,
  } = useAsyncConfirmDialog<string>();
  const {
    pending: pendingRevokeId,
    isPending: isRevokePending,
    isRunning: isRevoking,
    error: revokeError,
    open: openRevokeDialog,
    close: closeRevokeDialog,
    confirm: confirmRevokeDialog,
  } = useAsyncConfirmDialog<string>();

  const {
    pending: pendingUnpublish,
    isPending: isUnpublishPending,
    isRunning: isUnpublishing,
    open: openUnpublishDialog,
    close: closeUnpublishDialog,
    confirm: confirmUnpublishDialog,
  } = useAsyncConfirmDialog<{
    path: string;
    title: string;
    folders: string[];
  }>();
  /* Set only when the conversation is published to more than one folder. */
  const [selectedUnpublishFolder, setSelectedUnpublishFolder] = useState<
    string | null
  >(null);

  const [pendingShareConversationPath, setPendingShareConversationPath] =
    useState<string | null>(null);

  const [pendingPublishConversation, setPendingPublishConversation] = useState<{
    path: string;
    title: string;
  } | null>(null);

  const {
    requestRecipientsCount,
    getRecipientsCount,
    invalidateRecipientsCount,
  } = useShareRecipientsCount(shareApi);
  const { requestPublishHistory, getPublishHistory } =
    useConversationPublishHistory();
  const showPublishError = usePublishErrorNotification();

  const handleCloseSharePopover = useCallback(() => {
    setPendingShareConversationPath(null);
  }, []);

  /*
   * Already fetched when the row's action menu opened, so opening the publish
   * panel next issues no second request.
   */
  const publishPanelHistory = getPublishHistory(
    pendingPublishConversation?.path ?? '',
  );

  const unpublishFolders = pendingUnpublish?.folders ?? [];

  const handleClosePublishPanel = useCallback(() => {
    setPendingPublishConversation(null);
  }, []);

  const pendingUnshareTitle = useMemo(() => {
    if (!pendingUnshareId) return '';
    const item = items.find((c) => c.id === pendingUnshareId);
    return item?.title ?? item?.id ?? '';
  }, [items, pendingUnshareId]);

  const handleConfirmUnshare = useCallback(async () => {
    await confirmUnshareDialog(
      async (idToUnshare) => {
        await discardSharedCatalogItem(idToUnshare);

        try {
          await refreshConversations();
        } catch {
          /* The discard already succeeded; a refresh failure must not undo that success. */
        }

        showSuccessNotification({
          title: t(ConversationPanelI18nKeys.UnshareSuccessTitle),
          message: t(ConversationPanelI18nKeys.UnshareSuccess, {
            name: pendingUnshareTitle,
          }),
        });

        if (
          panelActiveConversationId != null &&
          conversationIdsMatch(idToUnshare, panelActiveConversationId)
        ) {
          navigate(ROUTES.Root);
        }
      },
      () =>
        t(ConversationPanelI18nKeys.UnshareError, {
          name: pendingUnshareTitle,
        }),
    );
  }, [
    confirmUnshareDialog,
    pendingUnshareTitle,
    refreshConversations,
    showSuccessNotification,
    panelActiveConversationId,
    navigate,
    t,
  ]);

  const handleCloseUnshareDialog = useCallback(() => {
    if (isUnsharing) return;
    closeUnshareDialog();
  }, [isUnsharing, closeUnshareDialog]);

  const pendingRevokeTitle = useMemo(() => {
    if (!pendingRevokeId) return '';
    const item = items.find((c) => c.id === pendingRevokeId);
    return item?.title ?? item?.id ?? '';
  }, [items, pendingRevokeId]);

  /*
   * Unlike unshare, revoking leaves the conversation in the owner's own list —
   * only other people lose access — so there is nothing to navigate away from.
   * `refreshConversations` runs purely so any share-derived indicator settles.
   */
  const handleCloseUnpublishDialog = useCallback(() => {
    if (isUnpublishing) return;
    closeUnpublishDialog();
    setSelectedUnpublishFolder(null);
  }, [isUnpublishing, closeUnpublishDialog]);

  const handleConfirmUnpublish = useCallback(async () => {
    await confirmUnpublishDialog(
      async ({ path, title, folders }) => {
        /* One published folder needs no choice; several require a pick, which
         * the disabled confirm button already enforces. */
        const folderPath =
          selectedUnpublishFolder != null
            ? folders.find((folder) => folder === selectedUnpublishFolder)
            : folders[0];
        /* `folderPath` is legitimately `''` for a conversation published at
         * the public root, so this must reject "not found" (`undefined`),
         * not every falsy value — an `if (!folderPath)` check here silently
         * dropped every unpublish request for a root-folder publication. */
        if (folderPath == null) return;

        try {
          await unpublishConversation(path, folderPath);
        } catch (error) {
          showPublishError(error, EntityOperation.UnpublishRequested);
          /* Swallow so confirm() calls close() instead of keeping the dialog open. */
          return;
        }

        /*
         * No `refreshConversations()`: nothing about the caller's own list
         * changed, and the published copy survives until an admin approves the
         * removal — the same reason publish success does not refresh either.
         */
        notifyOperationSuccess(
          NotifiableEntity.Conversation,
          EntityOperation.UnpublishRequested,
          { name: title, folder: getPublishFolderLabel(folderPath, t) },
        );
      },
      () => '',
    );
    setSelectedUnpublishFolder(null);
  }, [
    confirmUnpublishDialog,
    selectedUnpublishFolder,
    showPublishError,
    notifyOperationSuccess,
    t,
  ]);

  const handleConfirmRevoke = useCallback(async () => {
    await confirmRevokeDialog(
      async (idToRevoke) => {
        await revokeSharedAccess(idToRevoke);

        /* Nobody holds access any more, so the cached count is spent: dropping it
         * makes the next menu open re-ask instead of offering to revoke again. */
        invalidateRecipientsCount(idToRevoke);

        try {
          await refreshConversations();
        } catch {
          /* The revoke already succeeded; a refresh failure must not undo that success. */
        }

        showSuccessNotification({
          title: t(ConversationPanelI18nKeys.RevokeSuccessTitle),
          message: t(ConversationPanelI18nKeys.RevokeSuccess, {
            name: pendingRevokeTitle,
          }),
        });
      },
      () =>
        t(ConversationPanelI18nKeys.RevokeError, {
          name: pendingRevokeTitle,
        }),
    );
  }, [
    confirmRevokeDialog,
    pendingRevokeTitle,
    refreshConversations,
    invalidateRecipientsCount,
    showSuccessNotification,
    t,
  ]);

  const handleCloseRevokeDialog = useCallback(() => {
    if (isRevoking) return;
    closeRevokeDialog();
  }, [isRevoking, closeRevokeDialog]);

  return {
    pendingUnpublish,
    isUnsharePending,
    isUnsharing,
    unshareError,
    isRevokePending,
    isRevoking,
    revokeError,
    isUnpublishPending,
    isUnpublishing,
    openUnshareDialog,
    openRevokeDialog,
    openUnpublishDialog,
    selectedUnpublishFolder,
    setSelectedUnpublishFolder,
    pendingShareConversationPath,
    setPendingShareConversationPath,
    pendingPublishConversation,
    setPendingPublishConversation,
    requestRecipientsCount,
    getRecipientsCount,
    requestPublishHistory,
    getPublishHistory,
    publishPanelHistory,
    unpublishFolders,
    pendingUnshareTitle,
    pendingRevokeTitle,
    handleCloseSharePopover,
    handleClosePublishPanel,
    handleConfirmUnshare,
    handleCloseUnshareDialog,
    handleConfirmUnpublish,
    handleCloseUnpublishDialog,
    handleConfirmRevoke,
    handleCloseRevokeDialog,
  };
};
