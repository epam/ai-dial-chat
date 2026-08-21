import { Conversation } from '@/chat/types/chat';
import dialOverlayTest from '@/src/core/dialOverlayFixtures';
import { OverlaySandboxUrls } from '@/src/testData';
import { GeneratorUtil } from '@/src/utils';

for (const isFeatureEnabled of [false, true]) {
  dialOverlayTest(
    `[Overlay] Feature.SkipFocusChatInputOnLoad is ${isFeatureEnabled}`,
    async ({
      overlayHomePage,
      overlayHeader,
      overlayConversations,
      overlaySendMessage,
      overlayBaseAssertion,
      overlayDataInjector,
      conversationData,
      setTestIds,
    }) => {
      setTestIds('EPMDIAL-2318');
      let chat1: Conversation;
      let chat2: Conversation;
      let chat3: Conversation;

      await dialOverlayTest.step(
        'Prepare Chat1 with a single request-response pair and Chat2, Chat3 with more than 3 pairs',
        async () => {
          chat1 = conversationData.prepareDefaultConversation();
          conversationData.resetData();
          chat2 = conversationData.prepareModelConversationBasedOnRequests([
            GeneratorUtil.randomString(5),
            GeneratorUtil.randomString(5),
            GeneratorUtil.randomString(5),
            GeneratorUtil.randomString(5),
          ]);
          conversationData.resetData();
          chat3 = conversationData.prepareModelConversationBasedOnRequests([
            GeneratorUtil.randomString(5),
            GeneratorUtil.randomString(5),
            GeneratorUtil.randomString(5),
            GeneratorUtil.randomString(5),
          ]);
          await overlayDataInjector.createConversations([chat1, chat2, chat3]);
        },
      );

      await dialOverlayTest.step(
        `Open sandbox with Feature.SkipFocusChatInputOnLoad: ${isFeatureEnabled}, switch between Chat1, Chat2 and Chat3 and verify cursor state in the input field`,
        async () => {
          await overlayHomePage.navigateToUrl(
            isFeatureEnabled
              ? OverlaySandboxUrls.skipFocusSetSandboxUrl
              : OverlaySandboxUrls.enabledHeaderSandboxUrl,
          );
          await overlayHomePage.waitForPageLoaded();
          for (const chat of [chat1, chat2, chat3]) {
            await overlayHeader.leftPanelToggle.click();
            await overlayConversations.selectEntity(chat.name);
            await overlayBaseAssertion.assertIsElementFocused(
              overlaySendMessage.messageInput,
              !isFeatureEnabled,
            );
          }
        },
      );
    },
  );
}
