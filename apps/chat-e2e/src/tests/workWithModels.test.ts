import { SIDEBAR_MIN_WIDTH } from '@/chat/constants/default-ui-settings';
import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import { Prompt } from '@/chat/types/prompt';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  ExpectedConstants,
  ExpectedMessages,
  MockedChatApiResponseBodies,
  ModelIds,
  Theme,
} from '@/src/testData';
import { Cursors, Styles } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

const userRequests = ['first request', 'second request', 'third request'];
const requestTerm = 'qwer';
const request = 'write cinderella story';
const expectedResponse = 'The sky is blue.';
const promptContent = `Type: "${expectedResponse}" if user types ${requestTerm}`;
let gpt35Model: DialAIEntityModel;
let gpt4Model: DialAIEntityModel;

dialTest.beforeAll(async () => {
  gpt35Model = ModelsUtil.getModel(ModelIds.GPT_3_5_TURBO)!;
  gpt4Model = ModelsUtil.getModel(ModelIds.GPT_4)!;
});

dialTest(
  'Regenerate response when answer was received',
  async ({
    dialHomePage,
    conversationData,
    localStorageManager,
    dataInjector,
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
    await dialTest.step('Prepare model conversation', async () => {
      conversation = conversationData.prepareModelConversationBasedOnRequests(
        gpt35Model,
        userRequests,
      );
      await dataInjector.createConversations([conversation]);
      await localStorageManager.setSelectedConversation(conversation);
    });

    await dialTest.step(
      'Regenerate response and verify only last response is regenerating',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        const receivedPartialContent =
          await chatMessages.getGeneratedChatContent(
            conversation.messages.length,
          );
        await chatMessages.regenerateResponse(false);
        const preservedPartialContent =
          await chatMessages.getGeneratedChatContent(
            conversation.messages.length,
          );
        expect
          .soft(
            preservedPartialContent.includes(receivedPartialContent),
            ExpectedMessages.onlyLastResponseIsRegenerating,
          )
          .toBeTruthy();
      },
    );
  },
);

dialTest(
  'Regenerate response when answer was not received.\n' +
    'Model: Send action is unavailable if there is an error instead of response',
  async ({
    dialHomePage,
    chat,
    setTestIds,
    chatMessages,
    context,
    sendMessage,
    localStorageManager,
    page,
  }) => {
    setTestIds('EPMRTC-477', 'EPMRTC-1463');
    await dialTest.step('Set random application theme', async () => {
      const theme = GeneratorUtil.randomArrayElement(Object.keys(Theme));
      await localStorageManager.setSettings(theme);
    });

    await dialTest.step(
      'Send a request in chat and emulate error until response received',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await context.setOffline(true);
        await chat.sendRequestWithButton('Type a fairytale', false);
      },
    );
    await dialTest.step(
      'Verify error is displayed as a response, regenerate button is available',
      async () => {
        const generatedContent = await chatMessages.getLastMessageContent();
        expect
          .soft(generatedContent, ExpectedMessages.errorReceivedOnReplay)
          .toBe(ExpectedConstants.answerError);

        await expect
          .soft(
            chatMessages.regenerate.getElementLocator(),
            ExpectedMessages.regenerateIsAvailable,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Type any prompt, hit Enter button and and verify nothing happened, Send button is not shown',
      async () => {
        await context.setOffline(false);
        for (let i = 1; i <= 2; i++) {
          if (i === 2) {
            const messagesCountBefore =
              await chatMessages.chatMessages.getElementsCount();
            await sendMessage.messageInput.fillInInput(
              GeneratorUtil.randomString(5),
            );
            await page.keyboard.press(keys.enter);
            const messagesCountAfter =
              await chatMessages.chatMessages.getElementsCount();
            expect
              .soft(
                messagesCountBefore === messagesCountAfter,
                ExpectedMessages.messageCountIsCorrect,
              )
              .toBeTruthy();
          }
          await expect
            .soft(
              sendMessage.sendMessageButton.getElementLocator(),
              ExpectedMessages.sendMessageButtonDisabled,
            )
            .toBeHidden();
        }
      },
    );

    await dialTest.step(
      'Click Regenerate response and validate answer received',
      async () => {
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chatMessages.regenerateResponse();
        const generatedContent = await chatMessages.getLastMessageContent();
        expect
          .soft(generatedContent, ExpectedMessages.messageContentIsValid)
          .not.toContain(ExpectedConstants.answerError);
      },
    );
  },
);

dialTest(
  'Edit the message in the middle. Cancel.\n' +
    'Edit the message in the middle. Save & Submit.\n' +
    'Edited message can not be empty',
  async ({
    dialHomePage,
    conversationData,
    localStorageManager,
    dataInjector,
    setTestIds,
    chatMessages,
  }) => {
    setTestIds('EPMRTC-485', 'EPMRTC-486', 'EPMRTC-487');
    const editData = 'updated message';
    let conversation: Conversation;
    const userRequests = ['1+2=', '2+3=', '3+4='];
    await dialTest.step('Prepare conversation with 3 requests', async () => {
      conversation = conversationData.prepareModelConversationBasedOnRequests(
        gpt35Model,
        userRequests,
      );
      await dataInjector.createConversations([conversation]);
      await localStorageManager.setSelectedConversation(conversation);
    });

    await dialTest.step(
      'Edit 2nd request, cancel edit and verify nothing changed',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await chatMessages.openEditMessageMode(userRequests[1]);
        await chatMessages.fillEditData(userRequests[1], editData);
        await chatMessages.cancel.click();

        await expect
          .soft(
            chatMessages.getChatMessageTextarea(userRequests[1]),
            ExpectedMessages.editRequestModeIsClosed,
          )
          .toBeHidden();

        const isResponseLoading = await chatMessages.isResponseLoading();
        expect
          .soft(isResponseLoading, ExpectedMessages.responseIsNotLoading)
          .toBeFalsy();
      },
    );

    await dialTest.step(
      'Edit 2nd request, clear field and verify Save button is disabled',
      async () => {
        await chatMessages.openEditMessageMode(userRequests[1]);
        await chatMessages.fillEditData(userRequests[1], '');
        await expect
          .soft(
            chatMessages.saveAndSubmit.getElementLocator(),
            ExpectedMessages.saveIsDisabled,
          )
          .toBeDisabled();
        await chatMessages.cancel.click();
      },
    );

    await dialTest.step(
      'Edit 2nd request, save changes and verify response is received, last request is deleted',
      async () => {
        await chatMessages.openEditMessageMode(userRequests[1]);
        await chatMessages.editMessage(userRequests[1], editData);

        const messagesCount =
          await chatMessages.chatMessages.getElementsCount();
        expect
          .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
          .toBe((userRequests.length - 1) * 2);

        await expect
          .soft(
            chatMessages.getChatMessage(editData),
            ExpectedMessages.requestMessageIsEdited,
          )
          .toBeVisible();

        const lastMessage = await chatMessages.getLastMessageContent();
        expect
          .soft(lastMessage, ExpectedMessages.messageContentIsValid)
          .not.toBe(conversation.messages[3].content);
      },
    );
  },
);

dialTest(
  'Delete the message in the middle. Cancel.\n' +
    'Delete the message in the middle. Delete',
  async ({
    dialHomePage,
    conversationData,
    localStorageManager,
    dataInjector,
    setTestIds,
    chatMessages,
    confirmationDialog,
  }) => {
    setTestIds('EPMRTC-488', 'EPMRTC-489');
    await dialTest.step('Prepare conversation with 3 requests', async () => {
      const conversation =
        conversationData.prepareModelConversationBasedOnRequests(
          gpt35Model,
          userRequests,
        );
      await dataInjector.createConversations([conversation]);
      await localStorageManager.setSelectedConversation(conversation);
    });

    await dialTest.step(
      'Try to delete 2nd request but cancel deleting',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await chatMessages.openDeleteMessageDialog(userRequests[1]);
        await confirmationDialog.cancelDialog();
        const messagesCount =
          await chatMessages.chatMessages.getElementsCount();
        expect
          .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
          .toBe(userRequests.length * 2);
      },
    );

    await dialTest.step(
      'Delete 2nd request and verify request is deleted, other requests remain',
      async () => {
        await chatMessages.openDeleteMessageDialog(userRequests[1]);
        await confirmationDialog.confirm();

        const messagesCount =
          await chatMessages.chatMessages.getElementsCount();
        expect
          .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
          .toBe((userRequests.length - 1) * 2);

        await expect
          .soft(
            chatMessages.getChatMessage(userRequests[1]),
            ExpectedMessages.messageIsDeleted,
          )
          .toBeHidden();
      },
    );
  },
);

dialTest(
  'System prompt is applied in Model',
  async ({
    dialHomePage,
    chat,
    setTestIds,
    chatMessages,
    talkToSelector,
    entitySettings,
  }) => {
    setTestIds('EPMRTC-1085');
    await dialTest.step(
      'Set system prompt for model and send request',
      async () => {
        await dialHomePage.openHomePage({
          iconsToBeLoaded: [gpt4Model.iconUrl],
        });
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await talkToSelector.selectModel(gpt4Model);
        await entitySettings.setSystemPrompt(promptContent);
        await chat.sendRequestWithButton(requestTerm);
      },
    );

    await dialTest.step(
      'Verify response correspond system prompt',
      async () => {
        const response = await chatMessages.getLastMessageContent();
        expect
          .soft(response, ExpectedMessages.messageContentIsValid)
          .toMatch(expectedResponse);
      },
    );
  },
);

dialTest(
  'Stop generating for models like GPT (1 symbol = 1 token).\n' +
    'Model: Send action is unavailable if there is empty response.\n' +
    'Edit the message after the response was stopped',
  async ({
    dialHomePage,
    chat,
    setTestIds,
    chatMessages,
    sendMessage,
    page,
    tooltip,
    localStorageManager,
    iconApiHelper,
  }) => {
    setTestIds('EPMRTC-478', 'EPMRTC-1480', 'EPMRTC-1309');
    const expectedModelIcon = await iconApiHelper.getEntityIcon(gpt35Model);

    await dialTest.step('Set random application theme', async () => {
      const theme = GeneratorUtil.randomArrayElement(Object.keys(Theme));
      await localStorageManager.setSettings(theme);
    });

    await dialTest.step(
      'Send request and stop generation immediately',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await dialHomePage.throttleAPIResponse(API.chatHost);
        await chat.sendRequestWithButton(request, false);
        await sendMessage.stopGenerating.click();
      },
    );

    await dialTest.step(
      'Verify no content received and model icon is visible',
      async () => {
        await dialHomePage.unRouteAllResponses();
        const receivedContent = await chatMessages.getLastMessageContent();
        expect
          .soft(receivedContent, ExpectedMessages.messageContentIsValid)
          .toBe('');

        const conversationIcon =
          await chatMessages.getIconAttributesForMessage();
        expect
          .soft(conversationIcon, ExpectedMessages.entityIconIsValid)
          .toBe(expectedModelIcon);

        await expect
          .soft(
            chatMessages.regenerate.getElementLocator(),
            ExpectedMessages.regenerateIsAvailable,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Hover over Send button and verify it is disabled and tooltip is shown',
      async () => {
        for (let i = 1; i <= 2; i++) {
          if (i === 2) {
            const messagesCountBefore =
              await chatMessages.chatMessages.getElementsCount();
            await sendMessage.messageInput.fillInInput('   ');
            await page.keyboard.press(keys.enter);
            const messagesCountAfter =
              await chatMessages.chatMessages.getElementsCount();
            expect
              .soft(
                messagesCountBefore === messagesCountAfter,
                ExpectedMessages.messageCountIsCorrect,
              )
              .toBeTruthy();
          }
          const isSendMessageBtnEnabled =
            await sendMessage.sendMessageButton.isElementEnabled();
          expect
            .soft(
              isSendMessageBtnEnabled,
              ExpectedMessages.sendMessageButtonDisabled,
            )
            .toBeFalsy();

          await sendMessage.sendMessageButton.hoverOver();
          const sendBtnCursor =
            await sendMessage.sendMessageButton.getComputedStyleProperty(
              Styles.cursor,
            );
          expect
            .soft(
              sendBtnCursor[0],
              ExpectedMessages.sendButtonCursorIsNotAllowed,
            )
            .toBe(Cursors.notAllowed);

          const tooltipContent = await tooltip.getContent();
          expect
            .soft(tooltipContent, ExpectedMessages.tooltipContentIsValid)
            .toBe(ExpectedConstants.regenerateResponseTooltip);
        }
      },
    );

    await dialTest.step(
      'Send request and stop generation when partial content received',
      async () => {
        await chatMessages.regenerateResponse(false);
        await chatMessages.waitForPartialMessageReceived(2);
        await sendMessage.stopGenerating.click();
      },
    );

    await dialTest.step(
      'Verify partial content is preserved and model icon is visible',
      async () => {
        const generatedContent = await chatMessages.getLastMessageContent();
        expect
          .soft(generatedContent, ExpectedMessages.messageContentIsValid)
          .not.toBe('');
        const conversationIcon =
          await chatMessages.getIconAttributesForMessage();
        expect
          .soft(conversationIcon, ExpectedMessages.entityIconIsValid)
          .toBe(expectedModelIcon);

        await expect
          .soft(
            chatMessages.regenerate.getElementLocator(),
            ExpectedMessages.regenerateIsAvailable,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Edit request, click "Save & Submit" and verify response is regenerated',
      async () => {
        const updatedRequest = '1+2=';
        await chatMessages.openEditMessageMode(request);
        await chatMessages.editMessage(request, updatedRequest);
        const messagesCount =
          await chatMessages.chatMessages.getElementsCount();
        expect
          .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
          .toBe(2);
      },
    );
  },
);

dialTest(
  'Send button in new message is available for Model if previous response is partly received when Stop generating was used.\n' +
    'Compare mode button is not available while response is being generated',
  async ({
    dialHomePage,
    chat,
    setTestIds,
    chatMessages,
    sendMessage,
    localStorageManager,
    chatBar,
  }) => {
    setTestIds('EPMRTC-1533', 'EPMRTC-538');
    await dialTest.step(
      'Send request, verify Compare button is disabled while generating the response and stop generation immediately',
      async () => {
        const width = SIDEBAR_MIN_WIDTH + SIDEBAR_MIN_WIDTH / 3;
        await localStorageManager.setChatbarWidth(width.toFixed());
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await chat.sendRequestWithButton(request, false);
        await expect
          .soft(
            chatBar.compareButton.getElementLocator(),
            ExpectedMessages.compareButtonIsDisabled,
          )
          .toBeDisabled();

        await chatMessages.waitForPartialMessageReceived(2);
        // eslint-disable-next-line playwright/no-force-option
        await sendMessage.stopGenerating.click({ force: true });
        await expect
          .soft(
            sendMessage.stopGenerating.getElementLocator(),
            ExpectedMessages.stopGeneratingIsNotVisible,
          )
          .toBeHidden();
      },
    );

    await dialTest.step(
      'Type a new message and verify Send button is enabled',
      async () => {
        await sendMessage.messageInput.fillInInput(
          GeneratorUtil.randomString(10),
        );
        await expect
          .soft(
            sendMessage.sendMessageButton.getElementLocator(),
            ExpectedMessages.sendMessageButtonEnabled,
          )
          .toBeEnabled();
      },
    );
  },
);

dialTest(
  'Prompt text without parameters appear in System prompt field in chat settings.\n' +
    'System prompt set using slash is applied in Model',
  async ({
    dialHomePage,
    promptData,
    dataInjector,
    entitySettings,
    chat,
    chatMessages,
    chatHeader,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1010', 'EPMRTC-1945');
    let prompt: Prompt;

    await dialTest.step('Prepare prompt with content', async () => {
      prompt = promptData.preparePrompt(promptContent);
      await dataInjector.createPrompts([prompt]);
    });

    await dialTest.step(
      `'On a New Conversation screen set '/' as a system prompt and verify prompt is suggested in the list`,
      async () => {
        await dialHomePage.openHomePage({
          iconsToBeLoaded: [gpt35Model.iconUrl],
        });
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await entitySettings.setSystemPrompt('/');
        await entitySettings
          .getPromptList()
          .selectPrompt(prompt.name, { triggeredHttpMethod: 'PUT' });
        const actualPrompt = await entitySettings.getSystemPrompt();
        expect
          .soft(actualPrompt, ExpectedMessages.systemPromptValid)
          .toBe(prompt.content);
      },
    );

    await dialTest.step(
      'Send request and verify response corresponds system prompt',
      async () => {
        await chat.sendRequestWithButton(requestTerm);
        const response = await chatMessages.getLastMessageContent();
        expect
          .soft(response, ExpectedMessages.messageContentIsValid)
          .toBe(expectedResponse);
      },
    );

    await dialTest.step(
      'Open chat settings and verify system prompt is preserved',
      async () => {
        await chatHeader.openConversationSettingsPopup();
        const actualPrompt = await entitySettings.getSystemPrompt();
        expect
          .soft(actualPrompt, ExpectedMessages.systemPromptValid)
          .toBe(prompt.content);
      },
    );
  },
);
