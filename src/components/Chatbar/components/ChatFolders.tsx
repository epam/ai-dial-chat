import { useCallback } from 'react';

import { FolderInterface } from '@/src/types/folder';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import Folder from '@/src/components/Folder';

import { ConversationComponent } from './Conversation';

interface ChatFoldersProps {
  folder: FolderInterface;
}

const ChatFoldersTemplate = ({ folder }: ChatFoldersProps) => {
  const conversations = useAppSelector(
    ConversationsSelectors.selectConversations,
  );

  return (
    <div className="ml-5 flex flex-col gap-1 border-l border-gray-500">
      {conversations
        .filter((conversation) => conversation.folderId)
        .map((conversation, index) => {
          if (conversation.folderId === folder.id) {
            return (
              <div key={index} className="pl-2">
                <ConversationComponent conversation={conversation} />
              </div>
            );
          }
        })}
    </div>
  );
};

interface Props {
  searchTerm: string;
}

export const ChatFolders = ({ searchTerm }: Props) => {
  const dispatch = useAppDispatch();

  const folders = useAppSelector(ConversationsSelectors.selectFolders);

  const handleDrop = useCallback(
    (e: any, folder: FolderInterface) => {
      if (e.dataTransfer) {
        const conversation = JSON.parse(e.dataTransfer.getData('conversation'));
        dispatch(
          ConversationsActions.updateConversation({
            id: conversation.id,
            values: {
              folderId: folder.id,
            },
          }),
        );
      }
    },
    [dispatch],
  );

  return (
    <div className="flex w-full flex-col" data-qa="chat-folders">
      {folders.map((folder, index) => (
        <Folder
          key={index}
          searchTerm={searchTerm}
          currentFolder={folder}
          folderComponent={<ChatFoldersTemplate folder={folder} />}
          highlightColor="green"
          handleDrop={handleDrop}
          onRenameFolder={(newName) => {
            dispatch(
              ConversationsActions.renameFolder({
                folderId: folder.id,
                name: newName,
              }),
            );
          }}
          onDeleteFolder={() =>
            dispatch(ConversationsActions.deleteFolder({ folderId: folder.id }))
          }
        />
      ))}
    </div>
  );
};
