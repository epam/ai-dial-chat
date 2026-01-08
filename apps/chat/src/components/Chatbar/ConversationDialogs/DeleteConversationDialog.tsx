import { FC, useCallback } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { ConversationsActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ConversationsSelectors } from '@/src/store/selectors';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { withRenderWhenEntities } from '@/src/components/Common/RenderWhen';

interface DeleteConversationDialogProps {
  conversationId: string;
}

const DeleteConversationDialogView: FC<DeleteConversationDialogProps> = ({
  conversationId,
}) => {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();

  const conversation = useAppSelector((state) =>
    ConversationsSelectors.selectConversationById(state, conversationId),
  );

  const handleClose = useCallback(
    (result: boolean) => {
      if (!result) {
        dispatch(ConversationsActions.setDeletingConversationId());
        return;
      }
      dispatch(
        ConversationsActions.deleteConversations({
          conversationIds: [conversationId],
        }),
      );
      dispatch(ConversationsActions.setDeletingConversationId());
    },
    [conversationId, dispatch],
  );

  return (
    <ConfirmDialog
      isOpen
      heading={t('Confirm deleting conversation')}
      description={`${t('Are you sure that you want to delete a conversation?')}${t(
        conversation?.isShared
          ? '\nDeleting will stop sharing and other users will no longer see this conversation.'
          : '',
      )}`}
      confirmLabel={t('Delete')}
      cancelLabel={t('Cancel')}
      onClose={handleClose}
    />
  );
};

export const DeleteConversationDialog =
  withRenderWhenEntities<DeleteConversationDialogProps>({
    conversationId: ConversationsSelectors.selectDeletingConversationId,
  })(DeleteConversationDialogView);
