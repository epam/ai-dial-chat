import dialTest from '@/src/core/dialFixtures';
import dialOverlayTest from '@/src/core/dialOverlayFixtures';
import { OverlaySandboxUrls } from '@/src/testData/overlay/overlaySandboxUrls';

dialOverlayTest(
  'Overlay is opened if to click on the icon',
  async ({
    overlayHomePage,
    overlayBaseAssertion,
    overlayAssertion,
    page,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1404');

    await dialTest.step(
      'Click on the right bottom overlay button and verify frame is opened',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.overlayManagerUrl,
        );
        await overlayBaseAssertion.assertElementState(
          overlayHomePage.overlayChatIcon,
          'visible',
        );
        await overlayHomePage.overlayChatIcon.click();
        await overlayAssertion.assertOverlayManagerIsVisible(
          overlayHomePage.overlayManagerContainer,
        );
        await overlayHomePage.waitForPageLoaded();
      },
    );

    await dialTest.step(
      'Click on the frame collapse button and verify button at the right bottom corner is displayed',
      async () => {
        await overlayHomePage.overlayCollapseButton.click();
        await overlayBaseAssertion.assertElementState(
          overlayHomePage.overlayChatIcon,
          'visible',
        );
        await overlayAssertion.assertOverlayManagerIsHidden(
          overlayHomePage.overlayManagerContainer,
          page.viewportSize()!,
        );
      },
    );
  },
);
