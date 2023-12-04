import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { Conversation } from '@/src/types/chat';
import { FeatureType } from '@/src/types/common';
import { SearchFilters } from '@/src/types/search';
import { Translation } from '@/src/types/translation';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-settings';

import { ChatFolders } from './components/ChatFolders';
import { ChatbarSettings } from './components/ChatbarSettings';
import { Conversations } from './components/Conversations';

import PlusIcon from '../../../public/images/icons/plus-large.svg';
import Sidebar from '../Sidebar';

const ChatActionsBlock = () => {
  const { t } = useTranslation(Translation.SideBar);
  const dispatch = useAppDispatch();
  const messageIsStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );

  return (
    <div className="flex px-2 py-1">
      <button
        className="flex shrink-0 grow cursor-pointer select-none items-center gap-3 rounded px-3 py-2 transition-colors duration-200 hover:bg-green/15 disabled:cursor-not-allowed"
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
    </div>
  );
};

export const Chatbar = () => {
  const dispatch = useAppDispatch();

  const showChatbar = useAppSelector(UISelectors.selectShowChatbar);
  const searchTerm = useAppSelector(ConversationsSelectors.selectSearchTerm);
  const searchFilters = useAppSelector(
    ConversationsSelectors.selectSearchFilters,
  );
  const folders = useAppSelector((state) =>
    ConversationsSelectors.selectFilteredFolders(
      state,
      undefined,
      searchTerm,
      true,
    ),
  );
  const conversations = useAppSelector(
    ConversationsSelectors.selectConversations,
  );

  const filteredConversations = useAppSelector(
    ConversationsSelectors.selectSearchedConversations,
  );

  const handleDrop = useCallback(
    (e: any) => {
      if (e.dataTransfer) {
        const conversation = JSON.parse(e.dataTransfer.getData('conversation'));
        dispatch(
          ConversationsActions.updateConversation({
            id: conversation.id,
            values: { folderId: undefined },
          }),
        );
        dispatch(ConversationsActions.setSearchTerm({ searchTerm: '' }));
      }
    },
    [dispatch],
  );

  return (
    <Sidebar<Conversation>
      featureType={FeatureType.Chat}
      side="left"
      actionButtons={<ChatActionsBlock />}
      isOpen={showChatbar}
      itemComponent={<Conversations conversations={filteredConversations} />}
      folderComponent={<ChatFolders />}
      folders={folders}
      items={conversations}
      filteredItems={filteredConversations}
      searchTerm={searchTerm}
      searchFilters={searchFilters}
      handleSearchTerm={(searchTerm: string, searchFilters: SearchFilters) =>
        dispatch(
          ConversationsActions.setSearchTerm({ searchTerm, searchFilters }),
        )
      }
      handleDrop={handleDrop}
      footerComponent={<ChatbarSettings />}
    />
  );
};
