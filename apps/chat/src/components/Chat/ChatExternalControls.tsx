import { IconCopy } from '@tabler/icons-react';
import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { ConversationInfo } from '@/src/types/chat';
import { Translation } from '@/src/types/translation';

import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PublicationSelectors } from '@/src/store/publication/publication.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { PublicationControls } from './Publish/PublicationChatControls';

interface Props {
  conversations: ConversationInfo[];
}

export default function ChatExternalControls({ conversations }: Props) {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const resourceToReview = useAppSelector((state) =>
    PublicationSelectors.selectResourceToReviewByReviewUrl(
      state,
      conversations[0].id,
    ),
  );

  const isOverlayConversationId = useAppSelector(
    SettingsSelectors.selectOverlayConversationId,
  );

  const handleDuplicate = useCallback(() => {
    conversations.forEach((conv) => {
      dispatch(ConversationsActions.duplicateConversation(conv));
    });
  }, [conversations, dispatch]);

  if (conversations.length === 1 && resourceToReview) {
    return (
      <PublicationControls
        resourceToReview={resourceToReview}
        entity={conversations[0]}
        wrapperClassName="justify-center w-full"
      />
    );
  }

  if (isOverlayConversationId) {
    return null;
  }
  return (
    <button
      className="button button-chat !-top-10"
      onClick={handleDuplicate}
      data-qa="duplicate"
    >
      <span className="text-secondary">
        <IconCopy width={18} height={18} />
      </span>
      {t('Duplicate the conversation to be able to edit it')}
    </button>
  );
}
