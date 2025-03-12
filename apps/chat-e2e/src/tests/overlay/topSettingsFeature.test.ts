import dialTest from '@/src/core/dialFixtures';
import dialOverlayTest from '@/src/core/dialOverlayFixtures';
import {
  ExpectedConstants,
  MockedChatApiResponseBodies,
  OverlaySandboxUrls,
} from '@/src/testData';
import { GeneratorUtil } from '@/src/utils';

dialOverlayTest(
  '[Overlay] Display clear conversations button in chat header - Feature.TopClearConversation.\n' +
    '[Overlay] Display conversation info in chat header - Feature.TopChatInfo.\n' +
    '[Overlay] Display change model settings button in chat header - Feature.TopChatModelSettings',
  async ({
    overlayHomePage,
    overlayChat,
    overlayChatHeader,
    overlayBaseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3762', 'EPMRTC-3763', 'EPMRTC-3764');

    await dialTest.step(
      'Send the request and verify chat header is not visible',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.disableTopChatInfoUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        await overlayHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
          { isOverlay: true },
        );
        await overlayChat.sendRequestWithButton(GeneratorUtil.randomString(5));
        await overlayBaseAssertion.assertElementState(
          overlayChatHeader,
          'hidden',
        );
      },
    );
  },
);

dialOverlayTest(
  `[Overlay] Don't allow to click on model icon - Feature.DisallowChangeAgent`,
  async ({
    overlayHomePage,
    overlayChat,
    overlayChatHeader,
    overlayModelInfoTooltip,
    overlayTalkToAgentDialog,
    overlayBaseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-4872');

    await dialTest.step(
      'Send the request and verify chat name and icon are displayed in the header',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.enableDisallowChangeAgentUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        await overlayHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
          { isOverlay: true },
        );
        await overlayChat.sendRequestWithButton(GeneratorUtil.randomString(5));
        await overlayBaseAssertion.assertElementState(
          overlayChatHeader.chatTitle,
          'visible',
        );
        await overlayBaseAssertion.assertElementState(
          overlayChatHeader.chatModelIcon,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Click on model icon and verify "Select an agent" modal is not opened',
      async () => {
        // eslint-disable-next-line playwright/no-force-option
        await overlayChatHeader.chatModelIcon.click({ force: true });
        await overlayBaseAssertion.assertElementState(
          overlayTalkToAgentDialog,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Hover over model icon and verify tooltip content',
      async () => {
        await overlayBaseAssertion.assertElementText(
          overlayModelInfoTooltip.title,
          ExpectedConstants.modelInfoTooltipTitle,
        );
      },
    );
  },
);

dialOverlayTest(
  `[Overlay] Display chat menu in chat header - Feature.HideTopContextMenu`,
  async ({
    overlayHomePage,
    overlayChat,
    overlayChatHeader,
    overlayBaseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-4873');

    await dialTest.step(
      'Send the request and verify dots menu is not displayed in the header',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.enableHideTopContextMenuUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        await overlayHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
          { isOverlay: true },
        );
        await overlayChat.sendRequestWithButton(GeneratorUtil.randomString(5));
        await overlayBaseAssertion.assertElementState(
          overlayChatHeader.dotsMenu,
          'hidden',
        );
      },
    );
  },
);
