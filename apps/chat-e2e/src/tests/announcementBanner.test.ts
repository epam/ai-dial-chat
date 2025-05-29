import { Conversation } from '@/chat/types/chat';
import dialTest from '@/src/core/dialFixtures';
import { ExpectedMessages } from '@/src/testData';
import { expect } from '@playwright/test';

dialTest(
  'Banner is shown.\n' +
    'Banner text contains html link.\n' +
    "Banner doesn't appear if to close it",
  async (
    {
      dialHomePage,
      conversationData,
      dataInjector,
      chatBar,
      promptBar,
      conversations,
      banner,
      header,
      appContainer,
      providerLogin,
      setTestIds,
      localStorageManager,
      navigationPanel,
      baseAssertion,
      accountSettings,
    },
    testInfo,
  ) => {
    setTestIds('EPMRTC-1576', 'EPMRTC-1580', 'EPMRTC-1577');
    let conversation: Conversation;
    let chatBarBounding;
    let navigationPanelBounding;
    let promptBarBounding;

    await dialTest.step('Prepare any conversation', async () => {
      conversation = conversationData.prepareDefaultConversation();
      await dataInjector.createConversations([conversation]);
      await localStorageManager.setShowSideBarPanels();
    });

    await dialTest.step(
      'Open app and verify announcement banner is shown between side panels',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await baseAssertion.assertElementInnerText(
          banner.bannerMessage,
          [
            'Welcome to AI DIAL! Unified AI Access for Enterprises. Secure, scalable and customizable enterprise-grade AI ecosystem that seamlessly integrates with your data and workflows, tailored to achieve your unique business objectives.',
          ],
          ExpectedMessages.bannerMessageIsValid,
        );
        await baseAssertion.assertElementState(
          banner.bannerIcon,
          'visible',
          ExpectedMessages.entityIconIsValid,
        );

        navigationPanelBounding = await navigationPanel.getElementBoundingBox();
        chatBarBounding = await chatBar.getElementBoundingBox();
        const bannerBounding = await banner.getElementBoundingBox();
        promptBarBounding = await promptBar.getElementBoundingBox();
        baseAssertion.assertValue(
          bannerBounding!.x,
          chatBarBounding!.width + navigationPanelBounding!.width,
          ExpectedMessages.bannerWidthIsValid,
        );
        baseAssertion.assertValue(
          bannerBounding!.x + bannerBounding!.width,
          promptBarBounding!.x,
          ExpectedMessages.bannerWidthIsValid,
        );
      },
    );

    await dialTest.step(
      'Select conversation in chat panel and verify announcement banner is shown between side panels',
      async () => {
        await conversations.selectEntity(conversation.name);
        const bannerBounding = await banner.getElementBoundingBox();
        baseAssertion.assertValue(
          bannerBounding!.x,
          chatBarBounding!.width + navigationPanelBounding!.width,
          ExpectedMessages.bannerWidthIsValid,
        );
        baseAssertion.assertValue(
          bannerBounding!.x + bannerBounding!.width,
          promptBarBounding!.x,
          ExpectedMessages.bannerWidthIsValid,
        );
      },
    );

    await dialTest.step(
      'Hide side panels and verify announcement banner is shown on full window width',
      async () => {
        await header.leftPanelToggle.click();
        await header.rightPanelToggle.click();
        const appBounding = await appContainer.getElementBoundingBox();
        const bannerBounding = await banner.getElementBoundingBox();
        baseAssertion.assertValue(
          bannerBounding!.width,
          appBounding!.width - navigationPanelBounding!.width,
          ExpectedMessages.bannerWidthIsValid,
        );
      },
    );

    await dialTest.step(
      'Click on banner message link and verify new page is opened',
      async () => {
        const newPage = await dialHomePage.getNewPage(() =>
          banner.bannerMessageLink.click(),
        );
        expect
          .soft(newPage !== undefined, ExpectedMessages.newPageIsOpened)
          .toBeTruthy();
      },
    );

    await dialTest.step(
      'Click on close on banner and verify it is not shown',
      async () => {
        await dialHomePage.bringPageToFront();
        await banner.closeButton.click();
        await baseAssertion.assertElementState(
          banner,
          'hidden',
          ExpectedMessages.bannerIsClosed,
        );
      },
    );

    await dialTest.step(
      'Refresh page and verify banner is not shown',
      async () => {
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded({ skipSidebars: true });
        await baseAssertion.assertElementState(
          banner,
          'hidden',
          ExpectedMessages.bannerIsClosed,
        );
      },
    );

    await dialTest.step(
      'Re-login to app and verify banner is not shown',
      async () => {
        await accountSettings.logout();
        await providerLogin.login(
          testInfo,
          process.env.E2E_USERNAME!.split(',')[+testInfo.parallelIndex],
          process.env.E2E_PASSWORD!,
          false,
        );
        await dialHomePage.waitForPageLoaded({ skipSidebars: true });
        await baseAssertion.assertElementState(
          banner,
          'hidden',
          ExpectedMessages.bannerIsClosed,
        );
      },
    );
  },
);
