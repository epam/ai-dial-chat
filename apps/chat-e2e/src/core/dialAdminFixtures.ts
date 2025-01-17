import { DialHomePage } from '../ui/pages';
import {
  Chat,
  ChatBar,
  ChatHeader,
  ChatMessages,
  DropdownMenu,
  PromptBar,
  PublicationReviewControl,
  PublishingApprovalModal,
  PublishingRequestModal,
  VariableModalDialog,
} from '../ui/webElements';

import config from '@/config/chat.playwright.config';
import {
  ChatHeaderAssertion,
  ChatMessagesAssertion,
  ConversationAssertion,
  EntityTreeAssertion,
  MenuAssertion,
  PublishEntityAssertion,
  PublishFolderAssertion,
  TooltipAssertion,
  VariableModalAssertion,
} from '@/src/assertions';
import { FolderAssertion } from '@/src/assertions/folderAssertion';
import { PublishedPromptPreviewModalAssertion } from '@/src/assertions/publishing/publishedPromptPreviewModalAssertion';
import { PublishingApprovalModalAssertion } from '@/src/assertions/publishing/publishingApprovalModalAssertion';
import { SideBarEntityAssertion } from '@/src/assertions/sideBarEntityAssertion';
import dialTest, { stateFilePath } from '@/src/core/dialFixtures';
import { LocalStorageManager } from '@/src/core/localStorageManager';
import { isApiStorageType } from '@/src/hooks/global-setup';
import { ApiInjector } from '@/src/testData/injector/apiInjector';
import { BrowserStorageInjector } from '@/src/testData/injector/browserStorageInjector';
import { DataInjectorInterface } from '@/src/testData/injector/dataInjectorInterface';
import { AppContainer } from '@/src/ui/webElements/appContainer';
import {
  ApproveRequiredConversationsTree,
  ApproveRequiredPrompts,
  ConversationsToApproveTree,
  ConversationsToPublishTree,
  ConversationsTree,
  FilesToApproveTree,
  FolderConversationsToApprove,
  FolderPrompts,
  Folders,
  OrganizationConversationsTree,
  PromptsToApproveTree,
  PromptsTree,
} from '@/src/ui/webElements/entityTree';
import { PublishedPromptPreviewModal } from '@/src/ui/webElements/publishedPromptPreviewModal';
import { Tooltip } from '@/src/ui/webElements/tooltip';
import { Page } from '@playwright/test';

const dialAdminTest = dialTest.extend<{
  adminLocalStorageManager: LocalStorageManager;
  adminPage: Page;
  adminDialHomePage: DialHomePage;
  adminAppContainer: AppContainer;
  adminChatBar: ChatBar;
  adminPromptBar: PromptBar;
  adminChat: Chat;
  adminFolderPrompts: FolderPrompts;
  adminConversations: ConversationsTree;
  adminPrompts: PromptsTree;
  adminApproveRequiredConversations: ApproveRequiredConversationsTree;
  adminApproveRequiredPrompts: ApproveRequiredPrompts;
  adminOrganizationFolderConversations: Folders;
  adminConversationsToApprove: ConversationsToApproveTree;
  adminFilesToApprove: FilesToApproveTree;
  adminPromptsToApprove: PromptsToApproveTree;
  adminPublishingApprovalModal: PublishingApprovalModal;
  adminPublishedPromptPreviewModal: PublishedPromptPreviewModal;
  adminApiInjector: ApiInjector;
  adminBrowserStorageInjector: BrowserStorageInjector;
  adminDataInjector: DataInjectorInterface;
  adminPublishingRequestModal: PublishingRequestModal;
  adminApproveRequiredConversationsAssertion: FolderAssertion<ApproveRequiredConversationsTree>;
  adminApproveRequiredPromptsAssertion: FolderAssertion<ApproveRequiredPrompts>;
  adminOrganizationFolderConversationAssertions: FolderAssertion<Folders>;
  adminPublishingApprovalModalAssertion: PublishingApprovalModalAssertion;
  adminConversationToApproveAssertion: PublishEntityAssertion<ConversationsToApproveTree>;
  adminFilesToApproveAssertion: EntityTreeAssertion<FilesToApproveTree>;
  adminPromptToApproveAssertion: PublishEntityAssertion<PromptsToApproveTree>;
  adminFolderToApproveAssertion: PublishFolderAssertion<FolderConversationsToApprove>;
  adminPublicationReviewControl: PublicationReviewControl;
  adminChatHeader: ChatHeader;
  adminChatMessages: ChatMessages;
  adminOrganizationFolderDropdownMenu: DropdownMenu;
  adminApproveRequiredConversationDropdownMenu: DropdownMenu;
  adminTooltip: Tooltip;
  adminOrganizationConversations: OrganizationConversationsTree;
  adminVariableModal: VariableModalDialog;
  adminConversationDropdownMenu: DropdownMenu;
  adminChatHeaderAssertion: ChatHeaderAssertion<ChatHeader>;
  adminChatMessagesAssertion: ChatMessagesAssertion;
  adminOrganizationFolderDropdownMenuAssertion: MenuAssertion;
  adminApproveRequiredConversationDropdownMenuAssertion: MenuAssertion;
  adminTooltipAssertion: TooltipAssertion;
  adminOrganizationConversationAssertion: SideBarEntityAssertion<OrganizationConversationsTree>;
  adminPublishedPromptPreviewModalAssertion: PublishedPromptPreviewModalAssertion;
  adminVariableModalAssertion: VariableModalAssertion;
  adminConversationAssertion: ConversationAssertion;
  adminConversationsToPublishTree: ConversationsToPublishTree;
  adminConversationToPublishAssertion: PublishEntityAssertion<ConversationsToPublishTree>;
}>({
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
  adminFilesToApproveAssertion: async ({ adminFilesToApprove }, use) => {
    const adminFilesToApproveAssertion = new EntityTreeAssertion(
      adminFilesToApprove,
    );
    await use(adminFilesToApproveAssertion);
  },
  adminPromptToApproveAssertion: async ({ adminPromptsToApprove }, use) => {
    const adminPromptToApproveAssertion =
      new PublishEntityAssertion<PromptsToApproveTree>(adminPromptsToApprove);
    await use(adminPromptToApproveAssertion);
  },
  adminFolderToApproveAssertion: async (
    { adminPublishingApprovalModal },
    use,
  ) => {
    const adminFolderToApproveAssertion = new PublishFolderAssertion(
      adminPublishingApprovalModal.getFolderConversationsToApprove(),
    );
    await use(adminFolderToApproveAssertion);
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
      new SideBarEntityAssertion<OrganizationConversationsTree>(
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
});

export default dialAdminTest;
