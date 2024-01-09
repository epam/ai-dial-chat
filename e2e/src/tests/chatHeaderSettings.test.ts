import { Conversation } from '@/src/types/chat';
import { OpenAIEntityModel } from '@/src/types/openai';

import test from '@/e2e/src/core/fixtures';
import { ExpectedMessages } from '@/e2e/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/e2e/src/utils';
import { expect } from '@playwright/test';

let defaultModel: OpenAIEntityModel;

test.beforeAll(async () => {
  defaultModel = ModelsUtil.getDefaultModel()!;
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
    await chatHeader.openConversationSettingsPopup();
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
