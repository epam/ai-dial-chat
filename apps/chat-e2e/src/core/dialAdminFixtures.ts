import { DialHomePage, MarketplacePage } from '../ui/pages';
import {
  AgentDetailsModal,
  AttachFilesModal,
  Chat,
  ChatBar,
  ChatHeader,
  ChatMessages,
  DropdownMenu,
  InformationModal,
  Marketplace,
  MarketplaceAgents,
  MarketplaceContainer,
  MarketplaceHeader,
  PromptBar,
  PublicationReviewControl,
  PublishingApprovalModal,
  PublishingRequestModal,
  SelectFolderModal,
  Toast,
  VariableModalDialog,
} from '../ui/webElements';

import config from '@/config/chat.playwright.config';
import {
  ChatHeaderAssertion,
  ChatMessagesAssertion,
  ConversationAssertion,
  ManageAttachmentsAssertion,
  MarketplaceAgentsAssertion,
  MenuAssertion,
  PublicationReviewControlAssertion,
  PublishEntityAssertion,
  PublishFileAssertion,
  PublishFolderAssertion,
  PublishedAppReviewModalAssertion,
  PublishedPromptPreviewModalAssertion,
  PublishingApprovalModalAssertion,
  TooltipAssertion,
  VariableModalAssertion,
} from '@/src/assertions';
import { AgentDetailsModalAssertion } from '@/src/assertions/agentDetailsModalAssertion';
import { FolderAssertion } from '@/src/assertions/folderAssertion';
import { InformationModalAssertion } from '@/src/assertions/informationModalAssertion';
import { SideBarConversationAssertion } from '@/src/assertions/sideBarConversationAssertion';
import { SideBarEntityAssertion } from '@/src/assertions/sideBarEntityAssertion';
import dialTest, { stateFilePath } from '@/src/core/dialFixtures';
import { LocalStorageManager } from '@/src/core/localStorageManager';
import { isApiStorageType } from '@/src/hooks/global-setup';
import { ApiInjector } from '@/src/testData/injector/apiInjector';
import { BrowserStorageInjector } from '@/src/testData/injector/browserStorageInjector';
import { DataInjectorInterface } from '@/src/testData/injector/dataInjectorInterface';
import { AppContainer } from '@/src/ui/webElements/appContainer';
import {
  ApplicationsToApproveTree,
  ApproveRequiredConversationsTree,
  ApproveRequiredPrompts,
  ConversationsToApproveTree,
  ConversationsToPublishTree,
  ConversationsTree,
  FilesToApproveTree,
  FolderConversationsToApprove,
  FolderPrompts,
  FolderPromptsToApprove,
  Folders,
  OrganizationConversationsTree,
  OrganizationPromptsTree,
  PromptsToApproveTree,
  PromptsToPublishTree,
  PromptsTree,
} from '@/src/ui/webElements/entityTree';
import { MarketplaceAgentsSection } from '@/src/ui/webElements/marketplace/marketplaceAgentsSection';
import { NavigationPanel } from '@/src/ui/webElements/navigationPanel';
import { PublishedApplicationReviewModal } from '@/src/ui/webElements/publishedApplicationReviewModal';
import { PublishedPromptPreviewModal } from '@/src/ui/webElements/publishedPromptPreviewModal';
import { ShareModal } from '@/src/ui/webElements/shareModal';
import { Tooltip } from '@/src/ui/webElements/tooltip';
import { Page } from '@playwright/test';

const dialAdminTest = dialTest.extend<{
  adminLocalStorageManager: LocalStorageManager;
  adminPage: Page;
  adminDialHomePage: DialHomePage;
  adminAppContainer: AppContainer;
  adminMarketplacePage: MarketplacePage;
  adminChatBar: ChatBar;
  adminPromptBar: PromptBar;
  adminChat: Chat;
  adminMarketplaceContainer: MarketplaceContainer;
  adminNavigationPanel: NavigationPanel;
  adminMarketplace: Marketplace;
  adminMarketplaceHeader: MarketplaceHeader;
  adminMarketplaceAgentsSection: MarketplaceAgentsSection;
  adminMarketplaceAgents: MarketplaceAgents;
  adminFolderPrompts: FolderPrompts;
  adminConversations: ConversationsTree;
  adminPrompts: PromptsTree;
  adminApproveRequiredConversations: ApproveRequiredConversationsTree;
  adminApproveRequiredPrompts: ApproveRequiredPrompts;
  adminOrganizationFolderConversations: Folders;
  adminOrganizationFolderPrompts: Folders;
  adminConversationsToApprove: ConversationsToApproveTree;
  adminFilesToApprove: FilesToApproveTree;
  adminPromptsToApprove: PromptsToApproveTree;
  adminAppsToApprove: ApplicationsToApproveTree;
  adminPublishingApprovalModal: PublishingApprovalModal;
  adminPublishedPromptPreviewModal: PublishedPromptPreviewModal;
  adminApiInjector: ApiInjector;
  adminBrowserStorageInjector: BrowserStorageInjector;
  adminDataInjector: DataInjectorInterface;
  adminPublishingRequestModal: PublishingRequestModal;
  adminToast: Toast;
  adminShareModal: ShareModal;
  adminPromptsToPublishTree: PromptsToPublishTree;
  adminApproveRequiredConversationsAssertion: FolderAssertion<ApproveRequiredConversationsTree>;
  adminApproveRequiredPromptsAssertion: FolderAssertion<ApproveRequiredPrompts>;
  adminOrganizationFolderConversationAssertions: FolderAssertion<Folders>;
  adminOrganizationFolderPromptAssertions: FolderAssertion<Folders>;
  adminPublishingApprovalModalAssertion: PublishingApprovalModalAssertion;
  adminConversationToApproveAssertion: PublishEntityAssertion<ConversationsToApproveTree>;
  adminAppToApproveAssertion: PublishEntityAssertion<ApplicationsToApproveTree>;
  adminFilesToApproveAssertion: PublishFileAssertion<FilesToApproveTree>;
  adminPromptToApproveAssertion: PublishEntityAssertion<PromptsToApproveTree>;
  adminFolderConversationsToApproveAssertion: PublishFolderAssertion<FolderConversationsToApprove>;
  adminFolderPromptsToApproveAssertion: PublishFolderAssertion<FolderPromptsToApprove>;
  adminPromptDropdownMenuAssertion: MenuAssertion;
  adminPromptDropdownMenu: DropdownMenu;
  adminPublicationReviewControl: PublicationReviewControl;
  adminChatHeader: ChatHeader;
  adminChatMessages: ChatMessages;
  adminOrganizationFolderDropdownMenu: DropdownMenu;
  adminApproveRequiredConversationDropdownMenu: DropdownMenu;
  adminApproveRequiredPromptDropdownMenu: DropdownMenu;
  adminTooltip: Tooltip;
  adminOrganizationConversations: OrganizationConversationsTree;
  adminVariableModal: VariableModalDialog;
  adminConversationDropdownMenu: DropdownMenu;
  adminInformationModal: InformationModal;
  adminInformationModalAssertion: InformationModalAssertion;
  adminChatHeaderAssertion: ChatHeaderAssertion<ChatHeader>;
  adminChatMessagesAssertion: ChatMessagesAssertion;
  adminOrganizationFolderDropdownMenuAssertion: MenuAssertion;
  adminApproveRequiredConversationDropdownMenuAssertion: MenuAssertion;
  adminTooltipAssertion: TooltipAssertion;
  adminOrganizationConversationAssertion: SideBarConversationAssertion<OrganizationConversationsTree>;
  adminPublishedPromptPreviewModalAssertion: PublishedPromptPreviewModalAssertion;
  adminPublishedPromptPreviewModalControlsAssertion: PublicationReviewControlAssertion;
  adminVariableModalAssertion: VariableModalAssertion;
  adminConversationAssertion: ConversationAssertion;
  adminConversationsToPublishTree: ConversationsToPublishTree;
  adminConversationToPublishAssertion: PublishEntityAssertion<ConversationsToPublishTree>;
  adminPublishedApplicationReviewModal: PublishedApplicationReviewModal;
  adminPublishedAppReviewModalAssertion: PublishedAppReviewModalAssertion;
  adminPublishedAppReviewModalControlsAssertion: PublicationReviewControlAssertion;
  adminOrganizationPrompts: OrganizationPromptsTree;
  adminOrganizationPromptAssertion: SideBarEntityAssertion<OrganizationPromptsTree>;
  adminAttachFilesModal: AttachFilesModal;
  adminAgentDetailsModal: AgentDetailsModal;
  adminSelectFolderModal: SelectFolderModal;
  adminManageAttachmentsAssertion: ManageAttachmentsAssertion;
  adminMarketplaceAgentsAssertion: MarketplaceAgentsAssertion;
  adminAgentDetailsModalAssertion: AgentDetailsModalAssertion;
  adminSelectFoldersAssertion: FolderAssertion<Folders>;
}>({
  adminPromptDropdownMenuAssertion: async (
    { adminPromptDropdownMenu },
    use,
  ) => {
    const adminPromptDropdownMenuAssertion = new MenuAssertion(
      adminPromptDropdownMenu,
    );
    await use(adminPromptDropdownMenuAssertion);
  },
  adminPromptDropdownMenu: async ({ adminPrompts }, use) => {
    const adminPromptDropdownMenu = adminPrompts.getDropdownMenu();
    await use(adminPromptDropdownMenu);
  },
  adminPublishedPromptPreviewModalAssertion: async (
    { adminPublishedPromptPreviewModal },
    use,
  ) => {
    const adminPublishedPromptPreviewModalAssertion =
      new PublishedPromptPreviewModalAssertion(
        adminPublishedPromptPreviewModal,
      );
    await use(adminPublishedPromptPreviewModalAssertion);
  },
  adminPublishedPromptPreviewModalControlsAssertion: async (
    { adminPublishedPromptPreviewModal },
    use,
  ) => {
    const adminPublishedPromptPreviewModalControlsAssertion =
      new PublicationReviewControlAssertion(
        adminPublishedPromptPreviewModal.getPublicationReviewControl(),
      );
    await use(adminPublishedPromptPreviewModalControlsAssertion);
  },
  adminPublishedApplicationReviewModal: async ({ adminPage }, use) => {
    const adminPublishedApplicationReviewModal =
      new PublishedApplicationReviewModal(adminPage);
    await use(adminPublishedApplicationReviewModal);
  },
  adminPublishedPromptPreviewModal: async ({ adminPage }, use) => {
    const publishedPromptPreviewModal = new PublishedPromptPreviewModal(
      adminPage,
    );
    await use(publishedPromptPreviewModal);
  },
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: stateFilePath(+config.workers! * 3),
    });
    const adminUserPage = await context.newPage();
    await use(adminUserPage);
    await context.close();
  },
  adminLocalStorageManager: async ({ adminPage }, use) => {
    const adminUserLocalStorageManager = new LocalStorageManager(adminPage);
    await use(adminUserLocalStorageManager);
  },
  adminDialHomePage: async ({ adminPage }, use) => {
    const adminDialHomePage = new DialHomePage(adminPage);
    await use(adminDialHomePage);
  },
  adminAppContainer: async ({ adminDialHomePage }, use) => {
    const adminUserAppContainer = adminDialHomePage.getAppContainer();
    await use(adminUserAppContainer);
  },
  adminMarketplacePage: async ({ adminPage }, use) => {
    const adminMarketplacePage = new MarketplacePage(adminPage);
    await use(adminMarketplacePage);
  },
  adminChatBar: async ({ adminAppContainer }, use) => {
    const adminUserChatBar = adminAppContainer.getChatBar();
    await use(adminUserChatBar);
  },
  adminPromptBar: async ({ adminAppContainer }, use) => {
    const adminUserPromptBar = adminAppContainer.getPromptBar();
    await use(adminUserPromptBar);
  },
  adminChat: async ({ adminAppContainer }, use) => {
    const additionalShareUserChat = adminAppContainer.getChat();
    await use(additionalShareUserChat);
  },
  adminMarketplaceContainer: async ({ adminMarketplacePage }, use) => {
    const adminMarketplaceContainer =
      adminMarketplacePage.getMarketplaceContainer();
    await use(adminMarketplaceContainer);
  },
  adminNavigationPanel: async ({ adminAppContainer }, use) => {
    const adminNavigationPanel = adminAppContainer.getNavigationPanel();
    await use(adminNavigationPanel);
  },
  adminMarketplace: async ({ adminMarketplaceContainer }, use) => {
    const adminMarketplace = adminMarketplaceContainer.getMarketplace();
    await use(adminMarketplace);
  },
  adminMarketplaceHeader: async ({ adminMarketplace }, use) => {
    const adminMarketplaceHeader = adminMarketplace.getMarketplaceHeader();
    await use(adminMarketplaceHeader);
  },
  adminMarketplaceAgentsSection: async ({ adminMarketplace }, use) => {
    const adminMarketplaceAgentsSection =
      adminMarketplace.getMarketplaceAgentsSection();
    await use(adminMarketplaceAgentsSection);
  },
  adminMarketplaceAgents: async ({ adminMarketplaceAgentsSection }, use) => {
    const adminMarketplaceAgents = adminMarketplaceAgentsSection.getAgents();
    await use(adminMarketplaceAgents);
  },
  adminConversations: async ({ adminChatBar }, use) => {
    const additionalShareUserConversations =
      adminChatBar.getConversationsTree();
    await use(additionalShareUserConversations);
  },
  adminPrompts: async ({ adminPromptBar }, use) => {
    const additionalShareUserPrompts = adminPromptBar.getPromptsTree();
    await use(additionalShareUserPrompts);
  },
  adminFolderPrompts: async ({ adminPromptBar }, use) => {
    const additionalShareUserFolderPrompts =
      adminPromptBar.getPinnedFolderPrompts();
    await use(additionalShareUserFolderPrompts);
  },
  adminApproveRequiredConversations: async ({ adminChatBar }, use) => {
    const adminApproveRequiredConversations =
      adminChatBar.getApproveRequiredConversationsTree();
    await use(adminApproveRequiredConversations);
  },
  adminApproveRequiredPrompts: async ({ adminPromptBar }, use) => {
    const adminApproveRequiredPrompts =
      adminPromptBar.getApproveRequiredPrompts();
    await use(adminApproveRequiredPrompts);
  },
  adminOrganizationFolderConversations: async ({ adminChatBar }, use) => {
    const adminOrganizationFolderConversations =
      adminChatBar.getOrganizationFolderConversations();
    await use(adminOrganizationFolderConversations);
  },
  adminOrganizationFolderPrompts: async ({ adminPromptBar }, use) => {
    const adminOrganizationFolderPrompts =
      adminPromptBar.getOrganizationFolderPrompts();
    await use(adminOrganizationFolderPrompts);
  },
  adminConversationsToApprove: async (
    { adminPublishingApprovalModal },
    use,
  ) => {
    const adminConversationsToApprove =
      adminPublishingApprovalModal.getConversationsToApproveTree();
    await use(adminConversationsToApprove);
  },
  adminFilesToApprove: async ({ adminPublishingApprovalModal }, use) => {
    const adminFilesToApprove =
      adminPublishingApprovalModal.getFilesToApproveTree();
    await use(adminFilesToApprove);
  },
  adminPromptsToApprove: async ({ adminPublishingApprovalModal }, use) => {
    const adminPromptsToApprove =
      adminPublishingApprovalModal.getPromptsToApproveTree();
    await use(adminPromptsToApprove);
  },
  adminAppsToApprove: async ({ adminPublishingApprovalModal }, use) => {
    const adminAppsToApprove =
      adminPublishingApprovalModal.getApplicationsToApproveTree();
    await use(adminAppsToApprove);
  },
  adminPublishingApprovalModal: async ({ adminPage }, use) => {
    const adminPublishingApprovalModal = new PublishingApprovalModal(adminPage);
    await use(adminPublishingApprovalModal);
  },
  adminPublicationReviewControl: async ({ adminChat }, use) => {
    const adminPublicationReviewControl =
      adminChat.getPublicationReviewControl();
    await use(adminPublicationReviewControl);
  },
  adminChatHeader: async ({ adminChat }, use) => {
    const adminChatHeader = adminChat.getChatHeader();
    await use(adminChatHeader);
  },
  adminChatMessages: async ({ adminChat }, use) => {
    const adminChatMessages = adminChat.getChatMessages();
    await use(adminChatMessages);
  },
  adminOrganizationFolderDropdownMenu: async (
    { adminOrganizationFolderConversations },
    use,
  ) => {
    const adminOrganizationFolderDropdownMenu =
      adminOrganizationFolderConversations.getDropdownMenu();
    await use(adminOrganizationFolderDropdownMenu);
  },
  adminApproveRequiredConversationDropdownMenu: async (
    { adminApproveRequiredConversations },
    use,
  ) => {
    const adminApproveRequiredConversationDropdownMenu =
      adminApproveRequiredConversations.getDropdownMenu();
    await use(adminApproveRequiredConversationDropdownMenu);
  },
  adminApproveRequiredPromptDropdownMenu: async (
    { adminApproveRequiredPrompts },
    use,
  ) => {
    const adminApproveRequiredPromptDropdownMenu =
      adminApproveRequiredPrompts.getDropdownMenu();
    await use(adminApproveRequiredPromptDropdownMenu);
  },
  adminTooltip: async ({ adminPage }, use) => {
    const adminTooltip = new Tooltip(adminPage);
    await use(adminTooltip);
  },
  adminOrganizationConversations: async ({ adminChatBar }, use) => {
    const adminOrganizationConversations =
      adminChatBar.getOrganizationConversationsTree();
    await use(adminOrganizationConversations);
  },
  adminVariableModal: async ({ adminPage }, use) => {
    const adminVariableModal = new VariableModalDialog(adminPage);
    await use(adminVariableModal);
  },
  adminConversationDropdownMenu: async ({ adminConversations }, use) => {
    const adminConversationDropdownMenu = adminConversations.getDropdownMenu();
    await use(adminConversationDropdownMenu);
  },
  adminInformationModal: async ({ adminPage }, use) => {
    const adminInformationModal = new InformationModal(adminPage);
    await use(adminInformationModal);
  },
  adminInformationModalAssertion: async ({ adminInformationModal }, use) => {
    const adminInformationModalAssertion = new InformationModalAssertion(
      adminInformationModal,
    );
    await use(adminInformationModalAssertion);
  },
  adminChatHeaderAssertion: async ({ adminChatHeader }, use) => {
    const adminChatHeaderAssertion = new ChatHeaderAssertion(adminChatHeader);
    await use(adminChatHeaderAssertion);
  },
  adminChatMessagesAssertion: async ({ adminChatMessages }, use) => {
    const adminChatMessagesAssertion = new ChatMessagesAssertion(
      adminChatMessages,
    );
    await use(adminChatMessagesAssertion);
  },
  adminApiInjector: async ({ adminUserItemApiHelper }, use) => {
    const adminApiInjector = new ApiInjector(adminUserItemApiHelper);
    await use(adminApiInjector);
  },
  adminBrowserStorageInjector: async ({ adminLocalStorageManager }, use) => {
    const adminBrowserStorageInjector = new BrowserStorageInjector(
      adminLocalStorageManager,
    );
    await use(adminBrowserStorageInjector);
  },
  adminToast: async ({ adminPage }, use) => {
    const adminToast = new Toast(adminPage);
    await use(adminToast);
  },
  adminShareModal: async ({ adminPage }, use) => {
    const adminShareModal = new ShareModal(adminPage);
    await use(adminShareModal);
  },
  adminPublishingRequestModal: async ({ adminPage }, use) => {
    const adminPublishingRequestModal = new PublishingRequestModal(adminPage);
    await use(adminPublishingRequestModal);
  },
  adminDataInjector: async (
    { adminApiInjector, adminBrowserStorageInjector },
    use,
  ) => {
    const adminDataInjector = isApiStorageType
      ? adminApiInjector
      : adminBrowserStorageInjector;
    await use(adminDataInjector);
  },
  adminPromptsToPublishTree: async ({ adminPublishingRequestModal }, use) => {
    const adminPromptsToPublishTree =
      adminPublishingRequestModal.getPromptsToPublishTree();
    await use(adminPromptsToPublishTree);
  },
  adminApproveRequiredConversationsAssertion: async (
    { adminApproveRequiredConversations },
    use,
  ) => {
    const adminApproveRequiredConversationsAssertion =
      new FolderAssertion<ApproveRequiredConversationsTree>(
        adminApproveRequiredConversations,
      );
    await use(adminApproveRequiredConversationsAssertion);
  },
  adminApproveRequiredPromptsAssertion: async (
    { adminApproveRequiredPrompts },
    use,
  ) => {
    const adminApproveRequiredPromptsAssertion =
      new FolderAssertion<ApproveRequiredPrompts>(adminApproveRequiredPrompts);
    await use(adminApproveRequiredPromptsAssertion);
  },
  adminOrganizationFolderConversationAssertions: async (
    { adminOrganizationFolderConversations },
    use,
  ) => {
    const adminOrganizationFolderConversationAssertions = new FolderAssertion(
      adminOrganizationFolderConversations,
    );
    await use(adminOrganizationFolderConversationAssertions);
  },
  adminOrganizationFolderPromptAssertions: async (
    { adminOrganizationFolderPrompts },
    use,
  ) => {
    const adminOrganizationFolderPromptAssertions = new FolderAssertion(
      adminOrganizationFolderPrompts,
    );
    await use(adminOrganizationFolderPromptAssertions);
  },
  adminPublishingApprovalModalAssertion: async (
    { adminPublishingApprovalModal },
    use,
  ) => {
    const adminPublishingApprovalModalAssertion =
      new PublishingApprovalModalAssertion(adminPublishingApprovalModal);
    await use(adminPublishingApprovalModalAssertion);
  },
  adminConversationToApproveAssertion: async (
    { adminConversationsToApprove },
    use,
  ) => {
    const adminConversationToApproveAssertion =
      new PublishEntityAssertion<ConversationsToApproveTree>(
        adminConversationsToApprove,
      );
    await use(adminConversationToApproveAssertion);
  },
  adminAppToApproveAssertion: async ({ adminAppsToApprove }, use) => {
    const adminAppToApproveAssertion =
      new PublishEntityAssertion<ApplicationsToApproveTree>(adminAppsToApprove);
    await use(adminAppToApproveAssertion);
  },
  adminFilesToApproveAssertion: async ({ adminFilesToApprove }, use) => {
    const adminFilesToApproveAssertion = new PublishFileAssertion(
      adminFilesToApprove,
    );
    await use(adminFilesToApproveAssertion);
  },
  adminPromptToApproveAssertion: async ({ adminPromptsToApprove }, use) => {
    const adminPromptToApproveAssertion =
      new PublishEntityAssertion<PromptsToApproveTree>(adminPromptsToApprove);
    await use(adminPromptToApproveAssertion);
  },
  adminFolderConversationsToApproveAssertion: async (
    { adminPublishingApprovalModal },
    use,
  ) => {
    const adminFolderConversationsToApproveAssertion =
      new PublishFolderAssertion(
        adminPublishingApprovalModal.getFolderConversationsToApprove(),
      );
    await use(adminFolderConversationsToApproveAssertion);
  },
  adminFolderPromptsToApproveAssertion: async (
    { adminPublishingApprovalModal },
    use,
  ) => {
    const adminFolderPromptsToApproveAssertion = new PublishFolderAssertion(
      adminPublishingApprovalModal.getFolderPromptsToApprove(),
    );
    await use(adminFolderPromptsToApproveAssertion);
  },
  adminOrganizationFolderDropdownMenuAssertion: async (
    { adminOrganizationFolderDropdownMenu },
    use,
  ) => {
    const adminOrganizationFolderDropdownMenuAssertion = new MenuAssertion(
      adminOrganizationFolderDropdownMenu,
    );
    await use(adminOrganizationFolderDropdownMenuAssertion);
  },
  adminApproveRequiredConversationDropdownMenuAssertion: async (
    { adminApproveRequiredConversationDropdownMenu },
    use,
  ) => {
    const adminApproveRequiredConversationDropdownMenuAssertion =
      new MenuAssertion(adminApproveRequiredConversationDropdownMenu);
    await use(adminApproveRequiredConversationDropdownMenuAssertion);
  },
  adminTooltipAssertion: async ({ adminTooltip }, use) => {
    const adminTooltipAssertion = new TooltipAssertion(adminTooltip);
    await use(adminTooltipAssertion);
  },
  adminOrganizationConversationAssertion: async (
    { adminOrganizationConversations },
    use,
  ) => {
    const adminOrganizationConversationAssertion =
      new SideBarConversationAssertion<OrganizationConversationsTree>(
        adminOrganizationConversations,
      );
    await use(adminOrganizationConversationAssertion);
  },
  adminVariableModalAssertion: async ({ adminVariableModal }, use) => {
    const adminVariableModalAssertion = new VariableModalAssertion(
      adminVariableModal,
    );
    await use(adminVariableModalAssertion);
  },
  adminConversationAssertion: async ({ adminConversations }, use) => {
    const adminConversationAssertion = new ConversationAssertion(
      adminConversations,
    );
    await use(adminConversationAssertion);
  },
  adminConversationsToPublishTree: async (
    { adminPublishingRequestModal },
    use,
  ) => {
    const adminConversationsToPublishTree =
      adminPublishingRequestModal.getConversationsToPublishTree();
    await use(adminConversationsToPublishTree);
  },
  adminConversationToPublishAssertion: async (
    { adminConversationsToPublishTree },
    use,
  ) => {
    const adminConversationToPublishAssertion =
      new PublishEntityAssertion<ConversationsToPublishTree>(
        adminConversationsToPublishTree,
      );
    await use(adminConversationToPublishAssertion);
  },
  adminPublishedAppReviewModalAssertion: async (
    { adminPublishedApplicationReviewModal },
    use,
  ) => {
    const adminPublishedAppReviewModalAssertion =
      new PublishedAppReviewModalAssertion(
        adminPublishedApplicationReviewModal,
      );
    await use(adminPublishedAppReviewModalAssertion);
  },
  adminPublishedAppReviewModalControlsAssertion: async (
    { adminPublishedApplicationReviewModal },
    use,
  ) => {
    const adminPublishedAppReviewModalControlsAssertion =
      new PublicationReviewControlAssertion(
        adminPublishedApplicationReviewModal.getPublicationReviewControl(),
      );
    await use(adminPublishedAppReviewModalControlsAssertion);
  },
  adminOrganizationPrompts: async ({ adminPromptBar }, use) => {
    const adminOrganizationPrompts =
      adminPromptBar.getOrganizationPromptsTree();
    await use(adminOrganizationPrompts);
  },
  adminOrganizationPromptAssertion: async (
    { adminOrganizationPrompts },
    use,
  ) => {
    const adminOrganizationPromptAssertion =
      new SideBarEntityAssertion<OrganizationPromptsTree>(
        adminOrganizationPrompts,
      );
    await use(adminOrganizationPromptAssertion);
  },
  adminAttachFilesModal: async ({ adminPage }, use) => {
    const adminAttachFilesModal = new AttachFilesModal(adminPage);
    await use(adminAttachFilesModal);
  },
  adminAgentDetailsModal: async ({ adminMarketplaceAgents }, use) => {
    const adminAgentDetailsModal =
      adminMarketplaceAgents.getAgentDetailsModal();
    await use(adminAgentDetailsModal);
  },
  adminManageAttachmentsAssertion: async ({ adminAttachFilesModal }, use) => {
    const adminManageAttachmentsAssertion = new ManageAttachmentsAssertion(
      adminAttachFilesModal,
    );
    await use(adminManageAttachmentsAssertion);
  },
  adminSelectFolderModal: async ({ adminPage }, use) => {
    const adminSelectFolderModal = new SelectFolderModal(adminPage);
    await use(adminSelectFolderModal);
  },
  adminMarketplaceAgentsAssertion: async ({ adminMarketplaceAgents }, use) => {
    const adminMarketplaceAgentsAssertion = new MarketplaceAgentsAssertion(
      adminMarketplaceAgents,
    );
    await use(adminMarketplaceAgentsAssertion);
  },
  adminAgentDetailsModalAssertion: async ({ adminAgentDetailsModal }, use) => {
    const adminAgentDetailsModalAssertion = new AgentDetailsModalAssertion(
      adminAgentDetailsModal,
    );
    await use(adminAgentDetailsModalAssertion);
  },
  adminSelectFoldersAssertion: async ({ adminSelectFolderModal }, use) => {
    const adminSelectFoldersAssertion = new FolderAssertion(
      adminSelectFolderModal.getSelectFolders(),
    );
    await use(adminSelectFoldersAssertion);
  },
});

export default dialAdminTest;
