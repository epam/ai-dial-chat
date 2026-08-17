import { modelCursorSign } from '@/chat/constants/chat';
import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  MockedChatApiResponseBodies,
} from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { ConversationResponseFormat } from '@epam/ai-dial-shared';

const firstResponseMessageIndex = 2;
const secondResponseMessageIndex = 4;
const request = 'Generate one MD table';
const tableInPlainText = `| Country | Capital |
| --- | --- |
| Canada | Ottawa |
| United States | Washington, D.C. |`;

let randomModel: DialAIEntityModel;

dialTest.beforeAll(async () => {
  randomModel = GeneratorUtil.randomArrayElement(ModelsUtil.getLatestModels());
});

dialTest(
  'Check response format in the chat history.\n' +
    'Check tooltip in the Chat header.\n' +
    'Check tooltip explanation for Response format on Conversation settings modal.\n' +
    'Check response format is not stored for the next chat',
  async ({
    dialHomePage,
    setTestIds,
    localStorageManager,
    chat,
    chatHeader,
    chatMessages,
    chatMessagesAssertion,
    conversationSettingsModal,
    agentSettings,
    agentSettingAssertion,
    apiAssertion,
    chatSettingsTooltip,
    tooltipAssertion,
    chatBar,
    conversations,
  }) => {
    setTestIds('EPMDIAL-5985', 'EPMDIAL-5984', 'EPMDIAL-5983', 'EPMDIAL-5986');

    await dialTest.step(
      'Send a request that generates a table and verify the default value of responseFormat field',
      async () => {
        await localStorageManager.setRecentModelsIdsAndUseLastModel(
          randomModel,
        );
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.mdTableBody,
        );
        const requestData = await chat.sendRequestWithButton(request, true);
        apiAssertion.assertRequestResponseFormat(
          requestData.conversationUpdateRequest,
          ConversationResponseFormat.Markdown,
        );
      },
    );

    await dialTest.step(
      'Verify the table is rendered as markdown by default',
      async () => {
        await chatMessagesAssertion.assertElementState(
          chatMessages.getChatMessageTable(firstResponseMessageIndex),
          'visible',
          ExpectedMessages.tableIsVisible,
        );
      },
    );

    await dialTest.step(
      'Open conversation settings and verify Markdown is selected by default',
      async () => {
        await chatHeader.openConversationSettingsPopup();
        await agentSettingAssertion.assertResponseFormat(
          ConversationResponseFormat.Markdown,
        );
      },
    );

    await dialTest.step(
      'Hover over the question icon next to Response format and verify the tooltip explanation',
      async () => {
        await agentSettings.responseFormatHelpIcon.hoverOver();
        await tooltipAssertion.assertTooltipContent(
          ExpectedConstants.responseFormatExplanationTooltip,
        );
      },
    );

    await dialTest.step(
      'Close conversation settings, hover over the Gear icon and verify the tooltip shows Response format: Markdown',
      async () => {
        await conversationSettingsModal.cancelButton.click();
        await chatHeader.hoverOverChatSettings();
        await tooltipAssertion.assertElementText(
          chatSettingsTooltip.responseFormatInfo,
          ConversationResponseFormat.Markdown,
          ExpectedMessages.chatInfoResponseFormatIsValid,
        );
      },
    );

    await dialTest.step(
      'Change response format to Plain text and apply changes',
      async () => {
        await chatHeader.openConversationSettingsPopup();
        await agentSettings.setResponseFormat(
          ConversationResponseFormat.PlainText,
        );
        await conversationSettingsModal.applyChanges();
      },
    );

    await dialTest.step(
      'Hover over the Gear icon and verify the tooltip shows Response format: Plain text',
      async () => {
        await chatHeader.hoverOverChatSettings();
        await tooltipAssertion.assertElementText(
          chatSettingsTooltip.responseFormatInfo,
          ConversationResponseFormat.PlainText,
          ExpectedMessages.chatInfoResponseFormatIsValid,
        );
      },
    );

    await dialTest.step(
      'Verify the previously generated table is now rendered as plain text',
      async () => {
        await chatMessagesAssertion.assertElementState(
          chatMessages.getChatMessageTable(firstResponseMessageIndex),
          'hidden',
          ExpectedMessages.tableIsHidden,
        );
        await chatMessagesAssertion.assertElementText(
          chatMessages.getChatMessageContent(firstResponseMessageIndex),
          tableInPlainText,
        );
      },
    );

    await dialTest.step(
      'Send one more request that generates a table and verify the value of responseFormat is changed accordingly',
      async () => {
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.mdTableBody,
        );
        const requestData = await chat.sendRequestWithButton(
          'Generate one more MD table',
          true,
        );
        apiAssertion.assertRequestResponseFormat(
          requestData.conversationUpdateRequest,
          ConversationResponseFormat.PlainText,
        );
      },
    );

    await dialTest.step(
      'Verify the response format change is applied to the whole conversation, including the newly generated message',
      async () => {
        await chatMessagesAssertion.assertElementState(
          chatMessages.getChatMessageTable(secondResponseMessageIndex),
          'hidden',
          ExpectedMessages.tableIsHidden,
        );
        await chatMessagesAssertion.assertElementText(
          chatMessages.getChatMessageContent(secondResponseMessageIndex),
          tableInPlainText,
        );
      },
    );

    await dialTest.step(
      'Click on + to create a new chat and verify Response format is not stored, defaulting to Markdown',
      async () => {
        await chatBar.createNewEntity();
        await chat.configureSettingsButton.click();
        await agentSettingAssertion.assertResponseFormat(
          ConversationResponseFormat.Markdown,
        );
        await conversationSettingsModal.cancelButton.click();
      },
    );

    await dialTest.step('Return to the original conversation', async () => {
      await conversations.selectEntity(request);
    });

    await dialTest.step(
      'Change response format back to Markdown and apply changes',
      async () => {
        await chatHeader.openConversationSettingsPopup();
        await agentSettings.setResponseFormat(
          ConversationResponseFormat.Markdown,
        );
        await conversationSettingsModal.applyChanges();
      },
    );

    await dialTest.step(
      'Hover over the Gear icon and verify the tooltip shows Response format: Markdown',
      async () => {
        await chatHeader.hoverOverChatSettings();
        await tooltipAssertion.assertElementText(
          chatSettingsTooltip.responseFormatInfo,
          ConversationResponseFormat.Markdown,
          ExpectedMessages.chatInfoResponseFormatIsValid,
        );
      },
    );
  },
);

dialTest(
  'Check response format is stored for Replay chat',
  async ({
    dialHomePage,
    setTestIds,
    localStorageManager,
    conversationData,
    dataInjector,
    conversations,
    conversationDropdownMenu,
    agentInfo,
    chat,
    chatHeader,
    agentSettingAssertion,
  }) => {
    setTestIds('EPMDIAL-5987');
    let conversation: Conversation;

    await dialTest.step(
      'Prepare a conversation with Plain text response format',
      async () => {
        conversation = conversationData.prepareDefaultConversation(randomModel);
        conversation.responseFormat = ConversationResponseFormat.PlainText;
        await dataInjector.createConversations([conversation]);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Create Replay chat based on the prepared conversation',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.openEntityDropdownMenu(conversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.replay, {
          triggeredHttpMethod: 'POST',
        });
        await agentInfo.waitForState();
      },
    );

    await dialTest.step(
      'Click on Start replay and verify Response format is Plain text',
      async () => {
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.startReplay(undefined, true);
        await chatHeader.openConversationSettingsPopup();
        await agentSettingAssertion.assertResponseFormat(
          ConversationResponseFormat.PlainText,
        );
      },
    );
  },
);

dialTest(
  'Check response format is stored for Playback chat',
  async ({
    dialHomePage,
    setTestIds,
    localStorageManager,
    chat,
    chatHeader,
    chatMessages,
    chatMessagesAssertion,
    conversationSettingsModal,
    agentSettings,
    conversations,
    conversationDropdownMenu,
    agentInfo,
    chatSettingsTooltip,
    tooltipAssertion,
  }) => {
    setTestIds('EPMDIAL-7435');

    await dialTest.step(
      'Set response format to Plain text and create a chat with a table response',
      async () => {
        await localStorageManager.setRecentModelsIdsAndUseLastModel(
          randomModel,
        );
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await chat.configureSettingsButton.click();
        await agentSettings.setResponseFormat(
          ConversationResponseFormat.PlainText,
        );
        await conversationSettingsModal.applyChanges({
          waitForUpdate: false,
        });
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.mdTableBody,
        );
        await chat.sendRequestWithButton(request, true);
      },
    );

    await dialTest.step(
      'Create Playback chat based on the prepared conversation',
      async () => {
        await conversations.openEntityDropdownMenu(request);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.playback);
        await agentInfo.waitForState();
      },
    );

    await dialTest.step(
      'Click on Next button several times to have the response on the screen',
      async () => {
        for (let i = 1; i <= 2; i++) {
          await chat.playNextChatMessage(false);
        }
      },
    );

    await dialTest.step(
      'Verify Response format is Plain text in the tooltip on Gear icon and in the chat history',
      async () => {
        await chatHeader.hoverOverChatSettings();
        await tooltipAssertion.assertElementText(
          chatSettingsTooltip.responseFormatInfo,
          ConversationResponseFormat.PlainText,
          ExpectedMessages.chatInfoResponseFormatIsValid,
        );
        await chatMessagesAssertion.assertElementState(
          chatMessages.getChatMessageTable(firstResponseMessageIndex),
          'hidden',
          ExpectedMessages.tableIsHidden,
        );
        await chatMessagesAssertion.assertElementText(
          chatMessages.getChatMessageContent(firstResponseMessageIndex),
          tableInPlainText,
        );
      },
    );
  },
);

dialTest(
  'Check cursor when agents starts response generation with different Response formats',
  async ({
    dialHomePage,
    setTestIds,
    localStorageManager,
    chat,
    chatHeader,
    chatMessages,
    chatMessagesAssertion,
    conversationSettingsModal,
    agentSettings,
  }) => {
    setTestIds('EPMDIAL-7423');
    const cursorTextRegexp = new RegExp(`^${modelCursorSign}$`);

    await dialTest.step(
      'Send a request to the model and verify cursor is blinking while response is loading, no backticks are displayed',
      async () => {
        await localStorageManager.setRecentModelsIdsAndUseLastModel(
          randomModel,
        );
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.mdTableBody,
        );
        await dialHomePage.throttleAPIResponse('**/*');
        await chat.sendRequestWithButton('test request1', false);
        await chatMessagesAssertion.assertElementText(
          chatMessages.loadingCursor,
          cursorTextRegexp,
        );
        await dialHomePage.unRouteAllResponses();
      },
    );

    await dialTest.step(
      'Change response format to Plain text and apply changes',
      async () => {
        await chatHeader.openConversationSettingsPopup();
        await agentSettings.setResponseFormat(
          ConversationResponseFormat.PlainText,
        );
        await conversationSettingsModal.applyChanges();
      },
    );

    await dialTest.step(
      'Send one more request and verify cursor is blinking while response is loading, no backticks are displayed',
      async () => {
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.mdTableBody,
        );
        await dialHomePage.throttleAPIResponse('**/*');
        await chat.sendRequestWithButton('test request2', false);
        await chatMessagesAssertion.assertElementText(
          chatMessages.loadingCursor,
          cursorTextRegexp,
        );
      },
    );
  },
);
