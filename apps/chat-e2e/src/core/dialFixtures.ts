import config from '../../config/chat.playwright.config';
import { DialHomePage, MarketplacePage } from '../ui/pages';
import {
  AgentInfo,
  AttachFilesModal,
  Chat,
  ChatBar,
  ChatHeader,
  ChatMessages,
  ChatNotFound,
  ConversationSettingsModal,
  ConversationToCompare,
  MessageTemplateModal,
  PromptBar,
  PublishingRules,
  SelectFolderModal,
  SendMessage,
} from '../ui/webElements';
import { ChatSettingsTooltip } from '../ui/webElements/chatSettingsTooltip';

import {
  AccountSettingsAssertion,
  AgentInfoAssertion,
  AgentSettingAssertion,
  ApiAssertion,
  ChatAssertion,
  ChatHeaderAssertion,
  ChatMessagesAssertion,
  ConfirmationDialogAssertion,
  ConversationAssertion,
  ConversationInfoTooltipAssertion,
  ConversationToCompareAssertion,
  DownloadAssertion,
  ErrorToastAssertion,
  FolderAssertion,
  FooterAssertion,
  MarketplaceAgentsAssertion,
  MenuAssertion,
  PlaybackAssertion,
  PromptAssertion,
  PromptListAssertion,
  PromptModalAssertion,
  PublishFolderAssertion,
  PublishingRequestModalAssertion,
  SendMessageAssertion,
  ShareApiAssertion,
  ShareModalAssertion,
  SideBarAssertion,
  TalkToAgentDialogAssertion,
  TooltipAssertion,
  VariableModalAssertion,
} from '@/src/assertions';
import { AddonsDialogAssertion } from '@/src/assertions/addonsDialogAssertion';
import { ConversationToPublishAssertion } from '@/src/assertions/conversationToPublishAssertion';
import { ManageAttachmentsAssertion } from '@/src/assertions/manageAttachmentsAssertion';
import { MessageTemplateModalAssertion } from '@/src/assertions/messageTemplateModalAssertion';
import { PromptToPublishAssertion } from '@/src/assertions/promptToPublishAssertion';
import { RenameConversationModalAssertion } from '@/src/assertions/renameConversationModalAssertion';
import { SelectFolderModalAssertion } from '@/src/assertions/selectFolderModalAssertion';
import { SettingsModalAssertion } from '@/src/assertions/settingsModalAssertion';
import { SideBarEntityAssertion } from '@/src/assertions/sideBarEntityAssertion';
import test from '@/src/core/baseFixtures';
import { isApiStorageType } from '@/src/hooks/global-setup';
import { ConversationData, PublishRequestBuilder } from '@/src/testData';
import {
  ChatApiHelper,
  FileApiHelper,
  IconApiHelper,
  ShareApiHelper,
} from '@/src/testData/api';
import { ItemApiHelper } from '@/src/testData/api/itemApiHelper';
import { PublicationApiHelper } from '@/src/testData/api/publicationApiHelper';
import { ApiInjector } from '@/src/testData/injector/apiInjector';
import { BrowserStorageInjector } from '@/src/testData/injector/browserStorageInjector';
import { DataInjectorInterface } from '@/src/testData/injector/dataInjectorInterface';
import { PromptData } from '@/src/testData/prompts/promptData';
import { AccountSettings } from '@/src/ui/webElements/accountSettings';
import { Addons } from '@/src/ui/webElements/addons';
import { AddonsDialog } from '@/src/ui/webElements/addonsDialog';
import { AgentSettings } from '@/src/ui/webElements/agentSettings';
import { AppContainer } from '@/src/ui/webElements/appContainer';
import { Banner } from '@/src/ui/webElements/banner';
import { ChatLoader } from '@/src/ui/webElements/chatLoader';
import { Compare } from '@/src/ui/webElements/compare';
import { ConfirmationDialog } from '@/src/ui/webElements/confirmationDialog';
import { DropdownCheckboxMenu } from '@/src/ui/webElements/dropdownCheckboxMenu';
import { DropdownMenu } from '@/src/ui/webElements/dropdownMenu';
import {
  ConversationsToPublishTree,
  ConversationsTree,
  FolderConversations,
  FolderConversationsToPublish,
  FolderPrompts,
  Folders,
  OrganizationConversationsTree,
  PromptsToPublishTree,
  PromptsTree,
  PublishFolder,
} from '@/src/ui/webElements/entityTree';
import { OrganizationPromptsTree } from '@/src/ui/webElements/entityTree/sidebar/organizationPromptsTree';
import { ErrorPopup } from '@/src/ui/webElements/errorPopup';
import { ErrorToast } from '@/src/ui/webElements/errorToast';
import { Filter } from '@/src/ui/webElements/filter';
import { Header } from '@/src/ui/webElements/header';
import { ImportExportLoader } from '@/src/ui/webElements/importExportLoader';
import { InputAttachments } from '@/src/ui/webElements/inputAttachments';
import { Marketplace } from '@/src/ui/webElements/marketplace/marketplace';
import { MarketplaceAgents } from '@/src/ui/webElements/marketplace/marketplaceAgents';
import { MarketplaceContainer } from '@/src/ui/webElements/marketplace/marketplaceContainer';
import { MarketplaceFilter } from '@/src/ui/webElements/marketplace/marketplaceFilter';
import { MarketplaceHeader } from '@/src/ui/webElements/marketplace/marketplaceHeader';
import { MarketplaceSidebar } from '@/src/ui/webElements/marketplace/marketplaceSidebar';
import { ModelInfoTooltip } from '@/src/ui/webElements/modelInfoTooltip';
import { PlaybackControl } from '@/src/ui/webElements/playbackControl';
import { PromptModalDialog } from '@/src/ui/webElements/promptModalDialog';
import { PublishingRequestModal } from '@/src/ui/webElements/publishingRequestModal';
import { RenameConversationModal } from '@/src/ui/webElements/renameConversationModal';
import { Search } from '@/src/ui/webElements/search';
import { SettingsModal } from '@/src/ui/webElements/settingsModal';
import { ShareModal } from '@/src/ui/webElements/shareModal';
import { TalkToAgentDialog } from '@/src/ui/webElements/talkToAgentDialog';
import { TemperatureSlider } from '@/src/ui/webElements/temperatureSlider';
import { Tooltip } from '@/src/ui/webElements/tooltip';
import { UploadFromDeviceModal } from '@/src/ui/webElements/uploadFromDeviceModal';
import { VariableModalDialog } from '@/src/ui/webElements/variableModalDialog';
import { BucketUtil } from '@/src/utils';
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
    marketplacePage: MarketplacePage;
    appContainer: AppContainer;
    marketplaceContainer: MarketplaceContainer;
    marketplaceSidebar: MarketplaceSidebar;
    marketplaceFilter: MarketplaceFilter;
    marketplace: Marketplace;
    marketplaceAgents: MarketplaceAgents;
    marketplaceHeader: MarketplaceHeader;
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
    conversations: ConversationsTree;
    prompts: PromptsTree;
    folderConversations: FolderConversations;
    folderPrompts: FolderPrompts;
    organizationFolderPrompts: FolderPrompts;
    organizationConversations: OrganizationConversationsTree;
    organizationPrompts: OrganizationPromptsTree;
    organizationFolderConversations: Folders;
    conversationSettingsModal: ConversationSettingsModal;
    talkToAgentDialog: TalkToAgentDialog;
    talkToAgents: MarketplaceAgents;
    agentSettings: AgentSettings;
    temperatureSlider: TemperatureSlider;
    addons: Addons;
    addonsDialog: AddonsDialog;
    agentInfo: AgentInfo;
    conversationData: ConversationData;
    promptData: PromptData;
    conversationDropdownMenu: DropdownMenu;
    folderDropdownMenu: DropdownMenu;
    promptDropdownMenu: DropdownMenu;
    confirmationDialog: ConfirmationDialog;
    promptModalDialog: PromptModalDialog;
    renameConversationModal: RenameConversationModal;
    renameConversationModalAssertion: RenameConversationModalAssertion;
    variableModalDialog: VariableModalDialog;
    chatHeader: ChatHeader;
    modelInfoTooltip: ModelInfoTooltip;
    chatSettingsTooltip: ChatSettingsTooltip;
    compare: Compare;
    compareConversation: ConversationToCompare;
    rightChatHeader: ChatHeader;
    leftChatHeader: ChatHeader;
    tooltip: Tooltip;
    errorPopup: ErrorPopup;
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
    additionalSecondShareUserFileApiHelper: FileApiHelper;
    itemApiHelper: ItemApiHelper;
    browserStorageInjector: BrowserStorageInjector;
    apiInjector: ApiInjector;
    dataInjector: DataInjectorInterface;
    errorToast: ErrorToast;
    additionalShareUserRequestContext: APIRequestContext;
    additionalSecondShareUserRequestContext: APIRequestContext;
    adminUserRequestContext: APIRequestContext;
    adminUserItemApiHelper: ItemApiHelper;
    mainUserShareApiHelper: ShareApiHelper;
    additionalUserShareApiHelper: ShareApiHelper;
    additionalUserItemApiHelper: ItemApiHelper;
    additionalSecondUserShareApiHelper: ShareApiHelper;
    additionalSecondUserItemApiHelper: ItemApiHelper;
    chatNotFound: ChatNotFound;
    attachFilesModal: AttachFilesModal;
    uploadFromDeviceModal: UploadFromDeviceModal;
    selectFolderModal: SelectFolderModal;
    selectFolders: Folders;
    attachedAllFiles: Folders;
    messageTemplateModal: MessageTemplateModal;
    manageAttachmentsAssertion: ManageAttachmentsAssertion;
    settingsModal: SettingsModal;
    publishingRequestModal: PublishingRequestModal;
    conversationsToPublishTree: ConversationsToPublishTree;
    promptsToPublishTree: PromptsToPublishTree;
    folderConversationsToPublish: FolderConversationsToPublish;
    publicationApiHelper: PublicationApiHelper;
    adminPublicationApiHelper: PublicationApiHelper;
    publishRequestBuilder: PublishRequestBuilder;
    publishingRules: PublishingRules;
    conversationAssertion: ConversationAssertion;
    chatBarFolderAssertion: FolderAssertion<FolderConversations>;
    organizationConversationAssertion: SideBarEntityAssertion<OrganizationConversationsTree>;
    organizationPromptAssertion: SideBarEntityAssertion<OrganizationPromptsTree>;
    errorToastAssertion: ErrorToastAssertion;
    downloadAssertion: DownloadAssertion;
    promptModalAssertion: PromptModalAssertion;
    tooltipAssertion: TooltipAssertion;
    confirmationDialogAssertion: ConfirmationDialogAssertion;
    chatBarAssertion: SideBarAssertion;
    promptBarFolderAssertion: FolderAssertion<FolderPrompts>;
    promptBarOrganizationFolderAssertion: FolderAssertion<FolderPrompts>;
    promptAssertion: PromptAssertion;
    promptBarAssertion: SideBarAssertion;
    accountSettingsAssertion: AccountSettingsAssertion;
    accountDropdownMenuAssertion: MenuAssertion;
    conversationDropdownMenuAssertion: MenuAssertion;
    folderDropdownMenuAssertion: MenuAssertion;
    settingsModalAssertion: SettingsModalAssertion;
    sendMessageAssertion: SendMessageAssertion;
    chatHeaderAssertion: ChatHeaderAssertion<ChatHeader>;
    rightChatHeaderAssertion: ChatHeaderAssertion<ChatHeader>;
    leftChatHeaderAssertion: ChatHeaderAssertion<ChatHeader>;
    chatMessagesAssertion: ChatMessagesAssertion;
    footerAssertion: FooterAssertion;
    sendMessagePromptListAssertion: PromptListAssertion;
    systemPromptListAssertion: PromptListAssertion;
    variableModalAssertion: VariableModalAssertion;
    apiAssertion: ApiAssertion;
    chatAssertion: ChatAssertion;
    agentSettingAssertion: AgentSettingAssertion;
    playbackAssertion: PlaybackAssertion;
    shareApiAssertion: ShareApiAssertion;
    shareModalAssertion: ShareModalAssertion;
    publishingRequestModalAssertion: PublishingRequestModalAssertion;
    selectFoldersAssertion: FolderAssertion<Folders>;
    selectFolderModalAssertion: SelectFolderModalAssertion;
    conversationInfoTooltipAssertion: ConversationInfoTooltipAssertion;
    agentInfoAssertion: AgentInfoAssertion;
    addonsDialogAssertion: AddonsDialogAssertion;
    marketplaceAgentsAssertion: MarketplaceAgentsAssertion;
    conversationToCompareAssertion: ConversationToCompareAssertion;
    publishingRequestFolderConversationAssertion: FolderAssertion<PublishFolder>;
    talkToAgentDialogAssertion: TalkToAgentDialogAssertion;
    conversationToPublishAssertion: ConversationToPublishAssertion;
    promptToPublishAssertion: PromptToPublishAssertion;
    folderToPublishAssertion: PublishFolderAssertion<FolderConversationsToPublish>;
    organizationFolderConversationAssertions: FolderAssertion<Folders>;
    messageTemplateModalAssertion: MessageTemplateModalAssertion;
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
  marketplacePage: async ({ page }, use) => {
    const marketplacePage = new MarketplacePage(page);
    await use(marketplacePage);
  },
  appContainer: async ({ dialHomePage }, use) => {
    const appContainer = dialHomePage.getAppContainer();
    await use(appContainer);
  },
  marketplaceContainer: async ({ marketplacePage }, use) => {
    const marketplaceContainer = marketplacePage.getMarketplaceContainer();
    await use(marketplaceContainer);
  },
  marketplaceSidebar: async ({ marketplaceContainer }, use) => {
    const marketplaceSidebar = marketplaceContainer.getMarketplaceSidebar();
    await use(marketplaceSidebar);
  },
  marketplaceFilter: async ({ marketplaceSidebar }, use) => {
    const marketplaceFilter = marketplaceSidebar.getMarketplaceFilter();
    await use(marketplaceFilter);
  },
  marketplace: async ({ marketplaceContainer }, use) => {
    const marketplace = marketplaceContainer.getMarketplace();
    await use(marketplace);
  },
  marketplaceAgents: async ({ marketplace }, use) => {
    const marketplaceAgents = marketplace.getAgents();
    await use(marketplaceAgents);
  },
  marketplaceHeader: async ({ marketplace }, use) => {
    const marketplaceHeader = marketplace.getMarketplaceHeader();
    await use(marketplaceHeader);
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
    const conversations = chatBar.getConversationsTree();
    await use(conversations);
  },
  prompts: async ({ promptBar }, use) => {
    const prompts = promptBar.getPromptsTree();
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
    const folderPrompts = promptBar.getPinnedFolderPrompts();
    await use(folderPrompts);
  },
  organizationFolderPrompts: async ({ promptBar }, use) => {
    const organizationFolderPrompts = promptBar.getOrganizationFolderPrompts();
    await use(organizationFolderPrompts);
  },
  organizationConversations: async ({ chatBar }, use) => {
    const organizationConversations =
      chatBar.getOrganizationConversationsTree();
    await use(organizationConversations);
  },
  organizationPrompts: async ({ promptBar }, use) => {
    const organizationPrompts = promptBar.getOrganizationPromptsTree();
    await use(organizationPrompts);
  },
  conversationSettingsModal: async ({ page }, use) => {
    const conversationSettingsModal = new ConversationSettingsModal(page);
    await use(conversationSettingsModal);
  },
  organizationFolderConversations: async ({ chatBar }, use) => {
    const organizationFolderConversations =
      chatBar.getOrganizationFolderConversations();
    await use(organizationFolderConversations);
  },
  talkToAgentDialog: async ({ page }, use) => {
    const talkToAgentDialog = new TalkToAgentDialog(page);
    await use(talkToAgentDialog);
  },
  talkToAgents: async ({ talkToAgentDialog }, use) => {
    const talkToAgents = talkToAgentDialog.getAgents();
    await use(talkToAgents);
  },
  agentSettings: async ({ conversationSettingsModal }, use) => {
    const agentSettings = conversationSettingsModal.getAgentSettings();
    await use(agentSettings);
  },
  temperatureSlider: async ({ agentSettings }, use) => {
    const temperatureSlider = agentSettings.getTemperatureSlider();
    await use(temperatureSlider);
  },
  addons: async ({ agentSettings }, use) => {
    const addons = agentSettings.getAddons();
    await use(addons);
  },
  addonsDialog: async ({ addons }, use) => {
    const addonsDialog = addons.getAddonsDialog();
    await use(addonsDialog);
  },
  agentInfo: async ({ chat }, use) => {
    const agentInfo = chat.getAgentInfo();
    await use(agentInfo);
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
  renameConversationModal: async ({ page }, use) => {
    const renameConversationModal = new RenameConversationModal(page);
    await use(renameConversationModal);
  },
  renameConversationModalAssertion: async (
    { renameConversationModal },
    use,
  ) => {
    const renameConversationModalAssertion =
      new RenameConversationModalAssertion(renameConversationModal);
    await use(renameConversationModalAssertion);
  },
  variableModalDialog: async ({ page }, use) => {
    const variableModalDialog = new VariableModalDialog(page);
    await use(variableModalDialog);
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
  modelInfoTooltip: async ({ page }, use) => {
    const modelInfoTooltip = new ModelInfoTooltip(page);
    await use(modelInfoTooltip);
  },
  chatSettingsTooltip: async ({ page }, use) => {
    const chatSettingsTooltip = new ChatSettingsTooltip(page);
    await use(chatSettingsTooltip);
  },
  compare: async ({ chat }, use) => {
    const compare = chat.getCompare();
    await use(compare);
  },
  compareConversation: async ({ compare }, use) => {
    const compareConversation = compare.getConversationToCompare();
    await use(compareConversation);
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
  additionalSecondShareUserFileApiHelper: async (
    { additionalSecondShareUserRequestContext },
    use,
  ) => {
    const additionalSecondShareUserFileApiHelper = new FileApiHelper(
      additionalSecondShareUserRequestContext,
      BucketUtil.getAdditionalSecondShareUserBucket(),
    );
    await use(additionalSecondShareUserFileApiHelper);
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
  adminUserItemApiHelper: async ({ adminUserRequestContext }, use) => {
    const adminUserItemApiHelper = new ItemApiHelper(adminUserRequestContext);
    await use(adminUserItemApiHelper);
  },
  additionalShareUserRequestContext: async ({ playwright }, use) => {
    const additionalShareUserRequestContext =
      await playwright.request.newContext({
        storageState: stateFilePath(
          dialTest.info().parallelIndex + +config.workers!,
        ),
      });
    await use(additionalShareUserRequestContext);
  },
  additionalSecondShareUserRequestContext: async ({ playwright }, use) => {
    const additionalSecondShareUserRequestContext =
      await playwright.request.newContext({
        storageState: stateFilePath(
          dialTest.info().parallelIndex + +config.workers! * 2,
        ),
      });
    await use(additionalSecondShareUserRequestContext);
  },
  adminUserRequestContext: async ({ playwright }, use) => {
    const adminUserRequestContext = await playwright.request.newContext({
      storageState: stateFilePath(+config.workers! * 3),
    });
    await use(adminUserRequestContext);
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
  selectFolders: async ({ selectFolderModal }, use) => {
    const selectUploadFolder = selectFolderModal.getSelectFolders();
    await use(selectUploadFolder);
  },
  attachedAllFiles: async ({ attachFilesModal }, use) => {
    const attachedAllFiles = attachFilesModal.getAllFolderFiles();
    await use(attachedAllFiles);
  },
  messageTemplateModal: async ({ page }, use) => {
    const messageTemplateModal = new MessageTemplateModal(page);
    await use(messageTemplateModal);
  },
  settingsModal: async ({ page }, use) => {
    const settingsModal = new SettingsModal(page);
    await use(settingsModal);
  },
  publishingRequestModal: async ({ page }, use) => {
    const publishingModal = new PublishingRequestModal(page);
    await use(publishingModal);
  },
  conversationsToPublishTree: async ({ publishingRequestModal }, use) => {
    const conversationsToPublishTree =
      publishingRequestModal.getConversationsToPublishTree();
    await use(conversationsToPublishTree);
  },
  promptsToPublishTree: async ({ publishingRequestModal }, use) => {
    const promptsToPublishTree =
      publishingRequestModal.getPromptsToPublishTree();
    await use(promptsToPublishTree);
  },
  folderConversationsToPublish: async ({ publishingRequestModal }, use) => {
    const folderConversationsToPublish =
      publishingRequestModal.getFolderConversationsToPublish();
    await use(folderConversationsToPublish);
  },
  publicationApiHelper: async ({ request }, use) => {
    const publicationApiHelper = new PublicationApiHelper(request);
    await use(publicationApiHelper);
  },
  adminPublicationApiHelper: async ({ adminUserRequestContext }, use) => {
    const adminPublicationApiHelper = new PublicationApiHelper(
      adminUserRequestContext,
    );
    await use(adminPublicationApiHelper);
  },
  // eslint-disable-next-line no-empty-pattern
  publishRequestBuilder: async ({}, use) => {
    const publishRequestBuilder = new PublishRequestBuilder();
    await use(publishRequestBuilder);
  },
  publishingRules: async ({ publishingRequestModal }, use) => {
    const publishingRules = publishingRequestModal.getPublishingRules();
    await use(publishingRules);
  },
  conversationAssertion: async ({ conversations }, use) => {
    const conversationAssertion = new ConversationAssertion(conversations);
    await use(conversationAssertion);
  },
  manageAttachmentsAssertion: async ({ attachFilesModal }, use) => {
    const manageAttachmentsAssertion = new ManageAttachmentsAssertion(
      attachFilesModal,
    );
    await use(manageAttachmentsAssertion);
  },
  organizationConversationAssertion: async (
    { organizationConversations },
    use,
  ) => {
    const organizationConversationAssertion =
      new SideBarEntityAssertion<OrganizationConversationsTree>(
        organizationConversations,
      );
    await use(organizationConversationAssertion);
  },
  organizationPromptAssertion: async ({ organizationPrompts }, use) => {
    const organizationPromptAssertion =
      new SideBarEntityAssertion<OrganizationPromptsTree>(organizationPrompts);
    await use(organizationPromptAssertion);
  },
  chatBarFolderAssertion: async ({ folderConversations }, use) => {
    const chatBarFolderAssertion = new FolderAssertion<FolderConversations>(
      folderConversations,
    );
    await use(chatBarFolderAssertion);
  },
  errorToastAssertion: async ({ errorToast }, use) => {
    const promptErrorToastAssertion = new ErrorToastAssertion(errorToast);
    await use(promptErrorToastAssertion);
  },
  // eslint-disable-next-line no-empty-pattern
  downloadAssertion: async ({}, use) => {
    const downloadAssertion = new DownloadAssertion();
    await use(downloadAssertion);
  },
  promptModalAssertion: async ({ promptModalDialog }, use) => {
    const promptModalAssertion = new PromptModalAssertion(promptModalDialog);
    await use(promptModalAssertion);
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
    const promptBarFolderAssertion = new FolderAssertion<FolderPrompts>(
      folderPrompts,
    );
    await use(promptBarFolderAssertion);
  },
  promptBarOrganizationFolderAssertion: async (
    { organizationFolderPrompts },
    use,
  ) => {
    const promptBarOrganizationFolderAssertion =
      new FolderAssertion<FolderPrompts>(organizationFolderPrompts);
    await use(promptBarOrganizationFolderAssertion);
  },
  promptAssertion: async ({ prompts }, use) => {
    const promptAssertion = new PromptAssertion(prompts);
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
  conversationDropdownMenuAssertion: async (
    { conversationDropdownMenu },
    use,
  ) => {
    const conversationDropdownMenuAssertion = new MenuAssertion(
      conversationDropdownMenu,
    );
    await use(conversationDropdownMenuAssertion);
  },
  folderDropdownMenuAssertion: async ({ folderDropdownMenu }, use) => {
    const folderDropdownMenuAssertion = new MenuAssertion(folderDropdownMenu);
    await use(folderDropdownMenuAssertion);
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
  rightChatHeaderAssertion: async ({ rightChatHeader }, use) => {
    const rightChatHeaderAssertion = new ChatHeaderAssertion(rightChatHeader);
    await use(rightChatHeaderAssertion);
  },
  leftChatHeaderAssertion: async ({ leftChatHeader }, use) => {
    const leftChatHeaderAssertion = new ChatHeaderAssertion(leftChatHeader);
    await use(leftChatHeaderAssertion);
  },
  chatMessagesAssertion: async ({ chatMessages }, use) => {
    const chatMessagesAssertion = new ChatMessagesAssertion(chatMessages);
    await use(chatMessagesAssertion);
  },
  footerAssertion: async ({ chat }, use) => {
    const footerAssertion = new FooterAssertion(chat.getFooter());
    await use(footerAssertion);
  },
  sendMessagePromptListAssertion: async ({ sendMessage }, use) => {
    const sendMessagePromptListAssertion = new PromptListAssertion(
      sendMessage.getPromptList(),
    );
    await use(sendMessagePromptListAssertion);
  },
  systemPromptListAssertion: async ({ agentSettings }, use) => {
    const systemPromptListAssertion = new PromptListAssertion(
      agentSettings.getPromptList(),
    );
    await use(systemPromptListAssertion);
  },
  variableModalAssertion: async ({ variableModalDialog }, use) => {
    const variableModalAssertion = new VariableModalAssertion(
      variableModalDialog,
    );
    await use(variableModalAssertion);
  },
  chatAssertion: async ({ chat }, use) => {
    const chatAssertion = new ChatAssertion(chat);
    await use(chatAssertion);
  },
  agentSettingAssertion: async ({ agentSettings }, use) => {
    const agentSettingAssertion = new AgentSettingAssertion(agentSettings);
    await use(agentSettingAssertion);
  },
  playbackAssertion: async ({ playbackControl }, use) => {
    const playbackAssertion = new PlaybackAssertion(playbackControl);
    await use(playbackAssertion);
  },
  shareModalAssertion: async ({ shareModal }, use) => {
    const shareModalAssertion = new ShareModalAssertion(shareModal);
    await use(shareModalAssertion);
  },
  publishingRequestModalAssertion: async ({ publishingRequestModal }, use) => {
    const publishingRequestModalAssertion = new PublishingRequestModalAssertion(
      publishingRequestModal,
    );
    await use(publishingRequestModalAssertion);
  },
  selectFoldersAssertion: async ({ selectFolders }, use) => {
    const selectFoldersAssertion = new FolderAssertion(selectFolders);
    await use(selectFoldersAssertion);
  },
  selectFolderModalAssertion: async ({ selectFolderModal }, use) => {
    const selectFolderModalAssertion = new SelectFolderModalAssertion(
      selectFolderModal,
    );
    await use(selectFolderModalAssertion);
  },
  conversationInfoTooltipAssertion: async ({ modelInfoTooltip }, use) => {
    const conversationInfoTooltipAssertion =
      new ConversationInfoTooltipAssertion(modelInfoTooltip);
    await use(conversationInfoTooltipAssertion);
  },
  agentInfoAssertion: async ({ agentInfo }, use) => {
    const agentInfoAssertion = new AgentInfoAssertion(agentInfo);
    await use(agentInfoAssertion);
  },
  addonsDialogAssertion: async ({ addonsDialog }, use) => {
    const addonsDialogAssertion = new AddonsDialogAssertion(addonsDialog);
    await use(addonsDialogAssertion);
  },
  marketplaceAgentsAssertion: async ({ marketplaceAgents }, use) => {
    const marketplaceAgentsAssertion = new MarketplaceAgentsAssertion(
      marketplaceAgents,
    );
    await use(marketplaceAgentsAssertion);
  },
  conversationToCompareAssertion: async ({ compareConversation }, use) => {
    const conversationToCompareAssertion = new ConversationToCompareAssertion(
      compareConversation,
    );
    await use(conversationToCompareAssertion);
  },
  publishingRequestFolderConversationAssertion: async (
    { publishingRequestModal },
    use,
  ) => {
    const publishingRequestFolderConversationAssertion = new FolderAssertion(
      publishingRequestModal.getFolderConversationsToPublish(),
    );
    await use(publishingRequestFolderConversationAssertion);
  },
  talkToAgentDialogAssertion: async ({ talkToAgentDialog }, use) => {
    const talkToAgentDialogAssertion = new TalkToAgentDialogAssertion(
      talkToAgentDialog,
    );
    await use(talkToAgentDialogAssertion);
  },
  conversationToPublishAssertion: async (
    { conversationsToPublishTree },
    use,
  ) => {
    const conversationToPublishAssertion = new ConversationToPublishAssertion(
      conversationsToPublishTree,
    );
    await use(conversationToPublishAssertion);
  },
  promptToPublishAssertion: async ({ promptsToPublishTree }, use) => {
    const promptToPublishAssertion = new PromptToPublishAssertion(
      promptsToPublishTree,
    );
    await use(promptToPublishAssertion);
  },
  folderToPublishAssertion: async ({ publishingRequestModal }, use) => {
    const folderToPublishAssertion = new PublishFolderAssertion(
      publishingRequestModal.getFolderConversationsToPublish(),
    );
    await use(folderToPublishAssertion);
  },
  organizationFolderConversationAssertions: async (
    { organizationFolderConversations },
    use,
  ) => {
    const organizationFolderConversationAssertions = new FolderAssertion(
      organizationFolderConversations,
    );
    await use(organizationFolderConversationAssertions);
  },
  // eslint-disable-next-line no-empty-pattern
  apiAssertion: async ({}, use) => {
    const apiAssertion = new ApiAssertion();
    await use(apiAssertion);
  },
  // eslint-disable-next-line no-empty-pattern
  shareApiAssertion: async ({}, use) => {
    const shareApiAssertion = new ShareApiAssertion();
    await use(shareApiAssertion);
  },
  messageTemplateModalAssertion: async ({ messageTemplateModal }, use) => {
    const messageTemplateModalAssertion = new MessageTemplateModalAssertion(
      messageTemplateModal,
    );
    await use(messageTemplateModalAssertion);
  },
});

export default dialTest;
