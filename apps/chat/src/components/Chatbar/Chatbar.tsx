import { IconApps } from '@tabler/icons-react';
import { DragEvent, useCallback, useMemo } from 'react';

import Link from 'next/link';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

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

import { CONVERSATIONS_DATE_SECTIONS } from '@/src/constants/sections';

import Tooltip from '../Common/Tooltip';
import Sidebar from '../Sidebar';
import { ChatFolders } from './ChatFolders';
import { ChatbarSettings } from './ChatbarSettings';
import { Conversations } from './Conversations';

import { Inversify } from '@epam/ai-dial-modulify-ui';
import { ConversationInfo, Feature } from '@epam/ai-dial-shared';

const ChatActionsBlock = Inversify.register('ChatActionsBlock', () => {
  const { t } = useTranslation(Translation.SideBar);
  const messageIsStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );
  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );
  const isNewConversationDisabled = enabledFeatures.has(
    Feature.HideNewConversation,
  );

  const isMarketplaceEnabled = enabledFeatures.has(Feature.Marketplace);

  if (isNewConversationDisabled) {
    return null;
  }

  return (
    <>
      {isMarketplaceEnabled && (
        <div className="flex px-2 py-1">
          <Link
            href="/marketplace"
            shallow
            className={classNames(
              'flex shrink-0 grow select-none items-center gap-3 rounded px-3 py-[5px] transition-colors duration-200',
              messageIsStreaming
                ? 'cursor-not-allowed bg-transparent'
                : 'cursor-pointer hover:bg-accent-primary-alpha',
            )}
            onClick={(e) => (messageIsStreaming ? e.preventDefault() : null)}
            data-qa="link-to-marketplace"
          >
            <Tooltip tooltip={t('DIAL Marketplace')}>
              <IconApps className="text-secondary" width={24} height={24} />
            </Tooltip>
            {t('DIAL Marketplace')}
          </Link>
        </div>
      )}
    </>
  );
});

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

  const collapsedSectionsSelector = useMemo(
    () => UISelectors.selectCollapsedSections(FeatureType.Chat),
    [],
  );

  const collapsedSections = useAppSelector(collapsedSectionsSelector);

  const selectFilteredConversationsSelector = useMemo(
    () =>
      ConversationsSelectors.selectFilteredConversations(
        myItemsFilters,
        searchTerm,
      ),
    [myItemsFilters, searchTerm],
  );
  const filteredConversations = useAppSelector(
    selectFilteredConversationsSelector,
  );
  const selectFilteredFoldersSelector = useMemo(
    () =>
      ConversationsSelectors.selectFilteredFolders(myItemsFilters, searchTerm),
    [myItemsFilters, searchTerm],
  );
  const filteredFolders = useAppSelector(selectFilteredFoldersSelector);

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
                    ns: Translation.Chat,
                    name: conversation.name,
                  },
                ),
              ),
            );

            return;
          }

          dispatch(
            UIActions.setCollapsedSections({
              featureType: FeatureType.Chat,
              collapsedSections: collapsedSections.filter(
                (section) => section !== CONVERSATIONS_DATE_SECTIONS.today,
              ),
            }),
          );
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
    [allConversations, collapsedSections, dispatch, t],
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
      onSearchTerm={handleSearchTerm}
      onSearchFilters={handleSearchFilters}
      onDrop={handleDrop}
      footerComponent={<ChatbarSettings />}
      areEntitiesUploaded={areEntitiesUploaded}
    />
  );
};
