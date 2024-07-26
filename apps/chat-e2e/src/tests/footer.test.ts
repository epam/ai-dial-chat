import dialTest from '@/src/core/dialFixtures';
import { ExpectedMessages } from '@/src/testData';
import { expect } from '@playwright/test';

dialTest(
  'EPAM AI Dial leads to kb',
  async ({ dialHomePage, chat, footerAssertion, setTestIds }) => {
    setTestIds('EPMRTC-361');

    await dialTest.step(
      'Open app and verify footer with configured content is displayed',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await footerAssertion.assertFooterState('visible');
        await footerAssertion.assertFooterContentLength();
      },
    );

    await dialTest.step(
      'Click on any footer link and verify it is opened in a new tab',
      async () => {
        const newPage = await dialHomePage.getNewPage(() =>
          chat.getFooter().openFooterLink(),
        );
        expect.soft(newPage, ExpectedMessages.newPageIsOpened).toBeDefined();
      },
    );
  },
);
