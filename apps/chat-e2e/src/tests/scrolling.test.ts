import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  Attachment,
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  MockedChatApiResponseBodies,
  ScrollState,
} from '@/src/testData';
import { Colors } from '@/src/ui/domData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

let defaultModel: DialAIEntityModel;

dialTest.beforeAll(async () => {
  defaultModel = ModelsUtil.getDefaultModel()!;
});

dialTest(
  'Autoscroll.\n' +
    'Scroll down button appears if to move scroll up, disappears if to move scroll to the bottom.\n' +
    'Autoscroll is inactive if user manually moves the scroll to another position',
  async ({
    dialHomePage,
    chat,
    setTestIds,
    conversationData,
    conversations,
    dataInjector,
    sendMessage,
  }) => {
    setTestIds('EPMRTC-494', 'EPMRTC-492', 'EPMRTC-496');
    const deltaY = 50;
    let conversation: Conversation;

    await dialTest.step('Prepare conversation with long response', async () => {
      conversation = conversationData.prepareModelConversationBasedOnRequests(
        defaultModel,
        [GeneratorUtil.randomString(3000)],
      );
      await dataInjector.createConversations([conversation]);
    });

    await dialTest.step(
      'Open app and verify no scroll down button is visible on conversation',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(conversation.name);
        await expect
          .soft(
            sendMessage.scrollDownButton.getElementLocator(),
            ExpectedMessages.scrollDownButtonIsNotVisible,
          )
          .toBeHidden();
      },
    );

    await dialTest.step(
      'Send new request with long response and verify auto-scrolling to bottom of the page',
      async () => {
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.listTextBody,
        );
        await chat.sendRequestWithButton('request to mock', false);

        const scrollPosition =
          await chat.scrollableArea.getVerticalScrollPosition();
        expect
          .soft(scrollPosition, ExpectedMessages.scrollPositionIsCorrect)
          .toBe(ScrollState.bottom);
        await expect
          .soft(
            sendMessage.scrollDownButton.getElementLocator(),
            ExpectedMessages.scrollDownButtonIsNotVisible,
          )
          .toBeHidden();
      },
    );

    await dialTest.step(
      'Scroll messages up and verify scroll down button appears',
      async () => {
        await chat.scrollContent(0, -1 * deltaY);
        await expect
          .soft(
            sendMessage.scrollDownButton.getElementLocator(),
            ExpectedMessages.scrollDownButtonIsVisible,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Send new request and verify no auto-scroll applied, scroll down button is visible',
      async () => {
        await dialHomePage.unRouteAllResponses();
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequestWithButton('1+2=');
        const scrollPosition =
          await chat.scrollableArea.getVerticalScrollPosition();
        expect
          .soft(scrollPosition, ExpectedMessages.scrollPositionIsCorrect)
          .toBe(ScrollState.middle);
        await expect
          .soft(
            sendMessage.scrollDownButton.getElementLocator(),
            ExpectedMessages.scrollDownButtonIsVisible,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Scroll to the last message and verify scroll down button disappears',
      async () => {
        await chat.scrollContent(0, 10 * deltaY);
        await expect
          .soft(
            sendMessage.scrollDownButton.getElementLocator(),
            ExpectedMessages.scrollDownButtonIsNotVisible,
          )
          .toBeHidden();
      },
    );
  },
);

dialTest(
  'Scroll down button moves the scroll to the bottom',
  async ({
    dialHomePage,
    chat,
    setTestIds,
    conversationData,
    conversations,
    dataInjector,
    sendMessage,
  }) => {
    setTestIds('EPMRTC-3071');
    let conversation: Conversation;

    await dialTest.step('Prepare conversation with long response', async () => {
      conversation = conversationData.prepareModelConversationBasedOnRequests(
        defaultModel,
        [GeneratorUtil.randomString(3000)],
      );
      await dataInjector.createConversations([conversation]);
    });

    await dialTest.step(
      'Scroll chat history to the top, click on "Scroll down button" and verify scroll is at the bottom, scroll down button disappears',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(conversation.name);
        await chat.goToContentPosition(ScrollState.top);
        await sendMessage.scrollDownButton.click();
        await expect
          .soft(
            sendMessage.scrollDownButton.getElementLocator(),
            ExpectedMessages.scrollDownButtonIsNotVisible,
          )
          .toBeHidden();
        expect
          .soft(
            await chat.scrollableArea.getVerticalScrollPosition(),
            ExpectedMessages.scrollPositionIsCorrect,
          )
          .toBe(ScrollState.bottom);
      },
    );
  },
);

dialTest(
  'Scroll down button does not appear on new conversation screen if previously opened chat had the icon on the screen.\n' +
    'Scroll down button and scroll position are not applied to another chat.\n' +
    "Autoscroll doesn't depend on scroll position in previous chat.\n" +
    'New replay chat is highlighted only. Parent chat is not highlighted',
  async ({
    dialHomePage,
    chat,
    setTestIds,
    conversationData,
    dataInjector,
    sendMessage,
    conversations,
    conversationDropdownMenu,
    conversationAssertion,
    chatBar,
  }) => {
    setTestIds('EPMRTC-493', 'EPMRTC-3072', 'EPMRTC-1783', 'EPMRTC-1754');
    let firstConversation: Conversation;
    let secondConversation: Conversation;

    await dialTest.step(
      'Prepare two conversations with long responses',
      async () => {
        firstConversation =
          conversationData.prepareModelConversationBasedOnRequests(
            defaultModel,
            [GeneratorUtil.randomString(3000)],
          );
        conversationData.resetData();
        secondConversation =
          conversationData.prepareModelConversationBasedOnRequests(
            defaultModel,
            [GeneratorUtil.randomString(3000)],
          );
        await dataInjector.createConversations([
          firstConversation,
          secondConversation,
        ]);
      },
    );

    await dialTest.step(
      'Scroll first chat history to the top, select second chat and verify no "Scroll down" button is visible',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(firstConversation.name);
        await chat.goToContentPosition(ScrollState.top);
        await conversations.selectConversation(secondConversation.name);
        await expect
          .soft(
            sendMessage.scrollDownButton.getElementLocator(),
            ExpectedMessages.scrollDownButtonIsNotVisible,
          )
          .toBeHidden();
      },
    );

    await dialTest.step(
      'Back to the first conversation, create new conversation and verify no "Scroll down" button is visible',
      async () => {
        await conversations.selectConversation(firstConversation.name);
        await chatBar.createNewConversation();
        await expect
          .soft(
            sendMessage.scrollDownButton.getElementLocator(),
            ExpectedMessages.scrollDownButtonIsNotVisible,
          )
          .toBeHidden();
      },
    );

    await dialTest.step(
      'Create Replay conversation based on the first one and verify it is selected and highlighted',
      async () => {
        await conversations.selectConversation(firstConversation.name);
        await conversations.openEntityDropdownMenu(firstConversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.replay, {
          triggeredHttpMethod: 'POST',
        });

        const replayConversationName =
          ExpectedConstants.replayConversation + firstConversation.name;
        await conversationAssertion.assertEntityState(
          {
            name: replayConversationName,
          },
          'visible',
        );
        await conversationAssertion.assertEntityBackgroundColor(
          {
            name: replayConversationName,
          },
          Colors.backgroundAccentSecondary,
        );
        await conversationAssertion.assertEntityBackgroundColor(
          { name: firstConversation.name, index: 2 },
          Colors.defaultBackground,
        );
      },
    );

    await dialTest.step(
      'Start replaying and verify autoscroll is active',
      async () => {
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.listTextBody,
        );
        await chat.startReplay();
        const scrollPosition =
          await chat.scrollableArea.getVerticalScrollPosition();
        expect
          .soft(scrollPosition, ExpectedMessages.scrollPositionIsCorrect)
          .toBe(ScrollState.bottom);
        await expect
          .soft(
            sendMessage.scrollDownButton.getElementLocator(),
            ExpectedMessages.scrollDownButtonIsNotVisible,
          )
          .toBeHidden();
      },
    );
  },
);

dialTest(
  'Scroll position stays in chat if to open or close compare mode',
  async ({
    dialHomePage,
    chat,
    setTestIds,
    conversationData,
    dataInjector,
    conversations,
    conversationDropdownMenu,
    compareConversation,
  }) => {
    setTestIds('EPMRTC-3079');
    let firstConversation: Conversation;
    let secondConversation: Conversation;
    const firstConversationName = GeneratorUtil.randomString(5);
    const secondConversationName = `${firstConversationName} 1`;

    await dialTest.step(
      'Prepare two conversations with long responses',
      async () => {
        firstConversation =
          conversationData.prepareModelConversationBasedOnRequests(
            defaultModel,
            [
              GeneratorUtil.randomString(2000),
              GeneratorUtil.randomString(2000),
            ],
            firstConversationName,
          );
        conversationData.resetData();
        secondConversation =
          conversationData.prepareModelConversationBasedOnRequests(
            defaultModel,
            [
              GeneratorUtil.randomString(2000),
              GeneratorUtil.randomString(2000),
            ],
            secondConversationName,
          );
        await dataInjector.createConversations([
          firstConversation,
          secondConversation,
        ]);
      },
    );

    await dialTest.step(
      'Scroll up first chat history, create compare mode with the second conversation and verify scroll position is saved',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(firstConversation.name, {exactMatch: true});
        await chat.scrollContent(0, -100);
        await conversations.openEntityDropdownMenu(firstConversationName, {exactMatch: true});
        await conversationDropdownMenu.selectMenuOption(MenuOptions.compare);
        await compareConversation.selectCompareConversation(
          secondConversationName,
        );
        const scrollPosition =
          await chat.scrollableArea.getVerticalScrollPosition();
        expect
          .soft(scrollPosition, ExpectedMessages.scrollPositionIsCorrect)
          .toBe(ScrollState.middle);
      },
    );
  },
);

dialTest(
  'Scroll down button appears if to expand stage, disappears if to collapse',
  async ({
    dialHomePage,
    sendMessage,
    setTestIds,
    conversationData,
    conversations,
    dataInjector,
    chatMessages,
  }) => {
    setTestIds('EPMRTC-3074');
    let stageConversation: Conversation;

    await dialTest.step('Prepare conversation with stage', async () => {
      stageConversation =
        conversationData.prepareConversationWithStagesInResponse(
          defaultModel,
          1,
        );
      await dataInjector.createConversations([stageConversation]);
    });

    await dialTest.step(
      'Open response stage and verify "Scroll dawn" button is displayed',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(stageConversation.name);
        await chatMessages.openMessageStage(2, 1);
        await expect
          .soft(
            sendMessage.scrollDownButton.getElementLocator(),
            ExpectedMessages.scrollDownButtonIsVisible,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Close response stage and verify "Scroll dawn" button disappears',
      async () => {
        await chatMessages.closeMessageStage(2, 1);
        await expect
          .soft(
            sendMessage.scrollDownButton.getElementLocator(),
            ExpectedMessages.scrollDownButtonIsNotVisible,
          )
          .toBeHidden();
      },
    );
  },
);

dialTest(
  'Scroll down button appears if to expand picture, disappears if to collapse',
  async ({
    dialHomePage,
    sendMessage,
    setTestIds,
    conversationData,
    conversations,
    dataInjector,
    chatMessages,
    fileApiHelper,
  }) => {
    setTestIds('EPMRTC-3073');
    let imageConversation: Conversation;

    await dialTest.step(
      'Prepare conversation with image in response',
      async () => {
        const imageUrl = await fileApiHelper.putFile(Attachment.sunImageName);
        imageConversation =
          conversationData.prepareConversationWithAttachmentInResponse(
            imageUrl,
            defaultModel,
          );
        await dataInjector.createConversations([imageConversation]);
      },
    );

    await dialTest.step(
      'Expand generated image and verify "Scroll dawn" button is displayed',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(imageConversation.name);
        await chatMessages.expandChatMessageAttachment(
          2,
          Attachment.sunImageName,
        );
        await expect
          .soft(
            sendMessage.scrollDownButton.getElementLocator(),
            ExpectedMessages.scrollDownButtonIsVisible,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Collapse response image and verify "Scroll dawn" button disappears',
      async () => {
        await chatMessages.collapseChatMessageAttachment(
          2,
          Attachment.sunImageName,
        );
        await expect
          .soft(
            sendMessage.scrollDownButton.getElementLocator(),
            ExpectedMessages.scrollDownButtonIsNotVisible,
          )
          .toBeHidden();
      },
    );
  },
);

dialTest(
  'Position of user-message is changed if to click on edit',
  async ({
    dialHomePage,
    conversationData,
    conversations,
    dataInjector,
    setTestIds,
    chatMessages,
  }) => {
    setTestIds('EPMRTC-3076');
    let conversation: Conversation;
    const userRequests = [
      GeneratorUtil.randomString(300),
      GeneratorUtil.randomString(300),
      GeneratorUtil.randomString(300),
    ];
    await dialTest.step(
      'Prepare conversation with 3 long requests',
      async () => {
        conversation = conversationData.prepareModelConversationBasedOnRequests(
          defaultModel,
          userRequests,
        );
        await dataInjector.createConversations([conversation]);
      },
    );

    await dialTest.step(
      'Open edit mode for the 2nd request and verify ita stays at the bottom of the page',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(conversation.name);

        const lastChatMessage = chatMessages.getChatMessage(
          userRequests.length * 2,
        );
        const lastChatMessageBounding = await lastChatMessage.boundingBox();
        await chatMessages.openEditMessageMode(userRequests[1]);
        const editMessageTextArea = chatMessages.getChatMessageTextarea(
          userRequests[1],
        );
        const editMessageTextAreaBounding =
          await editMessageTextArea.boundingBox();
        expect
          .soft(
            editMessageTextAreaBounding!.y > lastChatMessageBounding!.y,
            ExpectedMessages.elementPositionIsCorrect,
          )
          .toBeTruthy();
      },
    );
  },
);
