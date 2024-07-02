import { DragEvent, useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { isEntityNameOnSameLevelUnique } from '@/src/utils/app/common';
import { getConversationRootId } from '@/src/utils/app/id';
import { MoveType } from '@/src/utils/app/move';

import { ConversationInfo } from '@/src/types/chat';
import { FeatureType } from '@/src/types/common';
import { SearchFilters } from '@/src/types/search';
import { Translation } from '@/src/types/translation';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import { ChatbarActionButtons } from '@/src/components/Chatbar/ChatbarActionButtons';

import Sidebar from '../Sidebar';
import { ChatFolders } from './ChatFolders';
import { Conversations } from './Conversations';

export const Chatbar = () => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const showChatbar = useAppSelector(UISelectors.selectShowChatbar);
  const searchTerm = useAppSelector(ConversationsSelectors.selectSearchTerm);
  const allConversations = useAppSelector(
    ConversationsSelectors.selectConversations,
  );
  const areEntitiesUploaded = useAppSelector(
    ConversationsSelectors.areConversationsUploaded,
  );
  const searchFilters = useAppSelector(
    ConversationsSelectors.selectSearchFilters,
  );
  const myItemsFilters = useAppSelector(
    ConversationsSelectors.selectMyItemsFilters,
  );

  const filteredConversations = useAppSelector((state) =>
    ConversationsSelectors.selectFilteredConversations(
      state,
      myItemsFilters,
      searchTerm,
    ),
  );
  const filteredFolders = useAppSelector((state) =>
    ConversationsSelectors.selectFilteredFolders(
      state,
      myItemsFilters,
      searchTerm,
    ),
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      if (e.dataTransfer) {
        const conversationData = e.dataTransfer.getData(MoveType.Conversation);
        if (conversationData) {
          const conversation = JSON.parse(conversationData);
          const folderId = getConversationRootId();

          if (
            !isEntityNameOnSameLevelUnique(
              conversation.name,
              { ...conversation, folderId },
              allConversations,
            )
          ) {
            dispatch(
              UIActions.showErrorToast(
                t(
                  'Conversation with name "{{name}}" already exists at the root.',
                  {
                    ns: 'chat',
                    name: conversation.name,
                  },
                ),
              ),
            );

            return;
          }

          dispatch(
            ConversationsActions.updateConversation({
              id: conversation.id,
              values: { folderId },
            }),
          );
          dispatch(ConversationsActions.resetSearch());
        }
      }
    },
    [allConversations, dispatch, t],
  );

  return (
    <Sidebar<ConversationInfo>
      featureType={FeatureType.Chat}
      side="left"
      actionButtons={<ChatbarActionButtons />}
      isOpen={showChatbar}
      itemComponent={<Conversations conversations={filteredConversations} />}
      folderComponent={<ChatFolders />}
      filteredItems={filteredConversations}
      filteredFolders={filteredFolders}
      searchTerm={searchTerm}
      searchFilters={searchFilters}
      handleSearchTerm={(searchTerm: string) =>
        dispatch(ConversationsActions.setSearchTerm({ searchTerm }))
      }
      handleSearchFilters={(searchFilters: SearchFilters) =>
        dispatch(ConversationsActions.setSearchFilters({ searchFilters }))
      }
      handleDrop={handleDrop}
      areEntitiesUploaded={areEntitiesUploaded}
    />
  );
};
