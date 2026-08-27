import { Conversation } from '@/chat/types/chat';
import dialOverlayTest from '@/src/core/dialOverlayFixtures';
import { ExpectedMessages, OverlaySandboxUrls } from '@/src/testData';
import { ThemeColorAttributes } from '@/src/ui/domData';
import { GeneratorUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';

const expectedChatHeaderHeight = 56;

dialOverlayTest(
  '[Overlay] enable ConversationsPanelToggle, PromptsPanelToggle flags',
  async ({
    overlayHomePage,
    overlayChatBar,
    overlayPromptBar,
    overlayConversations,
    overlayChatHeader,
    overlayBaseAssertion,
    overlayDataInjector,
    conversationData,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-2328');
    let conversation: Conversation;
    const longConversationName = `${GeneratorUtil.randomConversationName()}${GeneratorUtil.randomString(80)}`;

    await dialOverlayTest.step(
      'Prepare a conversation with a long name',
      async () => {
        conversation = conversationData.prepareDefaultConversation(
          undefined,
          longConversationName,
        );
        await overlayDataInjector.createConversations([conversation]);
      },
    );

    await dialOverlayTest.step(
      'Open the sandbox with Header disabled and ConversationsPanelToggle, PromptsPanelToggle enabled and verify the panel toggle buttons are shown',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.enabledPanelTogglesUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        await overlayBaseAssertion.assertElementState(
          overlayHomePage.leftPanelToggle,
          'visible',
        );
        await overlayBaseAssertion.assertElementState(
          overlayHomePage.rightPanelToggle,
          'visible',
        );
      },
    );

    await dialOverlayTest.step(
      'Hover over the buttons and verify tooltips are shown, icons are highlighted',
      async () => {
        const expectedColor = ThemesUtil.getRgbColorByKey(
          ThemeColorAttributes.controlsBgNeutralHover,
        );
        await overlayHomePage.leftPanelToggle.hoverOver();
        await overlayBaseAssertion.assertElementBackgroundColors(
          overlayHomePage.leftPanelToggle,
          expectedColor,
        );
        //currently there is an issue with tooltip displaying on hover disabled dial-button
        // await overlayTooltipPortalAssertion.assertTooltipContent(
        //   'Conversations',
        // );
        await overlayHomePage.rightPanelToggle.hoverOver();
        await overlayBaseAssertion.assertElementBackgroundColors(
          overlayHomePage.rightPanelToggle,
          expectedColor,
        );
        //currently there is an issue with tooltip displaying on hover disabled dial-button
        // await overlayTooltipPortalAssertion.assertTooltipContent('Prompts');
      },
    );

    await dialOverlayTest.step(
      'Click on the button to open Conversations panel and verify Close panel btn is displayed',
      async () => {
        await overlayHomePage.leftPanelToggle.click();
        await overlayBaseAssertion.assertElementState(
          overlayChatBar,
          'visible',
        );
        await overlayBaseAssertion.assertElementState(
          overlayChatBar.closeButton,
          'visible',
        );
      },
    );

    await dialOverlayTest.step(
      'Select the conversation and verify the panel is closed, the chat is selected and the chat header is readable',
      async () => {
        await overlayConversations.selectEntity(conversation.name);
        await overlayBaseAssertion.assertElementState(overlayChatBar, 'hidden');
        await overlayBaseAssertion.assertElementText(
          overlayChatHeader.chatTitle,
          conversation.name,
        );
        await overlayBaseAssertion.assertElementTextIsTruncated(
          overlayChatHeader.chatTitle,
        );
        const chatHeaderBoundingBox = await overlayChatHeader
          .getElementLocator()
          .boundingBox();
        overlayBaseAssertion.assertValue(
          chatHeaderBoundingBox?.height,
          expectedChatHeaderHeight,
          ExpectedMessages.elementHeightIsValid,
        );
      },
    );

    await dialOverlayTest.step(
      'Click on the button to open Prompts panel and close it by clicking the Close button',
      async () => {
        await overlayHomePage.rightPanelToggle.click();
        await overlayBaseAssertion.assertElementState(
          overlayPromptBar,
          'visible',
        );
        await overlayBaseAssertion.assertElementState(
          overlayPromptBar.closeButton,
          'visible',
        );
        await overlayPromptBar.closeButton.click();
        await overlayBaseAssertion.assertElementState(
          overlayPromptBar,
          'hidden',
        );
      },
    );
  },
);
