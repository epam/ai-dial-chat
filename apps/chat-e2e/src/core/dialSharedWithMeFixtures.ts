import { DialHomePage } from '../ui/pages';
import {
  AgentSettings,
  AttachFilesModal,
  Chat,
  ChatBar,
  ChatHeader,
  ChatMessages,
  Compare,
  ConfirmationDialog,
  ConversationSettingsModal,
  ConversationToCompare,
  DropdownMenu,
  ErrorToast,
  ModelInfoTooltip,
  PromptBar,
  PromptModalDialog,
  SendMessage,
  SharedPromptPreviewModal,
  TalkToAgentDialog,
  VariableModalDialog,
} from '../ui/webElements';

import config from '@/config/chat.playwright.config';
import {
  ChatAssertion,
  ConversationAssertion,
  DownloadAssertion,
  ErrorToastAssertion,
  ManageAttachmentsAssertion,
  TalkToAgentDialogAssertion,
} from '@/src/assertions';
import { AgentSettingAssertion } from '@/src/assertions/agentSettingAssertion';
import { ConfirmationDialogAssertion } from '@/src/assertions/confirmationDialogAssertion';
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
  additionalShareUserSharedFolderPrompts: SharedFolderPrompts;
  additionalShareUserChat: Chat;
  additionalShareUserConversationSettingsModal: ConversationSettingsModal;
  additionalShareUserAgentSettings: AgentSettings;
  additionalShareUserChatHeader: ChatHeader;
  additionalShareUserTalkToAgentDialog: TalkToAgentDialog;
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
  additionalShareUserAgentSettingAssertion: AgentSettingAssertion;
  additionalShareUserAttachFilesModal: AttachFilesModal;
  additionalShareUserErrorToastAssertion: ErrorToastAssertion;
  additionalShareUserManageAttachmentsAssertion: ManageAttachmentsAssertion;
  additionalShareUserDownloadAssertion: DownloadAssertion;
  additionalShareUserChatAssertion: ChatAssertion;
  additionalShareUserConversationAssertion: ConversationAssertion;
  additionalShareUserTalkToAgentDialogAssertion: TalkToAgentDialogAssertion;
}>({
  beforeAdditionalShareUserTestCleanup: [
    async (
      {
        additionalUserItemApiHelper,
        additionalUserShareApiHelper,
        additionalSecondUserItemApiHelper,
        additionalSecondUserShareApiHelper,
      },
      use,
    ) => {
      await additionalUserItemApiHelper.deleteAllData(
        BucketUtil.getAdditionalShareUserBucket(),
      );
      await additionalSecondUserItemApiHelper.deleteAllData(
        BucketUtil.getAdditionalSecondShareUserBucket(),
      );
      const additionalUserSharedConversations =
        await additionalUserShareApiHelper.listSharedWithMeConversations();
      const additionalUserSharedPrompts =
        await additionalUserShareApiHelper.listSharedWithMePrompts();
      const additionalUserSharedFiles =
        await additionalUserShareApiHelper.listSharedWithMeFiles();
      await additionalUserShareApiHelper.deleteSharedWithMeEntities([
        ...additionalUserSharedConversations.resources,
        ...additionalUserSharedPrompts.resources,
        ...additionalUserSharedFiles.resources,
      ]);
      const additionalSecondUserSharedConversations =
        await additionalSecondUserShareApiHelper.listSharedWithMeConversations();
      const additionalSecondUserSharedPrompts =
        await additionalSecondUserShareApiHelper.listSharedWithMePrompts();
      const additionalSecondUserSharedFiles =
        await additionalSecondUserShareApiHelper.listSharedWithMeFiles();
      await additionalSecondUserShareApiHelper.deleteSharedWithMeEntities([
        ...additionalSecondUserSharedConversations.resources,
        ...additionalSecondUserSharedPrompts.resources,
        ...additionalSecondUserSharedFiles.resources,
      ]);
      await use('beforeAdditionalShareUserTestCleanup');
    },
    { scope: 'test', auto: true },
  ],
  // eslint-disable-next-line no-empty-pattern
  additionalShareUserDownloadAssertion: async ({}, use) => {
    const additionalShareUserDownloadAssertion = new DownloadAssertion();
    await use(additionalShareUserDownloadAssertion);
  },
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
  additionalShareUserTalkToAgentDialog: async (
    { additionalShareUserPage },
    use,
  ) => {
    const additionalShareUserTalkToAgentDialog = new TalkToAgentDialog(
      additionalShareUserPage,
    );
    await use(additionalShareUserTalkToAgentDialog);
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
});

export let shareUserBucket: string;
dialSharedWithMeTest.beforeAll(async () => {
  shareUserBucket = BucketUtil.getAdditionalShareUserBucket();
});

export default dialSharedWithMeTest;
