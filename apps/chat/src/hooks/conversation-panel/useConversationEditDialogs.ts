import { type ConversationListItemDto } from '@epam/ai-dial-chat-api-client';
import { useAsyncConfirmDialog } from '@epam/ai-dial-chat-hooks';
import { type RenameConversationPopupLabels } from '@epam/ai-dial-conversation-panel';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import {
  ButtonsI18nKeys,
  ConversationPanelI18nKeys,
} from '../../constants/translation-keys';
import { useConversations } from '../../context/ConversationsContext';
import { useOperationNotification } from '../../hooks/useOperationNotification';
import {
  EntityOperation,
  NotifiableEntity,
} from '../../types/entity-notification';
import { ROUTES } from '../../types/routes';
import { conversationIdsMatch } from '../../utils/conversation-id-match';

interface DialogParams {
  items: ConversationListItemDto[];
  panelActiveConversationId: string | undefined;
}

/**
 * The delete and rename dialogs of the conversation panel: their pending
 * state, titles and labels, and the confirm/close handlers, including AI
 * title generation. Reads the conversations, navigation, notification and
 * i18n contexts itself.
 */
export const useConversationEditDialogs = ({
  items,
  panelActiveConversationId,
}: DialogParams) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { notifyOperationSuccess } = useOperationNotification();
  const { deleteConversation, renameConversation, generateConversationTitle } =
    useConversations();

  const {
    pending: pendingDeleteId,
    isPending: isDeletePending,
    isRunning: isDeleting,
    error: deleteError,
    open: openDeleteDialog,
    close: closeDeleteDialog,
    confirm: confirmDeleteDialog,
  } = useAsyncConfirmDialog<string>();

  const {
    pending: pendingRename,
    isPending: isRenamePending,
    isRunning: isRenaming,
    error: renameError,
    open: openRenameDialog,
    close: closeRenameDialog,
    confirm: confirmRenameDialog,
  } = useAsyncConfirmDialog<{ id: string; title: string }>();

  const renameLabels = useMemo<RenameConversationPopupLabels>(
    () => ({
      popupTitle: t(ConversationPanelI18nKeys.RenameTitle),
      inputPlaceholder: t(ConversationPanelI18nKeys.RenameInputPlaceholder),
      renameWithAiLabel: t(ConversationPanelI18nKeys.RenameWithAiLabel),
      renameWithAiError: t(ConversationPanelI18nKeys.RenameWithAiError),
      nameTooLongError: t(ConversationPanelI18nKeys.RenameTitleTooLong),
      saveLabel: t(ButtonsI18nKeys.Save),
      cancelLabel: t(ButtonsI18nKeys.Cancel),
    }),
    [t],
  );

  const pendingDeleteTitle = useMemo(() => {
    if (!pendingDeleteId) return '';
    return items.find((c) => c.id === pendingDeleteId)?.title ?? '';
  }, [items, pendingDeleteId]);

  const handleConfirmDelete = useCallback(async () => {
    await confirmDeleteDialog(
      async (idToDelete) => {
        await deleteConversation(idToDelete);
        notifyOperationSuccess(
          NotifiableEntity.Conversation,
          EntityOperation.Deleted,
          { name: pendingDeleteTitle },
        );
        if (
          panelActiveConversationId != null &&
          conversationIdsMatch(idToDelete, panelActiveConversationId)
        ) {
          navigate(ROUTES.Root);
        }
      },
      () => t(ConversationPanelI18nKeys.DeleteError),
    );
  }, [
    confirmDeleteDialog,
    pendingDeleteTitle,
    notifyOperationSuccess,
    deleteConversation,
    panelActiveConversationId,
    navigate,
    t,
  ]);

  const handleCloseDeleteDialog = useCallback(() => {
    if (isDeleting) return;
    closeDeleteDialog();
  }, [isDeleting, closeDeleteDialog]);

  const handleConfirmRename = useCallback(
    async (newTitle: string) => {
      await confirmRenameDialog(
        async ({ id }) => {
          await renameConversation(id, newTitle);
          notifyOperationSuccess(
            NotifiableEntity.Conversation,
            EntityOperation.Renamed,
            { name: newTitle },
          );
        },
        () => t(ConversationPanelI18nKeys.RenameError),
      );
    },
    [confirmRenameDialog, renameConversation, notifyOperationSuccess, t],
  );

  const handleGenerateRenameWithAi = useCallback(async () => {
    if (!pendingRename) return '';
    return generateConversationTitle(pendingRename.id);
  }, [pendingRename, generateConversationTitle]);

  const handleCloseRenameDialog = useCallback(() => {
    if (isRenaming) return;
    closeRenameDialog();
  }, [isRenaming, closeRenameDialog]);

  return {
    pendingRename,
    isDeletePending,
    isDeleting,
    deleteError,
    isRenamePending,
    isRenaming,
    renameError,
    openDeleteDialog,
    openRenameDialog,
    pendingDeleteTitle,
    renameLabels,
    handleConfirmDelete,
    handleCloseDeleteDialog,
    handleConfirmRename,
    handleGenerateRenameWithAi,
    handleCloseRenameDialog,
  };
};
