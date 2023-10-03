import { OpenAIEntityModelID, OpenAIEntityModels } from '@/src/types/openai';

import test from '../core/fixtures';
import { ExpectedConstants, ExpectedMessages } from '../testData';
import { Colors } from '../ui/domData';

import { GeneratorUtil } from '@/e2e/src/utils';
import { expect } from '@playwright/test';

test(
  'Create new conversation\n' +
    'Default settings in new chat with cleared site data\n',
  async ({
    dialHomePage,
    chatBar,
    conversations,
    recentEntities,
    entitySettings,
    temperatureSlider,
    addons,
    setTestIds,
    apiHelper,
  }) => {
    setTestIds('EPMRTC-933', 'EPMRTC-398');
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await chatBar.createNewConversation();

    const todayConversations = await conversations.getTodayConversations();
    expect
      .soft(todayConversations.length, ExpectedMessages.newConversationCreated)
      .toBe(2);
    for (const todayConversation of todayConversations) {
      expect
        .soft(todayConversation, ExpectedMessages.conversationOfToday)
        .toBe(ExpectedConstants.newConversationTitle);
    }

    const expectedModelEntities = await apiHelper.getModelEntities();
    const expectedDefaultModel = expectedModelEntities.find(
      (e) => e.isDefault === true,
    )!.name;
    const modelBorderColors = await recentEntities
      .getRecentEntity(expectedDefaultModel)
      .getAllBorderColors();
    Object.values(modelBorderColors).forEach((borders) => {
      borders.forEach((borderColor) => {
        expect
          .soft(borderColor, ExpectedMessages.defaultTalkToIsValid)
          .toBe(Colors.highlightedEntity);
      });
    });

    const expectedDefaultRecentEntities = [];
    for (const entity of ExpectedConstants.recentModelIds.split(',')) {
      expectedDefaultRecentEntities.push(
        expectedModelEntities.find((e) => e.id === entity)!.name,
      );
    }

    const recentTalkTo = await recentEntities.getRecentEntityNames();
    expect
      .soft(recentTalkTo, ExpectedMessages.recentEntitiesVisible)
      .toEqual(expectedDefaultRecentEntities);

    const defaultSystemPrompt = await entitySettings.getSystemPrompt();
    expect
      .soft(defaultSystemPrompt, ExpectedMessages.defaultSystemPromptIsEmpty)
      .toBe(ExpectedConstants.emptyString);

    const defaultTemperature = await temperatureSlider.getTemperature();
    expect
      .soft(defaultTemperature, ExpectedMessages.defaultTemperatureIsOne)
      .toBe(ExpectedConstants.defaultTemperature);

    const expectedDefaultModelAddons = await apiHelper.getEntitySelectedAddons(
      expectedDefaultModel,
    );
    const selectedAddons = await addons.getSelectedAddons();
    expect
      .soft(selectedAddons, ExpectedMessages.noAddonsSelected)
      .toEqual(expectedDefaultModelAddons);

    const expectedAddons = await apiHelper.getAddons();
    const expectedDefaultRecentAddons = [];
    for (const addon of ExpectedConstants.recentAddonIds.split(',')) {
      expectedDefaultRecentAddons.push(
        expectedAddons.find((a) => a.id === addon)!.name,
      );
    }
    const recentAddons = await addons.getRecentAddons();
    expect
      .soft(recentAddons, ExpectedMessages.recentAddonsVisible)
      .toEqual(expectedDefaultRecentAddons);
  },
);

test('Default model in new chat is set as in previous chat', async ({
  dialHomePage,
  chatBar,
  recentEntities,
  talkToSelector,
  chat,
  setTestIds,
}) => {
  setTestIds('EPMRTC-400');

  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded();
  await talkToSelector.selectModel(
    OpenAIEntityModels[OpenAIEntityModelID.BISON_001].name,
  );
  await chat.sendRequest('test');
  await chatBar.createNewConversation();

  const addonBorderColors = await recentEntities
    .getRecentEntity(OpenAIEntityModels[OpenAIEntityModelID.MIRROR].name)
    .getAllBorderColors();
  Object.values(addonBorderColors).forEach((borders) => {
    borders.forEach((borderColor) => {
      expect
        .soft(borderColor, ExpectedMessages.defaultTalkToIsValid)
        .toBe(Colors.highlightedEntity);
    });
  });

  const recentTalkTo = await recentEntities.getRecentEntityNames();
  expect
    .soft(recentTalkTo[0], ExpectedMessages.recentEntitiesIsOnTop)
    .toBe(OpenAIEntityModels[OpenAIEntityModelID.BISON_001].name);
});

test('Settings on default screen are saved in local storage when temperature = 0', async ({
  dialHomePage,
  recentEntities,
  entitySettings,
  temperatureSlider,
  setTestIds,
  apiHelper,
  talkToSelector,
  addons,
}) => {
  setTestIds('EPMRTC-406');
  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded();
  const randomModel = GeneratorUtil.randomArrayElement(
    await apiHelper.getModelNames(),
  );
  const randomAddonId = GeneratorUtil.randomArrayElement(
    ExpectedConstants.recentAddonIds.split(','),
  );
  const randomAddon = await apiHelper.getAddonById(randomAddonId);
  await talkToSelector.selectModel(randomModel);
  const sysPrompt = 'test prompt';
  const temp = 0;
  await entitySettings.setSystemPrompt(sysPrompt);
  await temperatureSlider.setTemperature(temp);
  await addons.selectAddon(randomAddon!.name);
  await dialHomePage.reloadPage();
  await dialHomePage.waitForPageLoaded();

  const modelBorderColors = await recentEntities
    .getRecentEntity(randomModel)
    .getAllBorderColors();
  Object.values(modelBorderColors).forEach((borders) => {
    borders.forEach((borderColor) => {
      expect
        .soft(borderColor, ExpectedMessages.defaultTalkToIsValid)
        .toBe(Colors.highlightedEntity);
    });
  });

  const systemPrompt = await entitySettings.systemPrompt.getElementContent();
  expect
    .soft(systemPrompt, ExpectedMessages.systemPromptIsValid)
    .toBe(sysPrompt);

  const temperature = await temperatureSlider.getTemperature();
  expect
    .soft(temperature, ExpectedMessages.temperatureIsValid)
    .toBe(temp.toString());

  const selectedAddons = await addons.getSelectedAddons();
  expect
    .soft(selectedAddons, ExpectedMessages.noAddonsSelected)
    .toEqual([randomAddon!.name]);
});

test('Recent "Talk to" list is updated', async ({
  dialHomePage,
  chatBar,
  recentEntities,
  chat,
  talkToSelector,
  setTestIds,
}) => {
  setTestIds('EPMRTC-1044');
  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded();
  await talkToSelector.selectApplication(
    OpenAIEntityModels[OpenAIEntityModelID.MIRROR].name,
  );
  await chat.sendRequest('test message');
  await chatBar.createNewConversation();
  const appBorderColors = await recentEntities
    .getRecentEntity(OpenAIEntityModels[OpenAIEntityModelID.MIRROR].name)
    .getAllBorderColors();
  Object.values(appBorderColors).forEach((borders) => {
    borders.forEach((borderColor) => {
      expect
        .soft(borderColor, ExpectedMessages.talkToEntityIsSelected)
        .toBe(Colors.highlightedEntity);
    });
  });

  const recentTalkTo = await recentEntities.getRecentEntityNames();
  expect
    .soft(recentTalkTo[0], ExpectedMessages.talkToEntityIsSelected)
    .toBe(OpenAIEntityModels[OpenAIEntityModelID.MIRROR].name);
});
