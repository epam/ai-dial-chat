import { DialHomePage } from '../ui/pages';
import {
  AttachFilesModal,
  Chat,
  ChatBar,
  ChatHeader,
  ChatInfoTooltip,
  ChatMessages,
  Compare,
  ConfirmationDialog,
  ConversationSettings,
  ConversationToCompare,
  DropdownMenu,
  EntitySelector,
  EntitySettings,
  ErrorToast,
  PromptBar,
  PromptModalDialog,
  RecentEntities,
  SendMessage,
  SharedPromptPreviewModal,
  VariableModalDialog,
} from '../ui/webElements';

import config from '@/config/chat.playwright.config';
import {
  ErrorToastAssertion,
  ManageAttachmentsAssertion,
} from '@/src/assertions';
import { ConfirmationDialogAssertion } from '@/src/assertions/confirmationDialogAssertion';
import { EntitySettingAssertion } from '@/src/assertions/entitySettingAssertion';
import { FolderAssertion } from '@/src/assertions/folderAssertion';
import { MenuAssertion } from '@/src/assertions/menuAssertion';
import { PromptAssertion } from '@/src/assertions/promptAssertion';
import { PromptListAssertion } from '@/src/assertions/promptListAssertion';
import { PromptModalAssertion } from '@/src/assertions/promptModalAssertion';
import { SendMessageAssertion } from '@/src/assertions/sendMessageAssertion';
import { SharedPromptPreviewModalAssertion } from '@/src/assertions/sharedPromptPreviewModalAssertion';
import { SharedWithMePromptsAssertion } from '@/src/assertions/sharedWithMePromptsAssertion';
import { VariableModalAssertion } from '@/src/assertions/variableModalAssertion';
import dialTest, { stateFilePath } from '@/src/core/dialFixtures';
import { LocalStorageManager } from '@/src/core/localStorageManager';
import { isApiStorageType } from '@/src/hooks/global-setup';
import { FileApiHelper, ItemApiHelper } from '@/src/testData/api';
import { ApiInjector } from '@/src/testData/injector/apiInjector';
import { BrowserStorageInjector } from '@/src/testData/injector/browserStorageInjector';
import { DataInjectorInterface } from '@/src/testData/injector/dataInjectorInterface';
import { AppContainer } from '@/src/ui/webElements/appContainer';
import { ChatNotFound } from '@/src/ui/webElements/chatNotFound';
import {
  ConversationsTree,
  FolderPrompts,
  PromptsTree,
  SharedFolderPrompts,
} from '@/src/ui/webElements/entityTree';
import { SharedFolderConversations } from '@/src/ui/webElements/entityTree/sidebar/sharedFolderConversations';
import { SharedWithMeConversationsTree } from '@/src/ui/webElements/entityTree/sidebar/sharedWithMeConversationsTree';
import { SharedWithMePromptsTree } from '@/src/ui/webElements/entityTree/sidebar/sharedWithMePromptsTree';
import { PlaybackControl } from '@/src/ui/webElements/playbackControl';
import { BucketUtil } from '@/src/utils';
import { Page } from '@playwright/test';

const dialSharedWithMeTest = dialTest.extend<{
  additionalShareUserLocalStorageManager: LocalStorageManager;
  additionalShareUserPage: Page;
  additionalShareUserDialHomePage: DialHomePage;
  additionalShareUserAppContainer: AppContainer;
  additionalShareUserChatBar: ChatBar;
  additionalShareUserPromptBar: PromptBar;
  additionalShareUserSharedWithMeConversations: SharedWithMeConversationsTree;
  additionalShareUserSharedFolderConversations: SharedFolderConversations;
  additionalShareUserSharedWithMePrompts: SharedWithMePromptsTree;
  additionalShareUserSharedFolderPrompts: SharedFolderPrompts;
  additionalShareUserChat: Chat;
  additionalShareUserConversationSettings: ConversationSettings;
  additionalShareUserEntitySettings: EntitySettings;
  additionalShareUserTalkToSelector: EntitySelector;
  additionalShareUserRecentEntities: RecentEntities;
  additionalShareUserChatHeader: ChatHeader;
  additionalShareUserChatMessages: ChatMessages;
  additionalShareUserSendMessage: SendMessage;
  additionalShareUserChatInfoTooltip: ChatInfoTooltip;
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
  additionalShareUserErrorToast: ErrorToast;
  additionalShareUserPromptPreviewModal: SharedPromptPreviewModal;
  additionalShareUserVariableModalDialog: VariableModalDialog;
  additionalShareUserPromptDropdownMenu: DropdownMenu;
  additionalShareUserBrowserStorageInjector: BrowserStorageInjector;
  additionalShareUserApiInjector: ApiInjector;
  additionalShareUserDataInjector: DataInjectorInterface;
  additionalShareUserItemApiHelper: ItemApiHelper;
  additionalShareUserFileApiHelper: FileApiHelper;
  additionalShareUserPromptModalDialog: PromptModalDialog;
  additionalShareUserSharedWithMePromptAssertion: SharedWithMePromptsAssertion;
  additionalShareUserSharedPromptPreviewModalAssertion: SharedPromptPreviewModalAssertion;
  additionalShareUserSendMessageAssertion: SendMessageAssertion;
  additionalShareUserVariableModalAssertion: VariableModalAssertion;
  additionalShareUserConversationDropdownMenu: DropdownMenu;
  additionalShareUserSharedFolderPromptsAssertions: FolderAssertion<SharedFolderPrompts>;
  additionalShareUserPromptsDropdownMenuAssertion: MenuAssertion;
  additionalShareUserFolderDropdownMenuAssertion: MenuAssertion;
  additionalShareUserConfirmationDialogAssertion: ConfirmationDialogAssertion;
  additionalShareUserPromptAssertion: PromptAssertion;
  additionalShareUserPromptModalAssertion: PromptModalAssertion;
  additionalShareUserPromptBarFolderAssertion: FolderAssertion<FolderPrompts>;
  additionalShareUserSystemPromptListAssertion: PromptListAssertion;
  additionalShareUserEntitySettingAssertion: EntitySettingAssertion;
  additionalShareUserAttachFilesModal: AttachFilesModal;
  additionalShareUserErrorToastAssertion: ErrorToastAssertion;
  additionalShareUserManageAttachmentsAssertion: ManageAttachmentsAssertion;
}>({
  additionalShareUserManageAttachmentsAssertion: async (
    { additionalShareUserAttachFilesModal },
    use,
  ) => {
    const additionalShareUserManageAttachmentsAssertion =
      new ManageAttachmentsAssertion(additionalShareUserAttachFilesModal);
    await use(additionalShareUserManageAttachmentsAssertion);
  },
  additionalShareUserErrorToastAssertion: async (
    { additionalShareUserErrorToast },
    use,
  ) => {
    const additionalShareUserErrorToastAssertion = new ErrorToastAssertion(
      additionalShareUserErrorToast,
    );
    await use(additionalShareUserErrorToastAssertion);
  },
  additionalShareUserFileApiHelper: async (
    { additionalShareUserRequestContext },
    use,
  ) => {
    const additionalShareUserFileApiHelper = new FileApiHelper(
      additionalShareUserRequestContext,
    );
    await use(additionalShareUserFileApiHelper);
  },
  additionalShareUserAttachFilesModal: async (
    { additionalShareUserPage },
    use,
  ) => {
    const additionalShareUserAttachFilesModal = new AttachFilesModal(
      additionalShareUserPage,
    );
    await use(additionalShareUserAttachFilesModal);
  },
  additionalShareUserItemApiHelper: async (
    { additionalShareUserRequestContext },
    use,
  ) => {
    const additionalUserItemApiHelper = new ItemApiHelper(
      additionalShareUserRequestContext,
      BucketUtil.getAdditionalShareUserBucket(),
    ); // Use User2's bucket
    await use(additionalUserItemApiHelper);
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
    { additionalShareUserItemApiHelper },
    use,
  ) => {
    const additionalShareUserApiInjector = new ApiInjector(
      additionalShareUserItemApiHelper,
    );
    await use(additionalShareUserApiInjector);
  },
  additionalShareUserBrowserStorageInjector: async (
    { localStorageManager },
    use,
  ) => {
    const additionalShareUserBrowserStorageInjector =
      new BrowserStorageInjector(localStorageManager);
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
  additionalShareUserChat: async ({ additionalShareUserAppContainer }, use) => {
    const additionalShareUserChat = additionalShareUserAppContainer.getChat();
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
  additionalShareUserConversationSettings: async (
    { additionalShareUserAppContainer },
    use,
  ) => {
    const additionalShareUserConversationSettings =
      additionalShareUserAppContainer.getConversationSettings();
    await use(additionalShareUserConversationSettings);
  },
  additionalShareUserEntitySettings: async (
    { additionalShareUserConversationSettings },
    use,
  ) => {
    const additionalShareUserEntitySettings =
      additionalShareUserConversationSettings.getEntitySettings();
    await use(additionalShareUserEntitySettings);
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
  additionalShareUserConversationDropdownMenu: async (
    { additionalShareUserConversations },
    use,
  ) => {
    const additionalShareUserConversationDropdownMenu =
      additionalShareUserConversations.getDropdownMenu();
    await use(additionalShareUserConversationDropdownMenu);
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
      additionalShareUserPromptBar.getFolderPrompts();
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
  additionalShareUserSharedFolderPromptsAssertions: async (
    { additionalShareUserSharedFolderPrompts },
    use,
  ) => {
    const additionalShareUserSharedFolderPromptsAssertions =
      new FolderAssertion<SharedFolderPrompts>(
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
  additionalShareUserSystemPromptListAssertion: async (
    { additionalShareUserEntitySettings },
    use,
  ) => {
    const additionalShareUserSystemPromptListAssertion =
      new PromptListAssertion(
        additionalShareUserEntitySettings.getPromptList(),
      );
    await use(additionalShareUserSystemPromptListAssertion);
  },
  additionalShareUserEntitySettingAssertion: async (
    { additionalShareUserEntitySettings },
    use,
  ) => {
    const additionalShareUserEntitySettingAssertion =
      new EntitySettingAssertion(additionalShareUserEntitySettings);
    await use(additionalShareUserEntitySettingAssertion);
  },
});

export let shareUserBucket: string;
dialSharedWithMeTest.beforeAll(async () => {
  shareUserBucket = BucketUtil.getAdditionalShareUserBucket();
});

export default dialSharedWithMeTest;
