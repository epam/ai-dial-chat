import {
  DialHomePage,
  EntityEditorPage,
  FileManagerPage,
  MarketplacePage,
} from '../ui/pages';
import {
  Chat,
  ChatBar,
  ChatHeader,
  ChatMessages,
  ConfirmationDialog,
  ConversationSettingsModal,
  DropdownMenu,
  EntityDetailsModal,
  EntityEditorGeneralForm,
  EntityEditorHeader,
  FileDropArea,
  FileManager,
  FileManagerCollapsibleSidebar,
  FileManagerContainer,
  FileManagerGrid,
  FileManagerModal,
  FileManagerToolbar,
  FoldersTree,
  InformationModal,
  Marketplace,
  MarketplaceContainer,
  MarketplaceEntities,
  MarketplaceHeader,
  ModelInfoTooltip,
  PromptBar,
  PublicationReviewControl,
  PublishedToolsetReviewModal,
  PublishingApprovalModal,
  PublishingRequestDialog,
  PublishingRules,
  QuickApp2EditorContainer,
  QuickApp2EditorViewForm,
  SelectFolderManagerModal,
  SelectFolderModal,
  SendMessage,
  TalkToAgentDialog,
  Toast,
  ToolsetEditorContainer,
  ToolsetEditorViewForm,
  TooltipPortal,
  VariableModalDialog,
} from '../ui/webElements';

import config from '@/config/chat.playwright.config';
import {
  AgentSettingAssertion,
  ChatAssertion,
  ChatHeaderAssertion,
  ChatMessagesAssertion,
  ConversationAssertion,
  ConversationInfoTooltipAssertion,
  EntityEditorGeneralFormAssertion,
  FileManagerGridAssertion,
  FoldersTreeAssertion,
  MenuAssertion,
  PublicationReviewControlAssertion,
  PublishEntityAssertion,
  PublishFileAssertion,
  PublishFolderAssertion,
  PublishedAppReviewModalAssertion,
  PublishedPromptPreviewModalAssertion,
  PublishedToolsetReviewModalAssertion,
  PublishingApprovalModalAssertion,
  PublishingRequestDialogAssertion,
  TalkToAgentDialogAssertion,
  TooltipAssertion,
  TooltipPortalAssertion,
  VariableModalAssertion,
} from '@/src/assertions';
import { InputAttachmentsAssertions } from '@/src/assertions/InputAttachmentsAssertions';
import { EntityDetailsModalAssertion } from '@/src/assertions/entityDetailsModalAssertion';
import { FolderAssertion } from '@/src/assertions/folderAssertion';
import { InformationModalAssertion } from '@/src/assertions/informationModalAssertion';
import { PublishingRulesAssertion } from '@/src/assertions/publishing/publishingRulesAssertion';
import { RenameConversationModalAssertion } from '@/src/assertions/renameConversationModalAssertion';
import { SideBarConversationAssertion } from '@/src/assertions/sideBarConversationAssertion';
import { SideBarEntityAssertion } from '@/src/assertions/sideBarEntityAssertion';
import { ToolsetEditorViewFormAssertion } from '@/src/assertions/toolsetEditorViewFormAssertion';
import dialTest, { stateFilePath } from '@/src/core/dialFixtures';
import { LocalStorageManager } from '@/src/core/localStorageManager';
import { isApiStorageType } from '@/src/hooks/global-setup';
import { ToolsetApiHelper } from '@/src/testData/api';
import { ApiInjector } from '@/src/testData/injector/apiInjector';
import { BrowserStorageInjector } from '@/src/testData/injector/browserStorageInjector';
import { DataInjectorInterface } from '@/src/testData/injector/dataInjectorInterface';
import { AppContainer } from '@/src/ui/webElements/appContainer';
import { ChatSettingsTooltip } from '@/src/ui/webElements/chatSettingsTooltip';
import {
  ApproveRequiredConversationsTree,
  ApproveRequiredPrompts,
  ConversationsTree,
  FolderPrompts,
  Folders,
  OrganizationConversationsTree,
  OrganizationPromptsTree,
  PromptsTree,
  PublishApplicationsTree,
  PublishConversationsTree,
  PublishFolderConversations,
  PublishFolderPrompts,
  PublishPromptsTree,
  PublishToolsetsTree,
} from '@/src/ui/webElements/entityTree';
import { PublishFilesTree } from '@/src/ui/webElements/entityTree/publication/publishFilesTree';
import { InputAttachments } from '@/src/ui/webElements/inputAttachments';
import { MarketplaceEntitiesSection } from '@/src/ui/webElements/marketplace/marketplaceEntitiesSection';
import { NavigationPanel } from '@/src/ui/webElements/navigationPanel';
import { PublishedApplicationReviewModal } from '@/src/ui/webElements/publishedApplicationReviewModal';
import { PublishedPromptPreviewModal } from '@/src/ui/webElements/publishedPromptPreviewModal';
import { RenameConversationModal } from '@/src/ui/webElements/renameConversationModal';
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
  adminFileDropArea: FileDropArea;
  adminChat: Chat;
  adminChatHeaderDropdownMenu: DropdownMenu;
  adminMarketplaceContainer: MarketplaceContainer;
  adminNavigationPanel: NavigationPanel;
  adminMarketplace: Marketplace;
  adminMarketplaceHeader: MarketplaceHeader;
  adminMarketplaceEntitiesSection: MarketplaceEntitiesSection;
  adminMarketplaceEntities: MarketplaceEntities;
  adminFolderPrompts: FolderPrompts;
  adminConversations: ConversationsTree;
  adminPrompts: PromptsTree;
  adminApproveRequiredConversations: ApproveRequiredConversationsTree;
  adminApproveRequiredPrompts: ApproveRequiredPrompts;
  adminOrganizationFolderConversations: Folders;
  adminOrganizationFolderPrompts: Folders;
  adminConversationsToApproveTree: PublishConversationsTree;
  adminFilesToApproveTree: PublishFilesTree;
  adminPromptsToApproveTree: PublishPromptsTree;
  adminAppsToApprove: PublishApplicationsTree;
  adminToolsetsToApprove: PublishToolsetsTree;
  adminPublishingApprovalModal: PublishingApprovalModal;
  adminPublishedPromptPreviewModal: PublishedPromptPreviewModal;
  adminApiInjector: ApiInjector;
  adminBrowserStorageInjector: BrowserStorageInjector;
  adminDataInjector: DataInjectorInterface;
  adminPublishingRequestDialog: PublishingRequestDialog;
  adminToast: Toast;
  adminShareModal: ShareModal;
  adminEntityEditorPage: EntityEditorPage;
  adminToolsetEditorContainer: ToolsetEditorContainer;
  adminToolsetEditorViewForm: ToolsetEditorViewForm;
  adminQuickApp2EditorContainer: QuickApp2EditorContainer;
  adminQuickApp2EditorViewForm: QuickApp2EditorViewForm;
  adminEntityEditorGeneralForm: EntityEditorGeneralForm;
  adminEntityEditorHeader: EntityEditorHeader;
  adminApproveRequiredConversationsAssertion: FolderAssertion<ApproveRequiredConversationsTree>;
  adminApproveRequiredPromptsAssertion: FolderAssertion<ApproveRequiredPrompts>;
  adminOrganizationFolderConversationAssertions: FolderAssertion<Folders>;
  adminOrganizationFolderPromptAssertions: FolderAssertion<Folders>;
  adminPublishingApprovalModalAssertion: PublishingApprovalModalAssertion;
  adminAppToApproveAssertion: PublishEntityAssertion<PublishApplicationsTree>;
  adminToolsetToApproveAssertion: PublishEntityAssertion<PublishToolsetsTree>;
  adminPublishFilesAssertion: PublishFileAssertion<PublishFilesTree>;
  adminPublishPromptsTreeAssertion: PublishEntityAssertion<PublishPromptsTree>;
  adminFolderConversationsToApproveAssertion: PublishFolderAssertion<PublishFolderConversations>;
  adminFolderPromptsToApproveAssertion: PublishFolderAssertion<PublishFolderPrompts>;
  adminPromptDropdownMenuAssertion: MenuAssertion;
  adminPromptDropdownMenu: DropdownMenu;
  adminPublicationReviewControl: PublicationReviewControl;
  adminChatHeader: ChatHeader;
  adminChatMessages: ChatMessages;
  adminOrganizationFolderDropdownMenu: DropdownMenu;
  adminApproveRequiredConversationDropdownMenu: DropdownMenu;
  adminApproveRequiredPromptDropdownMenu: DropdownMenu;
  adminTooltip: Tooltip;
  adminTooltipPortal: TooltipPortal;
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
  adminTooltipPortalAssertion: TooltipPortalAssertion;
  adminOrganizationConversationAssertion: SideBarConversationAssertion<OrganizationConversationsTree>;
  adminPublishedPromptPreviewModalAssertion: PublishedPromptPreviewModalAssertion;
  adminPublishedPromptPreviewModalControlsAssertion: PublicationReviewControlAssertion;
  adminVariableModalAssertion: VariableModalAssertion;
  adminConversationAssertion: ConversationAssertion;
  adminPublishConversationsTreeAssertion: PublishEntityAssertion<PublishConversationsTree>;
  adminPublishedApplicationReviewModal: PublishedApplicationReviewModal;
  adminPublishedToolsetReviewModal: PublishedToolsetReviewModal;
  adminPublishedAppReviewModalAssertion: PublishedAppReviewModalAssertion;
  adminPublishedToolsetReviewModalAssertion: PublishedToolsetReviewModalAssertion;
  adminPublishedAppReviewModalControlsAssertion: PublicationReviewControlAssertion;
  adminPublishedToolsetReviewModalControlsAssertion: PublicationReviewControlAssertion;
  adminOrganizationPrompts: OrganizationPromptsTree;
  adminOrganizationPromptAssertion: SideBarEntityAssertion<OrganizationPromptsTree>;
  adminFileManagerPage: FileManagerPage;
  adminFileManagerContainer: FileManagerContainer;
  adminFileManager: FileManager;
  adminFileManagerToolbar: FileManagerToolbar;
  adminFileManagerGrid: FileManagerGrid;
  adminFileManagerGridAssertion: FileManagerGridAssertion;
  adminFileManagerModal: FileManagerModal;
  adminFileManagerModalManager: FileManager;
  adminFileManagerModalGrid: FileManagerGrid;
  adminEntityDetailsModal: EntityDetailsModal;
  adminSelectFolderModal: SelectFolderModal;
  adminSelectFolderManagerModal: SelectFolderManagerModal;
  adminSelectFolderManagerModalManager: FileManager;
  adminSelectFolderManagerModalCollapsibleSidebar: FileManagerCollapsibleSidebar;
  adminSelectFolderManagerModalFoldersTree: FoldersTree;
  adminSelectFolderManagerModalFoldersTreeAssertion: FoldersTreeAssertion;
  adminSelectFolderManagerModalGrid: FileManagerGrid;
  adminSelectFolderManagerModalGridAssertion: FileManagerGridAssertion;
  adminAppsToPublishTree: PublishApplicationsTree;
  adminPublishingRules: PublishingRules;
  adminEntityDetailsModalAssertion: EntityDetailsModalAssertion;
  adminSelectFoldersAssertion: FolderAssertion<Folders>;
  adminPublishingRequestDialogAssertion: PublishingRequestDialogAssertion;
  adminAppToPublishAssertion: PublishEntityAssertion<PublishApplicationsTree>;
  adminPublishingRulesAssertion: PublishingRulesAssertion;
  adminConversationSettings: ConversationSettingsModal;
  adminTalkToAgentDialog: TalkToAgentDialog;
  adminEntitySettingsAssertion: AgentSettingAssertion;
  adminSendMessage: SendMessage;
  adminConfirmationDialog: ConfirmationDialog;
  adminChatAssertion: ChatAssertion;
  adminAttachmentDropdownMenu: DropdownMenu;
  adminSendMessageInputAttachments: InputAttachments;
  adminSendMessageInputAttachmentsAssertions: InputAttachmentsAssertions;
  adminInputAttachments: InputAttachments;
  adminInputAttachmentsAssertions: InputAttachmentsAssertions;
  adminConversationInfoTooltipAssertion: ConversationInfoTooltipAssertion;
  adminModelInfoTooltip: ModelInfoTooltip;
  adminChatSettingsTooltip: ChatSettingsTooltip;
  adminConversationDropdownMenuAssertion: MenuAssertion;
  adminTalkToAgentDialogAssertion: TalkToAgentDialogAssertion;
  adminRenameConversationModal: RenameConversationModal;
  adminRenameConversationModalAssertion: RenameConversationModalAssertion;
  adminToolsetEditorViewFormAssertion: ToolsetEditorViewFormAssertion;
  adminEntityEditorGeneralFormAssertion: EntityEditorGeneralFormAssertion;
}>({
  adminRenameConversationModal: async ({ adminPage }, use) => {
    const adminRenameConversationModal = new RenameConversationModal(adminPage);
    await use(adminRenameConversationModal);
  },
  adminRenameConversationModalAssertion: async (
    { adminRenameConversationModal },
    use,
  ) => {
    const adminRenameConversationModalAssertion =
      new RenameConversationModalAssertion(adminRenameConversationModal);
    await use(adminRenameConversationModalAssertion);
  },
  adminToolsetEditorViewFormAssertion: async (
    { adminToolsetEditorViewForm },
    use,
  ) => {
    const adminToolsetEditorViewFormAssertion =
      new ToolsetEditorViewFormAssertion(adminToolsetEditorViewForm);
    await use(adminToolsetEditorViewFormAssertion);
  },
  adminEntityEditorGeneralForm: async ({ adminEntityEditorPage }, use) => {
    const adminEntityEditorGeneralForm =
      adminEntityEditorPage.getEntityEditorGeneralForm();
    await use(adminEntityEditorGeneralForm);
  },
  adminEntityEditorHeader: async ({ adminEntityEditorPage }, use) => {
    const adminEntityEditorHeader =
      adminEntityEditorPage.getEntityEditorHeader();
    await use(adminEntityEditorHeader);
  },
  adminChatSettingsTooltip: async ({ adminPage }, use) => {
    const chatSettingsTooltip = new ChatSettingsTooltip(adminPage);
    await use(chatSettingsTooltip);
  },
  adminModelInfoTooltip: async ({ adminPage }, use) => {
    const adminModelInfoTooltip = new ModelInfoTooltip(adminPage);
    await use(adminModelInfoTooltip);
  },
  adminConversationInfoTooltipAssertion: async (
    { adminModelInfoTooltip },
    use,
  ) => {
    const adminConversationInfoTooltipAssertion =
      new ConversationInfoTooltipAssertion(adminModelInfoTooltip);
    await use(adminConversationInfoTooltipAssertion);
  },
  adminEntityEditorGeneralFormAssertion: async (
    { adminEntityEditorGeneralForm },
    use,
  ) => {
    const adminEntityEditorGeneralFormAssertion =
      new EntityEditorGeneralFormAssertion(adminEntityEditorGeneralForm);
    await use(adminEntityEditorGeneralFormAssertion);
  },
  adminInputAttachments: async ({ adminChatMessages }, use) => {
    const adminInputAttachments = adminChatMessages.getInputAttachments();
    await use(adminInputAttachments);
  },
  adminInputAttachmentsAssertions: async ({ adminInputAttachments }, use) => {
    const adminInputAttachmentsAssertions = new InputAttachmentsAssertions(
      adminInputAttachments,
    );
    await use(adminInputAttachmentsAssertions);
  },
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
  adminPublishedToolsetReviewModal: async ({ adminPage }, use) => {
    const adminPublishedToolsetReviewModal = new PublishedToolsetReviewModal(
      adminPage,
    );
    await use(adminPublishedToolsetReviewModal);
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
  adminFileDropArea: async ({ adminAppContainer }, use) => {
    const adminFileDropArea = adminAppContainer.getFileDropArea();
    await use(adminFileDropArea);
  },
  adminChat: async ({ adminFileDropArea }, use) => {
    await use(adminFileDropArea.getChat());
  },
  adminChatHeaderDropdownMenu: async ({ adminPage }, use) => {
    const adminChatHeaderDropdownMenu = new DropdownMenu(adminPage);
    await use(adminChatHeaderDropdownMenu);
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
  adminMarketplaceEntitiesSection: async ({ adminMarketplace }, use) => {
    const adminMarketplaceEntitiesSection =
      adminMarketplace.getMarketplaceEntitiesSection();
    await use(adminMarketplaceEntitiesSection);
  },
  adminMarketplaceEntities: async (
    { adminMarketplaceEntitiesSection },
    use,
  ) => {
    const adminMarketplaceEntities =
      adminMarketplaceEntitiesSection.getEntities();
    await use(adminMarketplaceEntities);
  },
  adminConversations: async ({ adminChatBar }, use) => {
    await use(adminChatBar.getConversationsTree());
  },
  adminPrompts: async ({ adminPromptBar }, use) => {
    await use(adminPromptBar.getPromptsTree());
  },
  adminFolderPrompts: async ({ adminPromptBar }, use) => {
    await use(adminPromptBar.getPinnedFolderPrompts());
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
  adminConversationsToApproveTree: async (
    { adminPublishingApprovalModal },
    use,
  ) => {
    const adminConversationsToApproveTree =
      adminPublishingApprovalModal.getConversationsToApproveTree();
    await use(adminConversationsToApproveTree);
  },
  adminFilesToApproveTree: async ({ adminPublishingApprovalModal }, use) => {
    const adminFilesToApproveTree =
      adminPublishingApprovalModal.getFilesToApproveTree();
    await use(adminFilesToApproveTree);
  },
  adminPromptsToApproveTree: async ({ adminPublishingApprovalModal }, use) => {
    const adminPromptsToApproveTree =
      adminPublishingApprovalModal.getPromptsToApproveTree();
    await use(adminPromptsToApproveTree);
  },
  adminAppsToApprove: async ({ adminPublishingApprovalModal }, use) => {
    const adminAppsToApprove =
      adminPublishingApprovalModal.getApplicationsToApproveTree();
    await use(adminAppsToApprove);
  },
  adminToolsetsToApprove: async ({ adminPublishingApprovalModal }, use) => {
    const adminToolsetsToApprove =
      adminPublishingApprovalModal.getToolsetToApproveTree();
    await use(adminToolsetsToApprove);
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
  adminTooltipPortal: async ({ adminPage }, use) => {
    const adminTooltipPortal = new TooltipPortal(adminPage);
    await use(adminTooltipPortal);
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
  adminToolsetApiHelper: async ({ adminUserRequestContext }, use) => {
    const adminToolsetApiHelper = new ToolsetApiHelper(adminUserRequestContext);
    await use(adminToolsetApiHelper);
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
  adminPublishingRequestDialog: async ({ adminPage }, use) => {
    const adminPublishingRequestDialog = new PublishingRequestDialog(adminPage);
    await use(adminPublishingRequestDialog);
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
  adminEntityEditorPage: async ({ adminPage }, use) => {
    const adminEntityEditorPage = new EntityEditorPage(adminPage);
    await use(adminEntityEditorPage);
  },
  adminToolsetEditorContainer: async ({ adminEntityEditorPage }, use) => {
    const adminToolsetEditorContainer =
      adminEntityEditorPage.getToolsetEditorContainer();
    await use(adminToolsetEditorContainer);
  },
  adminToolsetEditorViewForm: async ({ adminToolsetEditorContainer }, use) => {
    const adminToolsetEditorViewForm =
      adminToolsetEditorContainer.getEntityEditorViewForm();
    await use(adminToolsetEditorViewForm);
  },
  adminQuickApp2EditorContainer: async ({ adminEntityEditorPage }, use) => {
    const adminQuickApp2EditorContainer =
      adminEntityEditorPage.getQuickApp2EditorContainer();
    await use(adminQuickApp2EditorContainer);
  },
  adminQuickApp2EditorViewForm: async (
    { adminQuickApp2EditorContainer },
    use,
  ) => {
    const adminQuickApp2EditorViewForm =
      adminQuickApp2EditorContainer.getEntityEditorViewForm();
    await use(adminQuickApp2EditorViewForm);
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
  adminAppToApproveAssertion: async ({ adminAppsToApprove }, use) => {
    const adminAppToApproveAssertion =
      new PublishEntityAssertion<PublishApplicationsTree>(adminAppsToApprove);
    await use(adminAppToApproveAssertion);
  },
  adminToolsetToApproveAssertion: async ({ adminToolsetsToApprove }, use) => {
    const adminToolsetToApproveAssertion =
      new PublishEntityAssertion<PublishToolsetsTree>(adminToolsetsToApprove);
    await use(adminToolsetToApproveAssertion);
  },
  adminPublishFilesAssertion: async ({ adminFilesToApproveTree }, use) => {
    const adminPublishFilesAssertion = new PublishFileAssertion(
      adminFilesToApproveTree,
    );
    await use(adminPublishFilesAssertion);
  },
  adminPublishPromptsTreeAssertion: async (
    { adminPromptsToApproveTree },
    use,
  ) => {
    const adminPublishPromptsTreeAssertion =
      new PublishEntityAssertion<PublishPromptsTree>(adminPromptsToApproveTree);
    await use(adminPublishPromptsTreeAssertion);
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
  adminTooltipPortalAssertion: async ({ adminTooltipPortal }, use) => {
    const adminTooltipPortalAssertion = new TooltipPortalAssertion(
      adminTooltipPortal,
    );
    await use(adminTooltipPortalAssertion);
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
  adminPublishConversationsTreeAssertion: async (
    { adminConversationsToApproveTree },
    use,
  ) => {
    const adminPublishConversationsTreeAssertion =
      new PublishEntityAssertion<PublishConversationsTree>(
        adminConversationsToApproveTree,
      );
    await use(adminPublishConversationsTreeAssertion);
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
  adminPublishedToolsetReviewModalAssertion: async (
    { adminPublishedToolsetReviewModal },
    use,
  ) => {
    const adminPublishedToolsetReviewModalAssertion =
      new PublishedToolsetReviewModalAssertion(
        adminPublishedToolsetReviewModal,
      );
    await use(adminPublishedToolsetReviewModalAssertion);
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
  adminPublishedToolsetReviewModalControlsAssertion: async (
    { adminPublishedToolsetReviewModal },
    use,
  ) => {
    const adminPublishedToolsetReviewModalControlsAssertion =
      new PublicationReviewControlAssertion(
        adminPublishedToolsetReviewModal.getPublicationReviewControl(),
      );
    await use(adminPublishedToolsetReviewModalControlsAssertion);
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
  adminFileManagerPage: async ({ adminPage }, use) => {
    const adminFileManagerPage = new FileManagerPage(adminPage);
    await use(adminFileManagerPage);
  },
  adminFileManagerContainer: async ({ adminFileManagerPage }, use) => {
    const adminFileManagerContainer =
      adminFileManagerPage.getFileManagerContainer();
    await use(adminFileManagerContainer);
  },
  adminFileManager: async ({ adminFileManagerContainer }, use) => {
    const adminFileManager = adminFileManagerContainer.getFileManager();
    await use(adminFileManager);
  },
  adminFileManagerToolbar: async ({ adminFileManager }, use) => {
    const adminFileManagerToolbar = adminFileManager.getFileManagerToolbar();
    await use(adminFileManagerToolbar);
  },
  adminFileManagerGrid: async ({ adminFileManager }, use) => {
    const adminFileManagerGrid = adminFileManager.getFileManagerGrid();
    await use(adminFileManagerGrid);
  },
  adminFileManagerGridAssertion: async ({ adminFileManagerGrid }, use) => {
    const adminFileManagerGridAssertion = new FileManagerGridAssertion(
      adminFileManagerGrid,
    );
    await use(adminFileManagerGridAssertion);
  },
  adminFileManagerModal: async ({ adminPage }, use) => {
    const adminFileManagerModal = new FileManagerModal(adminPage);
    await use(adminFileManagerModal);
  },
  adminFileManagerModalManager: async ({ adminFileManagerModal }, use) => {
    const adminFileManagerModalManager = adminFileManagerModal.getFileManager();
    await use(adminFileManagerModalManager);
  },
  adminFileManagerModalGrid: async ({ adminFileManagerModalManager }, use) => {
    const adminFileManagerModalGrid =
      adminFileManagerModalManager.getFileManagerGrid();
    await use(adminFileManagerModalGrid);
  },
  adminEntityDetailsModal: async ({ adminMarketplaceEntities }, use) => {
    const adminEntityDetailsModal =
      adminMarketplaceEntities.getEntityDetailsModal();
    await use(adminEntityDetailsModal);
  },
  adminAppsToPublishTree: async ({ adminPublishingRequestDialog }, use) => {
    const adminAppsToPublishTree =
      adminPublishingRequestDialog.getApplicationsToPublishTree();
    await use(adminAppsToPublishTree);
  },
  adminPublishingRules: async ({ adminPublishingApprovalModal }, use) => {
    const adminPublishingRules =
      adminPublishingApprovalModal.getPublishingRules();
    await use(adminPublishingRules);
  },
  adminSelectFolderModal: async ({ adminPage }, use) => {
    const adminSelectFolderModal = new SelectFolderModal(adminPage);
    await use(adminSelectFolderModal);
  },
  adminSelectFolderManagerModal: async ({ adminPage }, use) => {
    const adminSelectFolderManagerModal = new SelectFolderManagerModal(
      adminPage,
    );
    await use(adminSelectFolderManagerModal);
  },
  adminSelectFolderManagerModalManager: async (
    { adminSelectFolderManagerModal },
    use,
  ) => {
    const adminSelectFolderManagerModalManager =
      adminSelectFolderManagerModal.getFileManager();
    await use(adminSelectFolderManagerModalManager);
  },
  adminSelectFolderManagerModalCollapsibleSidebar: async (
    { adminSelectFolderManagerModalManager },
    use,
  ) => {
    const adminSelectFolderManagerModalCollapsibleSidebar =
      adminSelectFolderManagerModalManager.getFileManagerCollapsibleSidebar();
    await use(adminSelectFolderManagerModalCollapsibleSidebar);
  },
  adminSelectFolderManagerModalFoldersTree: async (
    { adminSelectFolderManagerModalCollapsibleSidebar },
    use,
  ) => {
    const adminSelectFolderManagerModalFoldersTree =
      adminSelectFolderManagerModalCollapsibleSidebar.getFoldersTree();
    await use(adminSelectFolderManagerModalFoldersTree);
  },
  adminSelectFolderManagerModalFoldersTreeAssertion: async (
    { adminSelectFolderManagerModalFoldersTree },
    use,
  ) => {
    const adminSelectFolderManagerModalFoldersTreeAssertion =
      new FoldersTreeAssertion(adminSelectFolderManagerModalFoldersTree);
    await use(adminSelectFolderManagerModalFoldersTreeAssertion);
  },
  adminSelectFolderManagerModalGrid: async (
    { adminSelectFolderManagerModalManager },
    use,
  ) => {
    const adminSelectFolderManagerModalGrid =
      adminSelectFolderManagerModalManager.getFileManagerGrid();
    await use(adminSelectFolderManagerModalGrid);
  },
  adminSelectFolderManagerModalGridAssertion: async (
    { adminSelectFolderManagerModalGrid },
    use,
  ) => {
    const adminSelectFolderManagerModalGridAssertion =
      new FileManagerGridAssertion(adminSelectFolderManagerModalGrid);
    await use(adminSelectFolderManagerModalGridAssertion);
  },
  adminEntityDetailsModalAssertion: async (
    { adminEntityDetailsModal },
    use,
  ) => {
    const adminEntityDetailsModalAssertion = new EntityDetailsModalAssertion(
      adminEntityDetailsModal,
    );
    await use(adminEntityDetailsModalAssertion);
  },
  adminSelectFoldersAssertion: async ({ adminSelectFolderModal }, use) => {
    const adminSelectFoldersAssertion = new FolderAssertion(
      adminSelectFolderModal.getSelectFolders(),
    );
    await use(adminSelectFoldersAssertion);
  },
  adminPublishingRequestDialogAssertion: async (
    { adminPublishingRequestDialog },
    use,
  ) => {
    const adminPublishingRequestDialogAssertion =
      new PublishingRequestDialogAssertion(adminPublishingRequestDialog);
    await use(adminPublishingRequestDialogAssertion);
  },
  adminAppToPublishAssertion: async ({ adminAppsToPublishTree }, use) => {
    const adminAppToPublishAssertion =
      new PublishEntityAssertion<PublishApplicationsTree>(
        adminAppsToPublishTree,
      );
    await use(adminAppToPublishAssertion);
  },
  adminPublishingRulesAssertion: async ({ adminPublishingRules }, use) => {
    const adminPublishingRulesAssertion = new PublishingRulesAssertion(
      adminPublishingRules,
    );
    await use(adminPublishingRulesAssertion);
  },
  adminConversationSettings: async ({ adminPage }, use) => {
    const adminConversationSettings = new ConversationSettingsModal(adminPage);
    await use(adminConversationSettings);
  },
  adminTalkToAgentDialog: async ({ adminPage }, use) => {
    const adminTalkToAgentDialog = new TalkToAgentDialog(adminPage);
    await use(adminTalkToAgentDialog);
  },
  adminEntitySettingsAssertion: async ({ adminConversationSettings }, use) => {
    const adminEntitySettingsAssertion = new AgentSettingAssertion(
      adminConversationSettings.getAgentSettings(),
    );
    await use(adminEntitySettingsAssertion);
  },
  adminSendMessage: async ({ adminChat }, use) => {
    const adminSendMessage = adminChat.getSendMessage();
    await use(adminSendMessage);
  },
  adminConfirmationDialog: async ({ adminPage }, use) => {
    const adminConfirmationDialog = new ConfirmationDialog(adminPage);
    await use(adminConfirmationDialog);
  },
  adminChatAssertion: async ({ adminChat }, use) => {
    const adminChatAssertion = new ChatAssertion(adminChat);
    await use(adminChatAssertion);
  },
  adminAttachmentDropdownMenu: async ({ adminSendMessage }, use) => {
    const adminAttachmentDropdownMenu = adminSendMessage.getDropdownMenu();
    await use(adminAttachmentDropdownMenu);
  },
  adminSendMessageInputAttachments: async ({ adminSendMessage }, use) => {
    const adminSendMessageInputAttachments =
      adminSendMessage.getInputAttachments();
    await use(adminSendMessageInputAttachments);
  },
  adminSendMessageInputAttachmentsAssertions: async (
    {
      adminSendMessageInputAttachments,
    }: { adminSendMessageInputAttachments: InputAttachments },
    use: (value: InputAttachmentsAssertions) => Promise<void>,
  ) => {
    const adminSendMessageInputAttachmentsAssertions =
      new InputAttachmentsAssertions(adminSendMessageInputAttachments);
    await use(adminSendMessageInputAttachmentsAssertions);
  },
  adminConversationDropdownMenuAssertion: async (
    { adminConversationDropdownMenu },
    use,
  ) => {
    const adminConversationDropdownMenuAssertion = new MenuAssertion(
      adminConversationDropdownMenu,
    );
    await use(adminConversationDropdownMenuAssertion);
  },
  adminTalkToAgentDialogAssertion: async ({ adminTalkToAgentDialog }, use) => {
    const adminTalkToAgentDialogAssertion = new TalkToAgentDialogAssertion(
      adminTalkToAgentDialog,
    );
    await use(adminTalkToAgentDialogAssertion);
  },
});

export default dialAdminTest;
