import dialOverlayTest from '@/src/core/dialOverlayFixtures';
import {
  AccountMenuOptions,
  ExpectedMessages,
  OverlaySandboxUrls,
} from '@/src/testData';
import { getElementWidth } from '@/src/ui/domData';

dialOverlayTest(
  '[Overlay] enable Feature.ChatFullWidthByDefault',
  async ({
    page,
    overlayHomePage,
    overlayAssertion,
    overlayBaseAssertion,
    overlayAccountSettings,
    accountSettingsDropdownMenu,
    overlaySettingsModal,
    overlaySendMessage,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-2323');
    let sendMessageInitialWidth: number;

    await dialOverlayTest.step(
      'Open overlay manager and expand it on the full screen',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.overlayManagerFullWidthUrl,
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
        sendMessageInitialWidth = await getElementWidth(overlaySendMessage);
        await overlayHomePage.overlayFullScreenButton.click();
        await page.waitForFunction(() => document.fullscreenElement !== null);
      },
    );

    await dialOverlayTest.step(
      'Open settings under the user name and verify "Chat width" setting does not exist',
      async () => {
        await overlayAccountSettings.click();
        await accountSettingsDropdownMenu.selectMenuOption(
          AccountMenuOptions.settings,
        );
        await overlayBaseAssertion.assertElementState(
          overlaySettingsModal.fullWidthChatToggle,
          'hidden',
        );
        await overlaySettingsModal.cancelButton.click();
      },
    );

    await dialOverlayTest.step(
      'Verify the width of the chat input is full',
      async () => {
        const sendMessageFullScreenWidth =
          await getElementWidth(overlaySendMessage);
        overlayBaseAssertion.assertNumberIsGreaterThan(
          sendMessageFullScreenWidth,
          sendMessageInitialWidth,
          ExpectedMessages.elementWidthIsValid,
        );
      },
    );
  },
);
