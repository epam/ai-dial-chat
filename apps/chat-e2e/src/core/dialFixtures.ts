import { DialHomePage } from '../ui/pages';
import {
  Chat,
  ChatBar,
  ChatHeader,
  ChatMessages,
  ConversationSettings,
  ConversationToCompare,
  Conversations,
  EntitySelector,
  MoreInfo,
  PromptBar,
  SendMessage,
} from '../ui/webElements';

import test from '@/src/core/baseFixtures';
import { isApiStorageType } from '@/src/hooks/global-setup';
import { ConversationData } from '@/src/testData';
import {
  ChatApiHelper,
  FileApiHelper,
  IconApiHelper,
} from '@/src/testData/api';
import { ItemApiHelper } from '@/src/testData/api/itemApiHelper';
import { ApiInjector } from '@/src/testData/injector/apiInjector';
import { BrowserStorageInjector } from '@/src/testData/injector/browserStorageInjector';
import { DataInjectorInterface } from '@/src/testData/injector/dataInjectorInterface';
import { PromptData } from '@/src/testData/prompts/promptData';
import { AccountSettings } from '@/src/ui/webElements/accountSettings';
import { Addons } from '@/src/ui/webElements/addons';
import { AddonsDialog } from '@/src/ui/webElements/addonsDialog';
import { AppContainer } from '@/src/ui/webElements/appContainer';
import { Banner } from '@/src/ui/webElements/banner';
import { ChatInfoTooltip } from '@/src/ui/webElements/chatInfoTooltip';
import { ChatLoader } from '@/src/ui/webElements/chatLoader';
import { Compare } from '@/src/ui/webElements/compare';
import { ConfirmationDialog } from '@/src/ui/webElements/confirmationDialog';
import { DropdownCheckboxMenu } from '@/src/ui/webElements/dropdownCheckboxMenu';
import { DropdownMenu } from '@/src/ui/webElements/dropdownMenu';
import { EntitySettings } from '@/src/ui/webElements/entitySettings';
import { ErrorPopup } from '@/src/ui/webElements/errorPopup';
import { Filter } from '@/src/ui/webElements/filter';
import { FolderConversations } from '@/src/ui/webElements/folderConversations';
import { FolderPrompts } from '@/src/ui/webElements/folderPrompts';
import { GroupEntity } from '@/src/ui/webElements/groupEntity';
import { Header } from '@/src/ui/webElements/header';
import { ImportExportLoader } from '@/src/ui/webElements/importExportLoader';
import { ModelSelector } from '@/src/ui/webElements/modelSelector';
import { ModelsDialog } from '@/src/ui/webElements/modelsDialog';
import { Playback } from '@/src/ui/webElements/playback';
import { PlaybackControl } from '@/src/ui/webElements/playbackControl';
import { PromptModalDialog } from '@/src/ui/webElements/promptModalDialog';
import { Prompts } from '@/src/ui/webElements/prompts';
import { RecentEntities } from '@/src/ui/webElements/recentEntities';
import { ReplayAsIs } from '@/src/ui/webElements/replayAsIs';
import { Search } from '@/src/ui/webElements/search';
import { ShareModal } from '@/src/ui/webElements/shareModal';
import { TemperatureSlider } from '@/src/ui/webElements/temperatureSlider';
import { Tooltip } from '@/src/ui/webElements/tooltip';
import { VariableModalDialog } from '@/src/ui/webElements/variableModalDialog';
import { allure } from 'allure-playwright';
import path from 'path';
import * as process from 'process';

export const stateFilePath = (index: number) =>
  path.join(__dirname, `../../auth/desktopUser${index}.json`);

interface ReportAttributes {
  setTestIds: (...testId: string[]) => void;
  setIssueIds: (...issueIds: string[]) => void;
}

const dialTest = test.extend<
  ReportAttributes & {
    beforeTestCleanup: string;
    dialHomePage: DialHomePage;
    appContainer: AppContainer;
    chatBar: ChatBar;
    chatLoader: ChatLoader;
    importExportLoader: ImportExportLoader;
    header: Header;
    accountSettings: AccountSettings;
    accountDropdownMenu: DropdownMenu;
    banner: Banner;
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
    talkToRecentGroupEntities: GroupEntity;
    talkToModelsGroupEntities: GroupEntity;
    talkToAssistantsGroupEntities: GroupEntity;
    talkToApplicationGroupEntities: GroupEntity;
    recentEntities: RecentEntities;
    entitySettings: EntitySettings;
    modelSelector: ModelSelector;
    temperatureSlider: TemperatureSlider;
    addons: Addons;
    addonsDialog: AddonsDialog;
    conversationData: ConversationData;
    promptData: PromptData;
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
    compareConversation: ConversationToCompare;
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
    iconApiHelper: IconApiHelper;
    chatApiHelper: ChatApiHelper;
    fileApiHelper: FileApiHelper;
    itemApiHelper: ItemApiHelper;
    browserStorageInjector: BrowserStorageInjector;
    apiInjector: ApiInjector;
    dataInjector: DataInjectorInterface;
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
        dialTest.skip();
      }
    };
    await use(callback);
  },
  beforeTestCleanup: [
    async ({ dataInjector }, use) => {
      await dataInjector.deleteAllData();
      await use('beforeTestCleanup');
    },
    { scope: 'test', auto: true },
  ],
  // eslint-disable-next-line no-empty-pattern
  storageState: async ({}, use) => {
    await use(stateFilePath(+process.env.TEST_PARALLEL_INDEX!));
  },
  dialHomePage: async ({ page }, use) => {
    const dialHomePage = new DialHomePage(page);
    await use(dialHomePage);
  },
  appContainer: async ({ dialHomePage }, use) => {
    const appContainer = dialHomePage.getAppContainer();
    await use(appContainer);
  },
  chatBar: async ({ appContainer }, use) => {
    const chatBar = appContainer.getChatBar();
    await use(chatBar);
  },
  chatLoader: async ({ appContainer }, use) => {
    const chatLoader = appContainer.getChatLoader();
    await use(chatLoader);
  },
  importExportLoader: async ({ appContainer }, use) => {
    const importExportLoader = appContainer.getImportExportLoader();
    await use(importExportLoader);
  },
  header: async ({ appContainer }, use) => {
    const header = appContainer.getHeader();
    await use(header);
  },
  accountSettings: async ({ header }, use) => {
    const accountSettings = header.getAccountSettings();
    await use(accountSettings);
  },
  accountDropdownMenu: async ({ accountSettings }, use) => {
    const accountDropdownMenu = accountSettings.getDropdownMenu();
    await use(accountDropdownMenu);
  },
  banner: async ({ appContainer }, use) => {
    const banner = appContainer.getBanner();
    await use(banner);
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
  talkToRecentGroupEntities: async ({ recentEntities }, use) => {
    const talkToRecentGroupEntities = recentEntities
      .getTalkToGroup()
      .getGroupEntity();
    await use(talkToRecentGroupEntities);
  },
  talkToModelsGroupEntities: async ({ modelsDialog }, use) => {
    const talkToModelsGroupEntities = modelsDialog
      .getTalkToModels()
      .getGroupEntity();
    await use(talkToModelsGroupEntities);
  },
  talkToAssistantsGroupEntities: async ({ modelsDialog }, use) => {
    const talkToAssistantsGroupEntities = modelsDialog
      .getTalkToAssistants()
      .getGroupEntity();
    await use(talkToAssistantsGroupEntities);
  },
  talkToApplicationGroupEntities: async ({ modelsDialog }, use) => {
    const talkToModelsGroupEntities = modelsDialog
      .getTalkToApplications()
      .getGroupEntity();
    await use(talkToModelsGroupEntities);
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
  chatInfoTooltip: async ({ page }, use) => {
    const chatInfoTooltip = new ChatInfoTooltip(page);
    await use(chatInfoTooltip);
  },
  compare: async ({ chat }, use) => {
    const compare = chat.getCompare();
    await use(compare);
  },
  compareConversation: async ({ compare }, use) => {
    const compareConversation = compare.getConversationToCompare();
    await use(compareConversation);
  },
  compareConversationSelector: async ({ compareConversation }, use) => {
    const compareConversationSelector =
      compareConversation.getConversationSelector();
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
  iconApiHelper: async ({ request }, use) => {
    const iconApiHelper = new IconApiHelper(request);
    await use(iconApiHelper);
  },
  chatApiHelper: async ({ request }, use) => {
    const chatApiHelper = new ChatApiHelper(request);
    await use(chatApiHelper);
  },
  fileApiHelper: async ({ request }, use) => {
    const fileApiHelper = new FileApiHelper(request);
    await use(fileApiHelper);
  },
  itemApiHelper: async ({ request }, use) => {
    const conversationApiHelper = new ItemApiHelper(request);
    await use(conversationApiHelper);
  },
  apiInjector: async ({ itemApiHelper }, use) => {
    const apiInjector = new ApiInjector(itemApiHelper);
    await use(apiInjector);
  },
  browserStorageInjector: async ({ localStorageManager }, use) => {
    const browserStorageInjector = new BrowserStorageInjector(
      localStorageManager,
    );
    await use(browserStorageInjector);
  },
  dataInjector: async ({ apiInjector, browserStorageInjector }, use) => {
    const dataInjector = isApiStorageType
      ? apiInjector
      : browserStorageInjector;
    await use(dataInjector);
  },
});

export default dialTest;
