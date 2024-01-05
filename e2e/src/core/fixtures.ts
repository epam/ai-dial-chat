import { Auth0Page } from '@/e2e/src/ui/pages/auth0Page';

import { DialHomePage } from '../ui/pages';
import { LoginPage } from '../ui/pages';
import {
  Chat,
  ChatHeader,
  ChatMessages,
  ConversationSettings,
  Conversations,
  EntitySelector,
  ModelsDialog,
  MoreInfo,
  RecentEntities,
  SendMessage,
} from '../ui/webElements';
import { ChatBar } from '../ui/webElements';
import { PromptBar } from '../ui/webElements';
import { LocalStorageManager } from './localStorageManager';

import { ConversationData } from '@/e2e/src/testData';
import { ApiHelper } from '@/e2e/src/testData/api/apiHelper';
import { PromptData } from '@/e2e/src/testData/prompts/promptData';
import { Addons } from '@/e2e/src/ui/webElements/addons';
import { AddonsDialog } from '@/e2e/src/ui/webElements/addonsDialog';
import { AppContainer } from '@/e2e/src/ui/webElements/appContainer';
import { ChatInfoTooltip } from '@/e2e/src/ui/webElements/chatInfoTooltip';
import { Compare } from '@/e2e/src/ui/webElements/compare';
import { ConfirmationDialog } from '@/e2e/src/ui/webElements/confirmationDialog';
import { DropdownCheckboxMenu } from '@/e2e/src/ui/webElements/dropdownCheckboxMenu';
import { DropdownMenu } from '@/e2e/src/ui/webElements/dropdownMenu';
import { EntitySettings } from '@/e2e/src/ui/webElements/entitySettings';
import { ErrorPopup } from '@/e2e/src/ui/webElements/errorPopup';
import { Filter } from '@/e2e/src/ui/webElements/filter';
import { FolderConversations } from '@/e2e/src/ui/webElements/folderConversations';
import { FolderPrompts } from '@/e2e/src/ui/webElements/folderPrompts';
import { Header } from '@/e2e/src/ui/webElements/header';
import { ModelSelector } from '@/e2e/src/ui/webElements/modelSelector';
import { Playback } from '@/e2e/src/ui/webElements/playback';
import { PlaybackControl } from '@/e2e/src/ui/webElements/playbackControl';
import { PromptModalDialog } from '@/e2e/src/ui/webElements/promptModalDialog';
import { Prompts } from '@/e2e/src/ui/webElements/prompts';
import { ReplayAsIs } from '@/e2e/src/ui/webElements/replayAsIs';
import { Search } from '@/e2e/src/ui/webElements/search';
import { ShareModal } from '@/e2e/src/ui/webElements/shareModal';
import { TemperatureSlider } from '@/e2e/src/ui/webElements/temperatureSlider';
import { Tooltip } from '@/e2e/src/ui/webElements/tooltip';
import { VariableModalDialog } from '@/e2e/src/ui/webElements/variableModalDialog';
import { test as base } from '@playwright/test';
import { allure } from 'allure-playwright';

interface ReportAttributes {
  setTestIds: (...testId: string[]) => void;
  setIssueIds: (...issueIds: string[]) => void;
}

const test = base.extend<
  ReportAttributes & {
    dialHomePage: DialHomePage;
    loginPage: LoginPage;
    auth0Page: Auth0Page;
    appContainer: AppContainer;
    chatBar: ChatBar;
    header: Header;
    promptBar: PromptBar;
    chat: Chat;
    chatMessages: ChatMessages;
    sendMessage: SendMessage;
    conversations: Conversations;
    prompts: Prompts;
    folderConversations: FolderConversations;
    folderPrompts: FolderPrompts;
    conversationSettings: ConversationSettings;
    talkToSelector: EntitySelector;
    recentEntities: RecentEntities;
    entitySettings: EntitySettings;
    modelSelector: ModelSelector;
    temperatureSlider: TemperatureSlider;
    addons: Addons;
    addonsDialog: AddonsDialog;
    conversationData: ConversationData;
    promptData: PromptData;
    localStorageManager: LocalStorageManager;
    conversationDropdownMenu: DropdownMenu;
    folderDropdownMenu: DropdownMenu;
    promptDropdownMenu: DropdownMenu;
    confirmationDialog: ConfirmationDialog;
    promptModalDialog: PromptModalDialog;
    variableModalDialog: VariableModalDialog;
    modelsDialog: ModelsDialog;
    chatHeader: ChatHeader;
    moreInfo: MoreInfo;
    chatInfoTooltip: ChatInfoTooltip;
    compare: Compare;
    compareConversationSelector: ModelSelector;
    rightConversationSettings: ConversationSettings;
    leftConversationSettings: ConversationSettings;
    rightChatHeader: ChatHeader;
    leftChatHeader: ChatHeader;
    tooltip: Tooltip;
    errorPopup: ErrorPopup;
    replayAsIs: ReplayAsIs;
    playback: Playback;
    playbackControl: PlaybackControl;
    shareModal: ShareModal;
    chatBarSearch: Search;
    promptBarSearch: Search;
    chatFilter: Filter;
    promptFilter: Filter;
    chatFilterDropdownMenu: DropdownCheckboxMenu;
    promptFilterDropdownMenu: DropdownCheckboxMenu;
    apiHelper: ApiHelper;
  }
>({
  // eslint-disable-next-line no-empty-pattern
  setTestIds: async ({}, use) => {
    const callback = (...testIds: string[]) => {
      for (const testId of testIds) {
        allure.tms(testId, `${process.env.TMS_URL}/${testId}`);
      }
    };
    await use(callback);
  },
  // eslint-disable-next-line no-empty-pattern
  setIssueIds: async ({}, use) => {
    const callback = (...issueIds: string[]) => {
      for (const issueId of issueIds) {
        allure.issue(issueId, `${process.env.ISSUE_URL}/${issueId}`);
        test.skip();
      }
    };
    await use(callback);
  },
  dialHomePage: async ({ page }, use) => {
    const dialHomePage = new DialHomePage(page);
    await use(dialHomePage);
  },
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },
  auth0Page: async ({ page }, use) => {
    const auth0Page = new Auth0Page(page);
    await use(auth0Page);
  },
  appContainer: async ({ dialHomePage }, use) => {
    const appContainer = dialHomePage.getAppContainer();
    await use(appContainer);
  },
  chatBar: async ({ appContainer }, use) => {
    const chatBar = appContainer.getChatBar();
    await use(chatBar);
  },
  header: async ({ appContainer }, use) => {
    const header = appContainer.getHeader();
    await use(header);
  },
  promptBar: async ({ appContainer }, use) => {
    const promptBar = appContainer.getPromptBar();
    await use(promptBar);
  },
  promptBarSearch: async ({ promptBar }, use) => {
    const promptBarSearch = promptBar.getSearch();
    await use(promptBarSearch);
  },
  chat: async ({ appContainer }, use) => {
    const chat = appContainer.getChat();
    await use(chat);
  },
  chatMessages: async ({ chat }, use) => {
    const chatMessages = chat.getChatMessages();
    await use(chatMessages);
  },
  sendMessage: async ({ chat }, use) => {
    const sendMessage = chat.getSendMessage();
    await use(sendMessage);
  },
  conversations: async ({ chatBar }, use) => {
    const conversations = chatBar.getConversations();
    await use(conversations);
  },
  prompts: async ({ promptBar }, use) => {
    const prompts = promptBar.getPrompts();
    await use(prompts);
  },
  folderConversations: async ({ chatBar }, use) => {
    const folderConversations = chatBar.getFolderConversations();
    await use(folderConversations);
  },
  chatBarSearch: async ({ chatBar }, use) => {
    const chatBarSearch = chatBar.getSearch();
    await use(chatBarSearch);
  },
  chatFilter: async ({ chatBarSearch }, use) => {
    const chatFilter = chatBarSearch.getFilter();
    await use(chatFilter);
  },
  promptFilter: async ({ promptBarSearch }, use) => {
    const promptFilter = promptBarSearch.getFilter();
    await use(promptFilter);
  },
  chatFilterDropdownMenu: async ({ chatFilter }, use) => {
    const chatFilterDropdownMenu = chatFilter.getFilterDropdownMenu();
    await use(chatFilterDropdownMenu);
  },
  promptFilterDropdownMenu: async ({ promptFilter }, use) => {
    const promptFilterDropdownMenu = promptFilter.getFilterDropdownMenu();
    await use(promptFilterDropdownMenu);
  },
  folderPrompts: async ({ promptBar }, use) => {
    const folderPrompts = promptBar.getFolderPrompts();
    await use(folderPrompts);
  },
  conversationSettings: async ({ chat }, use) => {
    const conversationSettings = chat.getConversationSettings();
    await use(conversationSettings);
  },
  talkToSelector: async ({ conversationSettings }, use) => {
    const talkToSelector = conversationSettings.getTalkToSelector();
    await use(talkToSelector);
  },
  recentEntities: async ({ talkToSelector }, use) => {
    const recentEntities = talkToSelector.getRecentEntities();
    await use(recentEntities);
  },
  entitySettings: async ({ conversationSettings }, use) => {
    const entitySettings = conversationSettings.getEntitySettings();
    await use(entitySettings);
  },
  temperatureSlider: async ({ entitySettings }, use) => {
    const temperatureSlider = entitySettings.getTemperatureSlider();
    await use(temperatureSlider);
  },
  addons: async ({ entitySettings }, use) => {
    const addons = entitySettings.getAddons();
    await use(addons);
  },
  addonsDialog: async ({ addons }, use) => {
    const addonsDialog = addons.getAddonsDialog();
    await use(addonsDialog);
  },
  modelSelector: async ({ entitySettings }, use) => {
    const modelSelector = entitySettings.getModelSelector();
    await use(modelSelector);
  },
  conversationDropdownMenu: async ({ conversations }, use) => {
    const conversationDropdownMenu = conversations.getDropdownMenu();
    await use(conversationDropdownMenu);
  },
  folderDropdownMenu: async ({ folderConversations }, use) => {
    const folderDropdownMenu = folderConversations.getDropdownMenu();
    await use(folderDropdownMenu);
  },
  promptDropdownMenu: async ({ prompts }, use) => {
    const promptDropdownMenu = prompts.getDropdownMenu();
    await use(promptDropdownMenu);
  },
  confirmationDialog: async ({ page }, use) => {
    const confirmationDialog = new ConfirmationDialog(page);
    await use(confirmationDialog);
  },
  promptModalDialog: async ({ page }, use) => {
    const promptModalDialog = new PromptModalDialog(page);
    await use(promptModalDialog);
  },
  variableModalDialog: async ({ page }, use) => {
    const variableModalDialog = new VariableModalDialog(page);
    await use(variableModalDialog);
  },
  modelsDialog: async ({ page }, use) => {
    const modelsDialog = new ModelsDialog(page);
    await use(modelsDialog);
  },
  moreInfo: async ({ entitySettings }, use) => {
    const moreInfo = entitySettings.getMoreInfo();
    await use(moreInfo);
  },
  chatHeader: async ({ chat }, use) => {
    const chatHeader = chat.getChatHeader();
    await use(chatHeader);
  },
  // eslint-disable-next-line no-empty-pattern
  conversationData: async ({}, use) => {
    const conversationData = new ConversationData();
    await use(conversationData);
  },
  // eslint-disable-next-line no-empty-pattern
  promptData: async ({}, use) => {
    const promptData = new PromptData();
    await use(promptData);
  },
  localStorageManager: async ({ page }, use) => {
    const localStorageManager = new LocalStorageManager(page);
    await use(localStorageManager);
  },
  chatInfoTooltip: async ({ page }, use) => {
    const chatInfoTooltip = new ChatInfoTooltip(page);
    await use(chatInfoTooltip);
  },
  compare: async ({ chat }, use) => {
    const compare = chat.getCompare();
    await use(compare);
  },
  compareConversationSelector: async ({ compare }, use) => {
    const compareConversationSelector = compare
      .getConversationToCompare()
      .getConversationSelector();
    await use(compareConversationSelector);
  },
  rightConversationSettings: async ({ compare }, use) => {
    const rightConversationSettings = compare.getRightConversationSettings();
    await use(rightConversationSettings);
  },
  leftConversationSettings: async ({ compare }, use) => {
    const leftConversationSettings = compare.getLeftConversationSettings();
    await use(leftConversationSettings);
  },
  rightChatHeader: async ({ compare }, use) => {
    const rightChatHeader = compare.getRightChatHeader();
    await use(rightChatHeader);
  },
  leftChatHeader: async ({ compare }, use) => {
    const leftChatHeader = compare.getLeftChatHeader();
    await use(leftChatHeader);
  },
  tooltip: async ({ page }, use) => {
    const tooltip = new Tooltip(page);
    await use(tooltip);
  },
  errorPopup: async ({ page }, use) => {
    const errorPopup = new ErrorPopup(page);
    await use(errorPopup);
  },
  replayAsIs: async ({ page }, use) => {
    const replayAsIs = new ReplayAsIs(page);
    await use(replayAsIs);
  },
  playback: async ({ chat }, use) => {
    const playback = chat.getPlayBack();
    await use(playback);
  },
  playbackControl: async ({ chat }, use) => {
    const playbackControl = chat.getPlaybackControl();
    await use(playbackControl);
  },
  shareModal: async ({ page }, use) => {
    const shareModal = new ShareModal(page);
    await use(shareModal);
  },
  apiHelper: async ({ request }, use) => {
    const apiHelper = new ApiHelper(request);
    await use(apiHelper);
  },
});

export default test;
