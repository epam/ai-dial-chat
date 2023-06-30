import { Conversation, Message } from '@/types/chat';
import { ErrorMessage } from '@/types/error';
import { Feature } from '@/types/features';
import { FolderInterface } from '@/types/folder';
import { OpenAIModel, OpenAIModelID, fallbackModelID } from '@/types/openai';
import { Prompt } from '@/types/prompt';

export interface HomeInitialState {
  apiKey: string;
  loading: boolean;
  lightMode: 'light' | 'dark';
  messageIsStreaming: boolean;
  modelError: ErrorMessage | null;
  models: OpenAIModel[];
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
  defaultModelId: OpenAIModelID | undefined;
  serverSideApiKeyIsSet: boolean;
  serverSidePluginKeysSet: boolean;
  usePluginKeys: boolean;
  isCompareMode: boolean;
  isIframe: boolean;
  modelIconMapping: Record<string, string>;

  // Footer env variables
  isShowFooter: boolean;
  isShowRequestApiKey: boolean;
  isShowReportAnIssue: boolean;
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

  // Footer env variables
  isShowFooter: false,
  isShowRequestApiKey: false,
  isShowReportAnIssue: false,
  footerHtmlMessage: '',

  enabledFeatures: new Set([]),
};
