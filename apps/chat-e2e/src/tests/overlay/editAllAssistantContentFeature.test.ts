import { Conversation } from '@/chat/types/chat';
import dialOverlayTest from '@/src/core/dialOverlayFixtures';
import {
  MockedChatApiResponseBodies,
  OverlaySandboxUrls,
} from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

const prompt1 = 'prompt1';
const prompt2 = 'prompt2';
const prompt3 = 'prompt3';
const prompt1Index = 1;
const response1Index = 2;
const prompt2Index = 3;
const response2Index = 4;

dialOverlayTest(
  '[Overlay] enable Feature.EditAllAssistantContent',
  async ({
    overlayHomePage,
    overlayHeader,
    overlayConversations,
    overlayChatMessages,
    overlayChatMessagesAssertion,
    overlayBaseAssertion,
    overlayDataInjector,
    conversationData,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-2313');
    let conversation: Conversation;
    const editedResponse = GeneratorUtil.randomString(10);

    await dialOverlayTest.step(
      'Prepare a conversation with two prompt-response pairs',
      async () => {
        conversation = conversationData.prepareModelConversationBasedOnRequests(
          [prompt1, prompt2],
        );
        await overlayDataInjector.createConversations([conversation]);
      },
    );

    await dialOverlayTest.step(
      'Open sandbox with Feature.EditAllAssistantContent enabled, select the conversation and verify Edit button is available for both responses',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.enableEditAllAssistantContentUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        await overlayHeader.leftPanelToggle.click();
        await overlayConversations.selectEntity(conversation.name);
        await overlayChatMessagesAssertion.assertMessageEditIconState(
          response1Index,
          'visible',
        );
        await overlayChatMessagesAssertion.assertMessageEditIconState(
          response2Index,
          'visible',
        );
      },
    );

    await dialOverlayTest.step(
      'Edit response1, save changes and verify edit mode is closed, response1 is updated and other messages are not changed',
      async () => {
        await overlayChatMessages.openEditMessageMode(response1Index);
        await overlayChatMessages.fillEditData(response1Index, editedResponse);
        await overlayChatMessages.saveAndSubmit.click();
        await overlayBaseAssertion.assertElementState(
          overlayChatMessages.getChatMessageTextarea(response1Index),
          'hidden',
        );
        await overlayChatMessagesAssertion.assertMessageContent(
          response1Index,
          editedResponse,
        );
        await overlayChatMessagesAssertion.assertMessageContent(
          prompt1Index,
          prompt1,
        );
        await overlayChatMessagesAssertion.assertMessageContent(
          prompt2Index,
          prompt2,
        );
        await overlayChatMessagesAssertion.assertMessageContent(
          response2Index,
          `response on ${prompt2}`,
        );
      },
    );
  },
);

dialOverlayTest(
  '[Overlay] enable Feature.EditAllAssistantContent when System message is used',
  async ({
    overlayHomePage,
    overlayActions,
    overlayChat,
    overlayChatMessages,
    overlayChatMessagesAssertion,
    overlayBaseAssertion,
    overlayLocalStorageManager,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-2312');
    const systemPrompt = `End each word with string "!?!?!"`;
    const editedResponse = GeneratorUtil.randomString(10);
    const modelWithSystemPrompt = GeneratorUtil.randomArrayElement(
      ModelsUtil.getLatestModels().filter((m) =>
        ModelsUtil.doesModelAllowSystemPrompt(m),
      ),
    );

    await dialOverlayTest.step(
      'Set a model with allowed system prompt to the recent',
      async () => {
        await overlayLocalStorageManager.setRecentModelsIdsAndUseLastModel(
          modelWithSystemPrompt,
        );
      },
    );

    await dialOverlayTest.step(
      'Open sandbox with Feature.EditAllAssistantContent enabled and click on "Set system prompt"',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.enableEditAllAssistantContentUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        await overlayActions.setSysPromptButton.click();
      },
    );

    await dialOverlayTest.step(
      'Send 2 requests with system prompt',
      async () => {
        await overlayHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
          { isOverlay: true },
        );
        for (const prompt of [prompt1, prompt2]) {
          await overlayChat.sendRequestWithButton(prompt);
        }
      },
    );

    await dialOverlayTest.step(
      'Edit response2 and verify it is updated',
      async () => {
        await overlayChatMessages.openEditMessageMode(response2Index);
        await overlayChatMessages.fillEditData(response2Index, editedResponse);
        await overlayChatMessages.saveAndSubmit.click();
        await overlayBaseAssertion.assertElementState(
          overlayChatMessages.getChatMessageTextarea(response2Index),
          'hidden',
        );
        await overlayChatMessagesAssertion.assertMessageContent(
          response2Index,
          editedResponse,
        );
      },
    );

    await dialOverlayTest.step(
      'Send a new prompt and verify the system prompt is sent in the completion request',
      async () => {
        const requests = await overlayChat.sendRequestWithButton(prompt3);
        const systemMessage = (
          requests.completionRequest as Conversation
        ).messages.find((m) => m.role === 'system');
        expect.soft(systemMessage).toBeDefined();
        overlayBaseAssertion.assertValue(systemMessage?.content, systemPrompt);
      },
    );
  },
);
