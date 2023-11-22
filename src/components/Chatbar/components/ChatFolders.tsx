import { useCallback } from 'react';

import classNames from 'classnames';

import { Conversation } from '@/src/types/chat';
import { FolderInterface } from '@/src/types/folder';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import Folder from '@/src/components/Folder';

import { BetweenFoldersLine } from '../../Sidebar/BetweenFoldersLine';
import { ConversationComponent } from './Conversation';
import { HighlightColor } from '@/src/types/common';

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

export const ChatFolders = () => {
  const folders = useAppSelector(ConversationsSelectors.selectFolders);

  return (
    <div className={classNames('flex w-full flex-col')} data-qa="chat-folders">
      {folders.map((folder, index, arr) => {
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
