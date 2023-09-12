import { useCallback, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { Conversation } from '@/src/types/chat';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { ChatFolders } from './components/ChatFolders';
import { ChatbarSettings } from './components/ChatbarSettings';
import { Conversations } from './components/Conversations';

import PlusIcon from '../../../public/images/icons/plus-large.svg';
import Sidebar from '../Sidebar';

import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-settings';

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

  const chatFolders = useMemo(
    () => folders.filter(({ type }) => type === 'chat'),
    [folders],
  );

  const handleDrop = useCallback(
    (e: any) => {
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
    },
    [dispatch],
  );

  const actionsBlock = useMemo(
    () => (
      <button
        className={`hover:bg-green/15disabled:cursor-not-allowed flex shrink-0 cursor-pointer select-none items-center gap-3 p-5 transition-colors  duration-200`}
        onClick={() => {
          dispatch(
            ConversationsActions.createNewConversations({
              names: [DEFAULT_CONVERSATION_NAME],
            }),
          );
          dispatch(ConversationsActions.setSearchTerm({ searchTerm: '' }));
        }}
        disabled={!!messageIsStreaming}
        data-qa="new-chat"
      >
        <PlusIcon className="text-gray-500" width={18} height={18} />
        {t('New conversation')}
      </button>
    ),
    [dispatch, messageIsStreaming, t],
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
