import { Conversation } from '@/chat/types/chat';
import dialOverlayTest from '@/src/core/dialOverlayFixtures';
import { OverlaySandboxUrls, Rate } from '@/src/testData';

dialOverlayTest(
  '[Overlay] Popup to send feedback on dislike - Feature.DislikeComment',
  async ({
    overlayHomePage,
    overlayHeader,
    overlayConversations,
    overlayChatMessages,
    overlayChatMessagesAssertion,
    overlayDislikeCommentModal,
    overlayDataInjector,
    conversationData,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-2285');
    let conversation: Conversation;
    const messageIndex = 2;

    await dialOverlayTest.step(
      'Prepare a conversation with a user prompt and agent response',
      async () => {
        conversation = conversationData.prepareDefaultConversation();
        await overlayDataInjector.createConversations([conversation]);
      },
    );

    await dialOverlayTest.step(
      'Open sandbox with Feature.Likes enabled and Feature.DislikeComment not enabled, select the conversation and click on Dislike for the response',
      async () => {
        await overlayHomePage.navigateToUrl(OverlaySandboxUrls.enableLikesUrl);
        await overlayHomePage.waitForPageLoaded();
        await overlayHeader.leftPanelToggle.click();
        await overlayConversations.selectEntity(conversation.name);
        await overlayChatMessages.dislikeMessage(messageIndex);
      },
    );

    await dialOverlayTest.step(
      'Verify Dislike is saved as highlighted, Like disappears and no "Send feedback" pop-up appears',
      async () => {
        await overlayChatMessagesAssertion.assertElementState(
          overlayDislikeCommentModal,
          'hidden',
        );
        await overlayChatMessagesAssertion.assertRate(
          Rate.dislike,
          messageIndex,
        );
        await overlayChatMessagesAssertion.assertElementState(
          overlayChatMessages.getChatMessageRate(messageIndex, Rate.like),
          'hidden',
        );
      },
    );
  },
);
