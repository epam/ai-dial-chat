import { Conversation } from '@/src/types/chat';
import { OpenAIEntityModel } from '@/src/types/openai';

import test from '@/e2e/src/core/fixtures';
import {
  AssistantIds,
  ExpectedConstants,
  ExpectedMessages,
  ModelIds,
} from '@/e2e/src/testData';
import { ModelsUtil } from '@/e2e/src/utils';
import { expect } from '@playwright/test';

const userRequests = ['first request', 'second request', 'third request'];
const requestTerm = 'qwer';
const expectedResponse = 'The sky is blue.';
const sysPrompt = `Type: "${expectedResponse}" if user types ${requestTerm}`;
let allAddons: OpenAIEntityModel[];
let gpt35Model: OpenAIEntityModel;
let assistant: OpenAIEntityModel;
let mirrorApp: OpenAIEntityModel;
let gpt4Model: OpenAIEntityModel;

test.beforeAll(async () => {
  allAddons = ModelsUtil.getAddons();
  gpt35Model = ModelsUtil.getModel(ModelIds.GPT_3_5_AZ)!;
  assistant = ModelsUtil.getAssistant(AssistantIds.ASSISTANT10K)!;
  mirrorApp = ModelsUtil.getApplication(ModelIds.MIRROR)!;
  gpt4Model = ModelsUtil.getModel(ModelIds.GPT_4)!;
});

test('Regenerate response when answer was received', async ({
  dialHomePage,
  conversationData,
  chat,
  localStorageManager,
  setTestIds,
  chatMessages,
}) => {
  setTestIds('EPMRTC-476');
  let conversation: Conversation;
  const userRequests = [
    'first request',
    'second request',
    'write down 100 adjectives',
  ];
  await test.step('Prepare model conversation', async () => {
    conversation = conversationData.prepareModelConversationBasedOnRequests(
      gpt35Model,
      userRequests,
    );
    await localStorageManager.setConversationHistory(conversation);
    await localStorageManager.setSelectedConversation(conversation);
  });

  await test.step('Regenerate response and verify only last response is regenerating', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    const receivedPartialContent = await chatMessages.getGeneratedChatContent(
      conversation.messages.length,
    );
    await chat.regenerateResponse(false);
    const preservedPartialContent = await chatMessages.getGeneratedChatContent(
      conversation.messages.length,
    );
    expect
      .soft(
        preservedPartialContent.includes(receivedPartialContent),
        ExpectedMessages.onlyLastResponseIsRegenerating,
      )
      .toBeTruthy();
  });
});

test('Regenerate response when answer was not received', async ({
  dialHomePage,
  chat,
  setTestIds,
  chatMessages,
  context,
}) => {
  setTestIds('EPMRTC-477');
  await test.step('Send a request in chat and emulate error until response received', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    await context.setOffline(true);
    await chat.sendRequestWithButton('Type a fairytale', false);
  });
  await test.step('Verify error is displayed as a response, regenerate button is available', async () => {
    const generatedContent = await chatMessages.getLastMessageContent();
    expect
      .soft(generatedContent, ExpectedMessages.errorReceivedOnReplay)
      .toBe(ExpectedConstants.answerError);

    const isGenerateResponseVisible = await chat.regenerate.isVisible();
    expect
      .soft(isGenerateResponseVisible, ExpectedMessages.regenerateIsAvailable)
      .toBeTruthy();
  });
  await test.step('Click Regenerate response and validate answer received', async () => {
    await context.setOffline(false);
    await chat.regenerateResponse(false);
    await chatMessages.waitForPartialMessageReceived(2);
    const generatedContent = await chatMessages.getLastMessageContent();
    expect
      .soft(generatedContent, ExpectedMessages.messageContentIsValid)
      .not.toContain(ExpectedConstants.answerError);
  });
});

//TODO: enable when chat API for Gtp-4 is fixed
test.skip(
  'Stop generating for assistant.\n' +
    'Regenerate response for partly received answer when Stop generating was used',
  async ({ dialHomePage, chat, setTestIds, chatMessages, talkToSelector }) => {
    setTestIds('EPMRTC-481', 'EPMRTC-1166');
    await test.step('Send request for assistant and stop generating when first stage received', async () => {
      test.slow();
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
      await talkToSelector.selectAssistant(assistant.name);
      await chat.sendRequestWithButton(
        'What is Epam? What is epam revenue in 2018?',
        false,
      );
      await chatMessages.waitForMessageStageReceived(2, 1);
      await chat.stopGenerating.click();
    });

    await test.step('Verify Regenerate response button is visible, only 1st stage is displayed', async () => {
      const isGenerateResponseVisible = await chat.regenerate.isVisible();
      expect
        .soft(isGenerateResponseVisible, ExpectedMessages.regenerateIsAvailable)
        .toBeTruthy();

      const isResponseLoading = await chatMessages.isResponseLoading();
      expect
        .soft(isResponseLoading, ExpectedMessages.responseLoadingStopped)
        .toBeFalsy();

      const isSecondStageReceived = await chatMessages.isMessageStageReceived(
        2,
        2,
      );
      expect
        .soft(isSecondStageReceived, ExpectedMessages.onlyFirstStageDisplayed)
        .toBeFalsy();
    });

    await test.step('Regenerate response and verify whole answer is regenerated', async () => {
      await chat.regenerateResponse(false);
      const isFirstStageReceived = await chatMessages.isMessageStageReceived(
        2,
        1,
      );
      expect
        .soft(isFirstStageReceived, ExpectedMessages.allStagesRegenerated)
        .toBeFalsy();
    });
  },
);

test(
  'Edit the message in the middle. Cancel.\n' +
    'Edit the message in the middle. Save & Submit.\n' +
    'Edited message can not be empty',
  async ({
    dialHomePage,
    conversationData,
    localStorageManager,
    setTestIds,
    chatMessages,
  }) => {
    setTestIds('EPMRTC-485', 'EPMRTC-486', 'EPMRTC-487');
    const editData = 'updated message';
    let conversation: Conversation;
    await test.step('Prepare conversation with 3 requests', async () => {
      conversation = conversationData.prepareModelConversationBasedOnRequests(
        mirrorApp,
        userRequests,
      );
      await localStorageManager.setConversationHistory(conversation);
      await localStorageManager.setSelectedConversation(conversation);
    });

    await test.step('Edit 2nd request, cancel edit and verify nothing changed', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await chatMessages.openEditMessageMode(userRequests[1]);
      await chatMessages.fillEditData(editData);
      await chatMessages.cancel.click();

      const isEditTextareaVisible = await chatMessages
        .getChatMessageTextarea()
        .isVisible();
      expect
        .soft(isEditTextareaVisible, ExpectedMessages.editModeIsClosed)
        .toBeFalsy();

      const isResponseLoading = await chatMessages.isResponseLoading();
      expect
        .soft(isResponseLoading, ExpectedMessages.responseIsNotLoading)
        .toBeFalsy();
    });

    await test.step('Edit 2nd request, clear field and verify Save button is disabled', async () => {
      await chatMessages.openEditMessageMode(userRequests[1]);
      await chatMessages.fillEditData('');

      const isSaveButtonDisabled = await chatMessages.isSaveButtonEnabled();
      expect
        .soft(isSaveButtonDisabled, ExpectedMessages.saveIsDisabled)
        .toBeFalsy();
      await chatMessages.cancel.click();
    });

    await test.step('Edit 2nd request, save changes and verify response is received, last request is removed', async () => {
      await chatMessages.openEditMessageMode(userRequests[1]);
      await chatMessages.editMessage(editData);

      const messagesCount = await chatMessages.chatMessages.getElementsCount();
      expect
        .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
        .toBe((userRequests.length - 1) * 2);

      const isMessageEdited = await chatMessages
        .getChatMessage(editData)
        .isVisible();
      expect
        .soft(isMessageEdited, ExpectedMessages.requestMessageIsEdited)
        .toBeTruthy();

      const lastMessage = await chatMessages.getLastMessageContent();
      expect
        .soft(lastMessage, ExpectedMessages.messageContentIsValid)
        .toBe(editData);
    });
  },
);

test(
  'Delete the message in the middle. Cancel.\n' +
    'Delete the message in the middle. Remove',
  async ({
    dialHomePage,
    conversationData,
    localStorageManager,
    setTestIds,
    chatMessages,
    confirmationDialog,
  }) => {
    setTestIds('EPMRTC-488', 'EPMRTC-489');
    await test.step('Prepare conversation with 3 requests', async () => {
      const conversation =
        conversationData.prepareModelConversationBasedOnRequests(
          mirrorApp,
          userRequests,
        );
      await localStorageManager.setConversationHistory(conversation);
      await localStorageManager.setSelectedConversation(conversation);
    });

    await test.step('Try to delete 2nd request but cancel deleting', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await chatMessages.openDeleteMessageDialog(userRequests[1]);
      await confirmationDialog.cancelDialog();
      const messagesCount = await chatMessages.chatMessages.getElementsCount();
      expect
        .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
        .toBe(userRequests.length * 2);
    });

    await test.step('Delete 2nd request and verify request is deleted, other requests remain', async () => {
      await chatMessages.openDeleteMessageDialog(userRequests[1]);
      await confirmationDialog.confirm();

      const messagesCount = await chatMessages.chatMessages.getElementsCount();
      expect
        .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
        .toBe((userRequests.length - 1) * 2);

      const isMessageVisible = await chatMessages
        .getChatMessage(userRequests[1])
        .isVisible();
      expect
        .soft(isMessageVisible, ExpectedMessages.messageIsDeleted)
        .toBeFalsy();
    });
  },
);

//TODO: enable when chat API for Gtp-4 is fixed
test.skip('System prompt is applied in Model', async ({
  dialHomePage,
  chat,
  setTestIds,
  chatMessages,
  talkToSelector,
  entitySettings,
}) => {
  setTestIds('EPMRTC-1085');
  await test.step('Set system prompt for model and send request', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    await talkToSelector.selectModel(gpt4Model.name);
    await entitySettings.setSystemPrompt(sysPrompt);
    await chat.sendRequestWithButton(requestTerm);
  });

  await test.step('Verify response correspond system prompt', async () => {
    const response = await chatMessages.getLastMessageContent();
    expect
      .soft(response, ExpectedMessages.regenerateIsAvailable)
      .toBe(expectedResponse);
  });
});

//TODO: enable when chat API for Gtp-4 is fixed
test.skip('System prompt is applied in Model with addon', async ({
  dialHomePage,
  chat,
  setTestIds,
  chatMessages,
  talkToSelector,
  entitySettings,
  addons,
}) => {
  setTestIds('EPMRTC-1086');
  await test.step('Set system prompt for model + addons and send request', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    await talkToSelector.selectModel(gpt4Model.name);
    for (const addonName of allAddons.map((a) => a.name)) {
      await addons.selectAddon(addonName);
    }

    await entitySettings.setSystemPrompt(sysPrompt);
    await chat.sendRequestWithButton(requestTerm);
  });

  await test.step('Verify response correspond system prompt', async () => {
    const response = await chatMessages.getLastMessageContent();
    expect
      .soft(response, ExpectedMessages.regenerateIsAvailable)
      .toBe(expectedResponse);
  });
});

//TODO: enable when chat API for Gtp-4 is fixed
test.skip('Stop generating for models like GPT (1 symbol = 1 token)', async ({
  dialHomePage,
  chat,
  setTestIds,
  chatMessages,
}) => {
  setTestIds('EPMRTC-478');
  const request = 'write down 30 adjectives';
  await test.step('Send request and stop generation immediately', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    await chat.sendRequestWithButton(request, false);
    await chat.stopGenerating.click();
  });

  await test.step('Verify no content received and model icon is visible', async () => {
    const receivedContent = await chatMessages.getLastMessageContent();
    expect
      .soft(receivedContent, ExpectedMessages.messageContentIsValid)
      .toBe('');
    const conversationIcon = await chatMessages.getIconAttributesForMessage();
    expect
      .soft(
        conversationIcon.iconEntity,
        ExpectedMessages.chatBarIconEntityIsValid,
      )
      .toBe(gpt35Model.id);
    expect
      .soft(conversationIcon.iconUrl, ExpectedMessages.chatBarIconSourceIsValid)
      .toBe(gpt35Model.iconUrl);

    const isRegenerateButtonVisible = await chat.regenerate.isVisible();
    expect
      .soft(isRegenerateButtonVisible, ExpectedMessages.regenerateIsAvailable)
      .toBeTruthy();
  });

  await test.step('Send request and stop generation when partial content received', async () => {
    await chat.regenerateResponse(false);
    await chatMessages.waitForPartialMessageReceived(2);
    await chat.stopGenerating.click();
  });

  await test.step('Verify partial content is preserved and model icon is visible', async () => {
    const generatedContent = await chatMessages.getLastMessageContent();
    expect
      .soft(generatedContent, ExpectedMessages.messageContentIsValid)
      .not.toBe('');
    const conversationIcon = await chatMessages.getIconAttributesForMessage();
    expect
      .soft(
        conversationIcon.iconEntity,
        ExpectedMessages.chatBarIconEntityIsValid,
      )
      .toBe(gpt35Model.id);
    expect
      .soft(conversationIcon.iconUrl, ExpectedMessages.chatBarIconSourceIsValid)
      .toBe(gpt35Model.iconUrl);

    const isRegenerateButtonVisible = await chat.regenerate.isVisible();
    expect
      .soft(isRegenerateButtonVisible, ExpectedMessages.regenerateIsAvailable)
      .toBeTruthy();
  });
});
