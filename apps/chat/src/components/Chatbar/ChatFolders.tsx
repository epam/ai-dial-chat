import { DragEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { isEntityNameOnSameLevelUnique } from '@/src/utils/app/common';
import { compareEntitiesByName } from '@/src/utils/app/folders';
import { getRootId, isRootId } from '@/src/utils/app/id';
import { MoveType } from '@/src/utils/app/move';
import {
  PublishedWithMeFilter,
  SharedWithMeFilter,
} from '@/src/utils/app/search';
import { isEntityOrParentsExternal } from '@/src/utils/app/share';
import { ApiKeys } from '@/src/utils/server/api';

import { Conversation } from '@/src/types/chat';
import { FeatureType } from '@/src/types/common';
import { FolderInterface, FolderSectionProps } from '@/src/types/folder';
import { EntityFilters } from '@/src/types/search';
import { Translation } from '@/src/types/translation';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import {
  MAX_CHAT_AND_PROMPT_FOLDERS_DEPTH,
  PUBLISHING_FOLDER_NAME,
} from '@/src/constants/folders';

import Folder from '@/src/components/Folder/Folder';

import CollapsableSection from '../Common/CollapsableSection';
import { BetweenFoldersLine } from '../Sidebar/BetweenFoldersLine';
import { ConversationComponent } from './Conversation';

interface ChatFolderProps {
  folder: FolderInterface;
  isLast: boolean;
  readonly?: boolean;
  filters: EntityFilters;
  includeEmpty: boolean;
}

const ChatFolderTemplate = ({
  folder,
  isLast,
  readonly,
  filters,
  includeEmpty = false,
}: ChatFolderProps) => {
  const { t } = useTranslation(Translation.SideBar);

  const dispatch = useAppDispatch();

  const searchTerm = useAppSelector(ConversationsSelectors.selectSearchTerm);
  const conversations = useAppSelector((state) =>
    ConversationsSelectors.selectFilteredConversations(
      state,
      filters,
      searchTerm,
    ),
  );
  const allConversations = useAppSelector(
    ConversationsSelectors.selectConversations,
  );
  const allFolders = useAppSelector(ConversationsSelectors.selectFolders);
  const conversationFolders = useAppSelector((state) =>
    ConversationsSelectors.selectFilteredFolders(
      state,
      filters,
      searchTerm,
      includeEmpty,
    ),
  );
  const highlightedFolders = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsFoldersIds,
  );
  const openedFoldersIds = useAppSelector((state) =>
    UISelectors.selectOpenedFoldersIds(state, FeatureType.Chat),
  );
  const loadingFolderIds = useAppSelector(
    ConversationsSelectors.selectLoadingFolderIds,
  );

  const isExternal = useAppSelector((state) =>
    isEntityOrParentsExternal(state, folder, FeatureType.Chat),
  );

  const handleDrop = useCallback(
    (e: DragEvent, folder: FolderInterface) => {
      if (e.dataTransfer) {
        const conversationData = e.dataTransfer.getData(MoveType.Conversation);
        const folderData = e.dataTransfer.getData(MoveType.ConversationFolder);

        if (conversationData) {
          const conversation: Conversation = JSON.parse(conversationData);
          dispatch(
            ConversationsActions.updateConversation({
              id: conversation.id,
              values: {
                folderId: folder.id,
              },
            }),
          );
        } else if (folderData) {
          const movedFolder: FolderInterface = JSON.parse(folderData);
          if (
            movedFolder.id !== folder.id &&
            movedFolder.folderId !== folder.id
          ) {
            dispatch(
              ConversationsActions.updateFolder({
                folderId: movedFolder.id,
                values: { folderId: folder.id },
              }),
            );
          }
        }
      }
    },
    [dispatch],
  );
  const onDropBetweenFolders = useCallback(
    (folder: FolderInterface) => {
      const folderId = getRootId({ apiKey: ApiKeys.Conversations });

      if (
        !isEntityNameOnSameLevelUnique(
          folder.name,
          { ...folder, folderId },
          allFolders,
        )
      ) {
        dispatch(
          UIActions.showToast({
            message: t(
              'Folder with name "{{name}}" already exists in the root.',
              {
                ns: 'folder',
                name: folder.name,
              },
            ),
            type: 'error',
          }),
        );

        return;
      }

      dispatch(
        ConversationsActions.updateFolder({
          folderId: folder.id,
          values: { folderId },
        }),
      );
    },
    [allFolders, dispatch, t],
  );

  const handleFolderClick = useCallback(
    (folderId: string) => {
      dispatch(ConversationsActions.toggleFolder({ id: folderId }));
    },
    [dispatch],
  );

  return (
    <>
      <BetweenFoldersLine
        level={0}
        onDrop={onDropBetweenFolders}
        featureType={FeatureType.Chat}
        denyDrop={isExternal}
      />
      <Folder
        maxDepth={MAX_CHAT_AND_PROMPT_FOLDERS_DEPTH}
        readonly={readonly}
        searchTerm={searchTerm}
        currentFolder={folder}
        itemComponent={ConversationComponent}
        allItems={conversations}
        allItemsWithoutFilters={allConversations}
        allFolders={conversationFolders}
        allFoldersWithoutFilters={allFolders}
        highlightedFolders={highlightedFolders}
        openedFoldersIds={openedFoldersIds}
        handleDrop={handleDrop}
        onRenameFolder={(name, folderId) => {
          dispatch(
            ConversationsActions.updateFolder({
              folderId,
              values: { name },
            }),
          );
        }}
        onDeleteFolder={(folderId: string) =>
          dispatch(ConversationsActions.deleteFolder({ folderId }))
        }
        onClickFolder={handleFolderClick}
        featureType={FeatureType.Chat}
        loadingFolderIds={loadingFolderIds}
      />
      {isLast && (
        <BetweenFoldersLine
          level={0}
          onDrop={onDropBetweenFolders}
          featureType={FeatureType.Chat}
          denyDrop={isExternal}
        />
      )}
    </>
  );
};

export const ChatSection = ({
  name,
  filters,
  hideIfEmpty = true,
  displayRootFiles,
  showEmptyFolders = false,
  openByDefault = false,
  dataQa,
}: FolderSectionProps) => {
  const { t } = useTranslation(Translation.SideBar);
  const searchTerm = useAppSelector(ConversationsSelectors.selectSearchTerm);
  const [isSectionHighlighted, setIsSectionHighlighted] = useState(false);
  const folders = useAppSelector((state) =>
    ConversationsSelectors.selectFilteredFolders(
      state,
      filters,
      searchTerm,
      showEmptyFolders,
    ),
  );
  const conversations = useAppSelector((state) =>
    ConversationsSelectors.selectFilteredConversations(
      state,
      filters,
      searchTerm,
    ),
  );

  const rootFolders = useMemo(
    () => folders.filter(({ folderId }) => isRootId(folderId)),
    [folders],
  );

  const rootConversations = useMemo(
    () =>
      conversations
        .filter(({ folderId }) => isRootId(folderId))
        .sort(compareEntitiesByName),
    [conversations],
  );

  const selectedFoldersIds = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsFoldersIds,
  );

  const selectedConversationsIds = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsIds,
  );

  useEffect(() => {
    const shouldBeHighlighted =
      rootFolders.some((folder) => selectedFoldersIds.includes(folder.id)) ||
      (!!displayRootFiles &&
        rootConversations.some((chat) =>
          selectedConversationsIds.includes(chat.id),
        ));
    if (isSectionHighlighted !== shouldBeHighlighted) {
      setIsSectionHighlighted(shouldBeHighlighted);
    }
  }, [
    displayRootFiles,
    rootFolders,
    isSectionHighlighted,
    selectedConversationsIds,
    selectedFoldersIds,
    rootConversations,
  ]);

  if (
    hideIfEmpty &&
    (!displayRootFiles || !rootConversations.length) &&
    !rootFolders.length
  ) {
    return null;
  }

  return (
    <CollapsableSection
      name={t(name)}
      openByDefault={openByDefault}
      dataQa={dataQa}
      isHighlighted={isSectionHighlighted}
    >
      <div>
        {rootFolders.map((folder, index, arr) => {
          return (
            <ChatFolderTemplate
              key={folder.id}
              folder={folder}
              isLast={index === arr.length - 1}
              filters={filters}
              includeEmpty={showEmptyFolders}
            />
          );
        })}
      </div>
      {displayRootFiles && (
        <div className="flex flex-col gap-1">
          {rootConversations.map((item) => (
            <ConversationComponent key={item.id} item={item} />
          ))}
        </div>
      )}
    </CollapsableSection>
  );
};

export function ChatFolders() {
  const { t } = useTranslation(Translation.SideBar);
  const isFilterEmpty = useAppSelector(
    ConversationsSelectors.selectIsEmptySearchFilter,
  );
  const searchTerm = useAppSelector(ConversationsSelectors.selectSearchTerm);
  const commonItemFilter = useAppSelector(
    ConversationsSelectors.selectMyItemsFilters,
  );

  const isPublishingEnabled = useAppSelector((state) =>
    SettingsSelectors.isPublishingEnabled(state, FeatureType.Chat),
  );

  const isSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isSharingEnabled(state, FeatureType.Chat),
  );

  const folderItems: FolderSectionProps[] = useMemo(
    () =>
      [
        {
          hidden: !isPublishingEnabled || !isFilterEmpty,
          name: t(PUBLISHING_FOLDER_NAME),
          filters: PublishedWithMeFilter,
          displayRootFiles: true,
          dataQa: 'published-with-me',
          openByDefault: !!searchTerm.length,
        },
        {
          hidden: !isSharingEnabled || !isFilterEmpty,
          name: t('Shared with me'),
          filters: SharedWithMeFilter,
          displayRootFiles: true,
          dataQa: 'shared-with-me',
          openByDefault: !!searchTerm.length,
        },
        {
          name: t('Pinned chats'),
          filters: commonItemFilter,
          showEmptyFolders: isFilterEmpty,
          openByDefault: true,
          dataQa: 'pinned-chats',
        },
      ].filter(({ hidden }) => !hidden),
    [
      commonItemFilter,
      isFilterEmpty,
      isPublishingEnabled,
      isSharingEnabled,
      searchTerm.length,
      t,
    ],
  );

  return (
    <div
      className="flex w-full flex-col gap-0.5 divide-y divide-tertiary empty:hidden"
      data-qa="chat-folders"
    >
      {folderItems.map((itemProps) => (
        <ChatSection key={itemProps.name} {...itemProps} />
      ))}
    </div>
  );
}
