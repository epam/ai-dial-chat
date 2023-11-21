import { useCallback, useEffect, useState } from 'react';

import classNames from 'classnames';

import { Conversation } from '@/src/types/chat';
import { FolderInterface } from '@/src/types/folder';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import Folder from '@/src/components/Folder';

import { BetweenFoldersLine } from '../../Sidebar/BetweenFoldersLine';
import { ConversationComponent } from './Conversation';
import { IconCaretRightFilled } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

interface ChatFolderProps {
  folder: FolderInterface;
  index: number;
  isLast: boolean;
}

const ChatFolderTemplate = ({ folder, index, isLast }: ChatFolderProps) => {
  const dispatch = useAppDispatch();

  const searchTerm = useAppSelector(ConversationsSelectors.selectSearchTerm);
  const conversations = useAppSelector(
    ConversationsSelectors.selectConversations,
  );
  const conversationFolders = useAppSelector(
    ConversationsSelectors.selectFolders,
  );
  const highlightedFolders = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsFoldersIds,
  );

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

  return (
    <>
      <BetweenFoldersLine
        level={0}
        onDrop={onDropBetweenFolders}
        index={index}
        parentFolderId={folder.folderId}
        highlightColor="green"
      />
      <Folder
        searchTerm={searchTerm}
        currentFolder={folder}
        itemComponent={ConversationComponent}
        allItems={conversations}
        allFolders={conversationFolders}
        highlightColor="green"
        highlightedFolders={highlightedFolders}
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
      />
      {isLast && (
        <BetweenFoldersLine
          level={0}
          onDrop={onDropBetweenFolders}
          index={index + 1}
          parentFolderId={folder.folderId}
          highlightColor="green"
        />
      )}
    </>
  );
};

export const ChatFolders = () => {
  const { t } = useTranslation('chat');
  const [isSectionOpened, setIsSectionOpened] = useState(true);
  const [isSectionHighlighted, setIsSectionHighlighted] = useState(false);
  const folders = useAppSelector(ConversationsSelectors.selectFolders);
  const selectedFoldersIds = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsFoldersIds,
  );

  const handleSectionOpen = () => {
    setIsSectionOpened((isOpen) => !isOpen);
  };

  useEffect(() => {
    setIsSectionHighlighted(
      folders.some((folder) => selectedFoldersIds.includes(folder.id)),
    );
  }, [folders, selectedFoldersIds]);

  return (
    <div className={classNames('flex w-full flex-col')} data-qa="chat-folders">
      <button
        className={classNames(
          'flex items-center gap-1 py-1 text-xs',
          isSectionHighlighted
            ? 'text-green'
            : '[&:not(:hover)]:text-gray-500',
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
        {t('My Chats')}
      </button>
      {isSectionOpened && folders.map((folder, index, arr) => {
        if (!folder.folderId) {
          return (
            <ChatFolderTemplate
              key={index}
              folder={folder}
              index={index}
              isLast={index === arr.length - 1}
            />
          );
        }

        return null;
      })}
    </div>
  );
};
