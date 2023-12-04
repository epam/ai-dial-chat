import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { SharedWithMeFilter } from '@/src/utils/app/search';

import { Conversation } from '@/src/types/chat';
import { EntityFilter, HighlightColor } from '@/src/types/common';
import { FolderInterface, FolderSectionProps } from '@/src/types/folder';
import { Translation } from '@/src/types/translation';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import Folder from '@/src/components/Folder';

import CollapsableSection from '../../Common/CollapsableSection';
import { BetweenFoldersLine } from '../../Sidebar/BetweenFoldersLine';
import { ConversationComponent } from './Conversation';

interface ChatFolderProps {
  folder: FolderInterface;
  index: number;
  isLast: boolean;
  readonly?: boolean;
  itemFilter: EntityFilter<Conversation>;
  includeEmpty: boolean;
}

const ChatFolderTemplate = ({
  folder,
  index,
  isLast,
  readonly,
  itemFilter,
  includeEmpty = false,
}: ChatFolderProps) => {
  const dispatch = useAppDispatch();

  const searchTerm = useAppSelector(ConversationsSelectors.selectSearchTerm);
  const conversations = useAppSelector((state) =>
    ConversationsSelectors.selectFilteredConversations(
      state,
      itemFilter,
      searchTerm,
    ),
  );
  const conversationFolders = useAppSelector((state) =>
    ConversationsSelectors.selectFilteredFolders(
      state,
      itemFilter,
      searchTerm,
      includeEmpty,
    ),
  );
  const highlightedFolders = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsFoldersIds,
  );
  const openedFoldersIds = useAppSelector(UISelectors.selectOpenedFoldersIds);

  const handleDrop = useCallback(
    (e: any, folder: FolderInterface) => {
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
        highlightColor={HighlightColor.Green}
      />
      <Folder
        readonly={readonly}
        searchTerm={searchTerm}
        currentFolder={folder}
        itemComponent={ConversationComponent}
        allItems={conversations}
        allFolders={conversationFolders}
        highlightColor={HighlightColor.Green}
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
      />
      {isLast && (
        <BetweenFoldersLine
          level={0}
          onDrop={onDropBetweenFolders}
          index={index + 1}
          parentFolderId={folder.folderId}
          highlightColor={HighlightColor.Green}
        />
      )}
    </>
  );
};

export const ChatSection = ({
  name,
  itemFilter,
  hideIfEmpty = true,
  displayRootFiles,
  showEmptyFolders = false,
  openByDefault = false,
  dataQa,
}: FolderSectionProps<Conversation>) => {
  const { t } = useTranslation(Translation.SideBar);
  const searchTerm = useAppSelector(ConversationsSelectors.selectSearchTerm);
  const [isSectionHighlighted, setIsSectionHighlighted] = useState(false);
  const folders = useAppSelector((state) =>
    ConversationsSelectors.selectFilteredFolders(
      state,
      itemFilter,
      searchTerm,
      showEmptyFolders,
    ),
  );
  const conversations = useAppSelector((state) =>
    ConversationsSelectors.selectFilteredConversations(
      state,
      itemFilter,
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

  if (hideIfEmpty && !conversations.length && !folders.length) return null;

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
              itemFilter={itemFilter}
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
  const isFilterEmpty = useAppSelector(
    ConversationsSelectors.selectIsEmptySearchFilter,
  );
  const commonItemFilter = useAppSelector(
    ConversationsSelectors.selectItemFilter,
  );

  const folderItems: FolderSectionProps<Conversation>[] = useMemo(
    () =>
      [
        {
          hide: !isFilterEmpty,
          name: 'Shared with me',
          itemFilter: SharedWithMeFilter,
          displayRootFiles: true,
          dataQa: 'share-with-me',
        },
        {
          name: 'Pinned chats',
          itemFilter: commonItemFilter,
          showEmptyFolders: true,
          openByDefault: true,
          dataQa: 'pinned-chats',
        },
      ].filter(({ hide }) => !hide),
    [commonItemFilter, isFilterEmpty],
  );

  return (
    <div
      className="flex w-full flex-col gap-0.5 divide-y divide-gray-200 dark:divide-gray-800"
      data-qa="chat-folders"
    >
      {folderItems.map((itemProps) => (
        <ChatSection key={itemProps.name} {...itemProps} />
      ))}
    </div>
  );
}
