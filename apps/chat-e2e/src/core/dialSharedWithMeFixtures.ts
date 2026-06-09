import { DialHomePage, FileManagerPage, MarketplacePage } from '../ui/pages';
import {
  AgentSettings,
  Chat,
  ChatBar,
  ChatHeader,
  ChatMessages,
  Compare,
  ConfirmationDialog,
  ConversationSettingsModal,
  ConversationToCompare,
  Dropdown,
  DropdownMenu,
  EntityDetailsModal,
  FileDropArea,
  FileManager,
  FileManagerCollapsibleSidebar,
  FileManagerContainer,
  FileManagerGrid,
  FileManagerModal,
  FileManagerNavigationPanel,
  FileManagerToolbar,
  FoldersTree,
  InformationModal,
  Marketplace,
  MarketplaceContainer,
  MarketplaceEntities,
  MarketplaceFilter,
  MarketplaceHeader,
  MarketplaceSidebar,
  ModelInfoTooltip,
  PromptBar,
  PromptModalDialog,
  PublishingRequestDialog,
  SelectFolderModal,
  SendMessage,
  TalkToAgentDialog,
  Toast,
  VariableModalDialog,
} from '../ui/webElements';

import { BackendResourceType } from '@/chat/types/common';
import config from '@/config/chat.playwright.config';
import {
  ChatAssertion,
  ConversationAssertion,
  DownloadAssertion,
  FileManagerGridAssertion,
  FoldersTreeAssertion,
  SelectFolderModalAssertion,
  TalkToAgentDialogAssertion,
  ToastAssertion,
  TooltipAssertion,
} from '@/src/assertions';
import { AgentSettingAssertion } from '@/src/assertions/agentSettingAssertion';
import { ConfirmationDialogAssertion } from '@/src/assertions/confirmationDialogAssertion';
import { EntityDetailsModalAssertion } from '@/src/assertions/entityDetailsModalAssertion';
import { FolderAssertion } from '@/src/assertions/folderAssertion';
import { InformationModalAssertion } from '@/src/assertions/informationModalAssertion';
import { MenuAssertion } from '@/src/assertions/menuAssertion';
import { PromptAssertion } from '@/src/assertions/promptAssertion';
import { PromptListAssertion } from '@/src/assertions/promptListAssertion';
import { PromptModalAssertion } from '@/src/assertions/promptModalAssertion';
import { PromptPreviewModalAssertion } from '@/src/assertions/promptPreviewModalAssertion';
import { SendMessageAssertion } from '@/src/assertions/sendMessageAssertion';
import { SharedWithMePromptsAssertion } from '@/src/assertions/sharedWithMePromptsAssertion';
import { SideBarConversationAssertion } from '@/src/assertions/sideBarConversationAssertion';
import { VariableModalAssertion } from '@/src/assertions/variableModalAssertion';
import dialTest, { stateFilePath } from '@/src/core/dialFixtures';
import { LocalStorageManager } from '@/src/core/localStorageManager';
import { isApiStorageType } from '@/src/hooks/global-setup';
import { FileApiHelper, ModelApiHelper } from '@/src/testData/api';
import { ApiInjector } from '@/src/testData/injector/apiInjector';
import { BrowserStorageInjector } from '@/src/testData/injector/browserStorageInjector';
import { DataInjectorInterface } from '@/src/testData/injector/dataInjectorInterface';
import { AppContainer } from '@/src/ui/webElements/appContainer';
import { ChatNotFound } from '@/src/ui/webElements/chatNotFound';
import { ChatSettingsTooltip } from '@/src/ui/webElements/chatSettingsTooltip';
import {
  ConversationsTree,
  FolderPrompts,
  Folders,
  PromptsTree,
} from '@/src/ui/webElements/entityTree';
import { SharedFolderConversations } from '@/src/ui/webElements/entityTree/sidebar/sharedFolderConversations';
import { SharedWithMeConversationsTree } from '@/src/ui/webElements/entityTree/sidebar/sharedWithMeConversationsTree';
import { SharedWithMePromptsTree } from '@/src/ui/webElements/entityTree/sidebar/sharedWithMePromptsTree';
import { MarketplaceEntitiesSection } from '@/src/ui/webElements/marketplace/marketplaceEntitiesSection';
import { NavigationPanel } from '@/src/ui/webElements/navigationPanel';
import { PlaybackControl } from '@/src/ui/webElements/playbackControl';
import { PromptPreviewModalWindow } from '@/src/ui/webElements/promptPreviewModalWindow';
import { Tooltip } from '@/src/ui/webElements/tooltip';
import { BucketUtil } from '@/src/utils';
import { Page } from '@playwright/test';

const dialSharedWithMeTest = dialTest.extend<{
  beforeAdditionalShareUserTestCleanup: string;
  additionalShareUserLocalStorageManager: LocalStorageManager;
  additionalShareUserPage: Page;
  additionalShareUserDialHomePage: DialHomePage;
  additionalShareUserAppContainer: AppContainer;
  additionalShareUserChatBar: ChatBar;
  additionalShareUserPromptBar: PromptBar;
  additionalShareUserSharedWithMeConversations: SharedWithMeConversationsTree;
  additionalShareUserSharedFolderConversations: SharedFolderConversations;
  additionalShareUserSharedWithMePrompts: SharedWithMePromptsTree;
  additionalShareUserSharedFolderPrompts: FolderPrompts;
  additionalShareUserFileDropArea: FileDropArea;
  additionalShareUserChat: Chat;
  additionalShareUserConversationSettingsModal: ConversationSettingsModal;
  additionalShareUserAgentSettings: AgentSettings;
  additionalShareUserChatHeader: ChatHeader;
  additionalShareUserModelApiHelper: ModelApiHelper;
  additionalShareUserTalkToAgentDialog: TalkToAgentDialog;
  additionalShareUserTalkToAgents: MarketplaceEntities;
  additionalShareUserChatMessages: ChatMessages;
  additionalShareUserSendMessage: SendMessage;
  additionalShareUserModelInfoTooltip: ModelInfoTooltip;
  additionalShareUserFolderPrompts: FolderPrompts;
  additionalShareUserFolderDropdownMenu: DropdownMenu;
  additionalShareUserSharedWithMeFolderDropdownMenu: DropdownMenu;
  additionalShareUserAttachmentDropdownMenu: DropdownMenu;
  additionalShareUserSharedWithMeConversationDropdownMenu: DropdownMenu;
  additionalShareUserSharedWithMePromptDropdownMenu: DropdownMenu;
  additionalShareUserConversations: ConversationsTree;
  additionalShareUserPrompts: PromptsTree;
  additionalShareUserCompare: Compare;
  additionalShareUserCompareConversation: ConversationToCompare;
  additionalShareUserNotFound: ChatNotFound;
  additionalShareUserConfirmationDialog: ConfirmationDialog;
  additionalShareUserPlaybackControl: PlaybackControl;
  additionalShareUserToast: Toast;
  additionalShareUserPromptPreviewModal: PromptPreviewModalWindow;
  additionalShareUserVariableModalDialog: VariableModalDialog;
  additionalShareUserPromptDropdownMenu: DropdownMenu;
  additionalShareUserBrowserStorageInjector: BrowserStorageInjector;
  additionalShareUserApiInjector: ApiInjector;
  additionalShareUserDataInjector: DataInjectorInterface;
  additionalShareUserFileApiHelper: FileApiHelper;
  additionalShareUserPromptModalDialog: PromptModalDialog;
  additionalShareUserSharedWithMePromptAssertion: SharedWithMePromptsAssertion;
  additionalShareUserSharedWithMeConversationAssertion: SideBarConversationAssertion<SharedWithMeConversationsTree>;
  additionalShareUserPromptPreviewModalAssertion: PromptPreviewModalAssertion;
  additionalShareUserSendMessageAssertion: SendMessageAssertion;
  additionalShareUserVariableModalAssertion: VariableModalAssertion;
  additionalShareUserConversationDropdownMenu: DropdownMenu;
  additionalShareUserPublishingRequestDialog: PublishingRequestDialog;
  additionalShareUserInformationModal: InformationModal;
  additionalShareUserInformationModalAssertion: InformationModalAssertion;
  additionalShareUserSharedFolderPromptsAssertions: FolderAssertion<FolderPrompts>;
  additionalShareUserPromptsDropdownMenuAssertion: MenuAssertion;
  additionalShareUserFolderDropdownMenuAssertion: MenuAssertion;
  additionalShareUserConfirmationDialogAssertion: ConfirmationDialogAssertion;
  additionalShareUserPromptAssertion: PromptAssertion;
  additionalShareUserPromptModalAssertion: PromptModalAssertion;
  additionalShareUserPromptBarFolderAssertion: FolderAssertion<FolderPrompts>;
  additionalShareUserSharedWithMeFoldersAssertion: FolderAssertion<Folders>;
  additionalShareUserSystemPromptListAssertion: PromptListAssertion;
  additionalShareUserAgentSettingAssertion: AgentSettingAssertion;
  additionalShareUserToastAssertion: ToastAssertion;
  additionalShareUserChatSettingsTooltip: ChatSettingsTooltip;
  additionalShareUserDownloadAssertion: DownloadAssertion;
  additionalShareUserChatAssertion: ChatAssertion;
  additionalShareUserConversationAssertion: ConversationAssertion;
  additionalShareUserTalkToAgentDialogAssertion: TalkToAgentDialogAssertion;
  additionalShareUserMarketplacePage: MarketplacePage;
  additionalShareUserMarketplaceContainer: MarketplaceContainer;
  additionalShareUserMarketplaceSidebar: MarketplaceSidebar;
  additionalShareUserNavigationPanel: NavigationPanel;
  additionalShareUserMarketplaceFilter: MarketplaceFilter;
  additionalShareUserMarketplace: Marketplace;
  additionalShareUserMarketplaceHeader: MarketplaceHeader;
  additionalShareUserMarketplaceEntitiesSection: MarketplaceEntitiesSection;
  additionalShareUserMarketplaceEntities: MarketplaceEntities;
  additionalShareUserEntityDetailsModal: EntityDetailsModal;
  additionalShareUserSelectFolderModal: SelectFolderModal;
  additionalShareUserSelectFolders: Folders;
  additionalShareUserChatHeaderDropdownMenu: DropdownMenu;
  additionalShareUserSelectFoldersAssertion: FolderAssertion<Folders>;
  additionalShareUserSelectFolderModalAssertion: SelectFolderModalAssertion;
  additionalShareUserEntityDetailsModalAssertion: EntityDetailsModalAssertion;
  additionalShareUserConversationDropdownMenuAssertion: MenuAssertion;
  additionalShareUserTooltip: Tooltip;
  additionalShareUserTooltipAssertion: TooltipAssertion;
  additionalShareUserFileManagerPage: FileManagerPage;
  additionalShareUserFileManagerContainer: FileManagerContainer;
  additionalShareUserFileManager: FileManager;
  additionalShareUserFileManagerToolbar: FileManagerToolbar;
  additionalShareUserFileManagerGrid: FileManagerGrid;
  additionalShareUserFileManagerGridAssertion: FileManagerGridAssertion;
  additionalShareUserFileManagerGridRowDropdownMenu: Dropdown;
  additionalShareUserFileManagerNavigationPanel: FileManagerNavigationPanel;
  additionalShareUserFileManagerModal: FileManagerModal;
  additionalShareUserFileManagerModalManager: FileManager;
  additionalShareUserFileManagerModalGrid: FileManagerGrid;
  additionalShareUserFileManagerModalToolbar: FileManagerToolbar;
  additionalShareUserFileManagerModalCollapsibleSidebar: FileManagerCollapsibleSidebar;
  additionalShareUserFileManagerModalFoldersTree: FoldersTree;
  additionalShareUserFileManagerUnshareItemConfirmationPopup: ConfirmationDialog;
  additionalShareUserFileManagerModalFoldersTreeAssertion: FoldersTreeAssertion;
}>({
  beforeAdditionalShareUserTestCleanup: [
    async (
      {
        additionalUserItemApiHelper,
        additionalUserShareApiHelper,
        additionalSecondUserItemApiHelper,
        additionalSecondUserShareApiHelper,
        additionalUserFileApiHelper,
        additionalSecondShareUserFileApiHelper,
      },
      use,
    ) => {
      await additionalUserItemApiHelper.deleteAllData(
        BucketUtil.getAdditionalShareUserBucket(),
      );
      await additionalSecondUserItemApiHelper.deleteAllData(
        BucketUtil.getAdditionalSecondShareUserBucket(),
      );
      await additionalUserFileApiHelper.deleteAllFiles();
      await additionalSecondShareUserFileApiHelper.deleteAllFiles();
      const additionalUserSharedEntities =
        await additionalUserShareApiHelper.listSharedWithMeEntities(
          ...Object.values(BackendResourceType),
        );
      await additionalUserShareApiHelper.deleteSharedWithMeEntities([
        ...additionalUserSharedEntities.resources,
      ]);
      const additionalSecondUserSharedEntities =
        await additionalSecondUserShareApiHelper.listSharedWithMeEntities(
          ...Object.values(BackendResourceType),
        );
      await additionalSecondUserShareApiHelper.deleteSharedWithMeEntities([
        ...additionalSecondUserSharedEntities.resources,
      ]);
      await use('beforeAdditionalShareUserTestCleanup');
    },
    { scope: 'test', auto: true },
  ],
   
  additionalShareUserDownloadAssertion: async ({}, use) => {
    const additionalShareUserDownloadAssertion = new DownloadAssertion();
    await use(additionalShareUserDownloadAssertion);
  },
  additionalShareUserToastAssertion: async (
    { additionalShareUserToast },
    use,
  ) => {
    const additionalShareUserToastAssertion = new ToastAssertion(
      additionalShareUserToast,
    );
    await use(additionalShareUserToastAssertion);
  },
  additionalShareUserChatSettingsTooltip: async (
    { additionalShareUserPage },
    use,
  ) => {
    const additionalShareUserChatSettingsTooltip = new ChatSettingsTooltip(
      additionalShareUserPage,
    );
    await use(additionalShareUserChatSettingsTooltip);
  },
  additionalShareUserFileApiHelper: async (
    { additionalShareUserRequestContext },
    use,
  ) => {
    const additionalShareUserFileApiHelper = new FileApiHelper(
      additionalShareUserRequestContext,
      BucketUtil.getAdditionalShareUserBucket(),
    );
    await use(additionalShareUserFileApiHelper);
  },
  additionalShareUserAttachmentDropdownMenu: async (
    { additionalShareUserSendMessage },
    use,
  ) => {
    const additionalShareUserAttachmentDropdownMenu =
      additionalShareUserSendMessage.getDropdownMenu();
    await use(additionalShareUserAttachmentDropdownMenu);
  },
  additionalShareUserApiInjector: async (
    { additionalUserItemApiHelper },
    use,
  ) => {
    const additionalShareUserApiInjector = new ApiInjector(
      additionalUserItemApiHelper,
    );
    await use(additionalShareUserApiInjector);
  },
  additionalShareUserBrowserStorageInjector: async (
    { additionalShareUserLocalStorageManager },
    use,
  ) => {
    const additionalShareUserBrowserStorageInjector =
      new BrowserStorageInjector(additionalShareUserLocalStorageManager);
    await use(additionalShareUserBrowserStorageInjector);
  },
  additionalShareUserDataInjector: async (
    {
      additionalShareUserApiInjector,
      additionalShareUserBrowserStorageInjector,
    },
    use,
  ) => {
    const additionalShareUserDataInjector = isApiStorageType
      ? additionalShareUserApiInjector
      : additionalShareUserBrowserStorageInjector;
    await use(additionalShareUserDataInjector);
  },
  additionalShareUserPage: async ({ browser }, use) => {
    const numWorkers = +config.workers!;
    const context = await browser.newContext({
      storageState: stateFilePath(dialTest.info().parallelIndex + numWorkers), // Accessing additional user
    });
    const additionalShareUserPage = await context.newPage();
    await use(additionalShareUserPage);
    await context.close();
  },
  additionalShareUserLocalStorageManager: async (
    { additionalShareUserPage },
    use,
  ) => {
    const additionalShareUserLocalStorageManager = new LocalStorageManager(
      additionalShareUserPage,
    );
    await use(additionalShareUserLocalStorageManager);
  },
  additionalShareUserDialHomePage: async ({ additionalShareUserPage }, use) => {
    const additionalShareUserDialHomePage = new DialHomePage(
      additionalShareUserPage,
    );
    await use(additionalShareUserDialHomePage);
  },
  additionalShareUserAppContainer: async (
    { additionalShareUserDialHomePage },
    use,
  ) => {
    const additionalShareUserAppContainer =
      additionalShareUserDialHomePage.getAppContainer();
    await use(additionalShareUserAppContainer);
  },
  additionalShareUserChatBar: async (
    { additionalShareUserAppContainer },
    use,
  ) => {
    const additionalShareUserChatBar =
      additionalShareUserAppContainer.getChatBar();
    await use(additionalShareUserChatBar);
  },
  additionalShareUserPromptBar: async (
    { additionalShareUserAppContainer },
    use,
  ) => {
    const additionalShareUserPromptBar =
      additionalShareUserAppContainer.getPromptBar();
    await use(additionalShareUserPromptBar);
  },
  additionalShareUserSharedWithMeConversations: async (
    { additionalShareUserChatBar },
    use,
  ) => {
    const additionalShareUserSharedWithMeConversations =
      additionalShareUserChatBar.getSharedWithMeConversationsTree();
    await use(additionalShareUserSharedWithMeConversations);
  },
  additionalShareUserSharedFolderConversations: async (
    { additionalShareUserChatBar },
    use,
  ) => {
    const additionalShareUserSharedFolderConversations =
      additionalShareUserChatBar.getSharedFolderConversations();
    await use(additionalShareUserSharedFolderConversations);
  },
  additionalShareUserSharedWithMePrompts: async (
    { additionalShareUserPromptBar },
    use,
  ) => {
    const additionalShareUserSharedWithMePrompts =
      additionalShareUserPromptBar.getSharedWithMePromptsTree();
    await use(additionalShareUserSharedWithMePrompts);
  },
  additionalShareUserSharedFolderPrompts: async (
    { additionalShareUserPromptBar },
    use,
  ) => {
    const additionalShareUserSharedFolderPrompts =
      additionalShareUserPromptBar.getSharedFolderPrompts();
    await use(additionalShareUserSharedFolderPrompts);
  },
  additionalShareUserFileDropArea: async (
    { additionalShareUserAppContainer },
    use,
  ) => {
    const additionalShareUserFileDropArea =
      additionalShareUserAppContainer.getFileDropArea();
    await use(additionalShareUserFileDropArea);
  },
  additionalShareUserChat: async ({ additionalShareUserFileDropArea }, use) => {
    const additionalShareUserChat = additionalShareUserFileDropArea.getChat();
    await use(additionalShareUserChat);
  },
  additionalShareUserConversations: async (
    { additionalShareUserChatBar },
    use,
  ) => {
    const additionalShareUserConversations =
      additionalShareUserChatBar.getConversationsTree();
    await use(additionalShareUserConversations);
  },
  additionalShareUserPrompts: async ({ additionalShareUserPromptBar }, use) => {
    const additionalShareUserPrompts =
      additionalShareUserPromptBar.getPromptsTree();
    await use(additionalShareUserPrompts);
  },
  additionalShareUserCompare: async ({ additionalShareUserChat }, use) => {
    const additionalShareUserCompare = additionalShareUserChat.getCompare();
    await use(additionalShareUserCompare);
  },
  additionalShareUserCompareConversation: async (
    { additionalShareUserCompare },
    use,
  ) => {
    const additionalShareUserCompareConversation =
      additionalShareUserCompare.getConversationToCompare();
    await use(additionalShareUserCompareConversation);
  },
  additionalShareUserConversationSettingsModal: async (
    { additionalShareUserPage },
    use,
  ) => {
    const additionalShareUserConversationSettingsModal =
      new ConversationSettingsModal(additionalShareUserPage);
    await use(additionalShareUserConversationSettingsModal);
  },
  additionalShareUserAgentSettings: async (
    { additionalShareUserConversationSettingsModal },
    use,
  ) => {
    const additionalShareUserAgentSettings =
      additionalShareUserConversationSettingsModal.getAgentSettings();
    await use(additionalShareUserAgentSettings);
  },
  additionalShareUserChatHeader: async ({ additionalShareUserChat }, use) => {
    const additionalShareUserChatHeader =
      additionalShareUserChat.getChatHeader();
    await use(additionalShareUserChatHeader);
  },
  additionalShareUserModelApiHelper: async (
    { additionalShareUserRequestContext },
    use,
  ) => {
    const additionalShareUserModelApiHelper = new ModelApiHelper(
      additionalShareUserRequestContext,
      BucketUtil.getAdditionalShareUserBucket(),
    );
    await use(additionalShareUserModelApiHelper);
  },
  additionalShareUserTalkToAgentDialog: async (
    { additionalShareUserPage },
    use,
  ) => {
    const additionalShareUserTalkToAgentDialog = new TalkToAgentDialog(
      additionalShareUserPage,
    );
    await use(additionalShareUserTalkToAgentDialog);
  },
  additionalShareUserTalkToAgents: async (
    { additionalShareUserTalkToAgentDialog },
    use,
  ) => {
    const additionalShareUserT =
      additionalShareUserTalkToAgentDialog.getAgents();
    await use(additionalShareUserT);
  },
  additionalShareUserChatMessages: async ({ additionalShareUserChat }, use) => {
    const additionalShareUserChatMessages =
      additionalShareUserChat.getChatMessages();
    await use(additionalShareUserChatMessages);
  },
  additionalShareUserSendMessage: async ({ additionalShareUserChat }, use) => {
    const additionalShareUserSendMessage =
      additionalShareUserChat.getSendMessage();
    await use(additionalShareUserSendMessage);
  },
  additionalShareUserModelInfoTooltip: async (
    { additionalShareUserPage },
    use,
  ) => {
    const additionalShareUserModelInfoTooltip = new ModelInfoTooltip(
      additionalShareUserPage,
    );
    await use(additionalShareUserModelInfoTooltip);
  },
  additionalShareUserSharedWithMeConversationDropdownMenu: async (
    { additionalShareUserSharedWithMeConversations },
    use,
  ) => {
    const additionalShareUserSharedWithMeConversationDropdownMenu =
      additionalShareUserSharedWithMeConversations.getDropdownMenu();
    await use(additionalShareUserSharedWithMeConversationDropdownMenu);
  },
  additionalShareUserConversationDropdownMenu: async (
    { additionalShareUserConversations },
    use,
  ) => {
    const additionalShareUserConversationDropdownMenu =
      additionalShareUserConversations.getDropdownMenu();
    await use(additionalShareUserConversationDropdownMenu);
  },
  additionalShareUserPublishingRequestDialog: async (
    { additionalShareUserPage },
    use,
  ) => {
    const additionalShareUserPublishingRequestDialog =
      new PublishingRequestDialog(additionalShareUserPage);
    await use(additionalShareUserPublishingRequestDialog);
  },
  additionalShareUserInformationModal: async (
    { additionalShareUserPage },
    use,
  ) => {
    const additionalShareUserInformationModal = new InformationModal(
      additionalShareUserPage,
    );
    await use(additionalShareUserInformationModal);
  },
  additionalShareUserInformationModalAssertion: async (
    { additionalShareUserInformationModal },
    use,
  ) => {
    const additionalShareUserInformationModalAssertion =
      new InformationModalAssertion(additionalShareUserInformationModal);
    await use(additionalShareUserInformationModalAssertion);
  },
  additionalShareUserSharedWithMePromptDropdownMenu: async (
    { additionalShareUserSharedWithMePrompts },
    use,
  ) => {
    const additionalShareUserSharedWithMePromptDropdownMenu =
      additionalShareUserSharedWithMePrompts.getDropdownMenu();
    await use(additionalShareUserSharedWithMePromptDropdownMenu);
  },
  additionalShareUserFolderPrompts: async (
    { additionalShareUserPromptBar },
    use,
  ) => {
    const additionalShareUserFolderPrompts =
      additionalShareUserPromptBar.getPinnedFolderPrompts();
    await use(additionalShareUserFolderPrompts);
  },
  additionalShareUserFolderDropdownMenu: async (
    { additionalShareUserFolderPrompts },
    use,
  ) => {
    const additionalShareUserFolderDropdownMenu =
      additionalShareUserFolderPrompts.getDropdownMenu();
    await use(additionalShareUserFolderDropdownMenu);
  },
  additionalShareUserSharedWithMeFolderDropdownMenu: async (
    { additionalShareUserSharedFolderConversations },
    use,
  ) => {
    const additionalShareUserSharedWithMeFolderDropdownMenu =
      additionalShareUserSharedFolderConversations.getDropdownMenu();
    await use(additionalShareUserSharedWithMeFolderDropdownMenu);
  },
  additionalShareUserNotFound: async ({ additionalShareUserPage }, use) => {
    const additionalShareUserNotFound = new ChatNotFound(
      additionalShareUserPage,
    );
    await use(additionalShareUserNotFound);
  },
  additionalShareUserConfirmationDialog: async (
    { additionalShareUserPage },
    use,
  ) => {
    const additionalShareUserConfirmationDialog = new ConfirmationDialog(
      additionalShareUserPage,
    );
    await use(additionalShareUserConfirmationDialog);
  },
  additionalShareUserPlaybackControl: async (
    { additionalShareUserChat },
    use,
  ) => {
    const additionalShareUserPlaybackControl =
      additionalShareUserChat.getPlaybackControl();
    await use(additionalShareUserPlaybackControl);
  },
  additionalShareUserToast: async (
    { additionalShareUserAppContainer },
    use,
  ) => {
    const additionalShareUserToast = additionalShareUserAppContainer.getToast();
    await use(additionalShareUserToast);
  },
  additionalShareUserPromptPreviewModal: async (
    { additionalShareUserPage },
    use,
  ) => {
    const additionalShareUserPromptPreviewModal = new PromptPreviewModalWindow(
      additionalShareUserPage,
    );
    await use(additionalShareUserPromptPreviewModal);
  },
  additionalShareUserVariableModalDialog: async (
    { additionalShareUserPage },
    use,
  ) => {
    const additionalShareUserVariableModalDialog = new VariableModalDialog(
      additionalShareUserPage,
    );
    await use(additionalShareUserVariableModalDialog);
  },
  additionalShareUserPromptDropdownMenu: async (
    { additionalShareUserPrompts },
    use,
  ) => {
    const additionalShareUserPromptDropdownMenu =
      additionalShareUserPrompts.getDropdownMenu();
    await use(additionalShareUserPromptDropdownMenu);
  },
  additionalShareUserPromptModalDialog: async (
    { additionalShareUserPage },
    use,
  ) => {
    const additionalShareUserPromptModalDialog = new PromptModalDialog(
      additionalShareUserPage,
    );
    await use(additionalShareUserPromptModalDialog);
  },
  additionalShareUserSharedWithMePromptAssertion: async (
    { additionalShareUserSharedWithMePrompts },
    use,
  ) => {
    const additionalShareUserSharedWithMePromptAssertion =
      new SharedWithMePromptsAssertion(additionalShareUserSharedWithMePrompts);
    await use(additionalShareUserSharedWithMePromptAssertion);
  },
  additionalShareUserSharedWithMeConversationAssertion: async (
    { additionalShareUserSharedWithMeConversations },
    use,
  ) => {
    const additionalShareUserSharedWithMeConversationAssertion =
      new SideBarConversationAssertion<SharedWithMeConversationsTree>(
        additionalShareUserSharedWithMeConversations,
      );
    await use(additionalShareUserSharedWithMeConversationAssertion);
  },
  additionalShareUserPromptPreviewModalAssertion: async (
    { additionalShareUserPromptPreviewModal },
    use,
  ) => {
    const additionalShareUserPromptPreviewModalAssertion =
      new PromptPreviewModalAssertion(additionalShareUserPromptPreviewModal);
    await use(additionalShareUserPromptPreviewModalAssertion);
  },
  additionalShareUserVariableModalAssertion: async (
    { additionalShareUserVariableModalDialog },
    use,
  ) => {
    const additionalShareUserVariableModalAssertion =
      new VariableModalAssertion(additionalShareUserVariableModalDialog);
    await use(additionalShareUserVariableModalAssertion);
  },
  additionalShareUserSendMessageAssertion: async (
    { additionalShareUserSendMessage },
    use,
  ) => {
    const additionalShareUserSendMessageAssertion = new SendMessageAssertion(
      additionalShareUserSendMessage,
    );
    await use(additionalShareUserSendMessageAssertion);
  },
  additionalShareUserSharedFolderPromptsAssertions: async (
    { additionalShareUserSharedFolderPrompts },
    use,
  ) => {
    const additionalShareUserSharedFolderPromptsAssertions =
      new FolderAssertion<FolderPrompts>(
        additionalShareUserSharedFolderPrompts,
      );
    await use(additionalShareUserSharedFolderPromptsAssertions);
  },
  additionalShareUserPromptsDropdownMenuAssertion: async (
    { additionalShareUserPromptDropdownMenu },
    use,
  ) => {
    const additionalShareUserPromptsDropdownMenuAssertion = new MenuAssertion(
      additionalShareUserPromptDropdownMenu,
    );
    await use(additionalShareUserPromptsDropdownMenuAssertion);
  },
  additionalShareUserFolderDropdownMenuAssertion: async (
    { additionalShareUserFolderDropdownMenu },
    use,
  ) => {
    const additionalShareUserFolderDropdownMenuAssertion = new MenuAssertion(
      additionalShareUserFolderDropdownMenu,
    );
    await use(additionalShareUserFolderDropdownMenuAssertion);
  },
  additionalShareUserConfirmationDialogAssertion: async (
    { additionalShareUserConfirmationDialog },
    use,
  ) => {
    const additionalShareUserConfirmationDialogAssertion =
      new ConfirmationDialogAssertion(additionalShareUserConfirmationDialog);
    await use(additionalShareUserConfirmationDialogAssertion);
  },
  additionalShareUserPromptAssertion: async (
    { additionalShareUserPrompts },
    use,
  ) => {
    const additionalShareUserPromptAssertion = new PromptAssertion(
      additionalShareUserPrompts,
    );
    await use(additionalShareUserPromptAssertion);
  },
  additionalShareUserPromptModalAssertion: async (
    { additionalShareUserPromptModalDialog },
    use,
  ) => {
    const additionalShareUserPromptModalAssertion = new PromptModalAssertion(
      additionalShareUserPromptModalDialog,
    );
    await use(additionalShareUserPromptModalAssertion);
  },
  additionalShareUserPromptBarFolderAssertion: async (
    { additionalShareUserFolderPrompts },
    use,
  ) => {
    const additionalShareUserPromptBarFolderAssertion = new FolderAssertion(
      additionalShareUserFolderPrompts,
    );
    await use(additionalShareUserPromptBarFolderAssertion);
  },
  additionalShareUserSharedWithMeFoldersAssertion: async (
    { additionalShareUserSharedFolderConversations },
    use,
  ) => {
    const additionalShareUserSharedWithMeFoldersAssertion = new FolderAssertion(
      additionalShareUserSharedFolderConversations,
    );
    await use(additionalShareUserSharedWithMeFoldersAssertion);
  },
  additionalShareUserSystemPromptListAssertion: async (
    { additionalShareUserAgentSettings },
    use,
  ) => {
    const additionalShareUserSystemPromptListAssertion =
      new PromptListAssertion(additionalShareUserAgentSettings.getPromptList());
    await use(additionalShareUserSystemPromptListAssertion);
  },
  additionalShareUserAgentSettingAssertion: async (
    { additionalShareUserAgentSettings },
    use,
  ) => {
    const additionalShareUserAgentSettingAssertion = new AgentSettingAssertion(
      additionalShareUserAgentSettings,
    );
    await use(additionalShareUserAgentSettingAssertion);
  },
  additionalShareUserChatAssertion: async (
    { additionalShareUserChat },
    use,
  ) => {
    const additionalShareUserChatAssertion = new ChatAssertion(
      additionalShareUserChat,
    );
    await use(additionalShareUserChatAssertion);
  },
  additionalShareUserConversationAssertion: async (
    { additionalShareUserConversations },
    use,
  ) => {
    const additionalShareUserConversationAssertion = new ConversationAssertion(
      additionalShareUserConversations,
    );
    await use(additionalShareUserConversationAssertion);
  },
  additionalShareUserTalkToAgentDialogAssertion: async (
    { additionalShareUserTalkToAgentDialog },
    use,
  ) => {
    const additionalShareUserTalkToAgentDialogAssertion =
      new TalkToAgentDialogAssertion(additionalShareUserTalkToAgentDialog);
    await use(additionalShareUserTalkToAgentDialogAssertion);
  },
  additionalShareUserMarketplacePage: async (
    { additionalShareUserPage },
    use,
  ) => {
    const additionalShareUserMarketplacePage = new MarketplacePage(
      additionalShareUserPage,
    );
    await use(additionalShareUserMarketplacePage);
  },
  additionalShareUserMarketplaceContainer: async (
    { additionalShareUserMarketplacePage },
    use,
  ) => {
    const additionalShareUserMarketplaceContainer =
      additionalShareUserMarketplacePage.getMarketplaceContainer();
    await use(additionalShareUserMarketplaceContainer);
  },
  additionalShareUserMarketplaceSidebar: async (
    { additionalShareUserMarketplaceContainer },
    use,
  ) => {
    const additionalShareUserMarketplaceSidebar =
      additionalShareUserMarketplaceContainer.getMarketplaceSidebar();
    await use(additionalShareUserMarketplaceSidebar);
  },
  additionalShareUserNavigationPanel: async (
    { additionalShareUserMarketplaceContainer },
    use,
  ) => {
    const additionalShareUserNavigationPanel =
      additionalShareUserMarketplaceContainer.getNavigationPanel();
    await use(additionalShareUserNavigationPanel);
  },
  additionalShareUserMarketplaceFilter: async (
    { additionalShareUserMarketplaceSidebar },
    use,
  ) => {
    const additionalShareUserMarketplaceFilter =
      additionalShareUserMarketplaceSidebar.getMarketplaceFilter();
    await use(additionalShareUserMarketplaceFilter);
  },
  additionalShareUserMarketplace: async (
    { additionalShareUserMarketplaceContainer },
    use,
  ) => {
    const additionalShareUserMarketplace =
      additionalShareUserMarketplaceContainer.getMarketplace();
    await use(additionalShareUserMarketplace);
  },
  additionalShareUserMarketplaceHeader: async (
    { additionalShareUserMarketplace },
    use,
  ) => {
    const additionalShareUserMarketplaceHeader =
      additionalShareUserMarketplace.getMarketplaceHeader();
    await use(additionalShareUserMarketplaceHeader);
  },
  additionalShareUserMarketplaceEntitiesSection: async (
    { additionalShareUserMarketplace },
    use,
  ) => {
    const additionalShareUserMarketplaceEntitiesSection =
      additionalShareUserMarketplace.getMarketplaceEntitiesSection();
    await use(additionalShareUserMarketplaceEntitiesSection);
  },
  additionalShareUserMarketplaceEntities: async (
    { additionalShareUserMarketplaceEntitiesSection },
    use,
  ) => {
    const additionalShareUserMarketplaceEntities =
      additionalShareUserMarketplaceEntitiesSection.getEntities();
    await use(additionalShareUserMarketplaceEntities);
  },
  additionalShareUserEntityDetailsModal: async (
    { additionalShareUserMarketplaceEntities },
    use,
  ) => {
    const additionalShareUserEntityDetailsModal =
      additionalShareUserMarketplaceEntities.getEntityDetailsModal();
    await use(additionalShareUserEntityDetailsModal);
  },
  additionalShareUserSelectFolderModal: async (
    { additionalShareUserPage },
    use,
  ) => {
    const additionalShareUserSelectFolderModal = new SelectFolderModal(
      additionalShareUserPage,
    );
    await use(additionalShareUserSelectFolderModal);
  },
  additionalShareUserSelectFolders: async (
    { additionalShareUserSelectFolderModal },
    use,
  ) => {
    const additionalShareUserSelectFolders =
      additionalShareUserSelectFolderModal.getSelectFolders();
    await use(additionalShareUserSelectFolders);
  },
  additionalShareUserChatHeaderDropdownMenu: async (
    { additionalShareUserPage },
    use,
  ) => {
    const additionalShareUserChatHeaderDropdownMenu = new DropdownMenu(
      additionalShareUserPage,
    );
    await use(additionalShareUserChatHeaderDropdownMenu);
  },
  additionalShareUserSelectFoldersAssertion: async (
    { additionalShareUserSelectFolders },
    use,
  ) => {
    const additionalShareUserSelectFoldersAssertion = new FolderAssertion(
      additionalShareUserSelectFolders,
    );
    await use(additionalShareUserSelectFoldersAssertion);
  },
  additionalShareUserSelectFolderModalAssertion: async (
    { additionalShareUserSelectFolderModal },
    use,
  ) => {
    const additionalShareUserSelectFolderModalAssertion =
      new SelectFolderModalAssertion(additionalShareUserSelectFolderModal);
    await use(additionalShareUserSelectFolderModalAssertion);
  },
  additionalShareUserEntityDetailsModalAssertion: async (
    { additionalShareUserEntityDetailsModal },
    use,
  ) => {
    const additionalShareUserEntityDetailsModalAssertion =
      new EntityDetailsModalAssertion(additionalShareUserEntityDetailsModal);
    await use(additionalShareUserEntityDetailsModalAssertion);
  },
  additionalShareUserConversationDropdownMenuAssertion: async (
    { additionalShareUserConversationDropdownMenu },
    use,
  ) => {
    const additionalShareUserConversationDropdownMenuAssertion =
      new MenuAssertion(additionalShareUserConversationDropdownMenu);
    await use(additionalShareUserConversationDropdownMenuAssertion);
  },
  additionalShareUserTooltip: async ({ additionalShareUserPage }, use) => {
    const additionalShareUserTooltip = new Tooltip(additionalShareUserPage);
    await use(additionalShareUserTooltip);
  },
  additionalShareUserTooltipAssertion: async (
    { additionalShareUserTooltip },
    use,
  ) => {
    const additionalShareUserTooltipAssertion = new TooltipAssertion(
      additionalShareUserTooltip,
    );
    await use(additionalShareUserTooltipAssertion);
  },
  additionalShareUserFileManagerPage: async (
    { additionalShareUserPage },
    use,
  ) => {
    const additionalShareUserFileManagerPage = new FileManagerPage(
      additionalShareUserPage,
    );
    await use(additionalShareUserFileManagerPage);
  },
  additionalShareUserFileManagerContainer: async (
    { additionalShareUserFileManagerPage },
    use,
  ) => {
    const additionalShareUserFileManagerContainer =
      additionalShareUserFileManagerPage.getFileManagerContainer();
    await use(additionalShareUserFileManagerContainer);
  },
  additionalShareUserFileManager: async (
    { additionalShareUserFileManagerContainer },
    use,
  ) => {
    const additionalShareUserFileManager =
      additionalShareUserFileManagerContainer.getFileManager();
    await use(additionalShareUserFileManager);
  },
  additionalShareUserFileManagerToolbar: async (
    { additionalShareUserFileManager },
    use,
  ) => {
    const additionalShareUserFileManagerToolbar =
      additionalShareUserFileManager.getFileManagerToolbar();
    await use(additionalShareUserFileManagerToolbar);
  },
  additionalShareUserFileManagerGrid: async (
    { additionalShareUserFileManager },
    use,
  ) => {
    const additionalShareUserFileManagerGrid =
      additionalShareUserFileManager.getFileManagerGrid();
    await use(additionalShareUserFileManagerGrid);
  },
  additionalShareUserFileManagerGridAssertion: async (
    { additionalShareUserFileManagerGrid },
    use,
  ) => {
    const additionalShareUserFileManagerGridAssertion =
      new FileManagerGridAssertion(additionalShareUserFileManagerGrid);
    await use(additionalShareUserFileManagerGridAssertion);
  },
  additionalShareUserFileManagerGridRowDropdownMenu: async (
    { additionalShareUserFileManagerGrid },
    use,
  ) => {
    const additionalShareUserFileManagerGridRowDropdownMenu =
      additionalShareUserFileManagerGrid.getRowDropdownMenu();
    await use(additionalShareUserFileManagerGridRowDropdownMenu);
  },
  additionalShareUserFileManagerNavigationPanel: async (
    { additionalShareUserFileManager },
    use,
  ) => {
    const additionalShareUserFileManagerNavigationPanel =
      additionalShareUserFileManager.getFileManagerNavigationPanel();
    await use(additionalShareUserFileManagerNavigationPanel);
  },
  additionalShareUserFileManagerModal: async (
    { additionalShareUserPage },
    use,
  ) => {
    const additionalShareUserFileManagerModal = new FileManagerModal(
      additionalShareUserPage,
    );
    await use(additionalShareUserFileManagerModal);
  },
  additionalShareUserFileManagerModalManager: async (
    { additionalShareUserFileManagerModal },
    use,
  ) => {
    const additionalShareUserFileManagerModalManager =
      additionalShareUserFileManagerModal.getFileManager();
    await use(additionalShareUserFileManagerModalManager);
  },
  additionalShareUserFileManagerModalGrid: async (
    { additionalShareUserFileManagerModalManager },
    use,
  ) => {
    const additionalShareUserFileManagerModalGrid =
      additionalShareUserFileManagerModalManager.getFileManagerGrid();
    await use(additionalShareUserFileManagerModalGrid);
  },
  additionalShareUserFileManagerModalToolbar: async (
    { additionalShareUserFileManagerModalManager },
    use,
  ) => {
    const additionalShareUserFileManagerModalToolbar =
      additionalShareUserFileManagerModalManager.getFileManagerToolbar();
    await use(additionalShareUserFileManagerModalToolbar);
  },
  additionalShareUserFileManagerModalCollapsibleSidebar: async (
    { additionalShareUserFileManagerModalManager },
    use,
  ) => {
    const additionalShareUserFileManagerModalCollapsibleSidebar =
      additionalShareUserFileManagerModalManager.getFileManagerCollapsibleSidebar();
    await use(additionalShareUserFileManagerModalCollapsibleSidebar);
  },
  additionalShareUserFileManagerModalFoldersTree: async (
    { additionalShareUserFileManagerModalCollapsibleSidebar },
    use,
  ) => {
    const additionalShareUserFileManagerModalFoldersTree =
      additionalShareUserFileManagerModalCollapsibleSidebar.getFoldersTree();
    await use(additionalShareUserFileManagerModalFoldersTree);
  },
  additionalShareUserFileManagerUnshareItemConfirmationPopup: async (
    { additionalShareUserPage },
    use,
  ) => {
    const additionalShareUserFileManagerUnshareItemConfirmationPopup =
      new ConfirmationDialog(additionalShareUserPage);
    await use(additionalShareUserFileManagerUnshareItemConfirmationPopup);
  },
  additionalShareUserFileManagerModalFoldersTreeAssertion: async (
    { additionalShareUserFileManagerModalFoldersTree },
    use,
  ) => {
    const additionalShareUserFileManagerModalFoldersTreeAssertion =
      new FoldersTreeAssertion(additionalShareUserFileManagerModalFoldersTree);
    await use(additionalShareUserFileManagerModalFoldersTreeAssertion);
  },
});

export let shareUserBucket: string;
dialSharedWithMeTest.beforeAll(async () => {
  shareUserBucket = BucketUtil.getAdditionalShareUserBucket();
});

export default dialSharedWithMeTest;
