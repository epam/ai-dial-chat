import { Chat, ChatHeader } from '../ui/webElements';

import { ItemApiHelper } from '@/src/testData/api';
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
  overlayItemApiHelper: ItemApiHelper;
  overlayApiInjector: ApiInjector;
  overlayDataInjector: DataInjectorInterface;
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
  overlayItemApiHelper: async ({ request }, use) => {
    const overlayItemApiHelper = new ItemApiHelper(request);
    await use(overlayItemApiHelper);
  },
  overlayApiInjector: async ({ overlayItemApiHelper }, use) => {
    const overlayApiInjector = new ApiInjector(overlayItemApiHelper);
    await use(overlayApiInjector);
  },
  overlayDataInjector: async ({ overlayApiInjector }, use) => {
    await use(overlayApiInjector);
  },
});

export default dialOverlayTest;
