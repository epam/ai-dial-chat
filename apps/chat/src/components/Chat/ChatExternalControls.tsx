import { IconCopy } from '@tabler/icons-react';
import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { ConversationInfo } from '@/src/types/chat';
import { Translation } from '@/src/types/translation';

import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PublicationSelectors } from '@/src/store/publication/publication.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { ScrollDownButton } from '../Common/ScrollDownButton';

interface Props {
  conversations: ConversationInfo[];
  showScrollDownButton: boolean;
  onScrollDownClick: () => void;
}

export default function ChatExternalControls({
  conversations,
  showScrollDownButton,
  onScrollDownClick,
}: Props) {
  const { t } = useTranslation(Translation.Chat);
  const approveRequiredResources = useAppSelector(
    PublicationSelectors.selectResourceToReview,
  );

  const dispatch = useAppDispatch();

  const isOverlayConversationId = useAppSelector(
    SettingsSelectors.selectOverlayConversationId,
  );

  const handleDuplicate = useCallback(() => {
    conversations.forEach((conv) => {
      dispatch(ConversationsActions.duplicateConversation(conv));
    });
  }, [conversations, dispatch]);

  if (
    isOverlayConversationId ||
    conversations.some((c) =>
      approveRequiredResources.some((r) => r.reviewUrl === c.id),
    )
  ) {
    return null;
  }

  return (
    <div className="flex justify-center">
      <div className="relative mx-2 mb-2 flex w-full flex-row items-center justify-center gap-3 md:mx-4 md:mb-0 md:last:mb-6 lg:mx-auto lg:w-[768px] lg:max-w-3xl">
        <button
          className="button inset-x-0 !-top-10 mx-auto flex w-fit items-center gap-3 border-primary bg-layer-2 p-3 hover:bg-layer-4"
          onClick={handleDuplicate}
          data-qa="duplicate"
        >
          <span className="text-secondary-bg-dark">
            <IconCopy width={18} height={18} />
          </span>
          {t('Duplicate the conversation to be able to edit it')}
        </button>
        {showScrollDownButton && (
          <ScrollDownButton
            className="-top-16 right-0 md:-top-20"
            onScrollDownClick={onScrollDownClick}
          />
        )}
      </div>
    </div>
  );
}
