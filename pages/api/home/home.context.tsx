import { Dispatch, createContext } from 'react';

import { ActionType } from '@/hooks/useCreateReducer';

import { Conversation, Message } from '@/types/chat';
import { KeyValuePair } from '@/types/data';
import { FolderType } from '@/types/folder';

import { HomeInitialState } from './home.state';

export interface HomeContextProps {
  state: HomeInitialState;
  dispatch: Dispatch<ActionType<HomeInitialState>>;
  handleNewConversation: (name?: string) => void;
  handleCreateFolder: (name: string, type: FolderType) => void;
  handleDeleteFolder: (folderId: string) => void;
  handleUpdateFolder: (folderId: string, name: string) => void;
  handleSelectConversation: (
    conversation: Conversation,
    isMultiple?: boolean,
  ) => void;
  handleUpdateConversation: (
    conversation: Conversation,
    data: KeyValuePair,
    localConversations?: Conversation[],
  ) => Conversation[];
  handleNewReplayConversation: (conversation: Conversation) => void;
}

const HomeContext = createContext<HomeContextProps>(undefined!);

export default HomeContext;
