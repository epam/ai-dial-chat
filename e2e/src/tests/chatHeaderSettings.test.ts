import { Conversation } from '@/src/types/chat';
import { OpenAIEntityModel } from '@/src/types/openai';

import test from '@/e2e/src/core/fixtures';
import { AddonIds, AssistantIds, ExpectedMessages } from '@/e2e/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/e2e/src/utils';
import { expect } from '@playwright/test';

let allAddons: OpenAIEntityModel[];
let assistant: OpenAIEntityModel;
let defaultModel: OpenAIEntityModel;
let allModels: OpenAIEntityModel[];

test.beforeAll(async () => {
  allAddons = ModelsUtil.getAddons();
  assistant = await ModelsUtil.getAssistant(AssistantIds.ASSISTANT10K)!;
  defaultModel = ModelsUtil.getDefaultModel()!;
  allModels = ModelsUtil.getModels();
});

test('Model settings opened in chat are the same as on New chat defaults', async ({
  dialHomePage,
  chatHeader,
  entitySettings,
  temperatureSlider,
  addons,
  talkToSelector,
  setTestIds,
  conversationData,
  localStorageManager,
}) => {
  setTestIds('EPMRTC-449');
  let conversation: Conversation;
  const allModels = ModelsUtil.getModels();
  const randomModel = GeneratorUtil.randomArrayElement(
    allModels.filter((m) => m.id !== defaultModel.id),
  );

  await test.step('Prepare conversation with default model and settings', async () => {
    conversation = conversationData.prepareDefaultConversation();
    await localStorageManager.setConversationHistory(conversation);
    await localStorageManager.setSelectedConversation(conversation);
  });

  await test.step('Open conversation settings and change model', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await chatHeader.openConversationSettings.click();
    await talkToSelector.selectModel(randomModel.name);
  });

  await test.step('Verify conversation settings are the same as for initial model', async () => {
    const systemPrompt = await entitySettings.getSystemPrompt();
    expect
      .soft(systemPrompt, ExpectedMessages.defaultSystemPromptIsEmpty)
      .toBe(conversation.prompt);
    const temperature = await temperatureSlider.getTemperature();
    expect
      .soft(temperature, ExpectedMessages.defaultTemperatureIsOne)
      .toBe(conversation.temperature.toString());
    const modelAddons = defaultModel.selectedAddons ?? [];
    const selectedAddons = await addons.getSelectedAddons();
    expect
      .soft(selectedAddons, ExpectedMessages.noAddonsSelected)
      .toEqual(modelAddons);
  });
});

test('Chat header after changing chat settings and continuing chatting. From Model with system prompt to Assistant', async ({
  dialHomePage,
  chatHeader,
  talkToSelector,
  setTestIds,
  conversationData,
  localStorageManager,
  chat,
  modelSelector,
  chatInfoTooltip,
  errorPopup,
}) => {
  setTestIds('EPMRTC-452');
  let conversation: Conversation;
  const assistant = ModelsUtil.getAssistant(AssistantIds.ASSISTANT10K);
  const assistantSelectedAddons = assistant!.selectedAddons;
  const secondRandomAddon = GeneratorUtil.randomArrayElement(
    allAddons.filter((a) => !assistantSelectedAddons?.includes(a.id)),
  );
  const modelTemp = 0.9;
  const modelPrompt = 'test prompt';
  assistantSelectedAddons?.push(secondRandomAddon.id);
  let assistantModel: string | null;

  await test.step('Prepare model conversation with default settings', async () => {
    conversation = conversationData.prepareModelConversation(
      modelTemp,
      modelPrompt,
      [AddonIds.ADDON_EPAM10K_SEMANTIC_SEARCH, secondRandomAddon.id],
    );
    await localStorageManager.setConversationHistory(conversation);
    await localStorageManager.setSelectedConversation(conversation);
  });

  await test.step('Open conversation settings and change model to assistant with default settings', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await chatHeader.openConversationSettings.click();
    await talkToSelector.selectAssistant(assistant!.name);
    assistantModel = await modelSelector.getSelectedModel();
    await chat.applyChanges().click();
  });

  await test.step('Verify chat icons are correct in the header', async () => {
    const isClearConversationVisible =
      await chatHeader.clearConversation.isVisible();
    expect
      .soft(
        isClearConversationVisible,
        ExpectedMessages.headerCleanConversationIconVisible,
      )
      .toBeTruthy();

    const headerIcons = await chatHeader.getHeaderIcons();
    expect
      .soft(headerIcons.length, ExpectedMessages.headerIconsCountIsValid)
      .toBe(1 + assistantSelectedAddons!.length);
    expect
      .soft(headerIcons[0].iconEntity, ExpectedMessages.headerIconEntityIsValid)
      .toBe(assistant!.id);
    expect
      .soft(headerIcons[0].iconUrl, ExpectedMessages.headerIconSourceIsValid)
      .toBe(assistant!.iconUrl);

    for (let i = 0; i < assistantSelectedAddons!.length; i++) {
      const addon = allAddons.find((a) => a.id === assistantSelectedAddons![i]);
      expect
        .soft(
          headerIcons[i + 1].iconEntity,
          ExpectedMessages.headerIconEntityIsValid,
        )
        .toBe(addon!.id);
      expect
        .soft(
          headerIcons[i + 1].iconUrl,
          ExpectedMessages.headerIconSourceIsValid,
        )
        .toBe(addon!.iconUrl);
    }
  });

  await test.step('Hover over chat header and verify chat settings are correct on tooltip', async () => {
    await errorPopup.cancelPopup();
    await chatHeader.chatModel.hoverOver();
    const assistantInfo = await chatInfoTooltip.getAssistantInfo();
    expect
      .soft(assistantInfo, ExpectedMessages.chatInfoAssistantIsValid)
      .toBe(assistant!.name);

    const assistantInfoIcon = await chatInfoTooltip.getAssistantIcon();
    expect
      .soft(assistantInfoIcon, ExpectedMessages.chatInfoAssistantIconIsValid)
      .toBe(assistant!.iconUrl);

    const assistantModelEntity = allModels.find(
      (m) => m.name === assistantModel,
    );
    const assistantModelInfo = await chatInfoTooltip.getAssistantModelInfo();
    expect
      .soft(assistantModelInfo, ExpectedMessages.chatInfoAssistantModelIsValid)
      .toBe(assistantModel);

    const assistantModelInfoIcon =
      await chatInfoTooltip.getAssistantModelIcon();
    expect
      .soft(
        assistantModelInfoIcon,
        ExpectedMessages.chatInfoAssistantModelIconIsValid,
      )
      .toBe(assistantModelEntity!.iconUrl);

    const tempInfo = await chatInfoTooltip.getTemperatureInfo();
    expect
      .soft(tempInfo, ExpectedMessages.chatInfoTemperatureIsValid)
      .toBe(conversation.temperature.toString());

    const addonsInfo = await chatInfoTooltip.getAddonsInfo();
    const addonInfoIcons = await chatInfoTooltip.getAddonIcons();
    expect
      .soft(addonsInfo.length, ExpectedMessages.chatInfoAddonsCountIsValid)
      .toBe(assistantSelectedAddons!.length);

    for (let i = 0; i < assistantSelectedAddons!.length; i++) {
      const addon = allAddons.find((a) => a.id === assistantSelectedAddons![i]);
      expect
        .soft(addonsInfo[i], ExpectedMessages.chatInfoAddonIsValid)
        .toBe(addon!.name);
      expect
        .soft(addonInfoIcons[i], ExpectedMessages.chatInfoAddonIconIsValid)
        .toBe(addon!.iconUrl);
    }
  });
});

test('Chat header after changing chat settings and continuing chatting. From Assistant to Model', async ({
  dialHomePage,
  chat,
  setTestIds,
  conversationData,
  localStorageManager,
  chatHeader,
  chatInfoTooltip,
  talkToSelector,
  temperatureSlider,
  errorPopup,
}) => {
  setTestIds('EPMRTC-466');
  let conversation: Conversation;
  const assistantSelectedAddons = assistant?.selectedAddons;
  const models = allModels.filter((m) => m.iconUrl !== undefined);
  const randomModel = GeneratorUtil.randomArrayElement(models);
  const addonIds = allAddons.map((a) => a.id);
  let isSelectedAddon = true;
  let randomAddon = '';
  while (isSelectedAddon) {
    randomAddon = GeneratorUtil.randomArrayElement(addonIds);
    if (!assistantSelectedAddons?.includes(randomAddon)) {
      isSelectedAddon = false;
    }
  }
  assistantSelectedAddons?.push(randomAddon);
  const updatedTemp = 0.8;

  await test.step('Prepare assistant conversation with all available addons and temperature', async () => {
    conversation = conversationData.prepareAssistantConversation(
      assistant!,
      assistantSelectedAddons!,
    );
    await localStorageManager.setConversationHistory(conversation);
    await localStorageManager.setSelectedConversation(conversation);
  });

  await test.step('Open conversation settings and change assistant to model with temp', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await chatHeader.openConversationSettings.click();
    await talkToSelector.selectModel(randomModel.name);
    await temperatureSlider.setTemperature(updatedTemp);
    await chat.applyChanges().click();
  });

  await test.step('Verify chat icons are correct in the header', async () => {
    const headerIcons = await chatHeader.getHeaderIcons();
    expect
      .soft(headerIcons.length, ExpectedMessages.headerIconsCountIsValid)
      .toBe(1 + assistantSelectedAddons!.length);
    expect
      .soft(headerIcons[0].iconEntity, ExpectedMessages.headerIconEntityIsValid)
      .toBe(randomModel.id);
    expect
      .soft(headerIcons[0].iconUrl, ExpectedMessages.headerIconSourceIsValid)
      .toBe(randomModel!.iconUrl);

    for (let i = 0; i < assistantSelectedAddons!.length; i++) {
      const addon = allAddons.find((a) => a.id === assistantSelectedAddons![i]);
      expect
        .soft(
          headerIcons[i + 1].iconEntity,
          ExpectedMessages.headerIconEntityIsValid,
        )
        .toBe(addon!.id);
      expect
        .soft(
          headerIcons[i + 1].iconUrl,
          ExpectedMessages.headerIconSourceIsValid,
        )
        .toBe(addon!.iconUrl);
    }
  });

  await test.step('Hover over chat header and verify chat settings are correct on tooltip', async () => {
    await errorPopup.cancelPopup();
    await chatHeader.chatModel.hoverOver();
    const modelInfo = await chatInfoTooltip.getModelInfo();
    expect
      .soft(modelInfo, ExpectedMessages.chatInfoModelIsValid)
      .toBe(randomModel.name);

    const modelInfoIcon = await chatInfoTooltip.getModelIcon();
    expect
      .soft(modelInfoIcon, ExpectedMessages.chatInfoModelIconIsValid)
      .toBe(randomModel!.iconUrl);

    const tempInfo = await chatInfoTooltip.getTemperatureInfo();
    expect
      .soft(tempInfo, ExpectedMessages.chatInfoTemperatureIsValid)
      .toBe(updatedTemp.toString());

    const addonsInfo = await chatInfoTooltip.getAddonsInfo();
    const addonInfoIcons = await chatInfoTooltip.getAddonIcons();
    expect
      .soft(addonsInfo.length, ExpectedMessages.chatInfoAddonsCountIsValid)
      .toBe(assistantSelectedAddons!.length);

    for (let i = 0; i < assistantSelectedAddons!.length; i++) {
      const addon = allAddons.find((a) => a.id === assistantSelectedAddons![i]);
      expect
        .soft(addonsInfo[i], ExpectedMessages.chatInfoAddonIsValid)
        .toBe(addon!.name);
      expect
        .soft(addonInfoIcons[i], ExpectedMessages.chatInfoAddonIconIsValid)
        .toBe(addon!.iconUrl);
    }
  });
});

test('Chat header after changing chat settings and continuing chatting. From Assistant to Application', async ({
  dialHomePage,
  chat,
  setTestIds,
  conversationData,
  localStorageManager,
  chatHeader,
  chatInfoTooltip,
  talkToSelector,
  errorPopup,
}) => {
  setTestIds('EPMRTC-454');
  let conversation: Conversation;
  const allApps = ModelsUtil.getApplications().filter(
    (a) => a.iconUrl !== undefined,
  );
  const randomApp = GeneratorUtil.randomArrayElement(allApps);

  await test.step('Prepare assistant conversation with default settings', async () => {
    conversation = conversationData.prepareAssistantConversation(
      assistant!,
      assistant!.selectedAddons!,
    );
    await localStorageManager.setConversationHistory(conversation);
    await localStorageManager.setSelectedConversation(conversation);
  });

  await test.step('Open conversation settings and change assistant to application', async () => {
    const assistantAddonIconUrls = allAddons
      .filter((addon) => assistant?.selectedAddons?.includes(addon.id))
      .map((addon) => addon.iconUrl);
    await dialHomePage.openHomePage({
      iconsToBeLoaded: [assistant?.iconUrl, ...assistantAddonIconUrls],
    });
    await dialHomePage.waitForPageLoaded();
    await chatHeader.openConversationSettings.click();
    await talkToSelector.selectApplication(randomApp.name);
    await chat.applyChanges().click();
  });

  await test.step('Verify chat icons are correct in the header', async () => {
    const headerIcons = await chatHeader.getHeaderIcons();
    expect
      .soft(headerIcons.length, ExpectedMessages.headerIconsCountIsValid)
      .toBe(1);
    expect
      .soft(headerIcons[0].iconEntity, ExpectedMessages.headerIconEntityIsValid)
      .toBe(randomApp!.id);
    expect
      .soft(headerIcons[0].iconUrl, ExpectedMessages.headerIconSourceIsValid)
      .toBe(randomApp!.iconUrl);
  });

  await test.step('Hover over chat header and verify chat settings are correct on tooltip', async () => {
    await errorPopup.cancelPopup();
    await chatHeader.chatModel.hoverOver();
    const appInfo = await chatInfoTooltip.getApplicationInfo();
    expect
      .soft(appInfo, ExpectedMessages.chatInfoAppIsValid)
      .toBe(randomApp!.name);

    const appInfoIcon = await chatInfoTooltip.getApplicationIcon();
    expect
      .soft(appInfoIcon, ExpectedMessages.chatInfoAppIconIsValid)
      .toBe(randomApp!.iconUrl);
  });
});
