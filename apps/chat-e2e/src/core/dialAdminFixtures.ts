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
} from '../ui/webElements';

import config from '@/config/chat.playwright.config';
import {
  ChatHeaderAssertion,
  ChatMessagesAssertion,
  MenuAssertion,
  PublishFolderAssertion,
  TooltipAssertion,
} from '@/src/assertions';
import { ConversationToApproveAssertion } from '@/src/assertions/conversationToApproveAssertion';
import { FolderAssertion } from '@/src/assertions/folderAssertion';
import { PublishingApprovalModalAssertion } from '@/src/assertions/publishingApprovalModalAssertion';
import { SideBarEntityAssertion } from '@/src/assertions/sideBarEntityAssertion';
import dialTest, { stateFilePath } from '@/src/core/dialFixtures';
import { LocalStorageManager } from '@/src/core/localStorageManager';
import { AppContainer } from '@/src/ui/webElements/appContainer';
import {
  ApproveRequiredConversationsTree,
  ConversationsToApproveTree,
  ConversationsTree,
  FolderConversationsToApprove,
  FolderPrompts,
  Folders,
  OrganizationConversationsTree,
  PromptsTree,
} from '@/src/ui/webElements/entityTree';
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
  adminOrganizationFolderConversations: Folders;
  adminConversationsToApprove: ConversationsToApproveTree;
  adminPublishingApprovalModal: PublishingApprovalModal;
  adminApproveRequiredConversationsAssertion: FolderAssertion<ApproveRequiredConversationsTree>;
  adminOrganizationFolderConversationAssertions: FolderAssertion<Folders>;
  adminPublishingApprovalModalAssertion: PublishingApprovalModalAssertion;
  adminConversationToApproveAssertion: ConversationToApproveAssertion;
  adminFolderToApproveAssertion: PublishFolderAssertion<FolderConversationsToApprove>;
  adminPublicationReviewControl: PublicationReviewControl;
  adminChatHeader: ChatHeader;
  adminChatMessages: ChatMessages;
  adminOrganizationFolderDropdownMenu: DropdownMenu;
  adminApproveRequiredConversationDropdownMenu: DropdownMenu;
  adminTooltip: Tooltip;
  adminOrganizationConversations: OrganizationConversationsTree;
  adminChatHeaderAssertion: ChatHeaderAssertion<ChatHeader>;
  adminChatMessagesAssertion: ChatMessagesAssertion;
  adminOrganizationFolderDropdownMenuAssertion: MenuAssertion;
  adminApproveRequiredConversationDropdownMenuAssertion: MenuAssertion;
  adminTooltipAssertion: TooltipAssertion;
  adminOrganizationConversationAssertion: SideBarEntityAssertion<OrganizationConversationsTree>;
}>({
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
    const additionalShareUserFolderPrompts = adminPromptBar.getFolderPrompts();
    await use(additionalShareUserFolderPrompts);
  },
  adminApproveRequiredConversations: async ({ adminChatBar }, use) => {
    const adminApproveRequiredConversations =
      adminChatBar.getApproveRequiredConversationsTree();
    await use(adminApproveRequiredConversations);
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
      new ConversationToApproveAssertion(adminConversationsToApprove);
    await use(adminConversationToApproveAssertion);
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
});

export default dialAdminTest;
