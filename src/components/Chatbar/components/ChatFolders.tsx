import { DragEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import {
  PublishedWithMeFilter,
  SharedWithMeFilter,
} from '@/src/utils/app/search';

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

import Folder from '@/src/components/Folder/Folder';

import CollapsableSection from '../../Common/CollapsableSection';
import { BetweenFoldersLine } from '../../Sidebar/BetweenFoldersLine';
import { ConversationComponent } from './Conversation';

interface ChatFolderProps {
  folder: FolderInterface;
  index: number;
  isLast: boolean;
  readonly?: boolean;
  filters: EntityFilters;
  includeEmpty: boolean;
}

const ChatFolderTemplate = ({
  folder,
  index,
  isLast,
  readonly,
  filters,
  includeEmpty = false,
}: ChatFolderProps) => {
  const dispatch = useAppDispatch();

  const searchTerm = useAppSelector(ConversationsSelectors.selectSearchTerm);
  const conversations = useAppSelector((state) =>
    ConversationsSelectors.selectFilteredConversations(
      state,
      filters,
      searchTerm,
    ),
  );
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
  const openedFoldersIds = useAppSelector(UISelectors.selectOpenedFoldersIds);

  const handleDrop = useCallback(
    (e: DragEvent, folder: FolderInterface) => {
      if (e.dataTransfer) {
        const conversationData = e.dataTransfer.getData('conversation');
        const folderData = e.dataTransfer.getData('folder');

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
              ConversationsActions.moveFolder({
                folderId: movedFolder.id,
                newParentFolderId: folder.id,
                newIndex: 0,
              }),
            );
          }
        }
      }
    },
    [dispatch],
  );

  const onDropBetweenFolders = useCallback(
    (
      folder: FolderInterface,
      parentFolderId: string | undefined,
      index: number,
    ) => {
      dispatch(
        ConversationsActions.moveFolder({
          folderId: folder.id,
          newParentFolderId: parentFolderId,
          newIndex: index,
        }),
      );
    },
    [dispatch],
  );

  const handleFolderClick = useCallback(
    (folderId: string) => {
      dispatch(UIActions.toggleFolder({ id: folderId }));
    },
    [dispatch],
  );

  return (
    <>
      <BetweenFoldersLine
        level={0}
        onDrop={onDropBetweenFolders}
        index={index}
        parentFolderId={folder.folderId}
      />
      <Folder
        readonly={readonly}
        searchTerm={searchTerm}
        currentFolder={folder}
        itemComponent={ConversationComponent}
        allItems={conversations}
        allFolders={conversationFolders}
        highlightedFolders={highlightedFolders}
        openedFoldersIds={openedFoldersIds}
        handleDrop={handleDrop}
        onRenameFolder={(name, folderId) => {
          dispatch(
            ConversationsActions.renameFolder({
              folderId,
              name,
            }),
          );
        }}
        onDeleteFolder={(folderId: string) =>
          dispatch(ConversationsActions.deleteFolder({ folderId }))
        }
        onDropBetweenFolders={onDropBetweenFolders}
        onClickFolder={handleFolderClick}
        featureType={FeatureType.Chat}
      />
      {isLast && (
        <BetweenFoldersLine
          level={0}
          onDrop={onDropBetweenFolders}
          index={index + 1}
          parentFolderId={folder.folderId}
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

  const rootfolders = useMemo(
    () => folders.filter(({ folderId }) => !folderId),
    [folders],
  );

  const rootConversations = useMemo(
    () => conversations.filter(({ folderId }) => !folderId),
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
      rootfolders.some((folder) => selectedFoldersIds.includes(folder.id)) ||
      (!!displayRootFiles &&
        rootConversations.some((chat) =>
          selectedConversationsIds.includes(chat.id),
        ));
    if (isSectionHighlighted !== shouldBeHighlighted) {
      setIsSectionHighlighted(shouldBeHighlighted);
    }
  }, [
    displayRootFiles,
    rootfolders,
    isSectionHighlighted,
    selectedConversationsIds,
    selectedFoldersIds,
    rootConversations,
  ]);

  if (
    hideIfEmpty &&
    (!displayRootFiles || !conversations.length) &&
    !folders.length
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
        {rootfolders.map((folder, index, arr) => {
          return (
            <ChatFolderTemplate
              key={folder.id}
              folder={folder}
              index={index}
              isLast={index === arr.length - 1}
              filters={filters}
              includeEmpty={showEmptyFolders}
            />
          );
        })}
      </div>
      <div>
        {displayRootFiles &&
          rootConversations.map((item) => (
            <ConversationComponent key={item.id} item={item} />
          ))}
      </div>
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
          name: t('Organization'),
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
