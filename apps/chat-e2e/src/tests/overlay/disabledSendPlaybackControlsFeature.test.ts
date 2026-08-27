import { Conversation } from '@/chat/types/chat';
import dialOverlayTest from '@/src/core/dialOverlayFixtures';
import { OverlaySandboxUrls } from '@/src/testData';
import { GeneratorUtil } from '@/src/utils';

dialOverlayTest(
  '[Overlay] tooltip-explanation when features DisabledSend and DisabledPlaybackControls are enabled',
  async ({
    overlayHomePage,
    overlayHeader,
    overlayConversations,
    overlaySendMessage,
    overlayConfiguration,
    overlayPlaybackControl,
    overlayBaseAssertion,
    overlayDataInjector,
    conversationData,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-2308');
    let conversation: Conversation;
    let playbackConversation: Conversation;
    // const disabledSendTooltip = 'This is tooltip for disabled send';
    // const disabledPlaybackControlsTooltip =
    //   'This is tooltip for disabled playback controls';

    await dialOverlayTest.step(
      'Prepare a conversation and its playback version',
      async () => {
        conversation = conversationData.prepareModelConversationBasedOnRequests(
          [GeneratorUtil.randomString(5), GeneratorUtil.randomString(5)],
        );
        playbackConversation =
          conversationData.prepareDefaultPlaybackConversation(conversation);
        await overlayDataInjector.createConversations([
          conversation,
          playbackConversation,
        ]);
      },
    );

    await dialOverlayTest.step(
      'Open the featuresData sandbox and click "Disable send"',
      async () => {
        await overlayHomePage.navigateToUrl(OverlaySandboxUrls.featuresDataUrl);
        await overlayHomePage.waitForPageLoaded();
        await overlayConfiguration.disableSendButton.click();
      },
    );

    await dialOverlayTest.step(
      'Hover over the Send button and verify it is disabled and the tooltip is shown',
      async () => {
        await overlaySendMessage.sendMessageButton.hoverOver();
        await overlayBaseAssertion.assertElementActionabilityState(
          overlaySendMessage.sendMessageButton,
          'disabled',
        );
        //currently there is an issue with tooltip displaying on hover disabled dial-button
        // await overlayTooltipPortalAssertion.assertTooltipContent(
        //   disabledSendTooltip,
        // );
      },
    );

    await dialOverlayTest.step(
      'Type any text in the input field, hover over the Send button again and verify it is disabled and the tooltip is shown',
      async () => {
        await overlaySendMessage.fillRequestData(GeneratorUtil.randomString(5));
        await overlaySendMessage.sendMessageButton.hoverOver();
        await overlayBaseAssertion.assertElementActionabilityState(
          overlaySendMessage.sendMessageButton,
          'disabled',
        );
        //currently there is an issue with tooltip displaying on hover disabled dial-button
        // await overlayTooltipPortalAssertion.assertTooltipContent(
        //   disabledSendTooltip,
        // );
      },
    );

    await dialOverlayTest.step(
      'Open the chat in Playback mode and click "Disable playback controls"',
      async () => {
        await overlayHeader.leftPanelToggle.click();
        await overlayConversations.selectEntity(playbackConversation.name);
        await overlayConfiguration.disablePlaybackControlsButton.click();
      },
    );

    await dialOverlayTest.step(
      'Hover over the disabled Next and Back playback buttons and verify they are disabled and the tooltip is shown',
      async () => {
        await overlayPlaybackControl.playbackPreviousButton.hoverOver();
        await overlayBaseAssertion.assertElementActionabilityState(
          overlayPlaybackControl.playbackPreviousButton,
          'disabled',
        );
        //currently there is an issue with tooltip displaying on hover disabled dial-button
        // await overlayTooltipPortalAssertion.assertTooltipContent(
        //   disabledPlaybackControlsTooltip,
        // );
        await overlayPlaybackControl.playbackNextButton.hoverOver();
        await overlayBaseAssertion.assertElementActionabilityState(
          overlayPlaybackControl.playbackNextButton,
          'disabled',
        );
        //currently there is an issue with tooltip displaying on hover disabled dial-button
        // await overlayTooltipPortalAssertion.assertTooltipContent(
        //   disabledPlaybackControlsTooltip,
        // );
      },
    );
  },
);
