import { Conversation } from '@/src/types/chat';
import { OpenAIEntityModel } from '@/src/types/openai';



import { FolderConversation } from '../testData/conversationHistory/conversationData';

import test from '@/e2e/src/core/fixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  ModelIds,
  Side,
} from '@/e2e/src/testData';
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
    const chatsCount = await compare.gerConversationsCount();
    expect.soft(chatsCount, ExpectedMessages.compareModeOpened).toBe(2);

    const todayConversations = await conversations.getTodayConversations();
    expect
      .soft(todayConversations, ExpectedMessages.conversationOfToday)
      .toEqual([
        ExpectedConstants.newConversationTitle,
        ExpectedConstants.newConversationTitle,
        ExpectedConstants.newConversationTitle,
      ]);
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

      const chatsCount = await compare.gerChatMessagesCount();
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
        await compareConversationSelector.getOptionsIconAttributes();
      const expectedModels = [defaultModel, gpt4Model, bisonModel];
      expect
        .soft(
          compareOptionsIcons.length,
          ExpectedMessages.entitiesIconsCountIsValid,
        )
        .toBe(expectedModels.length);

      for (const expectedModel of expectedModels) {
        const actualOptionIcon = compareOptionsIcons.find(
          (o) => o.iconEntity === expectedModel.id,
        )!;
        expect
          .soft(
            actualOptionIcon.iconUrl,
            ExpectedMessages.chatIconSourceIsValid,
          )
          .toBe(expectedModel.iconUrl);
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

test(`Compare mode is closed on "x" button in chat1`, async ({
  dialHomePage,
  setTestIds,
  conversationData,
  localStorageManager,
  compare,
  rightChatHeader,
}) => {
  setTestIds('EPMRTC-544');
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
    await rightChatHeader.removeConversationFromComparison.click();
    const isCompareModeOn = await compare.isVisible();
    expect
      .soft(isCompareModeOn, ExpectedMessages.compareModeClosed)
      .toBeFalsy();
  });
});

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

test('Generate new response for two chats in compare mode. GPT models', async ({
  dialHomePage,
  chat,
  chatMessages,
  setTestIds,
  conversationData,
  localStorageManager,
  compare,
}) => {
  setTestIds('EPMRTC-552');

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
      'test message',
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
});

test('Generate new response for two chats in compare mode. Bison and GPT-4-32 which have different response time', async ({
  dialHomePage,
  chat,
  chatMessages,
  setTestIds,
  conversationData,
  localStorageManager,
}) => {
  setTestIds('EPMRTC-553');

  let firstConversation: Conversation;
  let secondConversation: Conversation;

  await test.step('Prepare two conversations for comparing', async () => {
    firstConversation = conversationData.prepareDefaultConversation(bisonModel);
    conversationData.resetData();
    secondConversation = conversationData.prepareDefaultConversation(
      ModelsUtil.getModel(ModelIds.GPT_4_32K),
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
    await chat.sendRequestInCompareMode('write down 20 adjectives', {
      rightEntity: firstConversation.model.id,
      leftEntity: secondConversation.model.id,
    });
    await chatMessages.waitForOneCompareConversationResponseReceived();
    const isRegenerateButtonVisible = await chat.regenerate.isVisible();
    expect
      .soft(isRegenerateButtonVisible, ExpectedMessages.regenerateNotAvailable)
      .toBeFalsy();

    const isStopButtonVisible = await chat.stopGenerating.isVisible();
    expect
      .soft(isStopButtonVisible, ExpectedMessages.stopGeneratingAvailable)
      .toBeTruthy();
  });
});

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
}) => {
  setTestIds('EPMRTC-1021');

  let firstConversation: Conversation;
  let secondConversation: Conversation;
  const models = ModelsUtil.getModels();
  const modelsWithIcons = models.filter((m) => m.iconUrl);
  const initRandomModel = GeneratorUtil.randomArrayElement(models);
  const firstUpdatedRandomModel =
    GeneratorUtil.randomArrayElement(modelsWithIcons);
  const secondUpdatedRandomModel =
    GeneratorUtil.randomArrayElement(modelsWithIcons);
  const firstUpdatedPrompt = 'first prompt';
  const secondUpdatedPrompt = 'second prompt';
  const firstUpdatedTemp = 0.5;
  const secondUpdatedTemp = 0;

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
    await leftChatHeader.openConversationSettings.click();
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
    await chat.applyChanges().click();
  });

  await test.step('Verify chat icons are updated with new model and addons in the header and chat bar', async () => {
    const rightHeaderIcons = await rightChatHeader.getHeaderIcons();
    expect
      .soft(rightHeaderIcons.length, ExpectedMessages.headerIconsCountIsValid)
      .toBe(1);
    expect
      .soft(
        rightHeaderIcons[0].iconEntity,
        ExpectedMessages.headerIconEntityIsValid,
      )
      .toBe(secondUpdatedRandomModel.id);
    expect
      .soft(
        rightHeaderIcons[0].iconUrl,
        ExpectedMessages.headerIconSourceIsValid,
      )
      .toBe(secondUpdatedRandomModel!.iconUrl);

    const leftHeaderIcons = await leftChatHeader.getHeaderIcons();
    expect
      .soft(leftHeaderIcons.length, ExpectedMessages.headerIconsCountIsValid)
      .toBe(1);
    expect
      .soft(
        leftHeaderIcons[0].iconEntity,
        ExpectedMessages.headerIconEntityIsValid,
      )
      .toBe(firstUpdatedRandomModel.id);
    expect
      .soft(
        leftHeaderIcons[0].iconUrl,
        ExpectedMessages.headerIconSourceIsValid,
      )
      .toBe(firstUpdatedRandomModel.iconUrl);

    const firstConversationIcon =
      await conversations.getConversationIconAttributes(firstConversation.name);
    expect
      .soft(
        firstConversationIcon.iconEntity,
        ExpectedMessages.chatBarIconEntityIsValid,
      )
      .toBe(firstUpdatedRandomModel.id);
    expect
      .soft(
        firstConversationIcon.iconUrl,
        ExpectedMessages.chatBarIconSourceIsValid,
      )
      .toBe(firstUpdatedRandomModel!.iconUrl);

    const secondConversationIcon =
      await conversations.getConversationIconAttributes(
        secondConversation.name,
      );
    expect
      .soft(
        secondConversationIcon.iconEntity,
        ExpectedMessages.chatBarIconEntityIsValid,
      )
      .toBe(secondUpdatedRandomModel.id);
    expect
      .soft(
        secondConversationIcon.iconUrl,
        ExpectedMessages.chatBarIconSourceIsValid,
      )
      .toBe(secondUpdatedRandomModel!.iconUrl);
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
      .toBe(secondUpdatedRandomModel.iconUrl);

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
      .toBe(firstUpdatedRandomModel.iconUrl);

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

      for (const side of sides) {
        const messageIcon =
          await chatMessages.getIconAttributesForCompareMessage(side);
        expect
          .soft(messageIcon.iconUrl, ExpectedMessages.chatIconSourceIsValid)
          .toBe(defaultModel.iconUrl);
      }
    });
  },
);
