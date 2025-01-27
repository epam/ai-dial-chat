import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MockedChatApiResponseBodies,
} from '@/src/testData';
import { ModelsUtil } from '@/src/utils';
import { GeneratorUtil } from '@/src/utils/generatorUtil';

dialTest.only(
  'New conversation stays on Back to Chat if new conversation was on the screen',
  async ({
    dialHomePage,
    header,
    chat,
    talkToAgentDialog,
    setTestIds,
    localStorageManager,
    conversationAssertion,
    conversations,
    chatHeader,
    confirmationDialog,
  }) => {
    setTestIds('EPMRTC-4587');
    const initialConversationName = GeneratorUtil.randomString(7);

    await dialTest.step(
      'Open the home page and set a random model to recent',
      async () => {
        const randomModel = GeneratorUtil.randomArrayElement(
          ModelsUtil.getModels(),
        );
        await localStorageManager.setRecentModelsIdsOnce(randomModel);
        await dialHomePage.openHomePage({
          iconsToBeLoaded: randomModel.iconUrl
            ? [randomModel.iconUrl]
            : undefined,
        });
      },
    );

    await dialTest.step('Verify initial state', async () => {
      await dialHomePage.waitForPageLoaded();
      await chat.getSendMessage().waitForState({ state: 'attached' });
      await conversationAssertion.assertNoConversationIsSelected();
    });

    await dialTest.step('Navigate to Marketplace', async () => {
      await chat.changeAgentButton.click();
      await talkToAgentDialog.goToMyWorkspace();
    });

    await dialTest.step('Click "Back to Chat"', async () => {
      await header.backToChatButton.click();
    });

    await dialTest.step('Verify final state', async () => {
      await dialHomePage.waitForPageLoaded();
      await chat.getSendMessage().waitForState({ state: 'attached' });
      await conversationAssertion.assertNoConversationIsSelected();
    });

    await dialTest.step(
      'Create new conversation and clear the history',
      async () => {
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequestWithButton(initialConversationName);
        await chatHeader.clearConversation.click();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'PUT' });
      },
    );

    await dialTest.step('Verify chat stays selected', async () => {
      await dialHomePage.waitForPageLoaded();
      await conversationAssertion.assertSelectedConversation(
        initialConversationName,
      );
      await chat.getSendMessage().waitForState({ state: 'attached' });
    });

    await dialTest.step(
      'Refresh the page and verify conversation state',
      async () => {
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await chat.getSendMessage().waitForState({ state: 'attached' });
        await conversationAssertion.assertSelectedConversation(
          initialConversationName,
        );
        await conversationAssertion.assertEntitiesCount(1);
      },
    );
  },
);
