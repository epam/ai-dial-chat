import { OpenAIEntityModel } from '@/src/types/openai';

import test from '@/e2e/src/core/fixtures';
import { ExpectedMessages, Groups } from '@/e2e/src/testData';
import { Colors } from '@/e2e/src/ui/domData';
import { GeneratorUtil } from '@/e2e/src/utils';
import { expect } from '@playwright/test';

const sysPrompt = 'test prompt';
const temp = 0.8;

let models: OpenAIEntityModel[];
let defaultModel: string;
test.beforeAll(async ({ apiHelper }) => {
  models = await apiHelper.getModels();
  defaultModel = models.find((m) => m.isDefault === true)!.name;
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
  let modelNames = models.filter((m) => m.type === 'model').map((m) => m.name);
  modelNames = modelNames.filter((m) => m !== defaultModel);
  const randomModel = GeneratorUtil.randomArrayElement(modelNames);

  await entitySettings.setSystemPrompt(sysPrompt);
  await temperatureSlider.setTemperature(temp);

  const randomAddon = GeneratorUtil.randomArrayElement(
    await addons.getRecentAddons(),
  );
  await addons.selectAddon(randomAddon);

  await talkToSelector.selectEntity(randomModel, Groups.models);
  const modelBorderColors = await recentEntities
    .getRecentEntity(randomModel)
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
  await entitySettings.setSystemPrompt(sysPrompt);
  await temperatureSlider.setTemperature(temp);

  const randomAddon = GeneratorUtil.randomArrayElement(
    await addons.getRecentAddons(),
  );
  await addons.selectAddon(randomAddon);
  let modelNames = models.filter((m) => m.type === 'model').map((m) => m.name);
  modelNames = modelNames.filter((m) => m !== defaultModel);
  const randomModel = GeneratorUtil.randomArrayElement(modelNames);
  const appNames = models
    .filter((m) => m.type === 'application')
    .map((m) => m.name);
  const randomApp = GeneratorUtil.randomArrayElement(appNames);

  await talkToSelector.selectEntity(randomApp, Groups.applications);
  await talkToSelector.selectEntity(randomModel, Groups.models);

  const modelBorderColors = await recentEntities
    .getRecentEntity(randomModel)
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
  for (const prompt of prompts) {
    await entitySettings.setSystemPrompt(prompt);
    const systemPrompt = await entitySettings.getSystemPrompt();
    expect
      .soft(systemPrompt, ExpectedMessages.systemPromptIsValid)
      .toBe(prompt);
    await entitySettings.clearSystemPrompt();
  }
});
