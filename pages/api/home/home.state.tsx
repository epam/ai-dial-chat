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
  // TODO: get rid of models array to use faster map
  models: OpenAIEntityModel[];
  modelsMap: Record<string, OpenAIEntityModel>;
  addonError: ErrorMessage | null;
  // TODO: get rid of models array to use faster map
  addons: OpenAIEntityAddon[];
  addonsMap: Record<string, OpenAIEntityAddon>;
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
  modelIconMapping: Record<string, string>;
  footerHtmlMessage: string;

  isUserSettingsOpen: boolean;
  enabledFeatures: Set<Feature>;
  isProfileOpen: boolean;
}

export const initialState: HomeInitialState = {
  apiKey: '',
  loading: false,
  lightMode: 'dark',
  messageIsStreaming: false,
  modelError: null,
  models: [],
  modelsMap: {},
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
  defaultModelId: undefined,
  serverSideApiKeyIsSet: false,
  serverSidePluginKeysSet: false,
  usePluginKeys: false,
  isCompareMode: false,
  isIframe: false,
  modelIconMapping: {},
  footerHtmlMessage: '',
  isUserSettingsOpen: false,

  enabledFeatures: new Set([]),
  isProfileOpen: false,
};
