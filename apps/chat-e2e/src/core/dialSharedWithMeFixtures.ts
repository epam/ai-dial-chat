import { DialHomePage } from '../ui/pages';
import {
  Chat,
  ChatBar,
  ChatHeader,
  ChatInfoTooltip,
  ChatMessages,
  Compare,
  ConfirmationDialog,
  ConversationSettings,
  ConversationToCompare,
  Conversations,
  DropdownMenu,
  EntitySelector,
  ErrorToast,
  ModelSelector,
  PromptBar,
  RecentEntities,
  SendMessage,
  SharedPromptPreviewModal,
  VariableModalDialog,
} from '../ui/webElements';

import config from '@/config/chat.playwright.config';
import { SendMessageAssertion } from '@/src/assertions/sendMessageAssertion';
import { SharedPromptPreviewModalAssertion } from '@/src/assertions/sharedPromptPreviewModalAssertion';
import { SharedWithMePromptsAssertion } from '@/src/assertions/sharedWithMePromptsAssertion';
import { VariableModalAssertion } from '@/src/assertions/variableModalAssertion';
import dialTest, { stateFilePath } from '@/src/core/dialFixtures';
import { LocalStorageManager } from '@/src/core/localStorageManager';
import { AppContainer } from '@/src/ui/webElements/appContainer';
import { ChatNotFound } from '@/src/ui/webElements/chatNotFound';
import { PlaybackControl } from '@/src/ui/webElements/playbackControl';
import { SharedFolderConversations } from '@/src/ui/webElements/sharedFolderConversations';
import { SharedWithMeConversations } from '@/src/ui/webElements/sharedWithMeConversations';
import { SharedWithMePrompts } from '@/src/ui/webElements/sharedWithMePrompts';
import { BucketUtil } from '@/src/utils';
import { Page } from '@playwright/test';

const dialSharedWithMeTest = dialTest.extend<{
  additionalShareUserLocalStorageManager: LocalStorageManager;
  additionalShareUserPage: Page;
  additionalShareUserDialHomePage: DialHomePage;
  additionalShareUserAppContainer: AppContainer;
  additionalShareUserChatBar: ChatBar;
  additionalShareUserPromptBar: PromptBar;
  additionalShareUserSharedWithMeConversations: SharedWithMeConversations;
  additionalShareUserSharedFolderConversations: SharedFolderConversations;
  additionalShareUserSharedWithMePrompts: SharedWithMePrompts;
  additionalShareUserChat: Chat;
  additionalShareUserConversationSettings: ConversationSettings;
  additionalShareUserTalkToSelector: EntitySelector;
  additionalShareUserRecentEntities: RecentEntities;
  additionalShareUserChatHeader: ChatHeader;
  additionalShareUserChatMessages: ChatMessages;
  additionalShareUserSendMessage: SendMessage;
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
  additionalShareUserPromptPreviewModal: SharedPromptPreviewModal;
  additionalShareUserVariableModalDialog: VariableModalDialog;
  additionalShareUserSharedWithMePromptAssertion: SharedWithMePromptsAssertion;
  additionalShareUserSharedPromptPreviewModalAssertion: SharedPromptPreviewModalAssertion;
  additionalShareUserSendMessageAssertion: SendMessageAssertion;
  additionalShareUserVariableModalAssertion: VariableModalAssertion;
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
  additionalShareUserSharedWithMePrompts: async (
    { additionalShareUserPromptBar },
    use,
  ) => {
    const additionalShareUserSharedWithMePrompts =
      additionalShareUserPromptBar.getSharedWithMePrompts();
    await use(additionalShareUserSharedWithMePrompts);
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
  additionalShareUserConversationSettings: async (
    { additionalShareUserAppContainer },
    use,
  ) => {
    const additionalShareUserConversationSettings =
      additionalShareUserAppContainer.getConversationSettings();
    await use(additionalShareUserConversationSettings);
  },
  additionalShareUserTalkToSelector: async (
    { additionalShareUserConversationSettings },
    use,
  ) => {
    const additionalShareUserTalkToSelector =
      additionalShareUserConversationSettings.getTalkToSelector();
    await use(additionalShareUserTalkToSelector);
  },
  additionalShareUserRecentEntities: async (
    { additionalShareUserTalkToSelector },
    use,
  ) => {
    const additionalShareUserRecentEntities =
      additionalShareUserTalkToSelector.getRecentEntities();
    await use(additionalShareUserRecentEntities);
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
  additionalShareUserSendMessage: async ({ additionalShareUserChat }, use) => {
    const additionalShareUserSendMessage =
      additionalShareUserChat.getSendMessage();
    await use(additionalShareUserSendMessage);
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
  additionalShareUserPromptPreviewModal: async (
    { additionalShareUserPage },
    use,
  ) => {
    const additionalShareUserPromptPreviewModal = new SharedPromptPreviewModal(
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
  additionalShareUserSharedWithMePromptAssertion: async (
    { additionalShareUserSharedWithMePrompts },
    use,
  ) => {
    const additionalShareUserSharedWithMePromptAssertion =
      new SharedWithMePromptsAssertion(additionalShareUserSharedWithMePrompts);
    await use(additionalShareUserSharedWithMePromptAssertion);
  },
  additionalShareUserSharedPromptPreviewModalAssertion: async (
    { additionalShareUserPromptPreviewModal },
    use,
  ) => {
    const additionalShareUserSharedPromptPreviewModalAssertion =
      new SharedPromptPreviewModalAssertion(
        additionalShareUserPromptPreviewModal,
      );
    await use(additionalShareUserSharedPromptPreviewModalAssertion);
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
});

export let shareUserBucket: string;
dialSharedWithMeTest.beforeAll(async () => {
  shareUserBucket = BucketUtil.getAdditionalShareUserBucket();
});

export default dialSharedWithMeTest;
