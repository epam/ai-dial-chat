import { useTranslation } from 'next-i18next';

import { DEFAULT_CONVERSATION_NAME } from '@/utils/app/const';

import { Conversation } from '@/types/chat';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { UISelectors } from '@/store/ui/ui.reducers';

import { ChatFolders } from './components/ChatFolders';
import { ChatbarSettings } from './components/ChatbarSettings';
import { Conversations } from './components/Conversations';

import PlusIcon from '../../public/images/icons/plus-large.svg';
import Sidebar from '../Sidebar';

export const Chatbar = () => {
  const { t } = useTranslation('sidebar');
  const dispatch = useAppDispatch();

  const showChatbar = useAppSelector(UISelectors.selectShowChatbar);
  const folders = useAppSelector(ConversationsSelectors.selectFolders);
  const messageIsStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );
  const conversations = useAppSelector(
    ConversationsSelectors.selectConversations,
  );
  const searchTerm = useAppSelector(ConversationsSelectors.selectSearchTerm);
  const filteredConversations = useAppSelector(
    ConversationsSelectors.selectSearchedConversations,
  );

  const chatFolders = folders.filter(({ type }) => type === 'chat');

  const handleDrop = (e: any) => {
    if (e.dataTransfer) {
      const conversation = JSON.parse(e.dataTransfer.getData('conversation'));
      dispatch(
        ConversationsActions.updateConversation({
          id: conversation.id,
          values: { folderId: '0' },
        }),
      );
      dispatch(ConversationsActions.setSearchTerm({ searchTerm: '' }));
    }
  };

  const actionsBlock = (
    <button
      className={`flex shrink-0 cursor-pointer select-none items-center gap-3 p-5 transition-colors duration-200 hover:bg-green/15 disabled:cursor-not-allowed`}
      onClick={() => {
        dispatch(
          ConversationsActions.createNewConversations({
            names: [DEFAULT_CONVERSATION_NAME],
          }),
        );
        dispatch(ConversationsActions.setSearchTerm({ searchTerm: '' }));
      }}
      disabled={!!messageIsStreaming}
    >
      <PlusIcon className="text-gray-500" width={18} height={18} />
      {t('New conversation')}
    </button>
  );

  return (
    <Sidebar<Conversation>
      featureType="chat"
      side={'left'}
      actionButtons={actionsBlock}
      isOpen={showChatbar}
      itemComponent={<Conversations conversations={filteredConversations} />}
      folderComponent={<ChatFolders searchTerm={searchTerm} />}
      folders={chatFolders}
      items={conversations}
      filteredItems={filteredConversations}
      searchTerm={searchTerm}
      handleSearchTerm={(searchTerm: string) =>
        dispatch(ConversationsActions.setSearchTerm({ searchTerm }))
      }
      handleDrop={handleDrop}
      footerComponent={<ChatbarSettings />}
    />
  );
};
