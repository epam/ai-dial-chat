import { Conversation, Message } from '@/types/chat';
import { ErrorMessage } from '@/types/error';
import { Feature } from '@/types/features';
import { FolderInterface } from '@/types/folder';
import { OpenAIEntityAddon } from '@/types/openai';
import { Prompt } from '@/types/prompt';

export interface HomeInitialState {
  loading: boolean;
  lightMode: 'light' | 'dark';
  messageIsStreaming: boolean;
  addonError: ErrorMessage | null;
  addons: OpenAIEntityAddon[];
  addonsMap: Partial<Record<string, OpenAIEntityAddon>>;
  folders: FolderInterface[];
  conversations: Conversation[];
  selectedConversationIds: string[];
  currentMessage: Message | undefined;
  prompts: Prompt[];
  temperature: number;
  showChatbar: boolean;
  showPromptbar: boolean;
  currentFolder: FolderInterface | undefined;
  messageError: boolean;
  searchTerm: string;
  isCompareMode: boolean;
  isIframe: boolean;
  footerHtmlMessage: string;

  isUserSettingsOpen: boolean;
  enabledFeatures: Set<Feature>;

  recentAddonsIds: string[];
  isProfileOpen: boolean;
}

export const initialState: HomeInitialState = {
  loading: false,
  lightMode: 'dark',
  messageIsStreaming: false,
  addonError: null,
  addons: [],
  addonsMap: {},
  folders: [],
  conversations: [],
  selectedConversationIds: [],
  currentMessage: undefined,
  prompts: [],
  temperature: 1,
  showPromptbar: true,
  showChatbar: true,
  currentFolder: undefined,
  messageError: false,
  searchTerm: '',
  isCompareMode: false,
  isIframe: false,
  footerHtmlMessage: '',
  isUserSettingsOpen: false,

  enabledFeatures: new Set([]),

  recentAddonsIds: [],
  isProfileOpen: false,
};
