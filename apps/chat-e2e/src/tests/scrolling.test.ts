import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  AddonIds,
  Attachment,
  ExpectedMessages,
  MenuOptions,
  ModelIds,
  ScrollState,
} from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';
import { Buffer } from 'buffer';

const mockedResponseBody = `{"content":"1"}\u0000{"content":"."}\u0000{"content":" Italy"}\u0000{"content":"\\n"}\u0000{"content":"2"}\u0000{"content":"."}\u0000{"content":" Greece"}\u0000{"content":"\\n"}\u0000{"content":"3"}\u0000{"content":"."}\u0000{"content":" Switzerland"}\u0000{"content":"\\n"}\u0000{"content":"4"}\u0000{"content":"."}\u0000{"content":" Australia"}\u0000{"content":"\\n"}\u0000{"content":"5"}\u0000{"content":"."}\u0000{"content":" New"}\u0000{"content":" Zealand"}\u0000{"content":"\\n"}\u0000{"content":"6"}\u0000{"content":"."}\u0000{"content":" Mal"}\u0000{"content":"dives"}\u0000{"content":"\\n"}\u0000{"content":"7"}\u0000{"content":"."}\u0000{"content":" Canada"}\u0000{"content":"\\n"}\u0000{"content":"8"}\u0000{"content":"."}\u0000{"content":" Norway"}\u0000{"content":"\\n"}\u0000{"content":"9"}\u0000{"content":"."}\u0000{"content":" France"}\u0000{"content":"\\n"}\u0000{"content":"10"}\u0000{"content":"."}\u0000{"content":" Spain"}\u0000{"content":"\\n"}\u0000{"content":"11"}\u0000{"content":"."}\u0000{"content":" Iceland"}\u0000{"content":"\\n"}\u0000{"content":"12"}\u0000{"content":"."}\u0000{"content":" Scotland"}\u0000{"content":"\\n"}\u0000{"content":"13"}\u0000{"content":"."}\u0000{"content":" Ireland"}\u0000{"content":"\\n"}\u0000{"content":"14"}\u0000{"content":"."}\u0000{"content":" Japan"}\u0000{"content":"\\n"}\u0000{"content":"15"}\u0000{"content":"."}\u0000{"content":" Thailand"}\u0000{"content":"\\n"}\u0000{"content":"16"}\u0000{"content":"."}\u0000{"content":" Croatia"}\u0000{"content":"\\n"}\u0000{"content":"17"}\u0000{"content":"."}\u0000{"content":" Austria"}\u0000{"content":"\\n"}\u0000{"content":"18"}\u0000{"content":"."}\u0000{"content":" Sweden"}\u0000{"content":"\\n"}\u0000{"content":"19"}\u0000{"content":"."}\u0000{"content":" South"}\u0000{"content":" Africa"}\u0000{"content":"\\n"}\u0000{"content":"20"}\u0000{"content":"."}\u0000{"content":" Brazil"}\u0000{"content":"\\n"}\u0000{"content":"21"}\u0000{"content":"."}\u0000{"content":" United"}\u0000{"content":" States"}\u0000{"content":"\\n"}\u0000{"content":"22"}\u0000{"content":"."}\u0000{"content":" India"}\u0000{"content":"\\n"}\u0000{"content":"23"}\u0000{"content":"."}\u0000{"content":" Costa"}\u0000{"content":" Rica"}\u0000{"content":"\\n"}\u0000{"content":"24"}\u0000{"content":"."}\u0000{"content":" Turkey"}\u0000{"content":"\\n"}\u0000{"content":"25"}\u0000{"content":"."}\u0000{"content":" Morocco"}\u0000{"content":"\\n"}\u0000{"content":"26"}\u0000{"content":"."}\u0000{"content":" Argentina"}\u0000{"content":"\\n"}\u0000{"content":"27"}\u0000{"content":"."}\u0000{"content":" Portugal"}\u0000{"content":"\\n"}\u0000{"content":"28"}\u0000{"content":"."}\u0000{"content":" Vietnam"}\u0000{"content":"\\n"}\u0000{"content":"29"}\u0000{"content":"."}\u0000{"content":" Fiji"}\u0000{"content":"\\n"}\u0000{"content":"30"}\u0000{"content":"."}\u0000{"content":" China"}\u0000{"content":"\\n"}\u0000{"content":"31"}\u0000{"content":"."}\u0000{"content":" Indonesia"}\u0000{"content":"\\n"}\u0000{"content":"32"}\u0000{"content":"."}\u0000{"content":" Mexico"}\u0000{"content":"\\n"}\u0000{"content":"33"}\u0000{"content":"."}\u0000{"content":" Peru"}\u0000{"content":"\\n"}\u0000{"content":"34"}\u0000{"content":"."}\u0000{"content":" Chile"}\u0000{"content":"\\n"}\u0000{"content":"35"}\u0000{"content":"."}\u0000{"content":" Netherlands"}\u0000{"content":"\\n"}\u0000{"content":"36"}\u0000{"content":"."}\u0000{"content":" Belize"}\u0000{"content":"\\n"}\u0000{"content":"37"}\u0000{"content":"."}\u0000{"content":" Sey"}\u0000{"content":"ch"}\u0000{"content":"elles"}\u0000{"content":"\\n"}\u0000{"content":"38"}\u0000{"content":"."}\u0000{"content":" Philippines"}\u0000{"content":"\\n"}\u0000{"content":"39"}\u0000{"content":"."}\u0000{"content":" Denmark"}\u0000{"content":"\\n"}\u0000{"content":"40"}\u0000{"content":"."}\u0000{"content":" Hungary"}\u0000{"content":"\\n"}\u0000{"content":"41"}\u0000{"content":"."}\u0000{"content":" Czech"}\u0000{"content":" Republic"}\u0000{"content":"\\n"}\u0000{"content":"42"}\u0000{"content":"."}\u0000{"content":" Mal"}\u0000{"content":"awi"}\u0000{"content":"\\n"}\u0000{"content":"43"}\u0000{"content":"."}\u0000{"content":" Kenya"}\u0000{"content":"\\n"}\u0000{"content":"44"}\u0000{"content":"."}\u0000{"content":" Jordan"}\u0000{"content":"\\n"}\u0000{"content":"45"}\u0000{"content":"."}\u0000{"content":" Tanzania"}\u0000{"content":"\\n"}\u0000{"content":"46"}\u0000{"content":"."}\u0000{"content":" South"}\u0000{"content":" Korea"}\u0000{"content":"\\n"}\u0000{"content":"47"}\u0000{"content":"."}\u0000{"content":" Sri"}\u0000{"content":" Lanka"}\u0000{"content":"\\n"}\u0000{"content":"48"}\u0000{"content":"."}\u0000{"content":" Cambodia"}\u0000{"content":"\\n"}\u0000{"content":"49"}\u0000{"content":"."}\u0000{"content":" Israel"}\u0000{"content":"\\n"}\u0000{"content":"50"}\u0000{"content":"."}\u0000{"content":" Latvia"}\u0000{}\u0000`;

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
    localStorageManager,
    dataInjector,
    sendMessage,
    page,
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
      await localStorageManager.setSelectedConversation(conversation);
    });

    await dialTest.step(
      'Open app and verify no scroll down button is visible on conversation',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await expect
          .soft(
            await sendMessage.scrollDownButton.getElementLocator(),
            ExpectedMessages.scrollDownButtonIsNotVisible,
          )
          .toBeHidden();
      },
    );

    await dialTest.step(
      'Send new request with long response and verify auto-scrolling to bottom of the page',
      async () => {
        await page.route(API.chatHost, async (route) => {
          await route.fulfill({
            body: Buffer.from(mockedResponseBody),
          });
        });
        await chat.sendRequestWithButton('request to mock', false);

        const scrollPosition =
          await chat.scrollableArea.getVerticalScrollPosition();
        expect
          .soft(scrollPosition, ExpectedMessages.scrollPositionIsCorrect)
          .toBe(ScrollState.bottom);
        await expect
          .soft(
            await sendMessage.scrollDownButton.getElementLocator(),
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
    localStorageManager,
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
      await localStorageManager.setSelectedConversation(conversation);
    });

    await dialTest.step(
      'Scroll chat history to the top, click on "Scroll down button" and verify scroll is at the bottom, scroll down button disappears',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
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
    "Autoscroll doesn't depend on scroll position in previous chat",
  async ({
    dialHomePage,
    chat,
    setTestIds,
    conversationData,
    localStorageManager,
    dataInjector,
    sendMessage,
    conversations,
    conversationDropdownMenu,
    chatBar,
    page,
  }) => {
    setTestIds('EPMRTC-493', 'EPMRTC-3072', 'EPMRTC-1783');
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
        await localStorageManager.setSelectedConversation(firstConversation);
      },
    );

    await dialTest.step(
      'Scroll first chat history to the top, select second chat and verify no "Scroll down" button is visible',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
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
      'Create Replay conversation based on the first one, start replaying and verify autoscroll is active',
      async () => {
        await conversations.openConversationDropdownMenu(
          firstConversation.name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.replay);
        await page.route(API.chatHost, async (route) => {
          await route.fulfill({
            body: Buffer.from(mockedResponseBody),
          });
        });
        await chat.startReplay();
        const scrollPosition =
          await chat.scrollableArea.getVerticalScrollPosition();
        expect
          .soft(scrollPosition, ExpectedMessages.scrollPositionIsCorrect)
          .toBe(ScrollState.bottom);
        await expect
          .soft(
            await sendMessage.scrollDownButton.getElementLocator(),
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
    localStorageManager,
    dataInjector,
    conversations,
    conversationDropdownMenu,
    compareConversationSelector,
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
        await localStorageManager.setSelectedConversation(firstConversation);
      },
    );

    await dialTest.step(
      'Scroll up first chat history, create compare mode with the second conversation and verify scroll position is saved',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await chat.scrollContent(0, -100);
        await conversations.openConversationDropdownMenu(
          firstConversationName,
          2,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.compare);
        await compareConversationSelector.selectModel(secondConversationName);

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
    localStorageManager,
    dataInjector,
    chatMessages,
  }) => {
    setTestIds('EPMRTC-3074');
    let stageConversation: Conversation;

    await dialTest.step('Prepare conversation with stage', async () => {
      stageConversation = conversationData.prepareAddonsConversation(
        ModelsUtil.getModel(ModelIds.GPT_4)!,
        [AddonIds.XWEATHER],
      );
      await dataInjector.createConversations([stageConversation]);
      await localStorageManager.setSelectedConversation(stageConversation);
    });

    await dialTest.step(
      'Open response stage and verify "Scroll dawn" button is displayed',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
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
    localStorageManager,
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
            ModelIds.DALLE,
          );
        await dataInjector.createConversations([imageConversation]);
        await localStorageManager.setSelectedConversation(imageConversation);
      },
    );

    await dialTest.step(
      'Expand generated image and verify "Scroll dawn" button is displayed',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
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
    localStorageManager,
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
        await localStorageManager.setSelectedConversation(conversation);
      },
    );

    await dialTest.step(
      'Open edit mode for the 2nd request and verify ita stays at the bottom of the page',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();

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
