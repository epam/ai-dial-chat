import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import { API, ExpectedMessages } from '@/src/testData';
import { responseThrottlingTimeout } from '@/src/ui/pages';
import { ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

let defaultModel: DialAIEntityModel;

dialTest.beforeAll(async () => {
  defaultModel = ModelsUtil.getDefaultAgent()!;
});

dialTest(
  'Message is send on Enter',
  async ({
    dialHomePage,
    chat,
    setTestIds,
    conversationData,
    dataInjector,
    chatHeader,
    modelInfoTooltip,
    chatSettingsTooltip,
    errorPopup,
    tooltipAssertion,
    conversationInfoTooltipAssertion,
    conversations,
    localStorageManager,
    baseAssertion,
  }) => {
    setTestIds('EPMRTC-473');
    let conversation: Conversation;
    const temp = 0;
    const request = 'This is a test request';

    await dialTest.step(
      'Prepare model conversation with non-default temperature',
      async () => {
        conversation = conversationData.prepareModelConversation(
          temp,
          '',
          defaultModel,
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
        await dialHomePage.throttleAPIResponse(
          API.chatHost,
          responseThrottlingTimeout * 2,
        );
        const requestsData = await chat.sendRequestWithKeyboard(request, false);
        baseAssertion.assertValue(
          requestsData.model.id,
          conversation.model.id,
          ExpectedMessages.requestModeIdIsValid,
        );
        baseAssertion.assertValue(
          requestsData.prompt,
          conversation.prompt,
          ExpectedMessages.requestPromptIsValid,
        );
        baseAssertion.assertValue(
          requestsData.temperature,
          conversation.temperature,
          ExpectedMessages.requestTempIsValid,
        );
      },
    );

    await dialTest.step(
      'Hover over chat header and verify chat model is correct on tooltip',
      async () => {
        await errorPopup.cancelPopup();
        await chatHeader.hoverOverChatModel();
        await conversationInfoTooltipAssertion.assertElementText(
          modelInfoTooltip.modelInfo,
          defaultModel.name,
          ExpectedMessages.chatInfoModelIsValid,
        );
        await conversationInfoTooltipAssertion.assertElementText(
          modelInfoTooltip.versionInfo,
          defaultModel.version!,
          ExpectedMessages.agentVersionIsValid,
        );

        await chatHeader.hoverOverChatSettings();
        await tooltipAssertion.assertElementText(
          chatSettingsTooltip.promptInfo,
          '',
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
    setTestIds('EPMRTC-490', 'EPMRTC-491');
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
