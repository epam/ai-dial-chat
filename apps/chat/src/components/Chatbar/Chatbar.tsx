import { IconApps } from '@tabler/icons-react';
import { DragEvent, useCallback } from 'react';

import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';

import { isEntityNameOnSameLevelUnique } from '@/src/utils/app/common';
import { getConversationRootId } from '@/src/utils/app/id';
import { MoveType } from '@/src/utils/app/move';

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
import Tooltip from '../Common/Tooltip';
import Sidebar from '../Sidebar';
import { ChatFolders } from './ChatFolders';
import { ChatbarSettings } from './ChatbarSettings';
import { Conversations } from './Conversations';

import { ConversationInfo, Feature } from '@epam/ai-dial-shared';

const ChatActionsBlock = () => {
  const router = useRouter();
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

  const isMarketplaceEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.Marketplace),
  );

  if (isNewConversationDisabled) {
    return null;
  }

  return (
    <>
      {isMarketplaceEnabled && (
        <div className="flex px-2 py-1">
          <button
            className="flex shrink-0 grow cursor-pointer select-none items-center gap-3 rounded px-3 py-[5px] transition-colors duration-200 hover:bg-accent-primary-alpha disabled:cursor-not-allowed hover:disabled:bg-transparent"
            onClick={() => router.push('/marketplace')}
            data-qa="link-to-marketplace"
          >
            <Tooltip tooltip={t('DIAL Marketplace')}>
              <IconApps className="text-secondary" width={24} height={24} />
            </Tooltip>
            {t('DIAL Marketplace')}
          </button>
        </div>
      )}
      <div className="flex px-2 py-1">
        <button
          className="flex shrink-0 grow cursor-pointer select-none items-center gap-3 rounded px-3 py-[5px] transition-colors duration-200 hover:bg-accent-primary-alpha disabled:cursor-not-allowed hover:disabled:bg-transparent"
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
            <Spinner size={24} className="text-secondary" />
          ) : (
            <Tooltip tooltip={t('New conversation')}>
              <PlusIcon className="text-secondary" width={24} height={24} />
            </Tooltip>
          )}
          {t('New conversation')}
        </button>
      </div>
    </>
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

  const handleSearchTerm = useCallback(
    (searchTerm: string) => {
      dispatch(ConversationsActions.setSearchTerm({ searchTerm }));
      dispatch(ConversationsActions.resetChosenConversations());
    },
    [dispatch],
  );

  const handleSearchFilters = useCallback(
    (searchFilters: SearchFilters) => {
      dispatch(ConversationsActions.setSearchFilters({ searchFilters }));
      dispatch(ConversationsActions.resetChosenConversations());
    },
    [dispatch],
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
      handleSearchTerm={handleSearchTerm}
      handleSearchFilters={handleSearchFilters}
      handleDrop={handleDrop}
      footerComponent={<ChatbarSettings />}
      areEntitiesUploaded={areEntitiesUploaded}
    />
  );
};
