import dialTest from '@/src/core/dialFixtures';
import { ExpectedMessages } from '@/src/testData';
import { expect } from '@playwright/test';

dialTest(
  'EPAM AI DIAL leads to kb',
  async ({
    dialHomePage,
    footerAssertion,
    setTestIds,
    footer,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-361');

    await dialTest.step(
      'Open app and verify footer with configured content is displayed',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await footerAssertion.assertFooterState('visible');
        await footerAssertion.assertFooterContentLength();
      },
    );

    await dialTest.step(
      'Click on any footer link and verify it is opened in a new tab',
      async () => {
        const newPage = await dialHomePage.getNewPage(() =>
          footer.openFooterLink(),
        );
        expect.soft(newPage, ExpectedMessages.newPageIsOpened).toBeDefined();
      },
    );
  },
);
