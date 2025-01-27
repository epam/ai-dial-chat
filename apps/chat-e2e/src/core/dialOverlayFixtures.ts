import {
  AccountSettings,
  AgentInfo,
  AgentSettings,
  AttachFilesModal,
  Chat,
  ChatBar,
  ChatHeader,
  ChatMessages,
  ConfirmationDialog,
  ConversationSettingsModal,
  DropdownMenu,
  ModelInfoTooltip,
  PromptBar,
  PublishingRequestModal,
  SendMessage,
  TalkToAgentDialog,
  Toast,
} from '../ui/webElements';

import config from '@/config/overlay.playwright.config';
import {
  AgentInfoAssertion,
  ApiAssertion,
  BaseAssertion,
  ChatMessagesAssertion,
  ConversationAssertion,
  PromptAssertion,
  TalkToAgentDialogAssertion,
} from '@/src/assertions';
import { OverlayAssertion } from '@/src/assertions/overlay/overlayAssertion';
import test from '@/src/core/baseFixtures';
import { LocalStorageManager } from '@/src/core/localStorageManager';
import { isApiStorageType } from '@/src/hooks/global-setup';
import {
  FileApiHelper,
  IconApiHelper,
  ItemApiHelper,
  PublicationApiHelper,
  ShareApiHelper,
} from '@/src/testData/api';
import { ApiInjector } from '@/src/testData/injector/apiInjector';
import { BrowserStorageInjector } from '@/src/testData/injector/browserStorageInjector';
import { DataInjectorInterface } from '@/src/testData/injector/dataInjectorInterface';
import { OverlayHomePage } from '@/src/ui/pages/overlay/overlayHomePage';
import { OverlayMarketplacePage } from '@/src/ui/pages/overlay/overlayMarketplacePage';
import {
  ConversationsTree,
  OrganizationConversationsTree,
  PromptsTree,
} from '@/src/ui/webElements/entityTree';
import { ReportAnIssueModal } from '@/src/ui/webElements/footer/reportAnIssueModal';
import { RequestApiKeyModal } from '@/src/ui/webElements/footer/requestApiKeyModal';
import { Header } from '@/src/ui/webElements/header';
import { Actions } from '@/src/ui/webElements/overlay/actions';
import { Configuration } from '@/src/ui/webElements/overlay/configuration';
import { Dialog } from '@/src/ui/webElements/overlay/dialog';
import { ProfilePanel } from '@/src/ui/webElements/overlay/profilePanel';
import { PlaybackControl } from '@/src/ui/webElements/playbackControl';
import { SettingsModal } from '@/src/ui/webElements/settingsModal';
import { ShareModal } from '@/src/ui/webElements/shareModal';
import { BucketUtil } from '@/src/utils';
import { Page } from '@playwright/test';
import path from 'path';
import { APIRequestContext } from 'playwright-core';
import * as process from 'process';

export const overlayStateFilePath = (index: number) =>
  path.join(__dirname, `../../auth/overlayUser${index}.json`);

const dialOverlayTest = test.extend<{
  beforeTestCleanup: string;
  overlayHomePage: OverlayHomePage;
  overlayMarketplacePage: OverlayMarketplacePage;
  overlayChat: Chat;
  overlayAgentInfo: AgentInfo;
  overlayHeader: Header;
  overlayChatBar: ChatBar;
  overlaySendMessage: SendMessage;
  overlayConversations: ConversationsTree;
  overlayChatHeader: ChatHeader;
  overlayChatMessages: ChatMessages;
  overlayConversationSettingsModal: ConversationSettingsModal;
  overlayAgentSettings: AgentSettings;
  overlayItemApiHelper: ItemApiHelper;
  overlayPublicationApiHelper: PublicationApiHelper;
  overlayFileApiHelper: FileApiHelper;
  overlayIconApiHelper: IconApiHelper;
  overlayApiInjector: ApiInjector;
  overlayDataInjector: DataInjectorInterface;
  overlayBaseAssertion: BaseAssertion;
  overlayAgentInfoAssertion: AgentInfoAssertion;
  overlayChatMessagesAssertion: ChatMessagesAssertion;
  overlayApiAssertion: ApiAssertion;
  overlayTalkToAgentDialog: TalkToAgentDialog;
  overlayPromptBar: PromptBar;
  overlayPrompts: PromptsTree;
  overlayConversationDropdownMenu: DropdownMenu;
  overlayPromptDropdownMenu: DropdownMenu;
  overlayShareModal: ShareModal;
  overlayPublishingRequestModal: PublishingRequestModal;
  overlayAccountSettings: AccountSettings;
  overlayProfilePanel: ProfilePanel;
  overlaySettingsModal: SettingsModal;
  overlayConfirmationDialog: ConfirmationDialog;
  overlayModelInfoTooltip: ModelInfoTooltip;
  overlayToast: Toast;
  overlayRequestApiKeyModal: RequestApiKeyModal;
  overlayReportAnIssueModal: ReportAnIssueModal;
  overlayAttachFilesModal: AttachFilesModal;
  overlayPlaybackControl: PlaybackControl;
  overlayOrganizationConversations: OrganizationConversationsTree;
  overlayTalkToAgentDialogAssertion: TalkToAgentDialogAssertion;
  overlayAssertion: OverlayAssertion;
  overlayConversationAssertion: ConversationAssertion;
  overlayPromptAssertion: PromptAssertion;
  overlayShareApiHelper: ShareApiHelper;
  adminUserRequestContext: APIRequestContext;
  adminPublicationApiHelper: PublicationApiHelper;
  adminShareApiHelper: ShareApiHelper;
  adminItemApiHelper: ItemApiHelper;
  adminApiInjector: ApiInjector;
  adminBrowserStorageInjector: BrowserStorageInjector;
  adminPage: Page;
  adminLocalStorageManager: LocalStorageManager;
  adminDataInjector: DataInjectorInterface;
  overlayActions: Actions;
  overlayConfiguration: Configuration;
  overlayDialog: Dialog;
}>({
  // eslint-disable-next-line no-empty-pattern
  storageState: async ({}, use) => {
    await use(overlayStateFilePath(+process.env.TEST_PARALLEL_INDEX!));
  },
  beforeTestCleanup: [
    async ({ overlayDataInjector, overlayFileApiHelper }, use) => {
      await overlayDataInjector.deleteAllData();
      await overlayFileApiHelper.deleteAllFiles();
      await use('beforeTestCleanup');
    },
    { scope: 'test', auto: true },
  ],
  overlayHomePage: async ({ page }, use) => {
    const overlayHomePage = new OverlayHomePage(page);
    await use(overlayHomePage);
  },
  overlayMarketplacePage: async ({ page }, use) => {
    const overlayMarketplacePage = new OverlayMarketplacePage(page);
    await use(overlayMarketplacePage);
  },
  overlayChat: async ({ overlayHomePage }, use) => {
    const overlayChat = overlayHomePage.getOverlayContainer().getChat();
    await use(overlayChat);
  },
  overlayAgentInfo: async ({ overlayChat }, use) => {
    const overlayAgentInfo = overlayChat.getAgentInfo();
    await use(overlayAgentInfo);
  },
  overlayHeader: async ({ overlayHomePage }, use) => {
    const overlayHeader = overlayHomePage.getOverlayContainer().getHeader();
    await use(overlayHeader);
  },
  overlayChatBar: async ({ overlayHomePage }, use) => {
    const overlayChatBar = overlayHomePage.getOverlayContainer().getChatBar();
    await use(overlayChatBar);
  },
  overlaySendMessage: async ({ overlayChat }, use) => {
    const overlaySendMessage = overlayChat.getSendMessage();
    await use(overlaySendMessage);
  },
  overlayConversations: async ({ overlayChatBar }, use) => {
    const overlayConversations = overlayChatBar.getConversationsTree();
    await use(overlayConversations);
  },
  overlayChatHeader: async ({ overlayChat }, use) => {
    const overlayChatHeader = overlayChat.getChatHeader();
    await use(overlayChatHeader);
  },
  overlayChatMessages: async ({ overlayChat }, use) => {
    const overlayChatMessages = overlayChat.getChatMessages();
    await use(overlayChatMessages);
  },
  overlayConversationSettingsModal: async ({ page, overlayHomePage }, use) => {
    const overlayConversationSettingsModal = new ConversationSettingsModal(
      page,
      overlayHomePage.getOverlayContainer().getElementLocator(),
    );
    await use(overlayConversationSettingsModal);
  },
  overlayAgentSettings: async ({ overlayConversationSettingsModal }, use) => {
    const overlayAgentSettings =
      overlayConversationSettingsModal.getAgentSettings();
    await use(overlayAgentSettings);
  },
  overlayItemApiHelper: async ({ request }, use) => {
    const overlayItemApiHelper = new ItemApiHelper(request);
    await use(overlayItemApiHelper);
  },
  overlayPublicationApiHelper: async ({ request }, use) => {
    const overlayPublicationApiHelper = new PublicationApiHelper(request);
    await use(overlayPublicationApiHelper);
  },
  overlayFileApiHelper: async ({ request }, use) => {
    const overlayFileApiHelper = new FileApiHelper(request);
    await use(overlayFileApiHelper);
  },
  overlayIconApiHelper: async ({ request }, use) => {
    const overlayIconApiHelper = new IconApiHelper(request);
    await use(overlayIconApiHelper);
  },
  overlayApiInjector: async ({ overlayItemApiHelper }, use) => {
    const overlayApiInjector = new ApiInjector(overlayItemApiHelper);
    await use(overlayApiInjector);
  },
  overlayDataInjector: async ({ overlayApiInjector }, use) => {
    await use(overlayApiInjector);
  },
  // eslint-disable-next-line no-empty-pattern
  overlayBaseAssertion: async ({}, use) => {
    const baseAssertion = new BaseAssertion();
    await use(baseAssertion);
  },
  overlayAgentInfoAssertion: async ({ overlayAgentInfo }, use) => {
    const overlayAgentInfoAssertion = new AgentInfoAssertion(overlayAgentInfo);
    await use(overlayAgentInfoAssertion);
  },
  overlayChatMessagesAssertion: async ({ overlayChatMessages }, use) => {
    const overlayChatMessagesAssertion = new ChatMessagesAssertion(
      overlayChatMessages,
    );
    await use(overlayChatMessagesAssertion);
  },
  // eslint-disable-next-line no-empty-pattern
  overlayApiAssertion: async ({}, use) => {
    const overlayApiAssertion = new ApiAssertion();
    await use(overlayApiAssertion);
  },
  overlayTalkToAgentDialog: async ({ page, overlayHomePage }, use) => {
    const overlayTalkToAgentDialog = new TalkToAgentDialog(
      page,
      overlayHomePage.getOverlayContainer().getElementLocator(),
    );
    await use(overlayTalkToAgentDialog);
  },
  overlayPromptBar: async ({ overlayHomePage }, use) => {
    const overlayPromptBar = overlayHomePage
      .getOverlayContainer()
      .getPromptBar();
    await use(overlayPromptBar);
  },
  overlayPrompts: async ({ overlayPromptBar }, use) => {
    const overlayPrompts = overlayPromptBar.getPromptsTree();
    await use(overlayPrompts);
  },
  overlayConversationDropdownMenu: async ({ page, overlayHomePage }, use) => {
    const overlayConversationDropdownMenu = new DropdownMenu(
      page,
      overlayHomePage.getOverlayContainer().getElementLocator(),
    );
    await use(overlayConversationDropdownMenu);
  },
  overlayPromptDropdownMenu: async ({ page, overlayHomePage }, use) => {
    const overlayPromptDropdownMenu = new DropdownMenu(
      page,
      overlayHomePage.getOverlayContainer().getElementLocator(),
    );
    await use(overlayPromptDropdownMenu);
  },
  overlayShareModal: async ({ page, overlayHomePage }, use) => {
    const overlayShareModal = new ShareModal(
      page,
      overlayHomePage.getOverlayContainer().getElementLocator(),
    );
    await use(overlayShareModal);
  },
  overlayPublishingRequestModal: async ({ page, overlayHomePage }, use) => {
    const publishingModal = new PublishingRequestModal(
      page,
      overlayHomePage.getOverlayContainer().getElementLocator(),
    );
    await use(publishingModal);
  },
  overlayAccountSettings: async ({ overlayHeader }, use) => {
    const overlayAccountSettings = overlayHeader.getAccountSettings();
    await use(overlayAccountSettings);
  },
  overlayProfilePanel: async ({ page, overlayHomePage }, use) => {
    const overlayProfilePanel = new ProfilePanel(
      page,
      overlayHomePage.getOverlayContainer().getElementLocator(),
    );
    await use(overlayProfilePanel);
  },
  overlaySettingsModal: async ({ page, overlayHomePage }, use) => {
    const overlaySettingsModal = new SettingsModal(
      page,
      overlayHomePage.getOverlayContainer().getElementLocator(),
    );
    await use(overlaySettingsModal);
  },
  overlayConfirmationDialog: async ({ page, overlayHomePage }, use) => {
    const overlayConfirmationDialog = new ConfirmationDialog(
      page,
      overlayHomePage.getOverlayContainer().getElementLocator(),
    );
    await use(overlayConfirmationDialog);
  },
  overlayModelInfoTooltip: async ({ page, overlayHomePage }, use) => {
    const overlayModelInfoTooltip = new ModelInfoTooltip(
      page,
      overlayHomePage.getOverlayContainer().getElementLocator(),
    );
    await use(overlayModelInfoTooltip);
  },
  overlayToast: async ({ page, overlayHomePage }, use) => {
    const overlayToast = new Toast(
      page,
      overlayHomePage.getOverlayContainer().getElementLocator(),
    );
    await use(overlayToast);
  },
  overlayRequestApiKeyModal: async ({ page, overlayHomePage }, use) => {
    const overlayRequestApiKeyModal = new RequestApiKeyModal(
      page,
      overlayHomePage.getOverlayContainer().getElementLocator(),
    );
    await use(overlayRequestApiKeyModal);
  },
  overlayReportAnIssueModal: async ({ page, overlayHomePage }, use) => {
    const overlayReportAnIssueModal = new ReportAnIssueModal(
      page,
      overlayHomePage.getOverlayContainer().getElementLocator(),
    );
    await use(overlayReportAnIssueModal);
  },
  overlayAttachFilesModal: async ({ page, overlayHomePage }, use) => {
    const overlayAttachFilesModal = new AttachFilesModal(
      page,
      overlayHomePage.getOverlayContainer().getElementLocator(),
    );
    await use(overlayAttachFilesModal);
  },
  overlayPlaybackControl: async ({ overlayChat }, use) => {
    const overlayPlaybackControl = overlayChat.getPlaybackControl();
    await use(overlayPlaybackControl);
  },
  overlayOrganizationConversations: async ({ overlayChatBar }, use) => {
    const overlayOrganizationConversations =
      overlayChatBar.getOrganizationConversationsTree();
    await use(overlayOrganizationConversations);
  },
  overlayTalkToAgentDialogAssertion: async (
    { overlayTalkToAgentDialog },
    use,
  ) => {
    const overlayTalkToAgentDialogAssertion = new TalkToAgentDialogAssertion(
      overlayTalkToAgentDialog,
    );
    await use(overlayTalkToAgentDialogAssertion);
  },
  // eslint-disable-next-line no-empty-pattern
  overlayAssertion: async ({}, use) => {
    const overlayAssertion = new OverlayAssertion();
    await use(overlayAssertion);
  },
  overlayConversationAssertion: async ({ overlayConversations }, use) => {
    const overlayConversationAssertion = new ConversationAssertion(
      overlayConversations,
    );
    await use(overlayConversationAssertion);
  },
  overlayPromptAssertion: async ({ overlayPrompts }, use) => {
    const promptAssertion = new PromptAssertion(overlayPrompts);
    await use(promptAssertion);
  },
  overlayShareApiHelper: async ({ request }, use) => {
    const overlayShareApiHelper = new ShareApiHelper(request);
    await use(overlayShareApiHelper);
  },
  adminUserRequestContext: async ({ playwright }, use) => {
    const adminUserRequestContext = await playwright.request.newContext({
      storageState: overlayStateFilePath(+config.workers!),
    });
    await use(adminUserRequestContext);
  },
  adminPublicationApiHelper: async ({ adminUserRequestContext }, use) => {
    const adminPublicationApiHelper = new PublicationApiHelper(
      adminUserRequestContext,
      BucketUtil.getAdminUserBucket(),
    );
    await use(adminPublicationApiHelper);
  },
  adminShareApiHelper: async ({ adminUserRequestContext }, use) => {
    const adminShareApiHelper = new ShareApiHelper(adminUserRequestContext);
    await use(adminShareApiHelper);
  },
  adminItemApiHelper: async ({ adminUserRequestContext }, use) => {
    const adminItemApiHelper = new ItemApiHelper(
      adminUserRequestContext,
      BucketUtil.getAdminUserBucket(),
    );
    await use(adminItemApiHelper);
  },
  adminApiInjector: async ({ adminItemApiHelper }, use) => {
    const adminApiInjector = new ApiInjector(adminItemApiHelper);
    await use(adminApiInjector);
  },
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: overlayStateFilePath(+config.workers!),
    });
    const adminPage = await context.newPage();
    await use(adminPage);
    await context.close();
  },
  adminLocalStorageManager: async ({ adminPage }, use) => {
    const adminLocalStorageManager = new LocalStorageManager(adminPage);
    await use(adminLocalStorageManager);
  },
  adminBrowserStorageInjector: async ({ adminLocalStorageManager }, use) => {
    const adminBrowserStorageInjector = new BrowserStorageInjector(
      adminLocalStorageManager,
    );
    await use(adminBrowserStorageInjector);
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
  overlayActions: async ({ overlayHomePage }, use) => {
    const overlayActions = overlayHomePage.getActions();
    await use(overlayActions);
  },
  overlayConfiguration: async ({ overlayHomePage }, use) => {
    const overlayConfiguration = overlayHomePage.getConfiguration();
    await use(overlayConfiguration);
  },
  overlayDialog: async ({ page }, use) => {
    const overlayDialog = new Dialog(page);
    await use(overlayDialog);
  },
});

export default dialOverlayTest;
