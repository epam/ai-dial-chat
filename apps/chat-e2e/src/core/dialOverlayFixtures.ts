import {
  AgentInfo,
  AgentSettings,
  Chat,
  ChatBar,
  ChatHeader,
  ChatMessages,
  ConversationSettingsModal,
  MarketplaceAgents,
  TalkToAgentDialog,
} from '../ui/webElements';

import {
  AgentInfoAssertion,
  AgentSettingAssertion,
  ApiAssertion,
  BaseAssertion,
  ChatHeaderAssertion,
  ChatMessagesAssertion,
  TalkToAgentDialogAssertion,
} from '@/src/assertions';
import { OverlayAssertion } from '@/src/assertions/overlay/overlayAssertion';
import test from '@/src/core/baseFixtures';
import { IconApiHelper, ItemApiHelper } from '@/src/testData/api';
import { ApiInjector } from '@/src/testData/injector/apiInjector';
import { DataInjectorInterface } from '@/src/testData/injector/dataInjectorInterface';
import { OverlayHomePage } from '@/src/ui/pages/overlay/overlayHomePage';
import { OverlayMarketplacePage } from '@/src/ui/pages/overlay/overlayMarketplacePage';
import { ConversationsTree } from '@/src/ui/webElements/entityTree';
import { Header } from '@/src/ui/webElements/header';
import path from 'path';
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
  overlayConversations: ConversationsTree;
  chatHeader: ChatHeader;
  overlayChatHeader: ChatHeader;
  overlayChatMessages: ChatMessages;
  overlayConversationSettingsModal: ConversationSettingsModal;
  overlayAgentSettings: AgentSettings;
  overlayItemApiHelper: ItemApiHelper;
  overlayIconApiHelper: IconApiHelper;
  overlayApiInjector: ApiInjector;
  overlayDataInjector: DataInjectorInterface;
  overlayBaseAssertion: BaseAssertion;
  overlayAgentInfoAssertion: AgentInfoAssertion;
  overlayChatHeaderAssertion: ChatHeaderAssertion<ChatHeader>;
  overlayChatMessagesAssertion: ChatMessagesAssertion;
  overlayApiAssertion: ApiAssertion;
  overlayAgentSettingAssertion: AgentSettingAssertion;
  overlayTalkToAgentDialog: TalkToAgentDialog;
  overlayTalkToAgents: MarketplaceAgents;
  talkToAgentDialogAssertion: TalkToAgentDialogAssertion;
  overlayAssertion: OverlayAssertion;
}>({
  // eslint-disable-next-line no-empty-pattern
  storageState: async ({}, use) => {
    await use(overlayStateFilePath(+process.env.TEST_PARALLEL_INDEX!));
  },
  beforeTestCleanup: [
    async ({ overlayDataInjector }, use) => {
      await overlayDataInjector.deleteAllData(true);
      // await fileApiHelper.deleteAllFiles();
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
  overlayChatHeaderAssertion: async ({ overlayChatHeader }, use) => {
    const chatHeaderAssertion = new ChatHeaderAssertion(overlayChatHeader);
    await use(chatHeaderAssertion);
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
  overlayAgentSettingAssertion: async ({ overlayAgentSettings }, use) => {
    const overlayAgentSettingAssertion = new AgentSettingAssertion(
      overlayAgentSettings,
    );
    await use(overlayAgentSettingAssertion);
  },
  overlayTalkToAgentDialog: async ({ page, overlayHomePage }, use) => {
    const overlayTalkToAgentDialog = new TalkToAgentDialog(
      page,
      overlayHomePage.getOverlayContainer().getElementLocator(),
    );
    await use(overlayTalkToAgentDialog);
  },
  overlayTalkToAgents: async ({ overlayTalkToAgentDialog }, use) => {
    const talkToAgents = overlayTalkToAgentDialog.getAgents();
    await use(talkToAgents);
  },
  talkToAgentDialogAssertion: async ({ overlayTalkToAgentDialog }, use) => {
    const talkToAgentDialogAssertion = new TalkToAgentDialogAssertion(
      overlayTalkToAgentDialog,
    );
    await use(talkToAgentDialogAssertion);
  },
  // eslint-disable-next-line no-empty-pattern
  overlayAssertion: async ({}, use) => {
    const overlayAssertion = new OverlayAssertion();
    await use(overlayAssertion);
  },
});

export default dialOverlayTest;
