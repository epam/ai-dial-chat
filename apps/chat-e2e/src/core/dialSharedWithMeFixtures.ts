import { DialHomePage } from '../ui/pages';
import {
  Chat,
  ChatBar,
  ChatHeader,
  ChatInfoTooltip,
  ChatMessages,
  Compare,
  ConfirmationDialog,
  ConversationToCompare,
  Conversations,
  DropdownMenu,
  ErrorToast,
  ModelSelector,
} from '../ui/webElements';

import config from '@/config/chat.playwright.config';
import dialTest, { stateFilePath } from '@/src/core/dialFixtures';
import { LocalStorageManager } from '@/src/core/localStorageManager';
import { AppContainer } from '@/src/ui/webElements/appContainer';
import { ChatNotFound } from '@/src/ui/webElements/chatNotFound';
import { PlaybackControl } from '@/src/ui/webElements/playbackControl';
import { SharedFolderConversations } from '@/src/ui/webElements/sharedFolderConversations';
import { SharedWithMeConversations } from '@/src/ui/webElements/sharedWithMeConversations';
import { BucketUtil } from '@/src/utils';
import { Page } from '@playwright/test';

const dialSharedWithMeTest = dialTest.extend<{
  additionalShareUserLocalStorageManager: LocalStorageManager;
  additionalShareUserPage: Page;
  additionalShareUserDialHomePage: DialHomePage;
  additionalShareUserAppContainer: AppContainer;
  additionalShareUserChatBar: ChatBar;
  additionalShareUserSharedWithMeConversations: SharedWithMeConversations;
  additionalShareUserSharedFolderConversations: SharedFolderConversations;
  additionalShareUserChat: Chat;
  additionalShareUserChatHeader: ChatHeader;
  additionalShareUserChatMessages: ChatMessages;
  additionalShareUserChatInfoTooltip: ChatInfoTooltip;
  additionalShareUserSharedWithMeFolderDropdownMenu: DropdownMenu;
  additionalShareUserSharedWithMeConversationDropdownMenu: DropdownMenu;
  additionalShareUserConversations: Conversations;
  additionalShareUserCompare: Compare;
  additionalShareUserCompareConversation: ConversationToCompare;
  additionalShareUserCompareConversationSelector: ModelSelector;
  additionalShareUserNotFound: ChatNotFound;
  additionalShareUserConfirmationDialog: ConfirmationDialog;
  additionalShareUserPlaybackControl: PlaybackControl;
  additionalShareUserErrorToast: ErrorToast;
}>({
  additionalShareUserPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: stateFilePath(+config.workers!),
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
  additionalShareUserSharedWithMeConversations: async (
    { additionalShareUserChatBar },
    use,
  ) => {
    const additionalShareUserSharedWithMeConversations =
      additionalShareUserChatBar.getSharedWithMeConversations();
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
  additionalShareUserChat: async ({ additionalShareUserAppContainer }, use) => {
    const additionalShareUserChat = additionalShareUserAppContainer.getChat();
    await use(additionalShareUserChat);
  },
  additionalShareUserConversations: async (
    { additionalShareUserChatBar },
    use,
  ) => {
    const additionalShareUserConversations =
      additionalShareUserChatBar.getConversations();
    await use(additionalShareUserConversations);
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
  additionalShareUserCompareConversationSelector: async (
    { additionalShareUserCompareConversation },
    use,
  ) => {
    const additionalShareUserCompareConversationSelector =
      additionalShareUserCompareConversation.getConversationSelector();
    await use(additionalShareUserCompareConversationSelector);
  },
  additionalShareUserChatHeader: async ({ additionalShareUserChat }, use) => {
    const additionalShareUserChatHeader =
      additionalShareUserChat.getChatHeader();
    await use(additionalShareUserChatHeader);
  },
  additionalShareUserChatMessages: async ({ additionalShareUserChat }, use) => {
    const additionalShareUserChatMessages =
      additionalShareUserChat.getChatMessages();
    await use(additionalShareUserChatMessages);
  },
  additionalShareUserChatInfoTooltip: async (
    { additionalShareUserPage },
    use,
  ) => {
    const additionalShareUserChatInfoTooltip = new ChatInfoTooltip(
      additionalShareUserPage,
    );
    await use(additionalShareUserChatInfoTooltip);
  },
  additionalShareUserSharedWithMeConversationDropdownMenu: async (
    { additionalShareUserSharedWithMeConversations },
    use,
  ) => {
    const additionalShareUserSharedWithMeConversationDropdownMenu =
      additionalShareUserSharedWithMeConversations.getDropdownMenu();
    await use(additionalShareUserSharedWithMeConversationDropdownMenu);
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
  additionalShareUserErrorToast: async (
    { additionalShareUserAppContainer },
    use,
  ) => {
    const additionalShareUserErrorToast =
      additionalShareUserAppContainer.getErrorToast();
    await use(additionalShareUserErrorToast);
  },
});

export let shareUserBucket: string;
dialSharedWithMeTest.beforeAll(async () => {
  shareUserBucket = BucketUtil.getAdditionalShareUserBucket();
});

export default dialSharedWithMeTest;
