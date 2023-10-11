import { Conversation } from '@/src/types/chat';
import {
  OpenAIEntityAddon,
  OpenAIEntityAddonID,
  OpenAIEntityModel,
  OpenAIEntityModelID,
  OpenAIEntityModels,
} from '@/src/types/openai';

import test from '@/e2e/src/core/fixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  FolderConversation,
  MenuOptions,
} from '@/e2e/src/testData';
import { GeneratorUtil } from '@/e2e/src/utils';
import { expect } from '@playwright/test';

let allAddons: OpenAIEntityAddon[];
test.beforeAll(async ({ apiHelper }) => {
  allAddons = await apiHelper.getAddons();
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
    await dialHomePage.waitForPageLoaded(true);
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

test('Check the list of available conversations', async ({
  dialHomePage,
  setTestIds,
  conversationDropdownMenu,
  conversations,
  conversationData,
  localStorageManager,
  compare,
  compareConversationSelector,
}) => {
  setTestIds('EPMRTC-546');
  let modelConversation: Conversation;
  let assistantConversation: Conversation;
  let appConversationInFolder: FolderConversation;
  let appConversation: Conversation;

  await test.step('Prepare three conversations to compare', async () => {
    modelConversation = conversationData.prepareDefaultConversation(
      OpenAIEntityModels[OpenAIEntityModelID.GPT_3_5_AZ],
      ExpectedConstants.newConversationTitle,
    );
    const request = modelConversation.messages.find(
      (m) => m.role === 'user',
    )?.content;
    conversationData.resetData();
    assistantConversation = conversationData.prepareAddonsConversation(
      OpenAIEntityModels[OpenAIEntityModelID.ASSISTANT10K],
      [
        OpenAIEntityAddonID.ADDON_EPAM10K_GOLDEN_QNA,
        OpenAIEntityAddonID.ADDON_EPAM10K_SEMANTIC_SEARCH,
      ],
      request,
    );
    conversationData.resetData();
    appConversationInFolder =
      conversationData.prepareDefaultConversationInFolder(
        OpenAIEntityModels[OpenAIEntityModelID.MIRROR],
      );
    conversationData.resetData();
    appConversation = conversationData.prepareDefaultConversation(
      OpenAIEntityModels[OpenAIEntityModelID.MIRROR],
    );
    await localStorageManager.setFolders(appConversationInFolder.folders);
    await localStorageManager.setConversationHistory(
      modelConversation,
      assistantConversation,
      appConversation,
      appConversationInFolder.conversations[0],
    );
    await localStorageManager.setSelectedConversation(appConversation);
  });

  await test.step('Open compare mode from 1st chat dropdown menu and verify chats available for comparison', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await conversations.openConversationDropdownMenu(appConversation.name);
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
        modelConversation.name,
        assistantConversation.name,
        appConversationInFolder.conversations[0].name,
      ]);
  });
});

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
        OpenAIEntityModels[OpenAIEntityModelID.GPT_3_5_AZ],
        [firstRequest, secondRequest],
        'firstConv',
      );
    conversationData.resetData();
    secondConversation =
      conversationData.prepareModelConversationBasedOnRequests(
        OpenAIEntityModels[OpenAIEntityModelID.GPT_3_5_AZ],
        [secondRequest, firstRequest],
        'secondConv',
      );
    conversationData.resetData();
    thirdConversation =
      conversationData.prepareModelConversationBasedOnRequests(
        OpenAIEntityModels[OpenAIEntityModelID.GPT_3_5_AZ],
        [firstRequest],
        'thirdConv',
      );
    conversationData.resetData();
    forthConversation =
      conversationData.prepareModelConversationBasedOnRequests(
        OpenAIEntityModels[OpenAIEntityModelID.GPT_3_5_AZ],
        [firstRequest, thirdRequest],
        'forthConv',
      );
    conversationData.resetData();
    fifthConversation =
      conversationData.prepareModelConversationBasedOnRequests(
        OpenAIEntityModels[OpenAIEntityModelID.GPT_3_5_AZ],
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
      OpenAIEntityModels[OpenAIEntityModelID.GPT_3_5_AZ],
    );
    conversationData.resetData();
    secondConversation = conversationData.prepareModelConversation(
      secondTemp,
      secondPrompt,
      [],
      OpenAIEntityModels[OpenAIEntityModelID.GPT_4],
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
      .toBe(OpenAIEntityModels[OpenAIEntityModelID.GPT_3_5_AZ].id);
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
      .toBe(OpenAIEntityModels[OpenAIEntityModelID.GPT_4].id);
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

//TODO: enable when chat API for Gtp-4 is fixed
test.skip('Generate new response for two chats in compare mode. Bison and GPT-4-32 which have different response time', async ({
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
    firstConversation = conversationData.prepareDefaultConversation(
      OpenAIEntityModels[OpenAIEntityModelID.MIRROR],
    );
    conversationData.resetData();
    secondConversation = conversationData.prepareDefaultConversation(
      OpenAIEntityModels[OpenAIEntityModelID.GPT_4_32K],
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
    await chat.sendRequestInCompareMode('write down 30 adjectives', {
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

test('Generate new response with new settings in compare mode. Assistant and Application.', async ({
  dialHomePage,
  chat,
  setTestIds,
  conversationData,
  localStorageManager,
  compare,
  rightChatHeader,
  leftChatHeader,
  rightConversationSettings,
  leftConversationSettings,
  apiHelper,
  chatInfoTooltip,
}) => {
  setTestIds('EPMRTC-554');
  let firstConversation: Conversation;
  let secondConversation: Conversation;
  const assistantTemp = 0.5;
  let assistantModel: string | null;
  let app: OpenAIEntityModel | undefined;
  let expectedAssistant: OpenAIEntityModel | undefined;
  let assistantAddons: string[];

  await test.step('Prepare two conversations for comparing', async () => {
    firstConversation = conversationData.prepareModelConversation(
      1,
      'repeat the same text',
      [],
      OpenAIEntityModels[OpenAIEntityModelID.GPT_3_5_AZ],
    );
    conversationData.resetData();
    secondConversation = conversationData.prepareDefaultConversation(
      OpenAIEntityModels[OpenAIEntityModelID.GPT_4],
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

  await test.step('Open any conversation settings and change them to Assistant and some application', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await rightChatHeader.openConversationSettings.click();

    const conversationSettingsCount = await compare.gerConversationsCount();
    expect
      .soft(conversationSettingsCount, ExpectedMessages.compareModeOpened)
      .toBe(2);

    await rightConversationSettings
      .getTalkToSelector()
      .selectAssistant(ExpectedConstants.presalesAssistant);
    const rightEntitySettings = rightConversationSettings.getEntitySettings();
    await rightEntitySettings
      .getTemperatureSlider()
      .setTemperature(assistantTemp);
    assistantModel = await rightEntitySettings
      .getModelSelector()
      .getSelectedModel();

    const appName = OpenAIEntityModels[OpenAIEntityModelID.MIRROR].name;
    app = await apiHelper.getApplication(appName);
    await leftConversationSettings
      .getTalkToSelector()
      .selectApplication(appName);

    await chat.applyChanges().click();
  });
  await test.step('Verify new settings are sent in requests', async () => {
    expectedAssistant = await apiHelper.getAssistant(
      ExpectedConstants.presalesAssistant,
    );
    assistantAddons = expectedAssistant!.selectedAddons!;
    const requestsData = await chat.sendRequestInCompareMode('what is epam?', {
      rightEntity: OpenAIEntityModels[OpenAIEntityModelID.ASSISTANT10K].id,
      leftEntity: app!.id,
    });
    expect
      .soft(
        requestsData.rightRequest.modelId,
        ExpectedMessages.requestModeIdIsValid,
      )
      .toBe(OpenAIEntityModels[OpenAIEntityModelID.ASSISTANT10K].id);
    expect
      .soft(
        OpenAIEntityModels[requestsData.rightRequest.assistantModelId].name,
        ExpectedMessages.requestAssistantModelIdIsValid,
      )
      .toBe(assistantModel);
    expect
      .soft(
        requestsData.rightRequest.selectedAddons,
        ExpectedMessages.requestSelectedAddonsAreValid,
      )
      .toEqual(assistantAddons);
    expect
      .soft(
        requestsData.leftRequest.modelId,
        ExpectedMessages.requestModeIdIsValid,
      )
      .toBe(app?.id);
  });

  await test.step('Verify chat header icons are updated with new model and addon', async () => {
    const rightHeaderIcons = await rightChatHeader.getHeaderIcons();
    expect
      .soft(rightHeaderIcons.length, ExpectedMessages.headerIconsCountIsValid)
      .toBe(assistantAddons.length + 1);
    expect
      .soft(
        rightHeaderIcons[0].iconEntity,
        ExpectedMessages.headerIconEntityIsValid,
      )
      .toBe(OpenAIEntityModels[OpenAIEntityModelID.ASSISTANT10K].id);
    expect
      .soft(
        rightHeaderIcons[0].iconUrl,
        ExpectedMessages.headerIconSourceIsValid,
      )
      .toBe(expectedAssistant!.iconUrl);

    for (let i = 0; i < assistantAddons.length; i++) {
      const addon = allAddons.find((a) => a.id === assistantAddons[i])!;
      expect
        .soft(
          rightHeaderIcons[i + 1].iconEntity,
          ExpectedMessages.headerIconEntityIsValid,
        )
        .toBe(addon.id);
      expect
        .soft(
          rightHeaderIcons[i + 1].iconUrl,
          ExpectedMessages.headerIconSourceIsValid,
        )
        .toBe(addon.iconUrl);
    }

    const leftHeaderIcons = await leftChatHeader.getHeaderIcons();
    expect
      .soft(leftHeaderIcons.length, ExpectedMessages.headerIconsCountIsValid)
      .toBe(1);
    expect
      .soft(
        leftHeaderIcons[0].iconEntity,
        ExpectedMessages.headerIconEntityIsValid,
      )
      .toBe(app?.id);
    expect
      .soft(
        leftHeaderIcons[0].iconUrl,
        ExpectedMessages.headerIconSourceIsValid,
      )
      .toBe(app?.iconUrl);
  });

  await test.step('Hover over chat headers and verify chat settings on tooltip', async () => {
    await rightChatHeader.chatModel.hoverOver();
    const assistantModelInfo = await chatInfoTooltip.getAssistantModelInfo();
    expect
      .soft(assistantModelInfo, ExpectedMessages.chatInfoAssistantModelIsValid)
      .toBe(assistantModel);

    const assistantModelInfoIcon =
      await chatInfoTooltip.getAssistantModelIcon();
    const expectedAssistantModel = await apiHelper.getModel(assistantModel!);
    expect
      .soft(
        assistantModelInfoIcon,
        ExpectedMessages.chatInfoAssistantModelIconIsValid,
      )
      .toBe(expectedAssistantModel!.iconUrl);

    const assistantInfo = await chatInfoTooltip.getAssistantInfo();
    expect
      .soft(assistantInfo, ExpectedMessages.chatInfoAssistantIsValid)
      .toBe(expectedAssistant!.name);

    const assistantInfoIcon = await chatInfoTooltip.getAssistantIcon();
    expect
      .soft(assistantInfoIcon, ExpectedMessages.chatInfoAssistantIconIsValid)
      .toBe(expectedAssistant!.iconUrl);

    const tempInfo = await chatInfoTooltip.getTemperatureInfo();
    expect
      .soft(tempInfo, ExpectedMessages.chatInfoTemperatureIsValid)
      .toBe(assistantTemp.toString());

    const addonsInfo = await chatInfoTooltip.getAddonsInfo();
    const addonInfoIcons = await chatInfoTooltip.getAddonIcons();
    for (let i = 0; i < assistantAddons.length; i++) {
      const addon = allAddons.find((a) => a.id === assistantAddons[i])!;
      expect
        .soft(addonsInfo[i], ExpectedMessages.chatInfoAddonIsValid)
        .toBe(addon.name);
      expect
        .soft(addonInfoIcons[i], ExpectedMessages.chatInfoAddonIconIsValid)
        .toBe(addon.iconUrl);
    }

    await leftChatHeader.chatModel.hoverOver();
    const appInfo = await chatInfoTooltip.getApplicationInfo();
    expect.soft(appInfo, ExpectedMessages.chatInfoAppIsValid).toBe(app?.name);

    const modelInfoIcon = await chatInfoTooltip.getApplicationIcon();
    expect
      .soft(modelInfoIcon, ExpectedMessages.chatInfoAppIconIsValid)
      .toBe(app!.iconUrl);
  });
});

test('Apply changes with new settings for both chats in compare mode and check chat headers', async ({
  dialHomePage,
  chat,
  setTestIds,
  conversationData,
  localStorageManager,
  apiHelper,
  leftChatHeader,
  rightChatHeader,
  rightConversationSettings,
  leftConversationSettings,
  conversations,
  chatInfoTooltip,
}) => {
  setTestIds('EPMRTC-1021');

  let firstConversation: Conversation;
  let secondConversation: Conversation;
  const models = await apiHelper.getModels();
  const modelsWithIcons = models.filter((m) => m.iconUrl);
  const initRandomModel = GeneratorUtil.randomArrayElement(models);
  const initRandomAddon = GeneratorUtil.randomArrayElement(allAddons);
  const firstUpdatedRandomModel =
    GeneratorUtil.randomArrayElement(modelsWithIcons);
  const secondUpdatedRandomModel =
    GeneratorUtil.randomArrayElement(modelsWithIcons);
  const updatedRandomAddonId = GeneratorUtil.randomArrayElement(
    ExpectedConstants.recentAddonIds.split(','),
  );
  const updatedRandomAddon = await apiHelper.getAddonById(updatedRandomAddonId);
  const firstUpdatedPrompt = 'first prompt';
  const secondUpdatedPrompt = 'second prompt';
  const firstUpdatedTemp = 0.5;
  const secondUpdatedTemp = 0;

  await test.step('Prepare two model conversations for comparing', async () => {
    firstConversation = conversationData.prepareModelConversation(
      1,
      'prompt',
      [initRandomAddon.id],
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
    await leftEntitySettings
      .getAddons()
      .removeSelectedAddon(initRandomAddon.name);

    await rightConversationSettings
      .getTalkToSelector()
      .selectModel(secondUpdatedRandomModel.name);
    const rightEntitySettings = rightConversationSettings.getEntitySettings();
    await rightEntitySettings.setSystemPrompt(secondUpdatedPrompt);
    await rightEntitySettings
      .getTemperatureSlider()
      .setTemperature(secondUpdatedTemp);
    await rightEntitySettings.getAddons().selectAddon(updatedRandomAddon!.name);
    await chat.applyChanges().click();
  });

  await test.step('Verify chat icons are updated with new model and addons in the header and chat bar', async () => {
    const rightHeaderIcons = await rightChatHeader.getHeaderIcons();
    expect
      .soft(rightHeaderIcons.length, ExpectedMessages.headerIconsCountIsValid)
      .toBe(2);
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

    expect
      .soft(
        rightHeaderIcons[1].iconEntity,
        ExpectedMessages.headerIconEntityIsValid,
      )
      .toBe(updatedRandomAddon!.id);
    expect
      .soft(
        rightHeaderIcons[1].iconUrl,
        ExpectedMessages.headerIconSourceIsValid,
      )
      .toBe(updatedRandomAddon!.iconUrl);

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

    const rightAddonsInfo = await chatInfoTooltip.getAddonsInfo();
    const rightAddonInfoIcons = await chatInfoTooltip.getAddonIcons();
    expect
      .soft(rightAddonsInfo.length, ExpectedMessages.chatInfoAddonsCountIsValid)
      .toBe(1);
    expect
      .soft(rightAddonsInfo[0], ExpectedMessages.chatInfoAddonIsValid)
      .toBe(updatedRandomAddon!.name);
    expect
      .soft(rightAddonInfoIcons[0], ExpectedMessages.chatInfoAddonIconIsValid)
      .toBe(updatedRandomAddon!.iconUrl);

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

    const leftAddonsInfo = await chatInfoTooltip.getAddonsInfo();
    expect
      .soft(leftAddonsInfo.length, ExpectedMessages.chatInfoAddonsCountIsValid)
      .toBe(0);
  });
});

test('Stop regenerating in compare mode', async ({
  dialHomePage,
  chat,
  chatMessages,
  setTestIds,
  conversationData,
  localStorageManager,
  compare,
  setIssueIds,
}) => {
  setTestIds('EPMRTC-556');
  setIssueIds('285');
  let firstConversation: Conversation;
  let secondConversation: Conversation;

  await test.step('Prepare two conversations for comparing', async () => {
    firstConversation = conversationData.prepareDefaultConversation(
      OpenAIEntityModels[OpenAIEntityModelID.GPT_3_5_AZ],
    );
    conversationData.resetData();
    secondConversation = conversationData.prepareDefaultConversation(
      OpenAIEntityModels[OpenAIEntityModelID.GPT_3_5_AZ],
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

  await test.step('Send new message in compare chat and stop generation', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await compare.waitForComparedConversationsLoaded();
    await chat.sendRequestInCompareMode('write down 30 adjectives', {
      rightEntity: firstConversation.model.id,
      leftEntity: secondConversation.model.id,
    });
    await chat.stopGenerating.click();
  });
  await test.step('Verify response is not received by both chats, stop is done immediately', async () => {
    const isResponseLoading = await chatMessages.isResponseLoading();
    expect
      .soft(isResponseLoading, ExpectedMessages.responseLoadingStopped)
      .toBeFalsy();
    const isStopButtonVisible = await chat.stopGenerating.isVisible();
    expect
      .soft(isStopButtonVisible, ExpectedMessages.responseLoadingStopped)
      .toBeFalsy();
  });
});
