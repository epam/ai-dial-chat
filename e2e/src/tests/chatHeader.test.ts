import { Conversation } from '@/src/types/chat';
import {
  OpenAIEntityAddon,
  OpenAIEntityModel,
  OpenAIEntityModelID,
  OpenAIEntityModels,
} from '@/src/types/openai';

import test from '@/e2e/src/core/fixtures';
import { ExpectedMessages } from '@/e2e/src/testData';
import { GeneratorUtil } from '@/e2e/src/utils';
import { expect } from '@playwright/test';

let allAddons: OpenAIEntityAddon[];
let addonIds: string[];
let allModels: OpenAIEntityModel[];
test.beforeAll(async ({ apiHelper }) => {
  allAddons = await apiHelper.getAddons();
  addonIds = allAddons.map((a) => a.id);
  allModels = await apiHelper
    .getModels()
    .then((models) => models.filter((m) => m.iconUrl != undefined));
});

test('Check chat header for Model with three addons, temp = 0', async ({
  dialHomePage,
  chat,
  setTestIds,
  conversationData,
  localStorageManager,
  apiHelper,
  chatHeader,
  chatInfoTooltip,
}) => {
  setTestIds('EPMRTC-1115');
  let conversation: Conversation;
  const temp = 0;
  const request = 'This is a test request';
  const model = await apiHelper.getModel(
    OpenAIEntityModels[OpenAIEntityModelID.GPT_3_5_AZ].name,
  );

  await test.step('Prepare model conversation with all available addons and temperature', async () => {
    conversation = conversationData.prepareModelConversation(
      temp,
      '',
      addonIds,
      OpenAIEntityModels[OpenAIEntityModelID.GPT_3_5_AZ],
    );
    await localStorageManager.setConversationHistory(conversation);
    await localStorageManager.setSelectedConversation(conversation);
  });

  await test.step('Send new request in chat and verify request is sent with valid data', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    const requestsData = await chat.sendRequest(request, false);

    expect
      .soft(requestsData.modelId, ExpectedMessages.requestModeIdIsValid)
      .toBe(conversation.model.id);
    expect
      .soft(requestsData.prompt, ExpectedMessages.requestPromptIsValid)
      .toBe(conversation.prompt);
    expect
      .soft(requestsData.temperature, ExpectedMessages.requestTempIsValid)
      .toBe(conversation.temperature);
    expect
      .soft(
        requestsData.selectedAddons,
        ExpectedMessages.requestSelectedAddonsAreValid,
      )
      .toEqual(conversation.selectedAddons);
  });

  await test.step('Verify chat icons are updated with model, temperature and addons in the header', async () => {
    const headerIcons = await chatHeader.getHeaderIcons();
    expect
      .soft(headerIcons.length, ExpectedMessages.headerIconsCountIsValid)
      .toBe(1 + addonIds.length);
    expect
      .soft(headerIcons[0].iconEntity, ExpectedMessages.headerIconEntityIsValid)
      .toBe(conversation.model.id);
    expect
      .soft(headerIcons[0].iconUrl, ExpectedMessages.headerIconSourceIsValid)
      .toBe(model!.iconUrl);

    for (let i = 0; i < addonIds.length; i++) {
      const addon = allAddons.find((a) => a.id === addonIds[i]);
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
    await chatHeader.chatModel.hoverOver();
    const modelInfo = await chatInfoTooltip.getModelInfo();
    expect
      .soft(modelInfo, ExpectedMessages.chatInfoModelIsValid)
      .toBe(conversation.model.name);

    const modelInfoIcon = await chatInfoTooltip.getModelIcon();
    expect
      .soft(modelInfoIcon, ExpectedMessages.chatInfoModelIconIsValid)
      .toBe(model!.iconUrl);

    const promptInfo = await chatInfoTooltip.getPromptInfo();
    expect.soft(promptInfo, ExpectedMessages.chatInfoPromptIsValid).toBe('');

    const tempInfo = await chatInfoTooltip.getTemperatureInfo();
    expect
      .soft(tempInfo, ExpectedMessages.chatInfoTemperatureIsValid)
      .toBe(conversation.temperature.toString());

    const addonsInfo = await chatInfoTooltip.getAddonsInfo();
    const addonInfoIcons = await chatInfoTooltip.getAddonIcons();
    expect
      .soft(addonsInfo.length, ExpectedMessages.chatInfoAddonsCountIsValid)
      .toBe(allAddons.length);

    for (let i = 0; i < addonIds.length; i++) {
      const addon = allAddons.find((a) => a.id === addonIds[i]);
      expect
        .soft(addonsInfo[i], ExpectedMessages.chatInfoAddonIsValid)
        .toBe(addon!.name);
      expect
        .soft(addonInfoIcons[i], ExpectedMessages.chatInfoAddonIconIsValid)
        .toBe(addon!.iconUrl);
    }
  });
});

test('Check chat header for Assistant with added non default addon', async ({
  dialHomePage,
  chat,
  setTestIds,
  conversationData,
  localStorageManager,
  apiHelper,
  chatHeader,
  chatInfoTooltip,
}) => {
  setTestIds('EPMRTC-1110');
  let conversation: Conversation;
  const assistant = await apiHelper.getEntity(
    OpenAIEntityModels[OpenAIEntityModelID.ASSISTANT10K],
  );
  const assistantSelectedAddons = assistant?.selectedAddons;
  const randomModel = GeneratorUtil.randomArrayElement(allModels);
  let isSelectedAddon = true;
  let randomAddon = '';
  while (isSelectedAddon) {
    randomAddon = GeneratorUtil.randomArrayElement(addonIds);
    if (!assistantSelectedAddons?.includes(randomAddon)) {
      isSelectedAddon = false;
    }
  }
  assistantSelectedAddons?.push(randomAddon);

  await test.step('Prepare assistant conversation with all available addons and temperature', async () => {
    conversation = conversationData.prepareAssistantConversation(
      assistant!,
      assistantSelectedAddons!,
      randomModel,
    );
    await localStorageManager.setConversationHistory(conversation);
    await localStorageManager.setSelectedConversation(conversation);
  });

  await test.step('Send new request in chat and verify request is sent with valid data', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    const requestsData = await chat.sendRequest(
      'where the main epam office located?',
      false,
    );

    expect
      .soft(requestsData.modelId, ExpectedMessages.requestModeIdIsValid)
      .toBe(conversation.model.id);
    expect
      .soft(requestsData.temperature, ExpectedMessages.requestTempIsValid)
      .toBe(conversation.temperature);
    expect
      .soft(
        requestsData.assistantModelId,
        ExpectedMessages.requestAssistantModelIdIsValid,
      )
      .toBe(conversation.assistantModelId);
    expect
      .soft(
        requestsData.selectedAddons,
        ExpectedMessages.requestSelectedAddonsAreValid,
      )
      .toEqual(conversation.selectedAddons);
  });

  await test.step('Verify chat icons are correct in the header', async () => {
    const headerIcons = await chatHeader.getHeaderIcons();
    expect
      .soft(headerIcons.length, ExpectedMessages.headerIconsCountIsValid)
      .toBe(1 + assistantSelectedAddons!.length);
    expect
      .soft(headerIcons[0].iconEntity, ExpectedMessages.headerIconEntityIsValid)
      .toBe(conversation.model.id);
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
    await chatHeader.chatModel.hoverOver();
    const assistantInfo = await chatInfoTooltip.getAssistantInfo();
    expect
      .soft(assistantInfo, ExpectedMessages.chatInfoAssistantIsValid)
      .toBe(assistant!.name);

    const assistantInfoIcon = await chatInfoTooltip.getAssistantIcon();
    expect
      .soft(assistantInfoIcon, ExpectedMessages.chatInfoAssistantIconIsValid)
      .toBe(assistant!.iconUrl);

    const assistantModelInfo = await chatInfoTooltip.getAssistantModelInfo();
    expect
      .soft(assistantModelInfo, ExpectedMessages.chatInfoAssistantModelIsValid)
      .toBe(randomModel.name);

    const assistantModelInfoIcon =
      await chatInfoTooltip.getAssistantModelIcon();
    expect
      .soft(
        assistantModelInfoIcon,
        ExpectedMessages.chatInfoAssistantModelIconIsValid,
      )
      .toBe(randomModel!.iconUrl);

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

test('Check chat header for Assistant if to update settings in chat', async ({
  dialHomePage,
  chat,
  setTestIds,
  conversationData,
  localStorageManager,
  apiHelper,
  chatHeader,
  chatInfoTooltip,
  modelSelector,
  temperatureSlider,
  addons,
}) => {
  setTestIds('EPMRTC-427');
  let conversation: Conversation;
  const assistant = await apiHelper.getEntity(
    OpenAIEntityModels[OpenAIEntityModelID.ASSISTANT10K],
  );
  const assistantSelectedAddons = assistant?.selectedAddons;
  const randomModel = GeneratorUtil.randomArrayElement(allModels);
  let isSelectedAddon = true;
  let randomAddon = '';
  while (isSelectedAddon) {
    randomAddon = GeneratorUtil.randomArrayElement(addonIds);
    if (!assistantSelectedAddons?.includes(randomAddon)) {
      isSelectedAddon = false;
    }
  }
  assistantSelectedAddons?.push(randomAddon);
  const updatedTemp = 0;
  const updatedAddons = assistantSelectedAddons!.filter(
    (a) => a !== randomAddon,
  );
  const randomAddonEntity = await apiHelper.getAddonById(randomAddon);

  await test.step('Prepare assistant conversation with all available addons and temperature', async () => {
    conversation = conversationData.prepareAssistantConversation(
      assistant!,
      assistantSelectedAddons!,
    );
    await localStorageManager.setConversationHistory(conversation);
    await localStorageManager.setSelectedConversation(conversation);
  });

  await test.step('Open conversation settings and change assistant model, temp, remove addon', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await chatHeader.openConversationSettings.click();
    await modelSelector.selectModel(randomModel.name);
    await temperatureSlider.setTemperature(updatedTemp);
    await addons.removeSelectedAddon(randomAddonEntity!.name);
    await chat.applyChanges().click();
  });

  await test.step('Send new request in chat and verify request is sent with valid data', async () => {
    const requestsData = await chat.sendRequest(
      'where the main epam office located?',
      false,
    );

    expect
      .soft(requestsData.modelId, ExpectedMessages.requestModeIdIsValid)
      .toBe(conversation.model.id);
    expect
      .soft(requestsData.temperature, ExpectedMessages.requestTempIsValid)
      .toBe(updatedTemp);
    expect
      .soft(
        requestsData.assistantModelId,
        ExpectedMessages.requestAssistantModelIdIsValid,
      )
      .toBe(randomModel.id);
    expect
      .soft(
        requestsData.selectedAddons,
        ExpectedMessages.requestSelectedAddonsAreValid,
      )
      .toEqual(updatedAddons);
  });

  await test.step('Verify chat icons are correct in the header', async () => {
    const headerIcons = await chatHeader.getHeaderIcons();
    expect
      .soft(headerIcons.length, ExpectedMessages.headerIconsCountIsValid)
      .toBe(1 + updatedAddons.length);
    expect
      .soft(headerIcons[0].iconEntity, ExpectedMessages.headerIconEntityIsValid)
      .toBe(conversation.model.id);
    expect
      .soft(headerIcons[0].iconUrl, ExpectedMessages.headerIconSourceIsValid)
      .toBe(assistant!.iconUrl);

    for (let i = 0; i < updatedAddons.length; i++) {
      const addon = allAddons.find((a) => a.id === updatedAddons[i]);
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
    await chatHeader.chatModel.hoverOver();
    const assistantInfo = await chatInfoTooltip.getAssistantInfo();
    expect
      .soft(assistantInfo, ExpectedMessages.chatInfoAssistantIsValid)
      .toBe(assistant!.name);

    const assistantInfoIcon = await chatInfoTooltip.getAssistantIcon();
    expect
      .soft(assistantInfoIcon, ExpectedMessages.chatInfoAssistantIconIsValid)
      .toBe(assistant!.iconUrl);

    const assistantModelInfo = await chatInfoTooltip.getAssistantModelInfo();
    expect
      .soft(assistantModelInfo, ExpectedMessages.chatInfoAssistantModelIsValid)
      .toBe(randomModel.name);

    const assistantModelInfoIcon =
      await chatInfoTooltip.getAssistantModelIcon();
    expect
      .soft(
        assistantModelInfoIcon,
        ExpectedMessages.chatInfoAssistantModelIconIsValid,
      )
      .toBe(randomModel!.iconUrl);

    const tempInfo = await chatInfoTooltip.getTemperatureInfo();
    expect
      .soft(tempInfo, ExpectedMessages.chatInfoTemperatureIsValid)
      .toBe(updatedTemp.toString());

    const addonsInfo = await chatInfoTooltip.getAddonsInfo();
    const addonInfoIcons = await chatInfoTooltip.getAddonIcons();
    expect
      .soft(addonsInfo.length, ExpectedMessages.chatInfoAddonsCountIsValid)
      .toBe(updatedAddons.length);

    for (let i = 0; i < updatedAddons.length; i++) {
      const addon = allAddons.find((a) => a.id === updatedAddons[i]);
      expect
        .soft(addonsInfo[i], ExpectedMessages.chatInfoAddonIsValid)
        .toBe(addon!.name);
      expect
        .soft(addonInfoIcons[i], ExpectedMessages.chatInfoAddonIconIsValid)
        .toBe(addon!.iconUrl);
    }
  });
});

test('Check chat header if to change Application to Application', async ({
  dialHomePage,
  conversationData,
  chat,
  localStorageManager,
  setTestIds,
  apiHelper,
  chatHeader,
  talkToSelector,
  chatInfoTooltip,
}) => {
  setTestIds('EPMRTC-1112');
  let allApps = await apiHelper
    .getModelEntities()
    .then((e) => e.filter((e) => e.type === 'application'));
  allApps = allApps.filter(
    (a) =>
      a !== OpenAIEntityModels[OpenAIEntityModelID.MIRROR] &&
      a.iconUrl !== undefined,
  );
  const randomApp = GeneratorUtil.randomArrayElement(allApps);

  await test.step('Prepare conversation with application', async () => {
    const conversation = conversationData.prepareDefaultConversation(
      OpenAIEntityModels[OpenAIEntityModelID.MIRROR],
    );
    await localStorageManager.setConversationHistory(conversation);
    await localStorageManager.setSelectedConversation(conversation);
  });

  await test.step('Change application to a random one', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await chatHeader.openConversationSettings.click();
    await talkToSelector.selectApplication(randomApp.name);
    await chat.applyChanges().click();
  });

  await test.step('Verify chat API request is sent with correct settings', async () => {
    const requestsData = await chat.sendRequest('Test request', false);
    expect
      .soft(requestsData.modelId, ExpectedMessages.chatRequestModelIsValid)
      .toBe(randomApp.id);
  });

  await test.step('Verify chat header icons are updated with new application', async () => {
    const headerIcons = await chatHeader.getHeaderIcons();
    expect
      .soft(headerIcons.length, ExpectedMessages.headerIconsCountIsValid)
      .toBe(1);
    expect
      .soft(headerIcons[0].iconEntity, ExpectedMessages.headerIconEntityIsValid)
      .toBe(randomApp.id);
    expect
      .soft(headerIcons[0].iconUrl, ExpectedMessages.headerIconSourceIsValid)
      .toBe(randomApp.iconUrl);
  });

  await test.step('Hover over chat header model and verify chat settings on tooltip', async () => {
    await chatHeader.chatModel.hoverOver();
    const appInfo = await chatInfoTooltip.getApplicationInfo();
    expect
      .soft(appInfo, ExpectedMessages.chatInfoAppIsValid)
      .toBe(randomApp.name);

    const modelInfoIcon = await chatInfoTooltip.getApplicationIcon();
    expect
      .soft(modelInfoIcon, ExpectedMessages.chatInfoAppIconIsValid)
      .toBe(randomApp.iconUrl);
  });
});
