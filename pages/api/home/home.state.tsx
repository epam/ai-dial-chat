import { Conversation, Message } from '@/types/chat';
import { ErrorMessage } from '@/types/error';
import { Feature } from '@/types/features';
import { FolderInterface } from '@/types/folder';
import {
  OpenAIEntityAddon,
  OpenAIEntityModel,
  OpenAIEntityModelID,
} from '@/types/openai';
import { Prompt } from '@/types/prompt';

export interface HomeInitialState {
  apiKey: string;
  loading: boolean;
  lightMode: 'light' | 'dark';
  messageIsStreaming: boolean;
  modelError: ErrorMessage | null;
  models: OpenAIEntityModel[];
  addonError: ErrorMessage | null;
  addons: OpenAIEntityAddon[];
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
  defaultModelId: OpenAIEntityModelID | undefined;
  serverSideApiKeyIsSet: boolean;
  serverSidePluginKeysSet: boolean;
  usePluginKeys: boolean;
  isCompareMode: boolean;
  isIframe: boolean;
  footerHtmlMessage: string;

  enabledFeatures: Set<Feature>;
}

export const initialState: HomeInitialState = {
  apiKey: '',
  loading: false,
  lightMode: 'dark',
  messageIsStreaming: false,
  modelError: null,
  models: [],
  addonError: null,
  addons: [],
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
  defaultModelId: undefined,
  serverSideApiKeyIsSet: false,
  serverSidePluginKeysSet: false,
  usePluginKeys: false,
  isCompareMode: false,
  isIframe: false,
  footerHtmlMessage: '',

  enabledFeatures: new Set([]),
};
