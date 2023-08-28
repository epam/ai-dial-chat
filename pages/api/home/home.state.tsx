import { Conversation, Message } from '@/types/chat';
import { Feature } from '@/types/features';
import { FolderInterface } from '@/types/folder';
import { Prompt } from '@/types/prompt';

export interface HomeInitialState {
  loading: boolean;
  messageIsStreaming: boolean;
  folders: FolderInterface[];
  conversations: Conversation[];
  selectedConversationIds: string[];
  currentMessage: Message | undefined;
  prompts: Prompt[];
  temperature: number;
  currentFolder: FolderInterface | undefined;
  messageError: boolean;
  searchTerm: string;
  isIframe: boolean;
  footerHtmlMessage: string;

  enabledFeatures: Set<Feature>;
}

export const initialState: HomeInitialState = {
  loading: false,
  messageIsStreaming: false,
  folders: [],
  conversations: [],
  selectedConversationIds: [],
  currentMessage: undefined,
  prompts: [],
  temperature: 1,
  currentFolder: undefined,
  messageError: false,
  searchTerm: '',
  isIframe: false,
  footerHtmlMessage: '',

  enabledFeatures: new Set([]),
};
