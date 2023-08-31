import { FolderInterface } from '@/types/folder';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

import Folder from '@/components/Folder';

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
    <div className="flex w-full flex-col">
      {folders
        .filter((folder) => folder.type === 'chat')
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((folder, index) => (
          <Folder
            key={index}
            searchTerm={searchTerm}
            currentFolder={folder}
            handleDrop={handleDrop}
            folderComponent={ChatFolders(folder)}
            highlightColor="green"
          />
        ))}
    </div>
  );
};
