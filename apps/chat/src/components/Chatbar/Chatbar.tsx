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
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-ui-settings';

import { Spinner } from '@/src/components/Common/Spinner';

import PlusIcon from '../../../public/images/icons/plus-large.svg';
import Sidebar from '../Sidebar';
import { ChatFolders } from './ChatFolders';
import { ChatbarSettings } from './ChatbarSettings';
import { Conversations } from './Conversations';

import { Feature } from '@epam/ai-dial-shared';

const ChatActionsBlock = () => {
  const { t } = useTranslation(Translation.SideBar);
  const dispatch = useAppDispatch();
  const messageIsStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );
  const isActiveNewConversationRequest = useAppSelector(
    ConversationsSelectors.selectIsActiveNewConversationRequest,
  );
  const isNewConversationDisabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.HideNewConversation),
  );

  if (isNewConversationDisabled) {
    return null;
  }

  return (
    <div className="flex">
      <button
        className="flex shrink-0 grow cursor-pointer select-none items-center leading-3 justify-center gap-2 px-3 py-2 transition-colors duration-200 bg-accent-primary hover:bg-accent-quaternary rounded-2xl my-2 mx-5 disabled:cursor-not-allowed"
        onClick={() => {
          dispatch(
            ConversationsActions.createNewConversations({
              names: [DEFAULT_CONVERSATION_NAME],
            }),
          );
          dispatch(ConversationsActions.resetSearch());
        }}
        disabled={messageIsStreaming || isActiveNewConversationRequest}
        data-qa="new-entity"
      >
        {isActiveNewConversationRequest ? (
          <Spinner size={18} className={'text-primary-bg-dark'}/>
        ) : (
          <PlusIcon width={18} height={18} />
        )}
        {t('New conversation')}
      </button>
    </div>
  );
};

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
      actionButtons={<ChatActionsBlock />}
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
      footerComponent={<ChatbarSettings />}
      areEntitiesUploaded={areEntitiesUploaded}
    />
  );
};
