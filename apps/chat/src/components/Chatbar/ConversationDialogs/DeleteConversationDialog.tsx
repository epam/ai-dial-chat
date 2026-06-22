import { useCallback } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { ConversationsActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ConversationsSelectors } from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { withRenderWhenEntities } from '@/src/components/Common/RenderWhen';

interface DeleteConversationDialogProps {
  conversationId: string;
}

const view = withRenderWhenEntities<DeleteConversationDialogProps>({
  conversationId: ConversationsSelectors.selectDeletingConversationId,
})(({ conversationId }: DeleteConversationDialogProps) => {
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
      heading={t(ChatI18nKeys.ConfirmDeletingConversation)}
      description={`${t(ChatI18nKeys.AreYouSureDeleteConversation)}${t(
        conversation?.isShared
          ? ChatI18nKeys.DeletingWillStopConversationSharing
          : '',
      )}`}
      confirmLabel={t(ChatI18nKeys.Delete)}
      cancelLabel={t(ChatI18nKeys.Cancel)}
      onClose={handleClose}
    />
  );
});

export const DeleteConversationDialog = view;
