import { Conversation } from '@/chat/types/chat';
import dialTest from '@/src/core/dialFixtures';
import { Colors } from '@/src/ui/domData';
import { ModelsUtil } from '@/src/utils';

dialTest(
  'Show more/less hides stages after 3rd',
  async ({
    dialHomePage,
    conversationData,
    localStorageManager,
    dataInjector,
    setTestIds,
    chatMessages,
    chatMessagesAssertion,
  }) => {
    setTestIds('EPMRTC-1757');
    let conversation: Conversation;
    const stagesCount = 5;
    const maxDisplayedStagesCount = 3;

    await dialTest.step(
      'Prepare conversation with 3+ stages in response',
      async () => {
        conversation = conversationData.prepareConversationWithStagesInResponse(
          ModelsUtil.getDefaultModel()!,
          stagesCount,
        );
        await dataInjector.createConversations([conversation]);
        await localStorageManager.setSelectedConversation(conversation);
      },
    );

    await dialTest.step(
      'Open conversation, verify first 3 stages are displayed, other are hidden under "Show more" blue button',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await chatMessagesAssertion.assertMessageStagesCount(
          2,
          maxDisplayedStagesCount,
        );
        await chatMessagesAssertion.assertShowMoreLessButtonState(
          'more',
          'visible',
        );
        await chatMessagesAssertion.assertShowMoreLessButtonColor(
          'more',
          Colors.controlsBackgroundAccent,
        );
      },
    );

    await dialTest.step(
      'Click on "Show more" and verify all stages and "Show less" button are displayed',
      async () => {
        await chatMessages.showMoreButton.click();
        await chatMessagesAssertion.assertMessageStagesCount(2, stagesCount);
        await chatMessagesAssertion.assertShowMoreLessButtonState(
          'less',
          'visible',
        );
        await chatMessagesAssertion.assertShowMoreLessButtonColor(
          'less',
          Colors.controlsBackgroundAccent,
        );
      },
    );

    await dialTest.step(
      'Click on "Show less" and verify 3 stages and "Show more" button are displayed',
      async () => {
        await chatMessages.showLessButton.click();
        await chatMessagesAssertion.assertMessageStagesCount(
          2,
          maxDisplayedStagesCount,
        );
        await chatMessagesAssertion.assertShowMoreLessButtonState(
          'more',
          'visible',
        );
      },
    );
  },
);
