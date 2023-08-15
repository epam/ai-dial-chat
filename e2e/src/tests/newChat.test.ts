import {
  OpenAIEntityAddonID,
  OpenAIEntityAddons,
  OpenAIEntityModelID,
  OpenAIEntityModels,
} from '@/types/openai';

import test from '../core/fixtures';
import { ExpectedConstants, ExpectedMessages } from '../testData';
import { Colors } from '../ui/domData';

import { expect } from '@playwright/test';

test(
  'New conversation is created on "New chat" button\n' +
    'Default settings in new chat with cleared site data\n' +
    '"Talk to" drop down contains items grouped by models, assistants, applications',
  async ({
    dialHomePage,
    chatBar,
    conversations,
    recentEntities,
    entitySettings,
    temperatureSlider,
    addons,
    addonsDialog,
  }) => {
    await dialHomePage.openHomePage();
    await chatBar.createNewChat();
    expect
      .soft(
        await conversations
          .getConversationByName(ExpectedConstants.newConversationTitle)
          .isVisible(),
        ExpectedMessages.newConversationCreated,
      )
      .toBeTruthy();

    const addonBorderColors = await recentEntities
      .getRecentEntity(OpenAIEntityModels[OpenAIEntityModelID.GPT_3_5_AZ].name)
      .getAllBorderColors();
    Object.values(addonBorderColors).forEach((borders) => {
      borders.forEach((borderColor) => {
        expect
          .soft(borderColor, ExpectedMessages.defaultTalkToIsValid)
          .toBe(Colors.selectedEntity);
      });
    });

    const defaultSystemPrompt = await entitySettings.getSystemPrompt();
    expect
      .soft(defaultSystemPrompt, ExpectedMessages.defaultSystemPromptIsEmpty)
      .toBe(ExpectedConstants.emptyString);

    const defaultTemperature = await temperatureSlider.getTemperature();
    expect
      .soft(defaultTemperature, ExpectedMessages.defaultTemperatureIsOne)
      .toBe(ExpectedConstants.defaultTemperature);

    const selectedAddons = await addons.getSelectedAddons();
    expect.soft(selectedAddons, ExpectedMessages.noAddonsSelected).toEqual([]);

    await addons.seeAllAddonsButton.click();
    const searchResults = await addonsDialog.getSearchResults();
    expect
      .soft(searchResults, ExpectedMessages.addonResultsValid)
      .toEqual([
        OpenAIEntityAddons[OpenAIEntityAddonID.ADDON_EPAM10K_GOLDEN_QNA].name,
        OpenAIEntityAddons[OpenAIEntityAddonID.ADDON_EPAM10K_SEMANTIC_SEARCH]
          .name,
        OpenAIEntityAddons[OpenAIEntityAddonID.ADDON_WOLFRAM].name,
      ]);
  },
);

test('Default model in new chat is always set to GPT-3.5', async ({
  dialHomePage,
  chatBar,
  recentEntities,
  conversationData,
  localStorageManager,
}) => {
  const conversation = conversationData.prepareDefaultConversation(
    OpenAIEntityModels[OpenAIEntityModelID.GPT_4],
  );
  await localStorageManager.setConversationHistory(conversation);
  await localStorageManager.setSelectedConversation(conversation);

  await dialHomePage.openHomePage();
  await chatBar.createNewChat();
  const addonBorderColors = await recentEntities
    .getRecentEntity(OpenAIEntityModels[OpenAIEntityModelID.GPT_3_5_AZ].name)
    .getAllBorderColors();
  Object.values(addonBorderColors).forEach((borders) => {
    borders.forEach((borderColor) => {
      expect
        .soft(borderColor, ExpectedMessages.defaultTalkToIsValid)
        .toBe(Colors.selectedEntity);
    });
  });
});

test('Settings on default screen are saved in local storage when temperature = 0', async ({
  dialHomePage,
  recentEntities,
  entitySettings,
  temperatureSlider,
}) => {
  await dialHomePage.openHomePage();
  await recentEntities.selectEntity(
    OpenAIEntityModels[OpenAIEntityModelID.BISON_001].name,
  );
  const sysPrompt = 'test prompt';
  const temp = 0;
  await entitySettings.setSystemPrompt(sysPrompt);
  await temperatureSlider.setTemperature(temp);
  await dialHomePage.reloadPage();

  const addonBorderColors = await recentEntities
    .getRecentEntity(OpenAIEntityModels[OpenAIEntityModelID.BISON_001].name)
    .getAllBorderColors();
  Object.values(addonBorderColors).forEach((borders) => {
    borders.forEach((borderColor) => {
      expect
        .soft(borderColor, ExpectedMessages.defaultTalkToIsValid)
        .toBe(Colors.selectedEntity);
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
});

test(
  'Default settings for Assistant\n' +
    'Default settings for Assistant. Models list\n' +
    'Default settings for Assistant. Default Addons',
  async ({
    dialHomePage,
    addons,
    recentEntities,
    modelSelector,
    entitySettings,
  }) => {
    await dialHomePage.openHomePage();
    await recentEntities.selectEntity(
      OpenAIEntityModels[OpenAIEntityModelID.ASSISTANT10K].name,
    );

    const selectedModel = await modelSelector.getSelectedModel();
    expect
      .soft(selectedModel, ExpectedMessages.defaultAssistantModelIsValid)
      .toBe(OpenAIEntityModels[OpenAIEntityModelID.GPT_4].name);

    await modelSelector.click();
    const listEntities = await modelSelector.getListOptions();
    const expectedModels = [
      OpenAIEntityModels[OpenAIEntityModelID.GPT_3_5].name,
      OpenAIEntityModels[OpenAIEntityModelID.GPT_4].name,
      OpenAIEntityModels[OpenAIEntityModelID.GPT_4_32K].name,
      OpenAIEntityModels[OpenAIEntityModelID.BISON_001].name,
      OpenAIEntityModels[OpenAIEntityModelID.AMAZON_TITAN_TG1_LARGE].name,
      OpenAIEntityModels[OpenAIEntityModelID.AI21_J2_GRANDE_INSTRUCT].name,
      OpenAIEntityModels[OpenAIEntityModelID.AI21_J2_JUMBO_INSTRUCT].name,
      OpenAIEntityModels[OpenAIEntityModelID.ANTHROPIC_CLAUDE_INSTANT_V1].name,
      OpenAIEntityModels[OpenAIEntityModelID.ANTHROPIC_CLAUDE_V1].name,
      'Anthropic (Claude V2)',
      OpenAIEntityModels[OpenAIEntityModelID.STABILITY_STABLE_DIFFUSION_XL]
        .name,
      'Dolly',
    ];
    expect
      .soft(listEntities, ExpectedMessages.entitiesAreGrouped)
      .toEqual(expectedModels);

    await modelSelector.click();
    const systemPrompt = await entitySettings.systemPrompt.isVisible();
    expect
      .soft(systemPrompt, ExpectedMessages.systemPromptNotVisible)
      .toBeFalsy();

    const expectedAssistantAddons = [
      OpenAIEntityAddons[OpenAIEntityAddonID.ADDON_EPAM10K_SEMANTIC_SEARCH]
        .name,
      OpenAIEntityAddons[OpenAIEntityAddonID.ADDON_EPAM10K_GOLDEN_QNA].name,
    ];
    const assistantAddons = await addons.getSelectedAddons();
    expect
      .soft(assistantAddons, ExpectedMessages.entitiesAreGrouped)
      .toEqual(expectedAssistantAddons);
  },
);
