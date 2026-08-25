import { Conversation } from '@/chat/types/chat';
import dialOverlayTest from '@/src/core/dialOverlayFixtures';
import {
  API,
  Attachment,
  MockedChatApiResponseBodies,
  OverlaySandboxUrls,
} from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

const prompt1 = 'prompt1';
const prompt2 = 'prompt2';
const prompt3 = 'prompt3';
const response1Index = 2;
const response2Index = 4;

dialOverlayTest(
  '[Overlay] enable Feature.EditLastAssistantContent',
  async ({
    overlayHomePage,
    overlayHeader,
    overlayConversations,
    overlayChat,
    overlayChatMessages,
    overlayChatMessagesAssertion,
    overlayBaseAssertion,
    overlayDataInjector,
    conversationData,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-2314');
    let conversation: Conversation;
    const cancelledText = GeneratorUtil.randomString(10);
    const editedResponse = GeneratorUtil.randomString(10);
    const originalResponse2 = `response on ${prompt2}`;

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
      'Open sandbox with Feature.EditLastAssistantContent enabled, select the conversation and verify Edit button is available only for the last response',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.enableEditLastAssistantContentUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        await overlayHeader.leftPanelToggle.click();
        await overlayConversations.selectEntity(conversation.name);
        await overlayChatMessagesAssertion.assertMessageEditIconState(
          response1Index,
          'hidden',
        );
        await overlayChatMessagesAssertion.assertMessageEditIconState(
          response2Index,
          'visible',
        );
      },
    );

    await dialOverlayTest.step(
      'Edit response2, click Cancel and verify edit mode is closed with no changes applied',
      async () => {
        await overlayChatMessages.openEditMessageMode(response2Index);
        await overlayChatMessages.fillEditData(response2Index, cancelledText);
        await overlayChatMessages.cancel.click();
        await overlayBaseAssertion.assertElementState(
          overlayChatMessages.getChatMessageTextarea(response2Index),
          'hidden',
        );
        await overlayChatMessagesAssertion.assertMessageContent(
          response2Index,
          originalResponse2,
        );
      },
    );

    await dialOverlayTest.step(
      'Edit response2 again, save changes and verify edit mode is closed with changes applied',
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
      'Send a new message and verify Edit button moved from response2 to the new response3',
      async () => {
        await overlayHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
          { isOverlay: true },
        );
        await overlayChat.sendRequestWithButton(GeneratorUtil.randomString(5));
        await overlayChatMessagesAssertion.assertMessageEditIconState(
          response2Index,
          'hidden',
        );
        await overlayChatMessagesAssertion.assertMessageEditIconState(
          response2Index + 2,
          'visible',
        );
      },
    );
  },
);

dialOverlayTest(
  '[Overlay] enable Feature.EditLastAssistantContent: Attachments are available, Clip icon is available when agent-response is opened in edit mode',
  async ({
    overlayHomePage,
    overlayHeader,
    overlayConversations,
    overlayChatMessages,
    overlayBaseAssertion,
    overlayDataInjector,
    overlayFileApiHelper,
    conversationData,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-2316');
    let conversation: Conversation;
    const responseIndex = 2;
    const modelWithAttachment = GeneratorUtil.randomArrayElement(
      ModelsUtil.getLatestModelsWithAttachment(),
    );

    await dialOverlayTest.step(
      'Prepare a conversation based on a model which returns an attachment in the response',
      async () => {
        const attachmentUrl = await overlayFileApiHelper.putFile(
          Attachment.sunImageName,
          { parentPath: API.modelFilePath(modelWithAttachment.id) },
        );
        conversation =
          conversationData.prepareConversationWithAttachmentInResponse(
            attachmentUrl,
            modelWithAttachment,
          );
        await overlayDataInjector.createConversations([conversation]);
      },
    );

    await dialOverlayTest.step(
      'Open the conversation, click on Edit in the response and verify attachment and Clip icon are available in edit mode',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.enableEditLastAssistantContentUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        await overlayHeader.leftPanelToggle.click();
        await overlayConversations.selectEntity(conversation.name);
        await overlayChatMessages.openEditMessageMode(responseIndex);
        await overlayBaseAssertion.assertElementState(
          overlayChatMessages.getChatMessageAttachment(responseIndex),
          'visible',
        );
        await overlayBaseAssertion.assertElementState(
          overlayChatMessages.getChatMessageClipIcon(responseIndex),
          'visible',
        );
      },
    );
  },
);

dialOverlayTest(
  '[Overlay] enable Feature.EditLastAssistantContent when System message is used',
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
    setTestIds('EPMDIAL-2315');
    const response2Index = 4;
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
      'Open sandbox with Feature.EditLastAssistantContent enabled and click on "Set system prompt"',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.enableEditLastAssistantContentUrl,
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
      'Edit the last response and verify it is updated',
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
