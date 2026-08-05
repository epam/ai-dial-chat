import { Conversation } from '@/chat/types/chat';
import dialTest from '@/src/core/dialFixtures';
import { ExpectedMessages, MockedChatApiResponseBodies } from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

dialTest(
  'Message is send on Enter',
  async ({
    dialHomePage,
    chat,
    toast,
    setTestIds,
    conversationData,
    dataInjector,
    chatHeader,
    modelInfoTooltip,
    chatSettingsTooltip,
    tooltipAssertion,
    conversationInfoTooltipAssertion,
    conversations,
    localStorageManager,
    apiAssertion,
  }) => {
    setTestIds('EPMDIAL-2456');
    let conversation: Conversation;
    const temp = 0;
    const request = 'This is a test request';
    const model = GeneratorUtil.randomArrayElement(
      ModelsUtil.getModels().filter((m) => m.features?.temperature === true),
    );

    await dialTest.step(
      'Prepare model conversation with non-default temperature',
      async () => {
        conversation = conversationData.prepareModelConversation(
          temp,
          '',
          model,
        );
        await dataInjector.createConversations([conversation]);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Send new request in chat and verify request is sent with valid data',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(conversation.name);
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        const requestsData = await chat.sendRequestWithKeyboard(request, false);
        await toast.closeToast();
        apiAssertion.assertRequestModelId(
          requestsData.completionRequest,
          model,
        );
        apiAssertion.assertRequestPrompt(
          requestsData.completionRequest,
          model.features?.systemPrompt === true
            ? conversation.prompt
            : undefined,
        );
        apiAssertion.assertRequestTemperature(
          requestsData.completionRequest,
          conversation.temperature,
        );
      },
    );

    await dialTest.step(
      'Hover over chat header and verify chat model is correct on tooltip',
      async () => {
        await chatHeader.hoverOverChatModel();
        await conversationInfoTooltipAssertion.assertElementText(
          modelInfoTooltip.modelInfo,
          model.name,
          ExpectedMessages.chatInfoModelIsValid,
        );
        model.version
          ? await conversationInfoTooltipAssertion.assertElementText(
              modelInfoTooltip.versionInfo,
              model.version!,
              ExpectedMessages.agentVersionIsValid,
            )
          : await conversationInfoTooltipAssertion.assertElementState(
              modelInfoTooltip.versionInfo,
              'hidden',
            );

        await chatHeader.hoverOverChatSettings();
        await tooltipAssertion.assertElementState(
          chatSettingsTooltip.promptInfo,
          'hidden',
        );
        await tooltipAssertion.assertElementText(
          chatSettingsTooltip.temperatureInfo,
          conversation.temperature,
          ExpectedMessages.chatInfoTemperatureIsValid,
        );
      },
    );
  },
);

dialTest(
  'Clear conversations using button in chat. Cancel.\n' +
    'Clear conversation using button in chat. Ok',
  async ({
    dialHomePage,
    setTestIds,
    chatMessages,
    conversationData,
    dataInjector,
    chatHeader,
    confirmationDialog,
    agentInfoAssertion,
    agentInfo,
    conversations,
    localStorageManager,
  }) => {
    setTestIds('EPMDIAL-5929', 'EPMDIAL-5930');
    let conversation: Conversation;
    await dialTest.step('Prepare conversation with history', async () => {
      conversation = conversationData.prepareModelConversationBasedOnRequests([
        'first request',
        'second request',
        'third request',
      ]);
      await dataInjector.createConversations([conversation]);
      await localStorageManager.setShowSideBarPanels();
    });

    await dialTest.step(
      'Try to clear conversation messages using header button but cancel clearing and verify no messages deleted',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(conversation.name);
        await chatHeader.clearConversation.click();
        await confirmationDialog.cancelDialog();

        const messagesCount =
          await chatMessages.chatMessages.getElementsCount();
        expect
          .soft(messagesCount, ExpectedMessages.messageContentIsValid)
          .toBe(conversation.messages.length);
      },
    );

    await dialTest.step(
      'Clear conversation messages using header button and verify messages deleted, setting are shown',
      async () => {
        await chatHeader.clearConversation.click();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'PUT' });
        await agentInfoAssertion.assertElementState(agentInfo, 'visible');
      },
    );
  },
);
