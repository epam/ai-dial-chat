import dialOverlayTest from '@/src/core/dialOverlayFixtures';
import { OverlaySandboxUrls } from '@/src/testData';

const viewportHeight = 800;

const breakpointCases = [
  {
    description:
      'Feature.MdSidebarOverlayBreakpoint is disabled (default xl breakpoint)',
    url: OverlaySandboxUrls.overlayManagerDefaultBreakpointUrl,
    breakpoint: 1280,
  },
  {
    description:
      'Feature.MdSidebarOverlayBreakpoint is enabled (md breakpoint)',
    url: OverlaySandboxUrls.overlayManagerMdBreakpointUrl,
    breakpoint: 768,
  },
];

for (const { description, url, breakpoint } of breakpointCases) {
  dialOverlayTest(
    `[Overlay] ${description}`,
    async ({
      page,
      overlayHomePage,
      overlayHeader,
      overlayChatBar,
      overlayPromptBar,
      overlayAssertion,
      overlayBaseAssertion,
      setTestIds,
    }) => {
      setTestIds('EPMDIAL-2331');

      const openOverlayFullscreen = async () => {
        await overlayHomePage.navigateToUrl(url);
        await overlayBaseAssertion.assertElementState(
          overlayHomePage.overlayChatIcon,
          'visible',
        );
        await overlayHomePage.overlayChatIcon.click();
        await overlayAssertion.assertOverlayManagerIsVisible(
          overlayHomePage.overlayManagerContainer,
        );
        await overlayHomePage.waitForPageLoaded();
        await overlayHomePage.overlayFullScreenButton.click();
      };

      await dialOverlayTest.step(
        `Set the viewport below the ${breakpoint}px breakpoint and verify the chat and prompt panels float over the chat`,
        async () => {
          await page.setViewportSize({
            width: breakpoint - 1,
            height: viewportHeight,
          });
          await openOverlayFullscreen();
          await overlayHeader.leftPanelToggle.click();
          await overlayBaseAssertion.assertElementPositionStyle(
            overlayChatBar,
            'fixed',
          );
          await overlayChatBar.closeButton.click();
          await overlayHeader.rightPanelToggle.click();
          await overlayBaseAssertion.assertElementPositionStyle(
            overlayPromptBar,
            'fixed',
          );
          await overlayPromptBar.closeButton.click();
        },
      );

      await dialOverlayTest.step(
        `Set the viewport at the ${breakpoint}px breakpoint and verify the chat and prompt panels sit inside the chat`,
        async () => {
          await page.setViewportSize({
            width: breakpoint,
            height: viewportHeight,
          });
          await openOverlayFullscreen();
          await overlayHeader.leftPanelToggle.click();
          await overlayBaseAssertion.assertElementPositionStyle(
            overlayChatBar,
            'relative',
          );
          await overlayHeader.rightPanelToggle.click();
          await overlayBaseAssertion.assertElementPositionStyle(
            overlayPromptBar,
            'relative',
          );
        },
      );
    },
  );
}
