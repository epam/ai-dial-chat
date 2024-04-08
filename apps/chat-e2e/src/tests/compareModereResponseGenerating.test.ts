import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  ExpectedMessages,
  FolderConversation,
  MenuOptions,
  ModelIds,
  Rate,
  Side,
} from '@/src/testData';
import { keys } from '@/src/ui/keyboard';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

let defaultModel: DialAIEntityModel;
let gpt4Model: DialAIEntityModel;
let bisonModel: DialAIEntityModel;

dialTest.beforeAll(async () => {
  defaultModel = ModelsUtil.getDefaultModel()!;
  gpt4Model = ModelsUtil.getModel(ModelIds.GPT_4)!;
  bisonModel = ModelsUtil.getModel(ModelIds.BISON_001)!;
});

dialTest(
  'Generate new response for two chats in compare mode. GPT models.\n' +
    'Likes/Dislikes set in compare mode are stored in both chats',
  async ({
    dialHomePage,
    chat,
    chatMessages,
    setTestIds,
    conversationData,
    localStorageManager,
    dataInjector,
    compare,
    conversations,
  }) => {
    setTestIds('EPMRTC-552', 'EPMRTC-558');

    let firstConversation: Conversation;
    let secondConversation: Conversation;

    const firstPrompt = 'repeat the same text';
    const firstTemp = 1;
    const secondPrompt = 'repeat the same text again';
    const secondTemp = 0;

    await dialTest.step('Prepare two conversations for comparing', async () => {
      firstConversation = conversationData.prepareModelConversation(
        firstTemp,
        firstPrompt,
        [],
        defaultModel,
      );
      conversationData.resetData();
      secondConversation = conversationData.prepareModelConversation(
        secondTemp,
        secondPrompt,
        [],
        gpt4Model,
      );
      await dataInjector.createConversations([
        firstConversation,
        secondConversation,
      ]);
      await localStorageManager.setSelectedConversation(
        firstConversation,
        secondConversation,
      );
    });

    await dialTest.step(
      'Send new message in compare chat and verify response is displayed for both and API requests are correct',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await compare.waitForComparedConversationsLoaded();
        const requestsData = await chat.sendRequestInCompareMode(
          'how are you?',
          {
            rightEntity: firstConversation.model.id,
            leftEntity: secondConversation.model.id,
          },
          true,
        );

        const messagesCount = await chatMessages.getCompareMessagesCount();
        expect
          .soft(
            messagesCount,
            ExpectedMessages.responseReceivedForComparedConversations,
          )
          .toBe(
            firstConversation.messages.length +
              secondConversation.messages.length +
              4,
          );

        expect
          .soft(
            requestsData.rightRequest.modelId,
            ExpectedMessages.requestModeIdIsValid,
          )
          .toBe(defaultModel.id);
        expect
          .soft(
            requestsData.rightRequest.prompt,
            ExpectedMessages.requestPromptIsValid,
          )
          .toBe(firstPrompt);
        expect
          .soft(
            requestsData.rightRequest.temperature,
            ExpectedMessages.requestTempIsValid,
          )
          .toBe(firstTemp);

        expect
          .soft(
            requestsData.leftRequest.modelId,
            ExpectedMessages.requestModeIdIsValid,
          )
          .toBe(gpt4Model.id);
        expect
          .soft(
            requestsData.leftRequest.prompt,
            ExpectedMessages.requestPromptIsValid,
          )
          .toBe(secondPrompt);
        expect
          .soft(
            requestsData.leftRequest.temperature,
            ExpectedMessages.requestTempIsValid,
          )
          .toBe(secondTemp);
      },
    );

    await dialTest.step(
      'Put like/dislike for compared chat, open this chat and verify like/dislike saved',
      async () => {
        const rate = GeneratorUtil.randomArrayElement(Object.values(Rate));
        await chatMessages.rateCompareRowMessage(Side.left, rate);
        const isComparedMessageRated =
          await chatMessages.isComparedRowMessageRated(Side.left, rate);
        expect
          .soft(isComparedMessageRated, ExpectedMessages.chatMessageIsRated)
          .toBeTruthy();

        await conversations.selectConversation(firstConversation.name);
        await chatMessages
          .getChatMessageRate(firstConversation.messages.length + 2, rate)
          .waitFor();
      },
    );
  },
);

dialTest(
  'Generate new response for two chats in compare mode. Bison and GPT-4-32 which have different response time.\n' +
    'Regenerate response in compare mode',
  async ({
    dialHomePage,
    chat,
    chatMessages,
    setTestIds,
    conversationData,
    localStorageManager,
    dataInjector,
    conversations,
    page,
  }) => {
    setTestIds('EPMRTC-553', 'EPMRTC-555');
    const request = ['beautiful'];
    let firstConversation: Conversation;
    let secondConversation: Conversation;

    await dialTest.step('Prepare two conversations for comparing', async () => {
      firstConversation =
        conversationData.prepareModelConversationBasedOnRequests(
          bisonModel,
          request,
        );
      conversationData.resetData();
      secondConversation =
        conversationData.prepareModelConversationBasedOnRequests(
          ModelsUtil.getModel(ModelIds.GPT_4_32K)!,
          request,
        );
      await dataInjector.createConversations([
        firstConversation,
        secondConversation,
      ]);
      await localStorageManager.setSelectedConversation(
        firstConversation,
        secondConversation,
      );
    });

    await dialTest.step(
      'Send new message in compare chat and verify regenerate is not available until both responses received',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();

        page.route(API.chatHost, async (route) => {
          const request = route.request();
          const postData = await request.postDataJSON();

          if (postData.modelId === bisonModel.id) {
            await route.fulfill({
              status: 200,
              body: '{}',
            });
          } else {
            await route.continue();
          }
        });

        await chat.sendRequestInCompareMode(
          'write down 20 adjectives about person',
          {
            rightEntity: firstConversation.model.id,
            leftEntity: secondConversation.model.id,
          },
        );
        await chatMessages.waitForCompareMessageJumpingIconDisappears(
          Side.left,
        );
        const isRegenerateButtonVisible = await chatMessages.regenerate
          .getNthElement(1)
          .isVisible();
        expect
          .soft(
            isRegenerateButtonVisible,
            ExpectedMessages.regenerateNotAvailable,
          )
          .toBeFalsy();

        const isStopButtonVisible = await chat.stopGenerating.isVisible();
        expect
          .soft(isStopButtonVisible, ExpectedMessages.stopGeneratingAvailable)
          .toBeTruthy();
      },
    );

    await dialTest.step(
      'Click "Regenerate" button and verify last response is regenerated for both chats',
      async () => {
        await chatMessages.regenerate.getNthElement(1).waitFor();

        const requestsData = await chat.regenerateResponseInCompareMode({
          rightEntity: firstConversation.model.id,
          leftEntity: secondConversation.model.id,
        });

        expect
          .soft(
            requestsData.rightRequest.modelId,
            ExpectedMessages.requestModeIdIsValid,
          )
          .toBe(firstConversation.model.id);
        expect
          .soft(
            requestsData.leftRequest.modelId,
            ExpectedMessages.requestModeIdIsValid,
          )
          .toBe(secondConversation.model.id);

        for (const conversation of [firstConversation, secondConversation]) {
          const isConversationVisible = await conversations
            .getConversationByName(conversation.name)
            .isVisible();
          expect
            .soft(isConversationVisible, ExpectedMessages.conversationIsVisible)
            .toBeTruthy();
        }
      },
    );
  },
);

dialTest(
  'Apply changes with new settings for both chats in compare mode and check chat headers',
  async ({
    dialHomePage,
    chat,
    setTestIds,
    conversationData,
    dataInjector,
    localStorageManager,
    leftChatHeader,
    rightChatHeader,
    rightConversationSettings,
    leftConversationSettings,
    conversations,
    chatInfoTooltip,
    errorPopup,
    iconApiHelper,
  }) => {
    dialTest.slow();
    setTestIds('EPMRTC-1021');
    let firstConversation: Conversation;
    let secondConversation: Conversation;
    const models = ModelsUtil.getLatestModels();
    const initRandomModel = GeneratorUtil.randomArrayElement(models);
    const modelsForUpdate = models.filter((m) => m !== initRandomModel);
    const firstUpdatedRandomModel =
      GeneratorUtil.randomArrayElement(modelsForUpdate);
    const secondUpdatedRandomModel = GeneratorUtil.randomArrayElement(
      modelsForUpdate.filter((m) => m !== firstUpdatedRandomModel),
    );
    const firstUpdatedPrompt = 'first prompt';
    const secondUpdatedPrompt = 'second prompt';
    const firstUpdatedTemp = 0.5;
    const secondUpdatedTemp = 0;
    const expectedSecondUpdatedRandomModelIcon =
      await iconApiHelper.getEntityIcon(secondUpdatedRandomModel);
    const expectedFirstUpdatedRandomModelIcon =
      await iconApiHelper.getEntityIcon(firstUpdatedRandomModel);

    await dialTest.step(
      'Prepare two model conversations for comparing',
      async () => {
        firstConversation = conversationData.prepareModelConversation(
          1,
          'prompt',
          [],
          initRandomModel,
        );
        conversationData.resetData();
        secondConversation =
          conversationData.prepareDefaultConversation(initRandomModel);
        await dataInjector.createConversations([
          firstConversation,
          secondConversation,
        ]);
        await localStorageManager.setSelectedConversation(
          firstConversation,
          secondConversation,
        );
      },
    );

    await dialTest.step(
      'Open chat settings and update them for both models',
      async () => {
        await dialHomePage.openHomePage({
          iconsToBeLoaded: [initRandomModel.iconUrl],
        });
        await dialHomePage.waitForPageLoaded();
        await leftChatHeader.openConversationSettingsPopup();
        await leftConversationSettings
          .getTalkToSelector()
          .selectModel(firstUpdatedRandomModel);
        const leftEntitySettings = leftConversationSettings.getEntitySettings();
        if (firstUpdatedRandomModel.features?.systemPrompt) {
          await leftEntitySettings.setSystemPrompt(firstUpdatedPrompt);
        }
        await leftEntitySettings
          .getTemperatureSlider()
          .setTemperature(firstUpdatedTemp);

        await rightConversationSettings
          .getTalkToSelector()
          .selectModel(secondUpdatedRandomModel);
        const rightEntitySettings =
          rightConversationSettings.getEntitySettings();
        if (secondUpdatedRandomModel.features?.systemPrompt) {
          await rightEntitySettings.setSystemPrompt(secondUpdatedPrompt);
        }
        await rightEntitySettings
          .getTemperatureSlider()
          .setTemperature(secondUpdatedTemp);
        await chat.applyNewEntity();
      },
    );

    await dialTest.step(
      'Verify chat icons are updated with new model and addons in the header and chat bar',
      async () => {
        const rightHeaderModelIcon = await rightChatHeader.getHeaderModelIcon();
        expect
          .soft(
            rightHeaderModelIcon,
            `${ExpectedMessages.entityIconIsValid} for ${secondUpdatedRandomModel.name}`,
          )
          .toBe(expectedSecondUpdatedRandomModelIcon);

        const leftHeaderModelIcon = await leftChatHeader.getHeaderModelIcon();
        expect
          .soft(
            leftHeaderModelIcon,
            `${ExpectedMessages.entityIconIsValid} for ${firstUpdatedRandomModel.name}`,
          )
          .toBe(expectedFirstUpdatedRandomModelIcon);

        const firstConversationIcon = await conversations.getConversationIcon(
          firstConversation.name,
        );
        expect
          .soft(firstConversationIcon, ExpectedMessages.entityIconIsValid)
          .toBe(expectedFirstUpdatedRandomModelIcon);

        const secondConversationIcon = await conversations.getConversationIcon(
          secondConversation.name,
        );
        expect
          .soft(secondConversationIcon, ExpectedMessages.entityIconIsValid)
          .toBe(expectedSecondUpdatedRandomModelIcon);
      },
    );

    await dialTest.step(
      'Hover over chat headers and verify chat settings updated on tooltip',
      async () => {
        await errorPopup.cancelPopup();
        await rightChatHeader.hoverOverChatModel();
        const rightModelInfo = await chatInfoTooltip.getModelInfo();
        expect
          .soft(rightModelInfo, ExpectedMessages.chatInfoModelIsValid)
          .toBe(ModelsUtil.getModelInfo(secondUpdatedRandomModel.id));

        const rightModelInfoIcon = await chatInfoTooltip.getModelIcon();
        expect
          .soft(rightModelInfoIcon, ExpectedMessages.chatInfoModelIconIsValid)
          .toBe(expectedSecondUpdatedRandomModelIcon);

        if (secondUpdatedRandomModel.features?.systemPrompt) {
          const rightPromptInfo = await chatInfoTooltip.getPromptInfo();
          expect
            .soft(rightPromptInfo, ExpectedMessages.chatInfoPromptIsValid)
            .toBe(secondUpdatedPrompt);
        }

        const rightTempInfo = await chatInfoTooltip.getTemperatureInfo();
        expect
          .soft(rightTempInfo, ExpectedMessages.chatInfoTemperatureIsValid)
          .toBe(secondUpdatedTemp.toString());

        await errorPopup.cancelPopup();
        await leftChatHeader.hoverOverChatModel();
        const leftModelInfo = await chatInfoTooltip.getModelInfo();
        expect
          .soft(leftModelInfo, ExpectedMessages.chatInfoModelIsValid)
          .toBe(ModelsUtil.getModelInfo(firstUpdatedRandomModel.id));

        const leftModelInfoIcon = await chatInfoTooltip.getModelIcon();
        expect
          .soft(leftModelInfoIcon, ExpectedMessages.chatInfoModelIconIsValid)
          .toBe(expectedFirstUpdatedRandomModelIcon);

        if (firstUpdatedRandomModel.features?.systemPrompt) {
          const leftPromptInfo = await chatInfoTooltip.getPromptInfo();
          expect
            .soft(leftPromptInfo, ExpectedMessages.chatInfoPromptIsValid)
            .toBe(firstUpdatedPrompt);
        }

        const leftTempInfo = await chatInfoTooltip.getTemperatureInfo();
        expect
          .soft(leftTempInfo, ExpectedMessages.chatInfoTemperatureIsValid)
          .toBe(firstUpdatedTemp.toString());
      },
    );
  },
);

dialTest(
  'Stop regenerating in compare mode.\n' +
    'Both "Talk to" item icons are jumping while generating an answer in Compare mode',
  async ({
    dialHomePage,
    chat,
    chatMessages,
    setTestIds,
    conversationData,
    localStorageManager,
    dataInjector,
    compare,
    iconApiHelper,
  }) => {
    dialTest.slow();
    setTestIds('EPMRTC-556', 'EPMRTC-1134');
    let firstConversation: Conversation;
    let secondConversation: Conversation;
    const sides = Object.values(Side);

    await dialTest.step('Prepare two conversations for comparing', async () => {
      firstConversation =
        conversationData.prepareDefaultConversation(defaultModel);
      conversationData.resetData();
      secondConversation =
        conversationData.prepareDefaultConversation(defaultModel);
      await dataInjector.createConversations([
        firstConversation,
        secondConversation,
      ]);
      await localStorageManager.setSelectedConversation(
        firstConversation,
        secondConversation,
      );
    });

    await dialTest.step(
      'Send new message in compare chat, verify both chat icons are jumping while responding and then stop generation',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await compare.waitForComparedConversationsLoaded();
        await dialHomePage.throttleAPIResponse(API.chatHost);

        await chat.sendRequestInCompareMode('write down 30 adjectives', {
          rightEntity: firstConversation.model.id,
          leftEntity: secondConversation.model.id,
        });

        for (const side of sides) {
          const jumpingIcon =
            await chatMessages.getCompareMessageJumpingIcon(side);
          await jumpingIcon.waitFor();
        }

        await chat.stopGenerating.click();
      },
    );

    await dialTest.step(
      'Verify response is not received by both chats, stop is done immediately, valid model icons are displayed',
      async () => {
        const isResponseLoading = await chatMessages.isResponseLoading();
        expect
          .soft(isResponseLoading, ExpectedMessages.responseLoadingStopped)
          .toBeFalsy();
        const isStopButtonVisible = await chat.stopGenerating.isVisible();
        expect
          .soft(isStopButtonVisible, ExpectedMessages.responseLoadingStopped)
          .toBeFalsy();

        const expectedModelIcon =
          await iconApiHelper.getEntityIcon(defaultModel);
        for (const side of sides) {
          const messageIcon =
            await chatMessages.getIconAttributesForCompareMessage(side);
          expect
            .soft(messageIcon, ExpectedMessages.entityIconIsValid)
            .toBe(expectedModelIcon);
        }
      },
    );
  },
);

dialTest(
  'Compare two chats located in different folders',
  async ({
    dialHomePage,
    setTestIds,
    conversationDropdownMenu,
    folderConversations,
    conversationData,
    dataInjector,
    compare,
    compareConversationSelector,
    chat,
  }) => {
    setTestIds('EPMRTC-557');
    let firstFolderConversation: FolderConversation;
    let secondFolderConversation: FolderConversation;
    const conversationName = GeneratorUtil.randomString(7);

    await dialTest.step('Prepare two conversations in folders', async () => {
      firstFolderConversation =
        conversationData.prepareDefaultConversationInFolder(
          undefined,
          defaultModel,
          `${conversationName} 1`,
        );
      conversationData.resetData();
      secondFolderConversation =
        conversationData.prepareDefaultConversationInFolder(
          undefined,
          bisonModel,
          `${conversationName} 2`,
        );

      await dataInjector.createConversations(
        [
          firstFolderConversation.conversations[0],
          secondFolderConversation.conversations[0],
        ],
        firstFolderConversation.folders,
        secondFolderConversation.folders,
      );
    });

    await dialTest.step(
      'Open compare mode from 1st chat dropdown menu and verify one chat is available for comparison',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await folderConversations.expandFolder(
          firstFolderConversation.folders.name,
        );
        await folderConversations.openFolderEntityDropdownMenu(
          firstFolderConversation.folders.name,
          firstFolderConversation.conversations[0].name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.compare);
        await compare.waitForState();
        await compareConversationSelector.click();
        const conversationsList =
          await compareConversationSelector.getListOptions();
        expect
          .soft(
            conversationsList,
            ExpectedMessages.conversationsToCompareOptionsValid,
          )
          .toEqual([secondFolderConversation.conversations[0].name]);
      },
    );

    await dialTest.step(
      'Select folder conversation for comparison, send new request and verify response generated for both chats',
      async () => {
        await compareConversationSelector.selectModel(
          secondFolderConversation.conversations[0].name,
          true,
        );
        const requestsData = await chat.sendRequestInCompareMode(
          'repeat the same response',
          {
            rightEntity: firstFolderConversation.conversations[0].model.id,
            leftEntity: secondFolderConversation.conversations[0].model.id,
          },
        );
        expect
          .soft(
            requestsData.rightRequest.modelId,
            ExpectedMessages.requestModeIdIsValid,
          )
          .toBe(firstFolderConversation.conversations[0].model.id);
        expect
          .soft(
            requestsData.leftRequest.modelId,
            ExpectedMessages.requestModeIdIsValid,
          )
          .toBe(secondFolderConversation.conversations[0].model.id);
      },
    );
  },
);

dialTest(
  'In compare mode delete any message in chat2.\n' +
    'In compare mode copy answer.\n' +
    'In compare mode save&sumbit any message in chat1.\n' +
    'In compare mode edit chat name.\n' +
    'In compare mode delete a chat',
  async ({
    dialHomePage,
    setTestIds,
    conversationData,
    localStorageManager,
    dataInjector,
    chatMessages,
    confirmationDialog,
    page,
    conversations,
    leftChatHeader,
    conversationDropdownMenu,
    compare,
  }) => {
    setTestIds(
      'EPMRTC-560',
      'EPMRTC-562',
      'EPMRTC-559',
      'EPMRTC-563',
      'EPMRTC-564',
    );
    let firstConversation: Conversation;
    let secondConversation: Conversation;
    const firstConversationRequests = ['1+2', '2+3', '3+4'];
    const secondConversationRequests = ['1+2', '4+5', '5+6'];
    let updatedRequestContent: string;

    await dialTest.step(
      'Prepare two conversations for compare mode',
      async () => {
        firstConversation =
          conversationData.prepareModelConversationBasedOnRequests(
            defaultModel,
            firstConversationRequests,
          );
        conversationData.resetData();

        secondConversation =
          conversationData.prepareModelConversationBasedOnRequests(
            gpt4Model,
            secondConversationRequests,
          );

        await dataInjector.createConversations([
          firstConversation,
          secondConversation,
        ]);
        await localStorageManager.setSelectedConversation(
          firstConversation,
          secondConversation,
        );
      },
    );

    await dialTest.step(
      'Delete 1st message from the left conversation and verify only 1st row deleted for both chats',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await chatMessages.openDeleteCompareRowMessageDialog(Side.left, 1);
        await confirmationDialog.confirm();

        const comparedMessagesCount =
          await chatMessages.getCompareMessagesCount();
        expect
          .soft(comparedMessagesCount, ExpectedMessages.messageCountIsCorrect)
          .toBe((firstConversationRequests.length - 1) * 4);

        const firstComparedMessage = await chatMessages.getCompareRowMessage(
          Side.left,
          1,
        );
        await expect
          .soft(firstComparedMessage, ExpectedMessages.messageContentIsValid)
          .toHaveText(firstConversationRequests[1]);
      },
    );

    await dialTest.step(
      'Copy last response from the right conversation and edit the 1st request for the left chat with copied message',
      async () => {
        await chatMessages.copyCompareRowMessage(
          Side.right,
          (firstConversationRequests.length - 1) * 2,
        );
        await chatMessages.openEditCompareRowMessageMode(Side.left, 1);
        await chatMessages.clearEditTextarea(firstConversationRequests[1]);
        await page.keyboard.press(keys.ctrlPlusV);
        await chatMessages.saveAndSubmit.click();
        await chatMessages.waitForResponseReceived();
      },
    );

    await dialTest.step(
      'Verify both first requests updated, messages below are deleted',
      async () => {
        updatedRequestContent =
          secondConversation.messages[secondConversation.messages.length - 1]
            .content;
        const comparedMessagesCount =
          await chatMessages.getCompareMessagesCount();
        expect
          .soft(comparedMessagesCount, ExpectedMessages.messageCountIsCorrect)
          .toBe(4);

        for (const side of Object.values(Side)) {
          const firstComparedMessage = await chatMessages.getCompareRowMessage(
            side,
            1,
          );
          await expect
            .soft(firstComparedMessage, ExpectedMessages.messageContentIsValid)
            .toHaveText(updatedRequestContent);
        }
      },
    );

    await dialTest.step(
      'Edit left chat title and verify it is updated in the header',
      async () => {
        const newLeftChatName = GeneratorUtil.randomString(7);
        await conversations.openConversationDropdownMenu(
          updatedRequestContent,
          1,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
        await conversations.editConversationNameWithTick(
          updatedRequestContent,
          newLeftChatName,
        );

        const chatTitle = await leftChatHeader.chatTitle.getElementContent();
        expect
          .soft(chatTitle, ExpectedMessages.headerTitleCorrespondRequest)
          .toBe(chatTitle);
      },
    );

    await dialTest.step(
      'Delete right chat and compare mode closed, left chat is active',
      async () => {
        await conversations.openConversationDropdownMenu(updatedRequestContent);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        await conversations
          .getConversationByName(updatedRequestContent)
          .waitFor({ state: 'hidden' });
        const isCompareModeOpened = await compare.isVisible();
        expect
          .soft(isCompareModeOpened, ExpectedMessages.compareModeClosed)
          .toBeFalsy();
      },
    );
  },
);
