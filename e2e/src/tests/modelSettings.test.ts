import { OpenAIEntityModel } from '@/src/types/openai';

import test from '@/e2e/src/core/fixtures';
import { ExpectedMessages } from '@/e2e/src/testData';
import { Colors } from '@/e2e/src/ui/domData';
import { GeneratorUtil, ModelsUtil } from '@/e2e/src/utils';
import { expect } from '@playwright/test';

const sysPrompt = 'test prompt';
const temp = 0.8;

let models: OpenAIEntityModel[];
let defaultModel: OpenAIEntityModel;

test.beforeAll(async () => {
  models = ModelsUtil.getModels();
  defaultModel = ModelsUtil.getDefaultModel()!;
});

test('Selected settings are saved if to switch from Model1 to Model2', async ({
  dialHomePage,
  recentEntities,
  entitySettings,
  temperatureSlider,
  addons,
  setTestIds,
  talkToSelector,
}) => {
  setTestIds('EPMRTC-1046');
  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
  const randomModel = GeneratorUtil.randomArrayElement(
    models.filter((m) => m.id !== defaultModel.id),
  );

  await entitySettings.setSystemPrompt(sysPrompt);
  await temperatureSlider.setTemperature(temp);

  const randomAddon = GeneratorUtil.randomArrayElement(
    await addons.getRecentAddons(),
  );
  await addons.selectAddon(randomAddon);

  await talkToSelector.selectModel(randomModel.name);
  const modelBorderColors = await recentEntities
    .getRecentEntity(randomModel.name)
    .getAllBorderColors();
  Object.values(modelBorderColors).forEach((borders) => {
    borders.forEach((borderColor) => {
      expect
        .soft(borderColor, ExpectedMessages.talkToEntityIsSelected)
        .toBe(Colors.highlightedEntity);
    });
  });

  const systemPromptVisible = await entitySettings.getSystemPrompt();
  expect
    .soft(systemPromptVisible, ExpectedMessages.systemPromptIsValid)
    .toBe(sysPrompt);

  const temperature = await temperatureSlider.getTemperature();
  expect
    .soft(temperature, ExpectedMessages.temperatureIsValid)
    .toBe(temp.toString());

  const selectedAddons = await addons.getSelectedAddons();
  expect
    .soft(selectedAddons, ExpectedMessages.selectedAddonsValid)
    .toEqual([randomAddon]);
});

test('Selected settings are saved if to switch from Model to Application to Model', async ({
  dialHomePage,
  recentEntities,
  entitySettings,
  temperatureSlider,
  addons,
  setTestIds,
  talkToSelector,
}) => {
  setTestIds('EPMRTC-417');
  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
  await entitySettings.setSystemPrompt(sysPrompt);
  await temperatureSlider.setTemperature(temp);

  const randomAddon = GeneratorUtil.randomArrayElement(
    await addons.getRecentAddons(),
  );
  await addons.selectAddon(randomAddon);
  const randomModel = GeneratorUtil.randomArrayElement(
    models.filter((m) => m.id !== defaultModel.id),
  );
  const randomApp = GeneratorUtil.randomArrayElement(
    ModelsUtil.getApplications(),
  );

  await talkToSelector.selectApplication(randomApp.name);
  await talkToSelector.selectModel(randomModel.name);

  const modelBorderColors = await recentEntities
    .getRecentEntity(randomModel.name)
    .getAllBorderColors();
  Object.values(modelBorderColors).forEach((borders) => {
    borders.forEach((borderColor) => {
      expect
        .soft(borderColor, ExpectedMessages.talkToEntityIsSelected)
        .toBe(Colors.highlightedEntity);
    });
  });

  const systemPrompt = await entitySettings.getSystemPrompt();
  expect
    .soft(systemPrompt, ExpectedMessages.systemPromptIsValid)
    .toBe(sysPrompt);

  const temperature = await temperatureSlider.getTemperature();
  expect
    .soft(temperature, ExpectedMessages.temperatureIsValid)
    .toBe(temp.toString());

  const selectedAddons = await addons.getSelectedAddons();
  expect
    .soft(selectedAddons, ExpectedMessages.selectedAddonsValid)
    .toEqual([randomAddon]);
});

test('System prompt contains combinations with :', async ({
  dialHomePage,
  entitySettings,
  setTestIds,
}) => {
  setTestIds('EPMRTC-1084');
  const prompts = [
    'test:',
    'test. test:',
    'test :',
    ' test:',
    'test test. test:',
  ];
  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
  for (const prompt of prompts) {
    await entitySettings.setSystemPrompt(prompt);
    const systemPrompt = await entitySettings.getSystemPrompt();
    expect
      .soft(systemPrompt, ExpectedMessages.systemPromptIsValid)
      .toBe(prompt);
    await entitySettings.clearSystemPrompt();
  }
});
