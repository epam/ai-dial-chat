import { FolderInterface } from '@/src/types/folder';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import Folder from '@/src/components/Folder';

import { ConversationComponent } from './Conversation';

interface Props {
  searchTerm: string;
}

export const ChatFolders = ({ searchTerm }: Props) => {
  const dispatch = useAppDispatch();

  const conversations = useAppSelector(
    ConversationsSelectors.selectConversations,
  );
  const folders = useAppSelector(ConversationsSelectors.selectFolders);

  const handleDrop = (e: any, folder: FolderInterface) => {
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
  };

  const ChatFolders = (currentFolder: FolderInterface) => {
    return conversations
      .filter((conversation) => conversation.folderId)
      .map((conversation, index) => {
        if (conversation.folderId === currentFolder.id) {
          return (
            <div
              key={index}
              className="ml-5 gap-2 border-l border-gray-500 pl-2"
            >
              <ConversationComponent conversation={conversation} />
            </div>
          );
        }
      });
  };

  return (
    <div className="flex w-full flex-col" data-qa="chat-folders">
      {folders.map((folder, index) => (
        <Folder
          key={index}
          searchTerm={searchTerm}
          currentFolder={folder}
          folderComponent={ChatFolders(folder)}
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
