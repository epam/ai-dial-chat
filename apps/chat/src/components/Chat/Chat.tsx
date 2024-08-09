import { useTranslation } from 'next-i18next';

import { useChatSelectors } from '@/src/components/Chat/hooks/useChatSelectors';

import { UploadStatus } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { ChatView } from '@/src/components/Chat/ChatView';

import Loader from '../Common/Loader';
import { NotFoundEntity } from '../Common/NotFoundEntity';
import { ChatInputFooter } from './ChatInput/ChatInputFooter';
import { PublicationHandler } from './Publish/PublicationHandler';

export function Chat() {
  const { t } = useTranslation(Translation.Chat);

  const {
    areSelectedConversationsLoaded,
    selectedConversationsIds,
    selectedConversations,
    modelIsLoaded,
    isolatedModelId,
    activeModel,
    selectedPublication,
  } = useChatSelectors();

  if (selectedPublication?.resources && !selectedConversationsIds.length) {
    return (
      <>
        <PublicationHandler publication={selectedPublication} />
        <ChatInputFooter />
      </>
    );
  }

  if (isolatedModelId && modelIsLoaded && !activeModel) {
    return (
      <div className="h-screen pt-2">
        <NotFoundEntity
          entity={t('Model is')}
          additionalText={t('Please contact your administrator.') || ''}
        />
      </div>
    );
  }

  if (
    !areSelectedConversationsLoaded &&
    (!selectedConversations.length ||
      selectedConversations.some((conv) => conv.status !== UploadStatus.LOADED))
  ) {
    return <Loader />;
  }
  if (
    selectedConversations.length !== selectedConversationsIds.length ||
    selectedConversations.some((conv) => conv.status !== UploadStatus.LOADED)
  ) {
    return (
      <NotFoundEntity
        entity={t('Conversation')}
        additionalText={t('Please select another conversation.') || ''}
      />
    );
  }

  return <ChatView />;
}
