import {
  OpenAIEntityAddonID,
  OpenAIEntityAddons,
  OpenAIEntityModelID,
  OpenAIEntityModels,
} from '@/src/types/openai';

import test from '../core/fixtures';
import { ExpectedConstants, ExpectedMessages } from '../testData';
import { Colors } from '../ui/domData';

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
  }) => {
    await dialHomePage.openHomePage();
    await chatBar.createNewConversation();
    expect
      .soft(
        await conversations
          .getConversationByName(ExpectedConstants.newConversationTitle)
          .isVisible(),
        ExpectedMessages.newConversationCreated,
      )
      .toBeTruthy();
    const todayConversations = await conversations.getTodayConversations();
    expect
      .soft(
        todayConversations.includes(ExpectedConstants.newConversationTitle),
        ExpectedMessages.conversationOfToday,
      )
      .toBeTruthy();

    const modelBorderColors = await recentEntities
      .getRecentEntity(OpenAIEntityModels[OpenAIEntityModelID.GPT_3_5_AZ].name)
      .getAllBorderColors();
    Object.values(modelBorderColors).forEach((borders) => {
      borders.forEach((borderColor) => {
        expect
          .soft(borderColor, ExpectedMessages.defaultTalkToIsValid)
          .toBe(Colors.selectedEntity);
      });
    });

    const recentTalkTo = await recentEntities.getRecentEntityNames();
    expect
      .soft(recentTalkTo, ExpectedMessages.recentEntitiesVisible)
      .toEqual([
        OpenAIEntityModels[OpenAIEntityModelID.GPT_3_5_AZ].name,
        OpenAIEntityModels[OpenAIEntityModelID.GPT_4].name,
        ExpectedConstants.askEpamPresaleApp,
        OpenAIEntityModels[OpenAIEntityModelID.GPT_WORLD].name,
        OpenAIEntityModels[OpenAIEntityModelID.MIRROR].name,
      ]);

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

    const recentAddons = await addons.getRecentAddons();
    expect
      .soft(recentAddons, ExpectedMessages.recentAddonsVisible)
      .toEqual([
        ExpectedConstants.epamPresalesFAQAddon,
        ExpectedConstants.epamPresalesSearchAddon,
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
  await chatBar.createNewConversation();
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
    OpenAIEntityModels[OpenAIEntityModelID.GPT_4].name,
  );
  const sysPrompt = 'test prompt';
  const temp = 0;
  await entitySettings.setSystemPrompt(sysPrompt);
  await temperatureSlider.setTemperature(temp);
  await dialHomePage.reloadPage();

  const modelBorderColors = await recentEntities
    .getRecentEntity(OpenAIEntityModels[OpenAIEntityModelID.GPT_4].name)
    .getAllBorderColors();
  Object.values(modelBorderColors).forEach((borders) => {
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

// TODO: fix test
test.skip(
  'Default settings for Assistant\n' +
    'Default settings for Assistant. Models list\n' +
    'Default settings for Assistant. Default Addons impossible to remove',
  async ({
    dialHomePage,
    addons,
    recentEntities,
    modelSelector,
    entitySettings,
    talkToSelector,
    modelsDialog,
    temperatureSlider,
  }) => {
    await dialHomePage.openHomePage();
    await talkToSelector.seeFullList();
    await modelsDialog.selectAssistant(ExpectedConstants.presalesAssistant);

    const assistantBorderColors = await recentEntities
      .getRecentEntity(ExpectedConstants.presalesAssistant)
      .getAllBorderColors();
    Object.values(assistantBorderColors).forEach((borders) => {
      borders.forEach((borderColor) => {
        expect
          .soft(borderColor, ExpectedMessages.defaultTalkToIsValid)
          .toBe(Colors.selectedEntity);
      });
    });

    const isSystemPromptVisible = await entitySettings.systemPrompt.isVisible();
    expect
      .soft(isSystemPromptVisible, ExpectedMessages.systemPromptNotVisible)
      .toBeFalsy();

    const isTemperatureSliderVisible = await temperatureSlider.isVisible();
    expect
      .soft(
        isTemperatureSliderVisible,
        ExpectedMessages.temperatureSliderVisible,
      )
      .toBeTruthy();

    const assistantModel = await modelSelector.getSelectedModel();
    expect
      .soft(assistantModel, ExpectedMessages.defaultAssistantModelIsValid)
      .toBe(OpenAIEntityModels[OpenAIEntityModelID.GPT_4].name);

    const selectedAddons = await addons.getSelectedAddons();
    expect
      .soft(selectedAddons, ExpectedMessages.noAddonsSelected)
      .toEqual([
        ExpectedConstants.epamPresalesSearchAddon,
        ExpectedConstants.epamPresalesFAQAddon,
      ]);
    for (const addon of selectedAddons) {
      expect
        .soft(
          await addons.isAddonRemovable(addon),
          ExpectedMessages.cannotDeleteSelectedAddon,
        )
        .toBeFalsy();
    }

    await modelSelector.click();
    const listEntities = await modelSelector.getListOptions();
    const expectedModels = [
      OpenAIEntityModels[OpenAIEntityModelID.GPT_3_5_AZ].name,
      OpenAIEntityModels[OpenAIEntityModelID.GPT_4].name,
      OpenAIEntityModels[OpenAIEntityModelID.GPT_4_32K].name,
      OpenAIEntityModels[OpenAIEntityModelID.BISON_001].name,
      OpenAIEntityModels[OpenAIEntityModelID.AMAZON_TITAN_TG1_LARGE].name,
      OpenAIEntityModels[OpenAIEntityModelID.AI21_J2_GRANDE_INSTRUCT].name,
      OpenAIEntityModels[OpenAIEntityModelID.AI21_J2_JUMBO_INSTRUCT].name,
      OpenAIEntityModels[OpenAIEntityModelID.ANTHROPIC_CLAUDE_INSTANT_V1].name,
      OpenAIEntityModels[OpenAIEntityModelID.ANTHROPIC_CLAUDE_V1].name,
      ExpectedConstants.anthropicCloudV2Model,
      OpenAIEntityModels[OpenAIEntityModelID.STABILITY_STABLE_DIFFUSION_XL]
        .name,
      ExpectedConstants.dollyModel,
      ExpectedConstants.llama2,
    ];
    expect
      .soft(listEntities, ExpectedMessages.assistantModelsValid)
      .toEqual(expectedModels);
  },
);
