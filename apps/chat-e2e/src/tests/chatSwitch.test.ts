import { Conversation } from '@/chat/types/chat';
import dialTest from '@/src/core/dialFixtures';
import { API, MenuOptions, MockedChatApiResponseBodies } from '@/src/testData';
import { Cursors } from '@/src/ui/domData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';

dialTest(
  'Another chat is not available while AI is generating a response.\n' +
    'Chat menu is not available while AI is generating a response.\n' +
    'Switching to another chat is not available while AI is replaying a chat\n' +
    'Switching to another chat is not available while AI is regenerating response in compare mode',
  async ({
    dialHomePage,
    conversations,
    conversationData,
    dataInjector,
    setTestIds,
    chat,
    conversationAssertion,
    baseAssertion,
    sendMessage,
    conversationDropdownMenu,
    compareConversation,
    conversationToCompareAssertion,
    localStorageManager,
    sendMessageAssertion,
  }) => {
    setTestIds(
      'EPMRTC-598',
      'EPMRTC-599',
      'EPMRTC-600',
      'EPMRTC-601',
      'EPMRTC-602',
    );
    const request =
      'give me a sci-fi story with a main topic of your choice. 200 tokens minimum';
    let firstConversation: Conversation;
    let preReplayConversation: Conversation;
    let replayConversation: Conversation;
    let comparedConversation: Conversation;

    await dialTest.step(
      'Prepare 1 empty conversation, replay conversation and 2 default conversations',
      async () => {
        firstConversation = conversationData.prepareEmptyConversation(
          ModelsUtil.getDefaultAgent()!,
          `z${GeneratorUtil.randomString(10)}`,
        );
        conversationData.resetData();
        preReplayConversation = conversationData.prepareDefaultConversation();
        conversationData.resetData();
        comparedConversation = conversationData.prepareDefaultConversation();
        conversationData.resetData();
        replayConversation = conversationData.prepareDefaultReplayConversation(
          preReplayConversation,
        );
        conversationData.resetData();

        await dataInjector.createConversations([
          preReplayConversation,
          replayConversation,
          comparedConversation,
          firstConversation,
        ]);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Verify another conversation is selectable during being in compare mode',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.openEntityDropdownMenu(preReplayConversation.name, {
          exactMatch: true,
        });
        await conversationDropdownMenu.selectMenuOption(MenuOptions.compare);
        await conversationToCompareAssertion.assertConversationToCompareState(
          'visible',
        );
        await conversationToCompareAssertion.assertElementState(
          compareConversation.showAllConversationsCheckbox,
          'visible',
        );
        await compareConversation.checkShowAllConversations();
        await compareConversation.selectCompareConversation(
          comparedConversation.name,
        );

        await conversationAssertion.assertEntityCursor(
          firstConversation.name,
          Cursors.pointer,
        );
        await conversationAssertion.assertSelectedEntity(
          comparedConversation.name,
        );
        await conversations.selectEntity(firstConversation.name);
        await conversationAssertion.assertSelectedEntity(
          firstConversation.name,
        );
        await baseAssertion.assertElementState(
          chat.changeAgentButton,
          'visible',
        );
        await baseAssertion.assertElementState(
          chat.configureSettingsButton,
          'visible',
        );
        await sendMessageAssertion.assertElementState(
          sendMessage.messageInput,
          'visible',
        );
      },
    );

    await dialTest.step('Send request to the first conversation', async () => {
      await dialHomePage.mockChatTextResponse(
        MockedChatApiResponseBodies.simpleTextBody,
      );
      await dialHomePage.throttleAPIResponse(API.chatHost);
      await chat.sendRequestWithButton(request, false);
      firstConversation.name = request;
    });

    await dialTest.step(
      'Verify any conversation cursor is "not-allowed" during text generation',
      async () => {
        await conversationAssertion.assertEntityCursor(
          preReplayConversation.name,
          Cursors.notAllowed,
        );
        await conversationAssertion.assertEntityCursor(
          firstConversation.name,
          Cursors.notAllowed,
        );
      },
    );

    await dialTest.step(
      'Verify another conversation is not selectable during text generation',
      async () => {
        await conversations.selectEntity(preReplayConversation.name);
        await conversationAssertion.assertSelectedEntity(
          firstConversation.name,
        );
      },
    );

    await dialTest.step(
      'Select [Replay] conversation and start generation',
      async () => {
        await sendMessageAssertion.assertElementState(
          sendMessage.stopGenerating,
          'visible',
        );
        await sendMessage.stopGenerating.click();
        await conversations.selectEntity(replayConversation.name);
        await chat.replay.click();
      },
    );

    await dialTest.step(
      'Verify conversation cursor is "not-allowed" during the chat replay',
      async () => {
        await conversationAssertion.assertEntityCursor(
          preReplayConversation.name,
          Cursors.notAllowed,
        );
        await conversationAssertion.assertEntityCursor(
          replayConversation.name,
          Cursors.notAllowed,
        );
      },
    );

    await dialTest.step(
      'Verify another conversation is not selectable during text generation in Replay',
      async () => {
        await conversations.selectEntity(preReplayConversation.name);
        await conversationAssertion.assertSelectedEntity(
          replayConversation.name,
        );
      },
    );
  },
);
