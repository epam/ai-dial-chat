import { Conversation } from '@/chat/types/chat';
import dialOverlayTest from '@/src/core/dialOverlayFixtures';
import { OverlaySandboxUrls } from '@/src/testData';
import { StyleValues } from '@/src/ui/domData';

dialOverlayTest(
  '[Overlay] enable UserMessageAlignEnd flag',
  async ({
    overlayHomePage,
    overlayHeader,
    overlayConversations,
    overlayChatMessages,
    overlayChatMessagesAssertion,
    overlayBaseAssertion,
    overlayDataInjector,
    conversationData,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-2327');
    let conversation: Conversation;
    const userMessageIndex = 1;
    const assistantMessageIndex = 2;

    await dialOverlayTest.step('Prepare a conversation via API', async () => {
      conversation = conversationData.prepareDefaultConversation();
      await overlayDataInjector.createConversations([conversation]);
    });

    await dialOverlayTest.step(
      'Open the sandbox with Feature.UserMessageAlignEnd enabled and select the conversation',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.enableUserMessageAlignEndUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        await overlayHeader.leftPanelToggle.click();
        await overlayConversations.selectEntity(conversation.name);
      },
    );

    await dialOverlayTest.step(
      'Verify the user message and its icon are moved to the right side',
      async () => {
        const userMessageIcon =
          overlayChatMessages.getUserMessageIcon(userMessageIndex);
        const userMessageContent =
          overlayChatMessages.getChatMessageContent(userMessageIndex);
        await overlayChatMessagesAssertion.assertElementTextAlignment(
          userMessageContent,
          StyleValues.end,
        );
        const userIconBoundingBox = await userMessageIcon.boundingBox();
        const userContentBoundingBox = await userMessageContent.boundingBox();
        overlayBaseAssertion.assertNumberIsGreaterThan(
          userIconBoundingBox!.x,
          userContentBoundingBox!.x + userIconBoundingBox!.width,
        );
      },
    );

    await dialOverlayTest.step(
      'Verify the assistant message is not affected and its icon remains on the left side',
      async () => {
        const assistantMessageIcon = await overlayChatMessages.getMessageIcon(
          assistantMessageIndex,
        );
        const assistantMessageContent =
          overlayChatMessages.getChatMessageContent(assistantMessageIndex);
        await overlayChatMessagesAssertion.assertElementTextAlignment(
          assistantMessageContent,
          StyleValues.start,
        );
        const assistantIconBoundingBox =
          await assistantMessageIcon.boundingBox();
        const assistantContentBoundingBox =
          await assistantMessageContent.boundingBox();
        overlayBaseAssertion.assertNumberIsGreaterThan(
          assistantContentBoundingBox!.x,
          assistantIconBoundingBox!.x + assistantIconBoundingBox!.width,
        );
      },
    );
  },
);
