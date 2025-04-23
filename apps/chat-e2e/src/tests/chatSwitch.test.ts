import { Conversation } from '@/chat/types/chat';
import dialTest from '@/src/core/dialFixtures';
import { API, MenuOptions, MockedChatApiResponseBodies } from '@/src/testData';
import { Cursors } from '@/src/ui/domData';

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
        firstConversation = conversationData.prepareEmptyConversation();
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
          firstConversation,
          preReplayConversation,
          replayConversation,
          comparedConversation,
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

        await conversationAssertion.assertConversationCursor(
          firstConversation.name,
          Cursors.pointer,
        );
        await conversationAssertion.assertSelectedConversation(
          comparedConversation.name,
        );
        await conversations.selectConversation(firstConversation.name, {
          isHttpMethodTriggered: true,
        });
        await conversationAssertion.assertSelectedConversation(
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
        await conversationAssertion.assertConversationCursor(
          preReplayConversation.name,
          Cursors.notAllowed,
        );
        await conversationAssertion.assertConversationCursor(
          firstConversation.name,
          Cursors.notAllowed,
        );
      },
    );

    await dialTest.step(
      'Verify another conversation is not selectable during text generation',
      async () => {
        await conversations.selectConversation(preReplayConversation.name);
        await conversationAssertion.assertSelectedConversation(
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
        await conversations.selectConversation(replayConversation.name);
        await chat.replay.click();
      },
    );

    await dialTest.step(
      'Verify conversation cursor is "not-allowed" during the chat replay',
      async () => {
        await conversationAssertion.assertConversationCursor(
          preReplayConversation.name,
          Cursors.notAllowed,
        );
        await conversationAssertion.assertConversationCursor(
          replayConversation.name,
          Cursors.notAllowed,
        );
      },
    );

    await dialTest.step(
      'Verify another conversation is not selectable during text generation in Replay',
      async () => {
        await conversations.selectConversation(preReplayConversation.name);
        await conversationAssertion.assertSelectedConversation(
          replayConversation.name,
        );
      },
    );
  },
);
