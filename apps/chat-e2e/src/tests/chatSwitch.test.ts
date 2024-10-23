import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import { noSimpleModelSkipReason } from '@/src/core/baseFixtures';
import dialTest from '@/src/core/dialFixtures';
import { API, ExpectedMessages, MenuOptions } from '@/src/testData';
import { Cursors } from '@/src/ui/domData';
import { ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

let simpleRequestModel: DialAIEntityModel | undefined;

dialTest.beforeAll(async () => {
  simpleRequestModel = ModelsUtil.getModelForSimpleRequest();
});

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
    sendMessage,
    conversationDropdownMenu,
    compareConversation,
  }) => {
    dialTest.skip(simpleRequestModel === undefined, noSimpleModelSkipReason);
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
          simpleRequestModel!,
        );
        conversationData.resetData();
        preReplayConversation = conversationData.prepareDefaultConversation(
          simpleRequestModel!,
        );
        conversationData.resetData();
        comparedConversation = conversationData.prepareDefaultConversation(
          simpleRequestModel!,
        );
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
      },
    );

    await dialTest.step(
      'Verify another conversation is selectable during being in compare mode',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.openEntityDropdownMenu(preReplayConversation.name, {exactMatch: true});
        await conversationDropdownMenu.selectMenuOption(MenuOptions.compare);
        await expect
          .soft(
            compareConversation.getElementLocator(),
            ExpectedMessages.conversationToCompareVisible,
          )
          .toBeVisible();
        await compareConversation.checkShowAllConversations();
        await compareConversation.selectCompareConversation(
          comparedConversation.name,
        );

        await conversationAssertion.assertConversationCursor(
          firstConversation.name,
          Cursors.pointer,
        );
        await conversations.getEntityByName(firstConversation.name).click();
        await conversationAssertion.assertSelectedConversation(
          firstConversation.name,
        );
      },
    );

    await dialTest.step('Send request to the first conversation', async () => {
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
        await conversations.getEntityByName(preReplayConversation.name).click();
        await conversationAssertion.assertSelectedConversation(
          firstConversation.name,
        );
      },
    );

    await dialTest.step(
      'Select [Replay] conversation and start generation',
      async () => {
        await sendMessage.stopGenerating.waitForState({ state: 'visible' });
        await sendMessage.stopGenerating.click();
        await conversations.getEntityByName(replayConversation.name).click();
        await chat.startReplay();
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
        await conversations.getEntityByName(preReplayConversation.name).click();
        await conversationAssertion.assertSelectedConversation(
          replayConversation.name,
        );
      },
    );
  },
);
