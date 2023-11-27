import { IconCaretRightFilled } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { MyChatsFilters, SharedWithMeFilters } from '@/src/utils/app/folders';

import { Conversation } from '@/src/types/chat';
import { HighlightColor } from '@/src/types/common';
import { ChatFoldersProps, FolderInterface } from '@/src/types/folder';

import { ConversationsActions, ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import Folder from '@/src/components/Folder';

import { BetweenFoldersLine } from '../../Sidebar/BetweenFoldersLine';
import { ConversationComponent } from './Conversation';

interface ChatFolderProps {
  folder: FolderInterface;
  index: number;
  isLast: boolean;
  readonly?: boolean;
}

const ChatFolderTemplate = ({
  folder,
  index,
  isLast,
  readonly,
}: ChatFolderProps) => {
  const dispatch = useAppDispatch();

  const searchTerm = useAppSelector(ConversationsSelectors.selectSearchTerm);
  const conversations = useAppSelector(ConversationsSelectors.selectConversations);
  const conversationFolders = useAppSelector(ConversationsSelectors.selectFolders);
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
  filters,
  hideIfEmpty,
  displayRootFiles,
  readonly,
}: ChatFoldersProps<Conversation>) => {
  const { t } = useTranslation('chat');
  const [isSectionOpened, setIsSectionOpened] = useState(true);
  const [isSectionHighlighted, setIsSectionHighlighted] = useState(false);
  const rootFolders = useAppSelector((state) =>
    ConversationsSelectors.selectRootFolders(state, filters.filterFolder),
  );
  const rootConversations = useAppSelector((state) =>
    ConversationsSelectors.selectFilteredConversations(state, filters.filterItem, true),
  );

  const folders = useMemo(
    () => rootFolders.filter((folder) => filters.filterFolder(folder)),
    [rootFolders, filters],
  );

  const folderItemsExists = useAppSelector((state) =>
    ConversationsSelectors.selectAreFolderItemsExists(state, filters),
  );

  const selectedFoldersIds = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsFoldersIds,
  );

  const selectedConversationsIds = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsIds,
  );

  function handleSectionOpen() {
    setIsSectionOpened((isOpen) => !isOpen);
  }

  useEffect(() => {
    const shouldBeHighlighted =
      folders.some((folder) => selectedFoldersIds.includes(folder.id)) ||
      (!!displayRootFiles &&
        rootConversations.some((chat) =>
          selectedConversationsIds.includes(chat.id),
        ));
    if (isSectionHighlighted !== shouldBeHighlighted) {
      setIsSectionHighlighted(shouldBeHighlighted);
    }
  }, [
    displayRootFiles,
    folders,
    isSectionHighlighted,
    rootConversations,
    selectedConversationsIds,
    selectedFoldersIds,
  ]);

  if (hideIfEmpty && !folderItemsExists) return null;

  return (
    <div
      className="flex w-full flex-col py-1 pl-2 pr-0.5"
      data-qa="chat-folders"
    >
      <button
        className={classNames(
          'flex items-center gap-1 py-1 text-xs',
          isSectionHighlighted ? 'text-green' : '[&:not(:hover)]:text-gray-500',
        )}
        data-qa="chronology"
        onClick={handleSectionOpen}
      >
        <IconCaretRightFilled
          className={classNames(
            'invisible text-gray-500 transition-all group-hover/sidebar:visible',
            isSectionOpened && 'rotate-90',
          )}
          size={10}
        />
        {t(name)}
      </button>
      {isSectionOpened && (
        <>
          <div>
            {folders.map((folder, index, arr) => {
              return (
                <ChatFolderTemplate
                  readonly={readonly}
                  key={index}
                  folder={folder}
                  index={index}
                  isLast={index === arr.length - 1}
                />
              );
            })}
          </div>
          <div>
            {displayRootFiles &&
              rootConversations.map((item, index) => (
                <ConversationComponent
                  key={index}
                  item={item}
                  readonly={readonly}
                />
              ))}
          </div>
        </>
      )}
    </div>
  );
};

const folderItems: ChatFoldersProps<Conversation>[] = [
  {
    name: 'Share With Me',
    filters: SharedWithMeFilters,
    hideIfEmpty: true,
    displayRootFiles: true,
    readonly: true,
  },
  {
    name: 'Pinned Chats',
    filters: MyChatsFilters,
  },
];

export function ChatFolders() {
  return (
    <div className="flex w-full flex-col gap-0.5 divide-y divide-gray-300 dark:divide-gray-900">
      {folderItems.map((itemProps) => (
        <ChatSection key={itemProps.name} {...itemProps} />
      ))}
    </div>
  );
}
