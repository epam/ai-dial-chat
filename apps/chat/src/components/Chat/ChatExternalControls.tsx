import { IconCopy } from '@tabler/icons-react';
import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { ConversationInfo } from '@/src/types/chat';
import { Translation } from '@/src/types/translation';

import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

interface Props {
  conversations: ConversationInfo[];
}

export default function ChatExternalControls({ conversations }: Props) {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const isOverlayConversationId = useAppSelector(
    SettingsSelectors.selectOverlayConversationId,
  );

  const handleDuplicate = useCallback(() => {
    conversations.forEach((conv) => {
      dispatch(ConversationsActions.duplicateConversation(conv));
    });
  }, [conversations, dispatch]);

  if (isOverlayConversationId) {
    return null;
  }
  return (
    <button
      className="button button-chat !-top-10"
      onClick={handleDuplicate}
      data-qa="duplicate"
    >
      <span className="text-secondary-bg-dark">
        <IconCopy width={18} height={18} />
      </span>
      {t('chat.common.button.duplicate_conversation.label')}
    </button>
  );
}
