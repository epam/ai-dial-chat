import {
  Chat,
  ChatHeader,
  ChatMessages,
  ConversationSettings,
  EntitySettings,
} from '../ui/webElements';

import {
  ApiAssertion,
  ChatHeaderAssertion,
  ChatMessagesAssertion,
  EntitySettingAssertion,
} from '@/src/assertions';
import { IconApiHelper, ItemApiHelper } from '@/src/testData/api';
import { ApiInjector } from '@/src/testData/injector/apiInjector';
import { DataInjectorInterface } from '@/src/testData/injector/dataInjectorInterface';
import { OverlayHomePage } from '@/src/ui/pages/overlayHomePage';
import { AppContainer } from '@/src/ui/webElements/appContainer';
import { Header } from '@/src/ui/webElements/header';
import { test as base } from '@playwright/test';
import path from 'path';
import * as process from 'process';

export const overlayStateFilePath = (index: number) =>
  path.join(__dirname, `../../auth/overlayUser${index}.json`);

const dialOverlayTest = base.extend<{
  beforeTestCleanup: string;
  overlayHomePage: OverlayHomePage;
  overlayContainer: AppContainer;
  overlayChat: Chat;
  overlayHeader: Header;
  overlayChatHeader: ChatHeader;
  overlayChatMessages: ChatMessages;
  overlayConversationSettings: ConversationSettings;
  overlayEntitySettings: EntitySettings;
  overlayItemApiHelper: ItemApiHelper;
  overlayIconApiHelper: IconApiHelper;
  overlayApiInjector: ApiInjector;
  overlayDataInjector: DataInjectorInterface;
  overlayChatHeaderAssertion: ChatHeaderAssertion<ChatHeader>;
  overlayChatMessagesAssertion: ChatMessagesAssertion;
  overlayApiAssertion: ApiAssertion;
  overlayEntitySettingAssertion: EntitySettingAssertion;
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
  overlayContainer: async ({ overlayHomePage }, use) => {
    const overlayContainer = overlayHomePage.getOverlayContainer();
    await use(overlayContainer);
  },
  overlayChat: async ({ overlayContainer }, use) => {
    const overlayChat = overlayContainer.getChat();
    await use(overlayChat);
  },
  overlayHeader: async ({ overlayContainer }, use) => {
    const overlayHeader = overlayContainer.getHeader();
    await use(overlayHeader);
  },
  overlayChatHeader: async ({ overlayChat }, use) => {
    const overlayChatHeader = overlayChat.getChatHeader();
    await use(overlayChatHeader);
  },
  overlayChatMessages: async ({ overlayChat }, use) => {
    const overlayChatMessages = overlayChat.getChatMessages();
    await use(overlayChatMessages);
  },
  overlayConversationSettings: async ({ overlayContainer }, use) => {
    const overlayConversationSettings =
      overlayContainer.getConversationSettings();
    await use(overlayConversationSettings);
  },
  overlayEntitySettings: async ({ overlayConversationSettings }, use) => {
    const overlayEntitySettings =
      overlayConversationSettings.getEntitySettings();
    await use(overlayEntitySettings);
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
  overlayEntitySettingAssertion: async ({ overlayEntitySettings }, use) => {
    const overlayEntitySettingAssertion = new EntitySettingAssertion(
      overlayEntitySettings,
    );
    await use(overlayEntitySettingAssertion);
  },
});

export default dialOverlayTest;
