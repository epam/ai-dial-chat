import { Conversation } from '@/chat/types/chat';
import dialTest from '@/src/core/dialFixtures';
import { AccountMenuOptions, ExpectedMessages } from '@/src/testData';
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
      chatMessages,
      accountSettings,
      accountDropdownMenu,
      confirmationDialog,
      providerLogin,
      setTestIds,
    },
    testInfo,
  ) => {
    setTestIds('EPMRTC-1576', 'EPMRTC-1580', 'EPMRTC-1577');
    const username =
      process.env.E2E_USERNAME!.split(',')[+process.env.TEST_PARALLEL_INDEX!];
    let conversation: Conversation;
    let chatBarBounding;
    let promptBarBounding;

    await dialTest.step('Prepare any conversation', async () => {
      conversation = conversationData.prepareDefaultConversation();
      await dataInjector.createConversations([conversation]);
    });

    await dialTest.step(
      'Open app and verify announcement banner is shown between side panels',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        const bannerMessage =
          await banner.bannerMessage.getElementInnerContent();
        expect
          .soft(bannerMessage, ExpectedMessages.bannerMessageIsValid)
          .toBe(
            'Welcome to AI Dial! Unified AI Access for Enterprises. Secure, scalable and customizable enterprise-grade AI ecosystem that seamlessly integrates with your data and workflows, tailored to achieve your unique business objectives.',
          );
        const bannerIcon = banner.bannerIcon;
        expect
          .soft(bannerIcon.isVisible(), ExpectedMessages.entityIconIsValid)
          .toBeTruthy();

        chatBarBounding = await chatBar.getElementBoundingBox();
        const bannerBounding = await banner.getElementBoundingBox();
        promptBarBounding = await promptBar.getElementBoundingBox();
        expect
          .soft(
            bannerBounding!.x === chatBarBounding!.width,
            ExpectedMessages.bannerWidthIsValid,
          )
          .toBeTruthy();
        expect
          .soft(
            bannerBounding!.x + bannerBounding!.width === promptBarBounding!.x,
            ExpectedMessages.bannerWidthIsValid,
          )
          .toBeTruthy();
      },
    );

    await dialTest.step(
      'Select conversation in chat panel and verify announcement banner is shown between side panels',
      async () => {
        await conversations.selectConversation(conversation.name);
        const bannerBounding = await banner.getElementBoundingBox();
        expect
          .soft(
            bannerBounding!.x === chatBarBounding!.width,
            ExpectedMessages.bannerWidthIsValid,
          )
          .toBeTruthy();
        expect
          .soft(
            bannerBounding!.x + bannerBounding!.width === promptBarBounding!.x,
            ExpectedMessages.bannerWidthIsValid,
          )
          .toBeTruthy();
      },
    );

    await dialTest.step(
      'Hide side panels and verify announcement banner is shown on full window width',
      async () => {
        await header.leftPanelToggle.click();
        await header.rightPanelToggle.click();
        const appBounding = await appContainer.getElementBoundingBox();
        const bannerBounding = await banner.getElementBoundingBox();
        expect
          .soft(
            bannerBounding!.width === appBounding!.width,
            ExpectedMessages.bannerWidthIsValid,
          )
          .toBeTruthy();
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
        await expect
          .soft(banner.getElementLocator(), ExpectedMessages.bannerIsClosed)
          .toBeHidden();
      },
    );

    await dialTest.step(
      'Refresh page and verify banner is not shown',
      async () => {
        await dialHomePage.reloadPage();
        await chatMessages.waitForState({ state: 'attached' });
        await expect
          .soft(banner.getElementLocator(), ExpectedMessages.bannerIsClosed)
          .toBeHidden();
      },
    );

    await dialTest.step(
      'Re-login to app and verify banner is not shown',
      async () => {
        await accountSettings.openAccountDropdownMenu();
        await accountDropdownMenu.selectMenuOption(AccountMenuOptions.logout);
        await confirmationDialog.confirm();
        await providerLogin.navigateToCredentialsPage();
        await providerLogin.authProviderLogin(
          testInfo,
          username,
          process.env.E2E_PASSWORD!,
          false,
        );
        await chatMessages.waitForState({ state: 'attached' });
        await expect
          .soft(banner.getElementLocator(), ExpectedMessages.bannerIsClosed)
          .toBeHidden();
      },
    );
  },
);
