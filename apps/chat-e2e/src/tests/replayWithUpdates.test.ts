import { ChatBody, Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import { ExpectedMessages, ModelIds } from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

let gpt35Model: DialAIEntityModel;
let bison: DialAIEntityModel;

dialTest.beforeAll(async () => {
  gpt35Model = ModelsUtil.getModel(ModelIds.GPT_3_5_TURBO)!;
  bison = ModelsUtil.getModel(ModelIds.CHAT_BISON)!;
});

dialTest(
  'Start replay with the new Model settings',
  async ({
    dialHomePage,
    conversationData,
    chat,
    localStorageManager,
    dataInjector,
    setTestIds,
    chatHeader,
    entitySettings,
    temperatureSlider,
    talkToSelector,
    chatInfoTooltip,
    errorPopup,
    iconApiHelper,
  }) => {
    setTestIds('EPMRTC-508');
    const replayTemp = 0;
    const replayPrompt = 'reply the same text';
    const replayModel = bison;

    await dialTest.step('Prepare conversation to replay', async () => {
      const conversation =
        conversationData.prepareDefaultConversation(gpt35Model);
      const replayConversation =
        conversationData.prepareDefaultReplayConversation(conversation);
      await dataInjector.createConversations([
        conversation,
        replayConversation,
      ]);
      await localStorageManager.setSelectedConversation(replayConversation);
    });

    let replayRequest: ChatBody;
    await dialTest.step(
      'Change model and settings for replay conversation and press Start replay',
      async () => {
        await dialHomePage.openHomePage({
          iconsToBeLoaded: [gpt35Model.iconUrl],
        });
        await dialHomePage.waitForPageLoaded();
        await talkToSelector.selectModel(bison);
        await entitySettings.setSystemPrompt(replayPrompt);
        await temperatureSlider.setTemperature(replayTemp);
        replayRequest = await chat.startReplay();
      },
    );

    await dialTest.step(
      'Verify chat API request is sent with correct settings',
      async () => {
        expect
          .soft(replayRequest.modelId, ExpectedMessages.chatRequestModelIsValid)
          .toBe(bison.id);
        expect
          .soft(replayRequest.prompt, ExpectedMessages.chatRequestPromptIsValid)
          .toBe(replayPrompt);
        expect
          .soft(
            replayRequest.temperature,
            ExpectedMessages.chatRequestTemperatureIsValid,
          )
          .toBe(replayTemp);
      },
    );

    await dialTest.step(
      'Verify chat header icons are updated with new model and addon',
      async () => {
        const headerModelIcon = await chatHeader.getHeaderModelIcon();
        const expectedModelIcon = await iconApiHelper.getEntityIcon(bison);
        expect
          .soft(headerModelIcon, ExpectedMessages.entityIconIsValid)
          .toBe(expectedModelIcon);
      },
    );

    await dialTest.step(
      'Hover over chat header model and verify chat settings on tooltip',
      async () => {
        await errorPopup.cancelPopup();
        await chatHeader.hoverOverChatModel();
        const modelInfo = await chatInfoTooltip.getModelInfo();
        expect
          .soft(modelInfo, ExpectedMessages.chatInfoModelIsValid)
          .toBe(ModelsUtil.getModelInfo(bison.id));

        const expectedReplayModelIcon =
          await iconApiHelper.getEntityIcon(replayModel);
        const modelInfoIcon = await chatInfoTooltip.getModelIcon();
        expect
          .soft(modelInfoIcon, ExpectedMessages.chatInfoModelIconIsValid)
          .toBe(expectedReplayModelIcon);

        const promptInfo = await chatInfoTooltip.getPromptInfo();
        expect
          .soft(promptInfo, ExpectedMessages.chatInfoPromptIsValid)
          .toBe(replayPrompt);

        const tempInfo = await chatInfoTooltip.getTemperatureInfo();
        expect
          .soft(tempInfo, ExpectedMessages.chatInfoTemperatureIsValid)
          .toBe(replayTemp.toString());
      },
    );
  },
);

dialTest(
  'Replay function is still available if the name was edited.\n' +
    'Start replay works in renamed [Replay]chat.\n' +
    'Regenerate response in already replayed chat.\n' +
    'Continue conversation in already replayed chat',
  async ({
    dialHomePage,
    conversationData,
    chat,
    localStorageManager,
    dataInjector,
    chatMessages,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-505', 'EPMRTC-506', 'EPMRTC-515', 'EPMRTC-516');
    let conversation: Conversation;
    let replayConversation: Conversation;

    await dialTest.step(
      'Prepare conversation to replay with updated name',
      async () => {
        conversation = conversationData.prepareModelConversationBasedOnRequests(
          gpt35Model,
          ['1+2'],
        );
        replayConversation =
          conversationData.prepareDefaultReplayConversation(conversation);
        replayConversation.name = GeneratorUtil.randomString(7);
        await dataInjector.createConversations([
          conversation,
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

    await dialTest.step(
      'Start replaying and verify replaying is in progress',
      async () => {
        const replayRequest = await chat.startReplay(
          conversation.messages[0].content,
          true,
        );
        expect
          .soft(replayRequest.modelId, ExpectedMessages.chatRequestModelIsValid)
          .toBe(conversation.model.id);
      },
    );

    await dialTest.step(
      'Regenerate response and verify it regenerated',
      async () => {
        await chatMessages.regenerateResponse();
        const messagesCount =
          await chatMessages.chatMessages.getElementsCount();
        expect
          .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
          .toBe(conversation.messages.length);
      },
    );

    await dialTest.step(
      'Send a new message to chat and verify response received',
      async () => {
        const newMessage = '2+3';
        const newRequest = await chat.sendRequestWithButton(newMessage);
        expect
          .soft(newRequest.modelId, ExpectedMessages.chatRequestModelIsValid)
          .toBe(conversation.model.id);
        expect
          .soft(
            newRequest.messages[2].content,
            ExpectedMessages.chatRequestMessageIsValid,
          )
          .toBe(newMessage);
      },
    );
  },
);
