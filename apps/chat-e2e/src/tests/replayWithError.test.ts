import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import { ExpectedConstants, ExpectedMessages, ModelIds } from '@/src/testData';
import { ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

let gpt35Model: DialAIEntityModel;
dialTest.beforeAll(async () => {
  gpt35Model = ModelsUtil.getModel(ModelIds.GPT_3_5_TURBO)!;
});

dialTest(
  'Restart replay after error appeared on browser refresh.\n' +
    'Restart replay after error appeared on network interruption',
  async ({
    dialHomePage,
    conversationData,
    chat,
    localStorageManager,
    dataInjector,
    setTestIds,
    chatMessages,
    tooltip,
    context,
  }) => {
    setTestIds('EPMRTC-514', 'EPMRTC-1165');
    let conversation: Conversation;
    let replayConversation: Conversation;
    await dialTest.step('Prepare conversation to replay', async () => {
      conversation = conversationData.prepareDefaultConversation(gpt35Model);
      replayConversation =
        conversationData.prepareDefaultReplayConversation(conversation);
      await dataInjector.createConversations([
        conversation,
        replayConversation,
      ]);
      await localStorageManager.setSelectedConversation(replayConversation);
    });

    await dialTest.step(
      'Press Start replay and interrupt it with network error',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await context.setOffline(true);
        await chat.startReplay();
      },
    );

    await dialTest.step('Verify error message is displayed', async () => {
      const generatedContent = await chatMessages.getLastMessageContent();

      await chat.proceedGenerating.hoverOver();
      const tooltipContent = await tooltip.getContent();

      expect
        .soft(generatedContent, ExpectedMessages.errorReceivedOnReplay)
        .toBe(ExpectedConstants.answerError);
      expect
        .soft(tooltipContent, ExpectedMessages.proceedReplayIsVisible)
        .toBe(ExpectedConstants.continueReplayAfterErrorLabel);
    });

    await dialTest.step(
      'Proceed replaying and verify response received',
      async () => {
        await context.setOffline(false);
        await chat.proceedReplaying(true);
        const generatedContent = await chatMessages.getGeneratedChatContent(
          conversation.messages.length,
        );
        expect
          .soft(
            generatedContent.includes(
              conversation.messages.find((m) => m.role === 'user')!.content,
            ),
            ExpectedMessages.replayContinuesFromReceivedContent,
          )
          .toBeTruthy();
      },
    );
  },
);

dialTest(
  'Start replay button appears in [Replay]chat if the parent chat has error in the response',
  async ({
    dialHomePage,
    conversationData,
    chat,
    localStorageManager,
    dataInjector,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1312');
    let errorConversation: Conversation;
    let replayConversation: Conversation;

    await dialTest.step(
      'Prepare errorConversation with error response and replay errorConversation',
      async () => {
        errorConversation =
          conversationData.prepareErrorResponseConversation(gpt35Model);
        replayConversation =
          conversationData.prepareDefaultReplayConversation(errorConversation);
        await dataInjector.createConversations([
          errorConversation,
          replayConversation,
        ]);
        await localStorageManager.setSelectedConversation(replayConversation);
      },
    );

    await dialTest.step(
      'Verify "Start Replay" button is available',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();

        const isStartReplayEnabled = await chat.replay.isElementEnabled();
        expect
          .soft(isStartReplayEnabled, ExpectedMessages.startReplayVisible)
          .toBeTruthy();
      },
    );
  },
);

dialTest(
  `"Replay as is" when restricted Model is used in parent chat`,
  async ({
    dialHomePage,
    conversationData,
    chat,
    localStorageManager,
    dataInjector,
    talkToSelector,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1328');
    let notAllowedModelConversation: Conversation;
    let replayConversation: Conversation;

    await dialTest.step(
      'Prepare conversation with not allowed model and replay for it',
      async () => {
        notAllowedModelConversation =
          conversationData.prepareDefaultConversation('not_allowed_model');
        replayConversation = conversationData.prepareDefaultReplayConversation(
          notAllowedModelConversation,
        );
        await dataInjector.createConversations([
          notAllowedModelConversation,
          replayConversation,
        ]);
        await localStorageManager.setSelectedConversation(replayConversation);
      },
    );

    await dialTest.step(
      'Verify "Start Replay" button is not displayed, error is shown at the bottom',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();

        await talkToSelector.waitForState({ state: 'attached' });

        const isStartReplayVisible = await chat.replay.isVisible();
        expect
          .soft(isStartReplayVisible, ExpectedMessages.startReplayNotVisible)
          .toBeFalsy();

        const notAllowedModelError =
          await chat.notAllowedModelLabel.getElementContent();
        expect
          .soft(
            notAllowedModelError!.trim(),
            ExpectedMessages.notAllowedModelErrorDisplayed,
          )
          .toBe(ExpectedConstants.notAllowedModelError);
      },
    );

    await dialTest.step(
      'Select any available model and start replaying',
      async () => {
        await talkToSelector.selectModel(gpt35Model);
        const replayRequest = await chat.startReplay();
        expect
          .soft(replayRequest.modelId, ExpectedMessages.chatRequestModelIsValid)
          .toBe(gpt35Model.id);
      },
    );
  },
);
