import { Conversation } from '@/src/types/chat';
import { OpenAIEntityModel } from '@/src/types/openai';

import test from '@/e2e/src/core/fixtures';
import {
  API,
  ExpectedConstants,
  ExpectedMessages,
  FolderConversation,
  MenuOptions,
  ModelIds,
  Rate,
  Side,
} from '@/e2e/src/testData';
import { Overflow, Styles } from '@/e2e/src/ui/domData';
import { keys } from '@/e2e/src/ui/keyboard';
import { GeneratorUtil, ModelsUtil } from '@/e2e/src/utils';
import { expect } from '@playwright/test';

let defaultModel: OpenAIEntityModel;
let gpt4Model: OpenAIEntityModel;
let bisonModel: OpenAIEntityModel;

test.beforeAll(async () => {
  defaultModel = ModelsUtil.getDefaultModel()!;
  gpt4Model = ModelsUtil.getModel(ModelIds.GPT_4)!;
  bisonModel = ModelsUtil.getModel(ModelIds.BISON_001)!;
});

test('Compare mode button creates two new chats and opens them in compare mode', async ({
  dialHomePage,
  setTestIds,
  chatBar,
  conversations,
  compare,
}) => {
  setTestIds('EPMRTC-537');
  await test.step('Click on compare button on bottom of chat bar and verify compare mode is opened for new two chats', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    await chatBar.openCompareMode();
    await compare.waitForState();
    const chatsCount = await compare.getConversationsCount();
    expect.soft(chatsCount, ExpectedMessages.compareModeOpened).toBe(2);

    const todayConversations = await conversations.getTodayConversations();
    expect
      .soft(todayConversations.length, ExpectedMessages.conversationOfToday)
      .toBe(3);

    todayConversations.forEach((value) =>
      expect
        .soft(value, ExpectedMessages.conversationOfToday)
        .toContain(ExpectedConstants.newConversationTitle),
    );
  });
});

test(
  'Check the list of available conversations.\n' +
    'Chat icon is shown in Select conversation drop down list  in compare mode',
  async ({
    dialHomePage,
    setTestIds,
    conversationDropdownMenu,
    conversations,
    conversationData,
    localStorageManager,
    compare,
    compareConversationSelector,
    iconApiHelper,
  }) => {
    setTestIds('EPMRTC-546', 'EPMRTC-383');
    let firstModelConversation: Conversation;
    let secondModelConversation: Conversation;
    let modelConversationInFolder: FolderConversation;
    let thirdModelConversation: Conversation;

    await test.step('Prepare three conversations to compare', async () => {
      firstModelConversation = conversationData.prepareDefaultConversation(
        defaultModel,
        ExpectedConstants.newConversationTitle,
      );
      const request = firstModelConversation.messages.find(
        (m) => m.role === 'user',
      )?.content;
      conversationData.resetData();
      secondModelConversation =
        conversationData.prepareModelConversationBasedOnRequests(gpt4Model, [
          request!,
        ]);
      conversationData.resetData();
      modelConversationInFolder =
        conversationData.prepareDefaultConversationInFolder(bisonModel);
      conversationData.resetData();
      thirdModelConversation =
        conversationData.prepareDefaultConversation(bisonModel);
      await localStorageManager.setFolders(modelConversationInFolder.folders);
      await localStorageManager.setConversationHistory(
        firstModelConversation,
        secondModelConversation,
        thirdModelConversation,
        modelConversationInFolder.conversations[0],
      );
      await localStorageManager.setSelectedConversation(thirdModelConversation);
    });

    await test.step('Open compare mode from 1st chat dropdown menu and verify chats with valid icons available for comparison', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await conversations.openConversationDropdownMenu(
        thirdModelConversation.name,
      );
      await conversationDropdownMenu.selectMenuOption(MenuOptions.compare);

      const chatsCount = await compare.getChatMessagesCount();
      expect.soft(chatsCount, ExpectedMessages.compareModeOpened).toBe(1);

      const isConversationToCompareVisible =
        await compare.isConversationToCompareVisible();
      expect
        .soft(
          isConversationToCompareVisible,
          ExpectedMessages.conversationToCompareVisible,
        )
        .toBeTruthy();

      await compareConversationSelector.click();
      const conversationsList =
        await compareConversationSelector.getListOptions();
      expect
        .soft(
          conversationsList,
          ExpectedMessages.conversationsToCompareOptionsValid,
        )
        .toEqual([
          firstModelConversation.name,
          secondModelConversation.name,
          modelConversationInFolder.conversations[0].name,
        ]);

      const compareOptionsIcons =
        await compareConversationSelector.getOptionsIcons();
      const expectedModels = [defaultModel, gpt4Model, bisonModel];
      expect
        .soft(
          compareOptionsIcons.length,
          ExpectedMessages.entitiesIconsCountIsValid,
        )
        .toBe(expectedModels.length);

      for (const expectedModel of expectedModels) {
        const actualOptionIcon = compareOptionsIcons.find(
          (o) => o.entityName === expectedModel.name,
        )!;
        const expectedModelIcon =
          await iconApiHelper.getEntityIcon(expectedModel);
        expect
          .soft(actualOptionIcon.icon, ExpectedMessages.entityIconIsValid)
          .toBe(expectedModelIcon);
      }
    });
  },
);

test(
  'Check replay chats are not included in Select conversation drop down list.\n' +
    'Compare mode is closed if to switch to another chat',
  async ({
    dialHomePage,
    setTestIds,
    conversationDropdownMenu,
    conversations,
    conversationData,
    localStorageManager,
    compareConversationSelector,
    compare,
  }) => {
    setTestIds('EPMRTC-1133', 'EPMRTC-541');
    let modelConversation: Conversation;
    let replayConversation: Conversation;
    let firstEmptyConversation: Conversation;
    let secondEmptyConversation: Conversation;

    await test.step('Prepare one conversation with replay conversation and two empty conversations', async () => {
      modelConversation = conversationData.prepareDefaultConversation();
      replayConversation =
        conversationData.prepareDefaultReplayConversation(modelConversation);
      conversationData.resetData();
      firstEmptyConversation = conversationData.prepareEmptyConversation();
      conversationData.resetData();
      secondEmptyConversation = conversationData.prepareEmptyConversation();
      await localStorageManager.setConversationHistory(
        modelConversation,
        replayConversation,
        firstEmptyConversation,
        secondEmptyConversation,
      );
      await localStorageManager.setSelectedConversation(firstEmptyConversation);
    });

    await test.step('Open compare mode for the 1st empty chat and verify only one empty chat is available for comparison', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await conversations.openConversationDropdownMenu(
        firstEmptyConversation.name,
      );
      await conversationDropdownMenu.selectMenuOption(MenuOptions.compare);
      await compareConversationSelector.click();
      const conversationsList =
        await compareConversationSelector.getListOptions();
      expect
        .soft(
          conversationsList,
          ExpectedMessages.conversationsToCompareOptionsValid,
        )
        .toEqual([secondEmptyConversation.name]);
    });

    await test.step('Open another conversation and verify compare mode is closed', async () => {
      await conversations.selectConversation(modelConversation.name);
      const isCompareModeOn = await compare.isVisible();
      expect
        .soft(isCompareModeOn, ExpectedMessages.compareModeClosed)
        .toBeFalsy();
    });
  },
);

test(
  `Compare mode is closed on "x" button in chat1.\n` +
    'Compare mode is closed on "x" button in chat2',
  async ({
    dialHomePage,
    setTestIds,
    conversationData,
    localStorageManager,
    compare,
    rightChatHeader,
    leftChatHeader,
  }) => {
    setTestIds('EPMRTC-544', 'EPMRTC-545');
    let firstConversation: Conversation;
    let secondConversation: Conversation;

    await test.step('Prepare two conversations in compare mode', async () => {
      firstConversation = conversationData.prepareDefaultConversation();
      conversationData.resetData();
      secondConversation = conversationData.prepareDefaultConversation();
      await localStorageManager.setConversationHistory(
        firstConversation,
        secondConversation,
      );
      await localStorageManager.setSelectedConversation(
        firstConversation,
        secondConversation,
      );
    });

    await test.step('Remove 1st conversation from compare mode using Close btn in the header', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      const randomSide = GeneratorUtil.randomArrayElement(Object.values(Side));
      let activeChat;
      if (randomSide === Side.right) {
        await rightChatHeader.removeConversationFromComparison.click();
        activeChat = firstConversation.name;
      } else {
        await leftChatHeader.removeConversationFromComparison.click();
        activeChat = secondConversation.name;
      }

      const isCompareModeOn = await compare.isVisible();
      expect
        .soft(isCompareModeOn, ExpectedMessages.compareModeClosed)
        .toBeFalsy();

      const activeChatHeader =
        await leftChatHeader.chatTitle.getElementContent();
      expect
        .soft(activeChatHeader, ExpectedMessages.headerTitleIsValid)
        .toBe(activeChat);
    });
  },
);

test('Check the list of No conversations available', async ({
  dialHomePage,
  setTestIds,
  conversationData,
  localStorageManager,
  conversations,
  compareConversationSelector,
  conversationDropdownMenu,
}) => {
  setTestIds('EPMRTC-540');
  const firstRequest = 'What is EPAM official name?';
  const secondRequest = 'What is DIAL?';
  const thirdRequest = 'Who is EPAM founder?';
  let firstConversation: Conversation;
  let secondConversation: Conversation;
  let thirdConversation: Conversation;
  let forthConversation: Conversation;
  let fifthConversation: Conversation;

  await test.step('Prepare five conversations with requests combination', async () => {
    firstConversation =
      conversationData.prepareModelConversationBasedOnRequests(
        defaultModel,
        [firstRequest, secondRequest],
        'firstConv',
      );
    conversationData.resetData();
    secondConversation =
      conversationData.prepareModelConversationBasedOnRequests(
        defaultModel,
        [secondRequest, firstRequest],
        'secondConv',
      );
    conversationData.resetData();
    thirdConversation =
      conversationData.prepareModelConversationBasedOnRequests(
        defaultModel,
        [firstRequest],
        'thirdConv',
      );
    conversationData.resetData();
    forthConversation =
      conversationData.prepareModelConversationBasedOnRequests(
        defaultModel,
        [firstRequest, thirdRequest],
        'forthConv',
      );
    conversationData.resetData();
    fifthConversation =
      conversationData.prepareModelConversationBasedOnRequests(
        defaultModel,
        [firstRequest.toLowerCase(), secondRequest],
        'fifthConv',
      );

    await localStorageManager.setConversationHistory(
      firstConversation,
      secondConversation,
      thirdConversation,
      forthConversation,
      fifthConversation,
    );
    await localStorageManager.setSelectedConversation(firstConversation);
  });

  await test.step('Open compare mode for the 1st conversation and verify no options are available for comparison', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await conversations.openConversationDropdownMenu(firstConversation.name);
    await conversationDropdownMenu.selectMenuOption(MenuOptions.compare);

    await compareConversationSelector.click();
    const selectorPlaceholder =
      await compareConversationSelector.getSelectorPlaceholder();
    expect
      .soft(selectorPlaceholder, ExpectedMessages.noConversationsAvailable)
      .toBe(ExpectedConstants.noConversationsAvailable);

    const conversationsList =
      await compareConversationSelector.getListOptions();
    expect
      .soft(
        conversationsList,
        ExpectedMessages.conversationsToCompareOptionsValid,
      )
      .toEqual([]);
  });
});

test(
  'Generate new response for two chats in compare mode. GPT models.\n' +
    'Likes/Dislikes set in compare mode are stored in both chats',
  async ({
    dialHomePage,
    chat,
    chatMessages,
    setTestIds,
    conversationData,
    localStorageManager,
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

    await test.step('Prepare two conversations for comparing', async () => {
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
      await localStorageManager.setConversationHistory(
        firstConversation,
        secondConversation,
      );
      await localStorageManager.setSelectedConversation(
        firstConversation,
        secondConversation,
      );
    });

    await test.step('Send new message in compare chat and verify response is displayed for both and API requests are correct', async () => {
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
    });

    await test.step('Put like/dislike for compared chat, open this chat and verify like/dislike saved', async () => {
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
    });
  },
);

test(
  'Generate new response for two chats in compare mode. Bison and GPT-4-32 which have different response time.\n' +
    'Regenerate response in compare mode',
  async ({
    dialHomePage,
    chat,
    chatMessages,
    setTestIds,
    conversationData,
    localStorageManager,
    page,
  }) => {
    setTestIds('EPMRTC-553', 'EPMRTC-555');
    const request = ['beautiful'];
    let firstConversation: Conversation;
    let secondConversation: Conversation;

    await test.step('Prepare two conversations for comparing', async () => {
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
      await localStorageManager.setConversationHistory(
        firstConversation,
        secondConversation,
      );
      await localStorageManager.setSelectedConversation(
        firstConversation,
        secondConversation,
      );
    });

    await test.step('Send new message in compare chat and verify regenerate is not available until both responses received', async () => {
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
      await chatMessages.waitForCompareMessageJumpingIconDisappears(Side.left);
      const isRegenerateButtonVisible = await chat.regenerate.isVisible();
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
    });

    await test.step('Click "Regenerate" button and verify last response is regenerated for both chats', async () => {
      await chat.regenerate.waitForState();

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
    });
  },
);

test('Apply changes with new settings for both chats in compare mode and check chat headers', async ({
  dialHomePage,
  chat,
  setTestIds,
  conversationData,
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
  test.slow();
  setTestIds('EPMRTC-1021');
  let firstConversation: Conversation;
  let secondConversation: Conversation;
  const models = ModelsUtil.getModels();
  const initRandomModel = GeneratorUtil.randomArrayElement(models);
  const modelsForUpdate = models.filter((m) => m !== initRandomModel);
  const firstUpdatedRandomModel =
    GeneratorUtil.randomArrayElement(modelsForUpdate);
  const secondUpdatedRandomModel =
    GeneratorUtil.randomArrayElement(modelsForUpdate);
  const firstUpdatedPrompt = 'first prompt';
  const secondUpdatedPrompt = 'second prompt';
  const firstUpdatedTemp = 0.5;
  const secondUpdatedTemp = 0;
  const expectedSecondUpdatedRandomModelIcon =
    await iconApiHelper.getEntityIcon(secondUpdatedRandomModel);
  const expectedFirstUpdatedRandomModelIcon = await iconApiHelper.getEntityIcon(
    firstUpdatedRandomModel,
  );

  await test.step('Prepare two model conversations for comparing', async () => {
    firstConversation = conversationData.prepareModelConversation(
      1,
      'prompt',
      [],
      initRandomModel,
    );
    conversationData.resetData();
    secondConversation =
      conversationData.prepareDefaultConversation(initRandomModel);
    await localStorageManager.setConversationHistory(
      firstConversation,
      secondConversation,
    );
    await localStorageManager.setSelectedConversation(
      firstConversation,
      secondConversation,
    );
  });

  await test.step('Open chat settings and update them for both models', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await leftChatHeader.openConversationSettingsPopup();
    await leftConversationSettings
      .getTalkToSelector()
      .selectModel(firstUpdatedRandomModel.name);
    const leftEntitySettings = leftConversationSettings.getEntitySettings();
    await leftEntitySettings.setSystemPrompt(firstUpdatedPrompt);
    await leftEntitySettings
      .getTemperatureSlider()
      .setTemperature(firstUpdatedTemp);

    await rightConversationSettings
      .getTalkToSelector()
      .selectModel(secondUpdatedRandomModel.name);
    const rightEntitySettings = rightConversationSettings.getEntitySettings();
    await rightEntitySettings.setSystemPrompt(secondUpdatedPrompt);
    await rightEntitySettings
      .getTemperatureSlider()
      .setTemperature(secondUpdatedTemp);
    await chat.applyNewEntity(
      firstUpdatedRandomModel.iconUrl,
      secondUpdatedRandomModel.iconUrl,
    );
  });

  await test.step('Verify chat icons are updated with new model and addons in the header and chat bar', async () => {
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
  });

  await test.step('Hover over chat headers and verify chat settings updated on tooltip', async () => {
    await errorPopup.cancelPopup();
    await rightChatHeader.chatModel.hoverOver();
    const rightModelInfo = await chatInfoTooltip.getModelInfo();
    expect
      .soft(rightModelInfo, ExpectedMessages.chatInfoModelIsValid)
      .toBe(secondUpdatedRandomModel.name);

    const rightModelInfoIcon = await chatInfoTooltip.getModelIcon();
    expect
      .soft(rightModelInfoIcon, ExpectedMessages.chatInfoModelIconIsValid)
      .toBe(expectedSecondUpdatedRandomModelIcon);

    const rightPromptInfo = await chatInfoTooltip.getPromptInfo();
    expect
      .soft(rightPromptInfo, ExpectedMessages.chatInfoPromptIsValid)
      .toBe(secondUpdatedPrompt);

    const rightTempInfo = await chatInfoTooltip.getTemperatureInfo();
    expect
      .soft(rightTempInfo, ExpectedMessages.chatInfoTemperatureIsValid)
      .toBe(secondUpdatedTemp.toString());

    await errorPopup.cancelPopup();
    await leftChatHeader.chatModel.hoverOver();
    const leftModelInfo = await chatInfoTooltip.getModelInfo();
    expect
      .soft(leftModelInfo, ExpectedMessages.chatInfoModelIsValid)
      .toBe(firstUpdatedRandomModel.name);

    const leftModelInfoIcon = await chatInfoTooltip.getModelIcon();
    expect
      .soft(leftModelInfoIcon, ExpectedMessages.chatInfoModelIconIsValid)
      .toBe(expectedFirstUpdatedRandomModelIcon);

    const leftPromptInfo = await chatInfoTooltip.getPromptInfo();
    expect
      .soft(leftPromptInfo, ExpectedMessages.chatInfoPromptIsValid)
      .toBe(firstUpdatedPrompt);

    const leftTempInfo = await chatInfoTooltip.getTemperatureInfo();
    expect
      .soft(leftTempInfo, ExpectedMessages.chatInfoTemperatureIsValid)
      .toBe(firstUpdatedTemp.toString());
  });
});

test(
  'Stop regenerating in compare mode.\n' +
    'Both "Talk to" item icons are jumping while generating an answer in Compare mode',
  async ({
    dialHomePage,
    chat,
    chatMessages,
    setTestIds,
    conversationData,
    localStorageManager,
    compare,
    iconApiHelper,
  }) => {
    setTestIds('EPMRTC-556', 'EPMRTC-1134');
    let firstConversation: Conversation;
    let secondConversation: Conversation;
    const sides = Object.values(Side);

    await test.step('Prepare two conversations for comparing', async () => {
      firstConversation =
        conversationData.prepareDefaultConversation(defaultModel);
      conversationData.resetData();
      secondConversation =
        conversationData.prepareDefaultConversation(defaultModel);
      await localStorageManager.setConversationHistory(
        firstConversation,
        secondConversation,
      );
      await localStorageManager.setSelectedConversation(
        firstConversation,
        secondConversation,
      );
    });

    await test.step('Send new message in compare chat, verify both chat icons are jumping while responding and then stop generation', async () => {
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
    });

    await test.step('Verify response is not received by both chats, stop is done immediately, valid model icons are displayed', async () => {
      const isResponseLoading = await chatMessages.isResponseLoading();
      expect
        .soft(isResponseLoading, ExpectedMessages.responseLoadingStopped)
        .toBeFalsy();
      const isStopButtonVisible = await chat.stopGenerating.isVisible();
      expect
        .soft(isStopButtonVisible, ExpectedMessages.responseLoadingStopped)
        .toBeFalsy();

      const expectedModelIcon = await iconApiHelper.getEntityIcon(defaultModel);
      for (const side of sides) {
        const messageIcon =
          await chatMessages.getIconAttributesForCompareMessage(side);
        expect
          .soft(messageIcon, ExpectedMessages.entityIconIsValid)
          .toBe(expectedModelIcon);
      }
    });
  },
);

test(
  'Search chat in Select conversation drop down.\n' +
    'Select chat from search results in Select conversation drop down',
  async ({
    dialHomePage,
    setTestIds,
    conversationDropdownMenu,
    conversations,
    conversationData,
    localStorageManager,
    compareConversationSelector,
    rightChatHeader,
  }) => {
    setTestIds('EPMRTC-536', 'EPMRTC-1168');
    const request = 'What is epam official name?';
    const firstSearchTerm = 'epam';
    const secondSearchTerm = 'systems';
    const thirdSearchTerm = 'epam official';
    const underscoreSearchTerm = '_';
    const noResultSearchTerm = 'epaQ';

    let firstConversation: Conversation;
    let secondConversation: Conversation;
    let thirdConversation: Conversation;
    let fourthConversation: Conversation;
    const matchedConversations: string[] = [];

    await test.step('Prepare 4 conversations with the same request but different names', async () => {
      firstConversation =
        conversationData.prepareModelConversationBasedOnRequests(
          defaultModel,
          [request],
          request,
        );
      conversationData.resetData();
      secondConversation =
        conversationData.prepareModelConversationBasedOnRequests(
          defaultModel,
          [request],
          request,
        );
      conversationData.resetData();
      thirdConversation =
        conversationData.prepareModelConversationBasedOnRequests(
          defaultModel,
          [request],
          'Renamed epam systems',
        );
      conversationData.resetData();
      fourthConversation =
        conversationData.prepareModelConversationBasedOnRequests(
          defaultModel,
          [request],
          'epam_systems !@#$%^&*()+=\':",.<>',
        );

      await localStorageManager.setConversationHistory(
        firstConversation,
        secondConversation,
        thirdConversation,
        fourthConversation,
      );
      await localStorageManager.setSelectedConversation(firstConversation);
      matchedConversations.push(
        secondConversation.name,
        thirdConversation.name,
        fourthConversation.name,
      );
    });

    await test.step('Open compare mode for the 1st chat and verify all chats are available for comparison in dropdown list', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await conversations.openConversationDropdownMenu(firstConversation.name);
      await conversationDropdownMenu.selectMenuOption(MenuOptions.compare);
      await compareConversationSelector.click();
      const conversationsList =
        await compareConversationSelector.getListOptions();
      expect
        .soft(
          conversationsList,
          ExpectedMessages.conversationsToCompareOptionsValid,
        )
        .toEqual(matchedConversations);
    });

    await test.step('Type first search term and verify all chats are available for comparison in dropdown list', async () => {
      for (const term of [firstSearchTerm, firstSearchTerm.toUpperCase()]) {
        await compareConversationSelector.fillInput(term);
        const conversationsList =
          await compareConversationSelector.getListOptions();
        expect
          .soft(
            conversationsList,
            ExpectedMessages.conversationsToCompareOptionsValid,
          )
          .toEqual(matchedConversations);
      }
    });

    await test.step('Type second search term and verify chat 3 and 4 are available for comparison in dropdown list', async () => {
      await compareConversationSelector.fillInput(secondSearchTerm);
      const conversationsList =
        await compareConversationSelector.getListOptions();
      expect
        .soft(
          conversationsList,
          ExpectedMessages.conversationsToCompareOptionsValid,
        )
        .toEqual([thirdConversation.name, fourthConversation.name]);
    });

    await test.step('Type third search term and verify chat 2 is available for comparison in dropdown list', async () => {
      await compareConversationSelector.fillInput(thirdSearchTerm);
      const conversationsList =
        await compareConversationSelector.getListOptions();
      expect
        .soft(
          conversationsList,
          ExpectedMessages.conversationsToCompareOptionsValid,
        )
        .toEqual([secondConversation.name]);
    });

    await test.step('Type underscore and verify chat 4 is available for comparison in dropdown list', async () => {
      await compareConversationSelector.fillInput(underscoreSearchTerm);
      const conversationsList =
        await compareConversationSelector.getListOptions();
      expect
        .soft(
          conversationsList,
          ExpectedMessages.conversationsToCompareOptionsValid,
        )
        .toEqual([fourthConversation.name]);
    });

    await test.step('Type not matching search term and verify no chats available for comparison in dropdown list', async () => {
      await compareConversationSelector.fillInput(noResultSearchTerm);
      const conversationsList =
        await compareConversationSelector.getListOptions();
      expect
        .soft(
          conversationsList,
          ExpectedMessages.conversationsToCompareOptionsValid,
        )
        .toEqual([]);
    });

    await test.step('Delete search term and verify all chats are available for comparison in dropdown list', async () => {
      await compareConversationSelector.fillInput('');
      const conversationsList =
        await compareConversationSelector.getListOptions();
      expect
        .soft(
          conversationsList,
          ExpectedMessages.conversationsToCompareOptionsValid,
        )
        .toEqual(matchedConversations);
    });

    await test.step('Select any chat and verify it shown in the input, dropdown list is closed', async () => {
      const chatToSelect =
        GeneratorUtil.randomArrayElement(matchedConversations);
      await compareConversationSelector.selectModel(chatToSelect, true);
      await compareConversationSelector.waitForState({
        state: 'hidden',
      });
      const rightHeaderTitle =
        await rightChatHeader.chatTitle.getElementContent();
      expect
        .soft(rightHeaderTitle, ExpectedMessages.headerTitleCorrespondRequest)
        .toBe(chatToSelect);
    });
  },
);

test(
  'Compare mode is closed if to create new chat.\n' +
    'Compare mode is closed if to click on chat which is used in compare mode.\n' +
    'Check chat header in compare mode with long chat names.\n' +
    'Long chat names in Select conversations drop down list',
  async ({
    dialHomePage,
    setTestIds,
    conversationData,
    localStorageManager,
    compare,
    conversations,
    chatBar,
    chatHeader,
    compareConversationSelector,
    conversationDropdownMenu,
    leftChatHeader,
  }) => {
    setTestIds('EPMRTC-542', 'EPMRTC-543', 'EPMRTC-548', 'EPMRTC-828');
    let firstConversation: Conversation;
    let secondConversation: Conversation;

    await test.step('Prepare two conversations for compare mode', async () => {
      firstConversation = conversationData.prepareDefaultConversation(
        defaultModel,
        GeneratorUtil.randomString(70),
      );
      conversationData.resetData();

      let secondConversationName = '';
      for (let i = 1; i <= 10; i++) {
        secondConversationName += ' ' + GeneratorUtil.randomString(7);
      }
      secondConversation = conversationData.prepareDefaultConversation(
        defaultModel,
        secondConversationName,
      );

      await localStorageManager.setConversationHistory(
        firstConversation,
        secondConversation,
      );
      await localStorageManager.setSelectedConversation(
        firstConversation,
        secondConversation,
      );
    });

    await test.step('Open compare mode and verify long chat name is cut', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      const isTitleTruncated =
        await chatHeader.chatTitle.isElementWidthTruncated();
      expect
        .soft(isTitleTruncated, ExpectedMessages.chatHeaderTitleTruncated)
        .toBeTruthy();
    });

    await test.step('Create new chat and verify Compare mode is closed', async () => {
      await chatBar.createNewConversation();
      const isCompareModeOn = await compare.isVisible();
      expect
        .soft(isCompareModeOn, ExpectedMessages.compareModeClosed)
        .toBeFalsy();
    });

    await test.step('Open compare mode again, switch to comparing conversation and verify Compare mode is closed', async () => {
      await dialHomePage.reloadPage();
      await compare.waitForState();
      await conversations.selectConversation(firstConversation.name);
      const isCompareModeOn = await compare.isVisible();
      expect
        .soft(isCompareModeOn, ExpectedMessages.compareModeClosed)
        .toBeFalsy();
    });

    await test.step('Open compare mode for 1st conversation and verify long compare options are shown in different rows', async () => {
      await conversations.openConversationDropdownMenu(firstConversation.name);
      await conversationDropdownMenu.selectMenuOption(MenuOptions.compare);

      const isRemoveConversationIconVisible =
        await leftChatHeader.removeConversationFromComparison.isVisible();
      expect
        .soft(
          isRemoveConversationIconVisible,
          ExpectedMessages.closeChatIconIsNotVisible,
        )
        .toBeFalsy();

      await compareConversationSelector.click();
      const overflowProp =
        await compareConversationSelector.listbox.getComputedStyleProperty(
          Styles.overflow_x,
        );
      expect
        .soft(overflowProp[0], ExpectedMessages.entityNameIsTruncated)
        .toBe(Overflow.auto);
    });
  },
);

test('Compare two chats located in different folders', async ({
  dialHomePage,
  setTestIds,
  conversationDropdownMenu,
  folderConversations,
  conversationData,
  localStorageManager,
  compare,
  compareConversationSelector,
  chat,
}) => {
  setTestIds('EPMRTC-557');
  let firstFolderConversation: FolderConversation;
  let secondFolderConversation: FolderConversation;

  await test.step('Prepare two conversations in folders', async () => {
    firstFolderConversation =
      conversationData.prepareDefaultConversationInFolder(defaultModel);
    conversationData.resetData();
    secondFolderConversation =
      conversationData.prepareDefaultConversationInFolder(bisonModel);
    await localStorageManager.setFolders(
      firstFolderConversation.folders,
      secondFolderConversation.folders,
    );
    await localStorageManager.setConversationHistory(
      firstFolderConversation.conversations[0],
      secondFolderConversation.conversations[0],
    );
    await localStorageManager.setOpenedFolders(
      firstFolderConversation.folders,
      secondFolderConversation.folders,
    );
    await localStorageManager.setSelectedConversation(
      firstFolderConversation.conversations[0],
    );
  });

  await test.step('Open compare mode from 1st chat dropdown menu and verify one chat is available for comparison', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
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
  });

  await test.step('Select folder conversation for comparison, send new request and verify response generated for both chats', async () => {
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
  });
});

test(
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
    const firstConversationRequests = ['1+2=', '2+3=', '3+4='];
    const secondConversationRequests = ['1+2=', '4+5=', '5+6='];
    let updatedRequestContent: string;

    await test.step('Prepare two conversations for compare mode', async () => {
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

      await localStorageManager.setConversationHistory(
        firstConversation,
        secondConversation,
      );
      await localStorageManager.setSelectedConversation(
        firstConversation,
        secondConversation,
      );
    });

    await test.step('Delete 1st message from the left conversation and verify only 1st row deleted for both chats', async () => {
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
      expect
        .soft(
          await firstComparedMessage.textContent(),
          ExpectedMessages.messageContentIsValid,
        )
        .toBe(firstConversationRequests[1]);
    });

    await test.step('Copy last response from the right conversation and edit the 1st request for the left chat with copied message', async () => {
      await chatMessages.copyCompareRowMessage(
        Side.right,
        (firstConversationRequests.length - 1) * 2,
      );
      await chatMessages.openEditCompareRowMessageMode(Side.left, 1);
      await chatMessages.clearEditTextarea(firstConversationRequests[1]);
      await page.keyboard.press(keys.ctrlPlusV);
      await chatMessages.saveAndSubmit.click();
      await chatMessages.waitForResponseReceived();
    });

    await test.step('Verify both first requests updated, messages below are deleted', async () => {
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
        expect
          .soft(
            await firstComparedMessage.textContent(),
            ExpectedMessages.messageContentIsValid,
          )
          .toBe(updatedRequestContent);
      }
    });

    await test.step('Edit left chat title and verify it is updated in the header', async () => {
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
    });

    await test.step('Delete right chat and compare mode closed, left chat is active', async () => {
      await conversations.openConversationDropdownMenu(updatedRequestContent);
      await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
      await conversations
        .getConversationInput(updatedRequestContent)
        .clickTickButton();
      expect
        .soft(
          await conversations
            .getConversationByName(updatedRequestContent)
            .isVisible(),
          ExpectedMessages.conversationDeleted,
        )
        .toBeFalsy();

      const isCompareModeOpened = await compare.isVisible();
      expect
        .soft(isCompareModeOpened, ExpectedMessages.compareModeClosed)
        .toBeFalsy();
    });
  },
);
