import { useTranslation } from 'next-i18next';

import { UploadStatus } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { StoreSelectorsHook } from '@/src/store/useStoreSelectors';

import { ChatView } from '@/src/components/Chat/ChatView/ChatView';
import { ChatInputFooter } from '@/src/components/Chat/common/ChatInputFooter';

import Loader from '../Common/Loader';
import { NotFoundEntity } from '../Common/NotFoundEntity';
import { PublicationHandler } from './Publish/PublicationHandler';

interface Props {
  useStoreSelectors: StoreSelectorsHook;
}

export function Chat({ useStoreSelectors }: Props) {
  const { t } = useTranslation(Translation.Chat);

  const {
    useConversationsSelectors,
    useModelsSelectors,
    useSettingsSelectors,
    usePublicationSelectors,
  } = useStoreSelectors();
  const {
    areSelectedConversationsLoaded,
    selectedConversationsIds,
    selectedConversations,
  } = useConversationsSelectors([
    'selectSelectedConversations',
    'selectSelectedConversationsIds',
    'selectAreSelectedConversationsLoaded',
  ]);
  const { isModelsLoaded, modelsMap } = useModelsSelectors();
  const { isolatedModelId } = useSettingsSelectors();
  const { selectedPublication } = usePublicationSelectors();
  const activeModel = modelsMap[isolatedModelId || ''];

  if (selectedPublication?.resources && !selectedConversationsIds.length) {
    return (
      <>
        <PublicationHandler publication={selectedPublication} />
        <ChatInputFooter />
      </>
    );
  }

  if (isolatedModelId && isModelsLoaded && !activeModel) {
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

  return <ChatView useStoreSelectors={useStoreSelectors} />;
}
