import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MockedChatApiResponseBodies,
} from '@/src/testData';
import { ModelsUtil } from '@/src/utils';
import { GeneratorUtil } from '@/src/utils/generatorUtil';

dialTest.only(
  'New conversation stays on Back to Chat if new conversation was on the screen\n' +
    'New conversation is NOT created on browser refresh if conversation with cleared history is focused\n' +
    'New conversation is NOT created on Back to Chat if conversation with history was focused\n' +
    'New conversation is NOT created on Search on My workspace opened from the chat header\n' +
    'New conversation is created on browser refresh if conversation with history from Pinned or Today is focused',
  async ({
    dialHomePage,
    header,
    chat,
    talkToAgentDialog,
    setTestIds,
    localStorageManager,
    conversationAssertion,
    chatHeader,
    confirmationDialog,
    chatMessagesAssertion,
    chatHeaderAssertion,
    marketplacePage,
  }) => {
    setTestIds(
      'EPMRTC-4587',
      'EPMRTC-4586',
      'EPMRTC-4718',
      'EPMRTC-4590',
      'EPMRTC-4588',
    );
    const initialConversationName = GeneratorUtil.randomString(7);
    let models: DialAIEntityModel[];

    await dialTest.step(' set a random model to recent', async () => {
      models = GeneratorUtil.randomArrayElements(
        ModelsUtil.getModels().filter((m) => m.iconUrl !== undefined),
        2,
      );
      await localStorageManager.setRecentModelsIdsOnce(...models);
    });

    await dialTest.step(
      'Open the home page and verify initial state',
      async () => {
        await dialHomePage.openHomePage({
          iconsToBeLoaded: models[0].iconUrl ? [models[0].iconUrl] : undefined,
        });
        await dialHomePage.waitForPageLoaded();
        await chat.getSendMessage().waitForState({ state: 'attached' });
        await conversationAssertion.assertNoConversationIsSelected();
      },
    );

    await dialTest.step('Navigate to Marketplace', async () => {
      await chat.changeAgentButton.click();
      await talkToAgentDialog.goToMyWorkspace();
    });

    await dialTest.step('Click "Back to Chat"', async () => {
      await header.backToChatButton.click();
    });

    await dialTest.step(
      'Verify nothing changes after going back to chat',
      async () => {
        await dialHomePage.waitForPageLoaded();
        await chat.getSendMessage().waitForState({ state: 'attached' });
        await conversationAssertion.assertNoConversationIsSelected();
      },
    );

    await dialTest.step('Send a message to the chat', async () => {
      await dialHomePage.mockChatTextResponse(
        MockedChatApiResponseBodies.simpleTextBody,
      );
      await chat.sendRequestWithButton(initialConversationName);
    });

    await dialTest.step('Navigate to Marketplace', async () => {
      await chatHeader.chatAgent.click();
      await talkToAgentDialog.goToMyWorkspace();
    });

    await dialTest.step('Click "Back to Chat"', async () => {
      await header.backToChatButton.click();
    });

    await dialTest.step('Verify chat stays selected', async () => {
      await conversationAssertion.assertSelectedConversation(
        initialConversationName,
      );
      await chatMessagesAssertion.assertMessageContent(
        1,
        initialConversationName,
      );
      await chatMessagesAssertion.assertMessageContent(2, 'Response');
      await conversationAssertion.assertEntitiesCount(1);
    });

    await dialTest.step(
      'Change model and verify the chat stays selected',
      async () => {
        await chatHeader.chatAgent.click();
        await talkToAgentDialog.selectAgent(models[1], marketplacePage);
        const expectedModelIcon = ModelsUtil.getOpenAIEntity(
          models[1].id,
        )!.iconUrl!;
        await chatHeaderAssertion.assertHeaderIcon(expectedModelIcon);
        await chatMessagesAssertion.assertMessageContent(
          1,
          initialConversationName,
        );
        await chatMessagesAssertion.assertMessageContent(2, 'Response');
        await conversationAssertion.assertEntitiesCount(1);
        await conversationAssertion.assertSelectedConversation(
          initialConversationName,
        );
      },
    );

    await dialTest.step(
      'Reload the page after the selection of the non-empty conversation and verify the regular start page is opened. No conversation is selected',
      async () => {
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await conversationAssertion.assertNoConversationIsSelected();
        await chat.getSendMessage().waitForState({ state: 'attached' });
      },
    );

    await dialTest.step('Clear the history', async () => {
      await chatHeader.clearConversation.click();
      await confirmationDialog.confirm({ triggeredHttpMethod: 'PUT' });
    });

    await dialTest.step('Verify chat stays selected', async () => {
      await dialHomePage.waitForPageLoaded();
      await conversationAssertion.assertSelectedConversation(
        initialConversationName,
      );
      await chat.getSendMessage().waitForState({ state: 'attached' });
    });

    await dialTest.step(
      'Refresh the page and verify that empty conversation stays selected, no new conversations is created',
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
