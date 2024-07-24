import config from '../../config/chat.playwright.config';
import { DialHomePage } from '../ui/pages';
import {
  AttachFilesModal,
  Chat,
  ChatBar,
  ChatHeader,
  ChatMessages,
  ChatNotFound,
  ConversationSettings,
  ConversationToCompare,
  Conversations,
  EntitySelector,
  Folders,
  MoreInfo,
  PromptBar,
  SelectFolderModal,
  SendMessage,
} from '../ui/webElements';

import { AccountSettingsAssertion } from '@/src/assertions/accountSettingsAssertion';
import { ChatHeaderAssertion } from '@/src/assertions/chatHeaderAssertion';
import { ChatMessagesAssertion } from '@/src/assertions/chatMessagesAssertion';
import { ConfirmationDialogAssertion } from '@/src/assertions/confirmationDialogAssertion';
import { ErrorToastAssertion } from '@/src/assertions/errorToastAssertion';
import { FolderAssertion } from '@/src/assertions/folderAssertion';
import { FooterAssertion } from '@/src/assertions/footerAssertion';
import { MenuAssertion } from '@/src/assertions/menuAssertion';
import { SendMessageAssertion } from '@/src/assertions/sendMessageAssertion';
import { SettingsModalAssertion } from '@/src/assertions/settingsModalAssertion';
import { SideBarAssertion } from '@/src/assertions/sideBarAssertion';
import { SideBarEntityAssertion } from '@/src/assertions/sideBarEntityAssertion';
import { TooltipAssertion } from '@/src/assertions/tooltipAssertion';
import test from '@/src/core/baseFixtures';
import { isApiStorageType } from '@/src/hooks/global-setup';
import { ConversationData } from '@/src/testData';
import {
  ChatApiHelper,
  FileApiHelper,
  IconApiHelper,
  ShareApiHelper,
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
import { ErrorToast } from '@/src/ui/webElements/errorToast';
import { Filter } from '@/src/ui/webElements/filter';
import { FolderConversations } from '@/src/ui/webElements/folderConversations';
import { FolderFiles } from '@/src/ui/webElements/folderFiles';
import { FolderPrompts } from '@/src/ui/webElements/folderPrompts';
import { GroupEntity } from '@/src/ui/webElements/groupEntity';
import { Header } from '@/src/ui/webElements/header';
import { ImportExportLoader } from '@/src/ui/webElements/importExportLoader';
import { InputAttachments } from '@/src/ui/webElements/inputAttachments';
import { ModelSelector } from '@/src/ui/webElements/modelSelector';
import { ModelsDialog } from '@/src/ui/webElements/modelsDialog';
import { PlaybackControl } from '@/src/ui/webElements/playbackControl';
import { PromptModalDialog } from '@/src/ui/webElements/promptModalDialog';
import { Prompts } from '@/src/ui/webElements/prompts';
import { RecentEntities } from '@/src/ui/webElements/recentEntities';
import { ReplayAsIs } from '@/src/ui/webElements/replayAsIs';
import { Search } from '@/src/ui/webElements/search';
import { SettingsModal } from '@/src/ui/webElements/settingsModal';
import { ShareModal } from '@/src/ui/webElements/shareModal';
import { TemperatureSlider } from '@/src/ui/webElements/temperatureSlider';
import { Tooltip } from '@/src/ui/webElements/tooltip';
import { UploadFromDeviceModal } from '@/src/ui/webElements/uploadFromDeviceModal';
import { VariableModalDialog } from '@/src/ui/webElements/variableModalDialog';
import { allure } from 'allure-playwright';
import path from 'path';
import { APIRequestContext } from 'playwright-core';
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
    editMessageInputAttachments: InputAttachments;
    sendMessage: SendMessage;
    attachmentDropdownMenu: DropdownMenu;
    sendMessageInputAttachments: InputAttachments;
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
    isolatedView: MoreInfo;
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
    errorToast: ErrorToast;
    additionalShareUserRequestContext: APIRequestContext;
    additionalSecondShareUserRequestContext: APIRequestContext;
    mainUserShareApiHelper: ShareApiHelper;
    additionalUserShareApiHelper: ShareApiHelper;
    additionalUserItemApiHelper: ItemApiHelper;
    additionalSecondUserShareApiHelper: ShareApiHelper;
    additionalSecondUserItemApiHelper: ItemApiHelper;
    chatNotFound: ChatNotFound;
    attachFilesModal: AttachFilesModal;
    uploadFromDeviceModal: UploadFromDeviceModal;
    selectFolderModal: SelectFolderModal;
    selectUploadFolder: Folders;
    attachedAllFiles: FolderFiles;
    settingsModal: SettingsModal;
    conversationAssertion: SideBarEntityAssertion;
    chatBarFolderAssertion: FolderAssertion;
    errorToastAssertion: ErrorToastAssertion;
    tooltipAssertion: TooltipAssertion;
    confirmationDialogAssertion: ConfirmationDialogAssertion;
    chatBarAssertion: SideBarAssertion;
    promptBarFolderAssertion: FolderAssertion;
    promptAssertion: SideBarEntityAssertion;
    promptBarAssertion: SideBarAssertion;
    accountSettingsAssertion: AccountSettingsAssertion;
    accountDropdownMenuAssertion: MenuAssertion;
    settingsModalAssertion: SettingsModalAssertion;
    sendMessageAssertion: SendMessageAssertion;
    chatHeaderAssertion: ChatHeaderAssertion;
    chatMessagesAssertion: ChatMessagesAssertion;
    footerAssertion: FooterAssertion;
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
    async ({ dataInjector, fileApiHelper }, use) => {
      await dataInjector.deleteAllData();
      await fileApiHelper.deleteAllFiles();
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
  editMessageInputAttachments: async ({ chatMessages }, use) => {
    const editMessageInputAttachments = chatMessages.getInputAttachments();
    await use(editMessageInputAttachments);
  },
  sendMessage: async ({ chat }, use) => {
    const sendMessage = chat.getSendMessage();
    await use(sendMessage);
  },
  attachmentDropdownMenu: async ({ sendMessage }, use) => {
    const attachmentDropdownMenu = sendMessage.getDropdownMenu();
    await use(attachmentDropdownMenu);
  },
  sendMessageInputAttachments: async ({ sendMessage }, use) => {
    const sendMessageInputAttachments = sendMessage.getInputAttachments();
    await use(sendMessageInputAttachments);
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
    const talkToModelsGroupEntities = modelsDialog.getTalkToModelEntities();
    await use(talkToModelsGroupEntities);
  },
  talkToAssistantsGroupEntities: async ({ modelsDialog }, use) => {
    const talkToAssistantsGroupEntities =
      modelsDialog.getTalkToAssistantEntities();
    await use(talkToAssistantsGroupEntities);
  },
  talkToApplicationGroupEntities: async ({ modelsDialog }, use) => {
    const talkToModelsGroupEntities =
      modelsDialog.getTalkToApplicationEntities();
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
  isolatedView: async ({ chat }, use) => {
    const isolatedView = chat.getIsolatedView();
    await use(isolatedView);
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
  errorToast: async ({ appContainer }, use) => {
    const errorToast = appContainer.getErrorToast();
    await use(errorToast);
  },
  mainUserShareApiHelper: async ({ request }, use) => {
    const mainUserShareApiHelper = new ShareApiHelper(request);
    await use(mainUserShareApiHelper);
  },
  additionalShareUserRequestContext: async ({ playwright }, use) => {
    const additionalShareUserRequestContext =
      await playwright.request.newContext({
        storageState: stateFilePath(+config.workers!),
      });
    await use(additionalShareUserRequestContext);
  },
  additionalSecondShareUserRequestContext: async ({ playwright }, use) => {
    const additionalSecondShareUserRequestContext =
      await playwright.request.newContext({
        storageState: stateFilePath(+config.workers! + 1),
      });
    await use(additionalSecondShareUserRequestContext);
  },
  additionalUserShareApiHelper: async (
    { additionalShareUserRequestContext },
    use,
  ) => {
    const additionalUserShareApiHelper = new ShareApiHelper(
      additionalShareUserRequestContext,
    );
    await use(additionalUserShareApiHelper);
  },
  additionalSecondUserShareApiHelper: async (
    { additionalSecondShareUserRequestContext },
    use,
  ) => {
    const additionalSecondUserShareApiHelper = new ShareApiHelper(
      additionalSecondShareUserRequestContext,
    );
    await use(additionalSecondUserShareApiHelper);
  },
  additionalUserItemApiHelper: async (
    { additionalShareUserRequestContext },
    use,
  ) => {
    const additionalUserItemApiHelper = new ItemApiHelper(
      additionalShareUserRequestContext,
    );
    await use(additionalUserItemApiHelper);
  },
  chatNotFound: async ({ page }, use) => {
    const chatNotFound = new ChatNotFound(page);
    await use(chatNotFound);
  },
  additionalSecondUserItemApiHelper: async (
    { additionalSecondShareUserRequestContext },
    use,
  ) => {
    const additionalSecondUserItemApiHelper = new ItemApiHelper(
      additionalSecondShareUserRequestContext,
    );
    await use(additionalSecondUserItemApiHelper);
  },
  attachFilesModal: async ({ page }, use) => {
    const attachFilesModal = new AttachFilesModal(page);
    await use(attachFilesModal);
  },
  uploadFromDeviceModal: async ({ page }, use) => {
    const uploadFromDeviceModal = new UploadFromDeviceModal(page);
    await use(uploadFromDeviceModal);
  },
  selectFolderModal: async ({ page }, use) => {
    const selectFolderModal = new SelectFolderModal(page);
    await use(selectFolderModal);
  },
  selectUploadFolder: async ({ selectFolderModal }, use) => {
    const selectUploadFolder = selectFolderModal.getUploadFolder();
    await use(selectUploadFolder);
  },
  attachedAllFiles: async ({ attachFilesModal }, use) => {
    const attachedAllFiles = attachFilesModal.getFolderFiles();
    await use(attachedAllFiles);
  },
  settingsModal: async ({ page }, use) => {
    const settingsModal = new SettingsModal(page);
    await use(settingsModal);
  },
  conversationAssertion: async ({ conversations }, use) => {
    const chatBarAssertion = new SideBarEntityAssertion(conversations);
    await use(chatBarAssertion);
  },
  chatBarFolderAssertion: async ({ folderConversations }, use) => {
    const chatBarFolderAssertion = new FolderAssertion(folderConversations);
    await use(chatBarFolderAssertion);
  },
  errorToastAssertion: async ({ errorToast }, use) => {
    const promptErrorToastAssertion = new ErrorToastAssertion(errorToast);
    await use(promptErrorToastAssertion);
  },
  tooltipAssertion: async ({ tooltip }, use) => {
    const tooltipAssertion = new TooltipAssertion(tooltip);
    await use(tooltipAssertion);
  },
  confirmationDialogAssertion: async ({ confirmationDialog }, use) => {
    const confirmationDialogAssertion = new ConfirmationDialogAssertion(
      confirmationDialog,
    );
    await use(confirmationDialogAssertion);
  },
  chatBarAssertion: async ({ chatBar }, use) => {
    const chatBarAssertion = new SideBarAssertion(chatBar);
    await use(chatBarAssertion);
  },
  promptBarFolderAssertion: async ({ folderPrompts }, use) => {
    const promptBarFolderAssertion = new FolderAssertion(folderPrompts);
    await use(promptBarFolderAssertion);
  },
  promptAssertion: async ({ prompts }, use) => {
    const promptAssertion = new SideBarEntityAssertion(prompts);
    await use(promptAssertion);
  },
  promptBarAssertion: async ({ promptBar }, use) => {
    const promptBarAssertion = new SideBarAssertion(promptBar);
    await use(promptBarAssertion);
  },
  accountSettingsAssertion: async ({ accountSettings }, use) => {
    const accountSettingsAssertion = new AccountSettingsAssertion(
      accountSettings,
    );
    await use(accountSettingsAssertion);
  },
  accountDropdownMenuAssertion: async ({ accountDropdownMenu }, use) => {
    const accountDropdownMenuAssertion = new MenuAssertion(accountDropdownMenu);
    await use(accountDropdownMenuAssertion);
  },
  settingsModalAssertion: async ({ settingsModal }, use) => {
    const settingsModalAssertion = new SettingsModalAssertion(settingsModal);
    await use(settingsModalAssertion);
  },
  sendMessageAssertion: async ({ sendMessage }, use) => {
    const sendMessageAssertion = new SendMessageAssertion(sendMessage);
    await use(sendMessageAssertion);
  },
  chatHeaderAssertion: async ({ chatHeader }, use) => {
    const chatHeaderAssertion = new ChatHeaderAssertion(chatHeader);
    await use(chatHeaderAssertion);
  },
  chatMessagesAssertion: async ({ chatMessages }, use) => {
    const chatMessagesAssertion = new ChatMessagesAssertion(chatMessages);
    await use(chatMessagesAssertion);
  },
  footerAssertion: async ({ chat }, use) => {
    const footerAssertion = new FooterAssertion(chat.getFooter());
    await use(footerAssertion);
  },
});

export default dialTest;
