import { ModelsUtil } from '@/e2e/src/utils/modelsUtil';

import { OpenAIEntityModel } from '@/src/types/openai';

import { DEFAULT_ASSISTANT_SUBMODEL } from '@/src/constants/default-settings';

import test from '../core/fixtures';
import { AddonIds, AssistantIds, ExpectedMessages, Groups } from '../testData';
import { Colors } from '../ui/domData';

import { GeneratorUtil } from '@/e2e/src/utils';
import { expect } from '@playwright/test';

const sysPrompt = 'test prompt';
const temp = 0.8;

let expectedSelectedAddons: OpenAIEntityModel[];
let expectedModels: OpenAIEntityModel[];
let wolframAddon: OpenAIEntityModel;
let presalesSearchAddon: OpenAIEntityModel;
let presalesAssistant: OpenAIEntityModel;

test.beforeAll(async () => {
  expectedSelectedAddons = ModelsUtil.getOpenAIEntitySelectedAddons(
    AssistantIds.ASSISTANT10K,
  );
  expectedModels = ModelsUtil.getModels();
  wolframAddon = ModelsUtil.getAddon(AddonIds.ADDON_WOLFRAM)!;
  presalesSearchAddon = ModelsUtil.getAddon(
    AddonIds.ADDON_EPAM10K_SEMANTIC_SEARCH,
  )!;
  presalesAssistant = ModelsUtil.getAssistant(AssistantIds.ASSISTANT10K)!;
});

test(
  'Check default settings screen for Assistant.\n' +
    'Default settings for Assistant. Models list.\n' +
    'Default settings for Assistant. Default Addons impossible to remove.',
  async ({
    dialHomePage,
    addons,
    recentEntities,
    modelSelector,
    entitySettings,
    talkToSelector,
    temperatureSlider,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-409', 'EPMRTC-410', 'EPMRTC-411');
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    await talkToSelector.selectAssistant(presalesAssistant.name);

    const assistantBorderColors = await recentEntities
      .getRecentEntity(presalesAssistant.name)
      .getAllBorderColors();
    Object.values(assistantBorderColors).forEach((borders) => {
      borders.forEach((borderColor) => {
        expect
          .soft(borderColor, ExpectedMessages.talkToEntityIsSelected)
          .toBe(Colors.highlightedEntity);
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
      .toBe(DEFAULT_ASSISTANT_SUBMODEL.name);

    const selectedAddons = await addons.getSelectedAddons();
    const expectedSelectedAddonNames = expectedSelectedAddons.map(
      (a) => a.name,
    );
    expect
      .soft(selectedAddons, ExpectedMessages.selectedAddonsValid)
      .toEqual(expectedSelectedAddonNames);

    for (const addon of selectedAddons) {
      await addons.removeSelectedAddon(addon);
    }
    expect
      .soft(selectedAddons, ExpectedMessages.cannotDeleteSelectedAddon)
      .toEqual(expectedSelectedAddonNames);

    await modelSelector.click();
    const listEntities = await modelSelector.getListOptions();
    expect
      .soft(listEntities, ExpectedMessages.assistantModelsValid)
      .toEqual(expectedModels.map((m) => m.name));
  },
);

test('Default settings for Assistant are saved in local storage', async ({
  dialHomePage,
  addons,
  recentEntities,
  modelSelector,
  talkToSelector,
  temperatureSlider,
  setTestIds,
}) => {
  setTestIds('EPMRTC-412');
  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
  await talkToSelector.selectAssistant(presalesAssistant.name);
  await modelSelector.click();
  const modelsList = await modelSelector.getListOptions();
  const randomModel = GeneratorUtil.randomArrayElement(modelsList);
  await modelSelector.selectModel(randomModel, true);
  await addons.selectAddon(wolframAddon.name);
  await temperatureSlider.setTemperature(0);
  await dialHomePage.reloadPage();
  await dialHomePage.waitForPageLoaded();

  const assistantBorderColors = await recentEntities
    .getRecentEntity(presalesAssistant.name)
    .getAllBorderColors();
  Object.values(assistantBorderColors).forEach((borders) => {
    borders.forEach((borderColor) => {
      expect
        .soft(borderColor, ExpectedMessages.talkToEntityIsSelected)
        .toBe(Colors.highlightedEntity);
    });
  });

  const temperature = await temperatureSlider.getTemperature();
  expect.soft(temperature, ExpectedMessages.temperatureIsValid).toBe('0');

  const assistantModel = await modelSelector.getSelectedModel();
  expect
    .soft(assistantModel, ExpectedMessages.assistantModelsValid)
    .toBe(randomModel);

  const selectedAddons = await addons.getSelectedAddons();
  if (
    !expectedSelectedAddons.map((a) => a.id).includes(AddonIds.ADDON_WOLFRAM)
  ) {
    expectedSelectedAddons.push(wolframAddon);
  }
  expect
    .soft(selectedAddons, ExpectedMessages.selectedAddonsValid)
    .toEqual(expectedSelectedAddons.map((a) => a.name));
});

test('Selected settings are saved if to switch from Model to Assistant', async ({
  dialHomePage,
  recentEntities,
  entitySettings,
  temperatureSlider,
  addons,
  talkToSelector,
  modelSelector,
  setTestIds,
}) => {
  setTestIds('EPMRTC-414');
  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
  await entitySettings.setSystemPrompt(sysPrompt);
  await temperatureSlider.setTemperature(temp);
  await addons.selectAddon(wolframAddon.name);
  await talkToSelector.selectAssistant(presalesAssistant.name);

  const assistantBorderColors = await recentEntities
    .getRecentEntity(presalesAssistant.name)
    .getAllBorderColors();
  Object.values(assistantBorderColors).forEach((borders) => {
    borders.forEach((borderColor) => {
      expect
        .soft(borderColor, ExpectedMessages.talkToEntityIsSelected)
        .toBe(Colors.highlightedEntity);
    });
  });

  const isSystemPromptVisible = await entitySettings.systemPrompt.isVisible();
  expect
    .soft(isSystemPromptVisible, ExpectedMessages.systemPromptNotVisible)
    .toBeFalsy();

  const temperature = await temperatureSlider.getTemperature();
  expect
    .soft(temperature, ExpectedMessages.temperatureIsValid)
    .toBe(temp.toString());

  const assistantModel = await modelSelector.getSelectedModel();
  expect
    .soft(assistantModel, ExpectedMessages.defaultAssistantModelIsValid)
    .toBe(DEFAULT_ASSISTANT_SUBMODEL.name);

  const selectedAddons = await addons.getSelectedAddons();
  if (
    !expectedSelectedAddons.map((a) => a.id).includes(AddonIds.ADDON_WOLFRAM)
  ) {
    expectedSelectedAddons.push(wolframAddon);
  }
  expect
    .soft(selectedAddons, ExpectedMessages.selectedAddonsValid)
    .toEqual(expectedSelectedAddons.map((a) => a.name));
});

test('Selected settings are saved if to switch from Model to Assistant to Model. Addon is not set in model2 if it was added as preselected in Assistant.', async ({
  dialHomePage,
  entitySettings,
  temperatureSlider,
  addons,
  talkToSelector,
  modelSelector,
  setTestIds,
}) => {
  setTestIds('EPMRTC-415');
  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
  const assistantTemp = 0.5;
  await entitySettings.setSystemPrompt(sysPrompt);
  await temperatureSlider.setTemperature(temp);
  await addons.selectAddon(wolframAddon.name);
  await talkToSelector.selectAssistant(presalesAssistant.name);

  const randomAssistantModel = GeneratorUtil.randomArrayElement(expectedModels);
  await modelSelector.selectModel(randomAssistantModel.name);
  await temperatureSlider.setTemperature(assistantTemp);

  let selectedAddons = await addons.getSelectedAddons();
  if (
    !expectedSelectedAddons.map((a) => a.id).includes(AddonIds.ADDON_WOLFRAM)
  ) {
    expectedSelectedAddons.push(wolframAddon);
  }
  expect
    .soft(selectedAddons, ExpectedMessages.selectedAddonsValid)
    .toEqual(expectedSelectedAddons.map((a) => a.name));

  const randomTalkToModel = GeneratorUtil.randomArrayElement(expectedModels);
  await talkToSelector.selectModel(randomTalkToModel.name);

  const systemPrompt = await entitySettings.getSystemPrompt();
  expect
    .soft(systemPrompt, ExpectedMessages.systemPromptIsValid)
    .toBe(sysPrompt);

  const temperature = await temperatureSlider.getTemperature();
  expect
    .soft(temperature, ExpectedMessages.temperatureIsValid)
    .toBe(assistantTemp.toString());

  selectedAddons = await addons.getSelectedAddons();
  expectedSelectedAddons = ModelsUtil.getOpenAIEntitySelectedAddons(
    randomTalkToModel.id,
  );
  if (
    !expectedSelectedAddons.map((a) => a.id).includes(AddonIds.ADDON_WOLFRAM)
  ) {
    expectedSelectedAddons.push(wolframAddon);
  }
  expect
    .soft(selectedAddons, ExpectedMessages.selectedAddonsValid)
    .toEqual(expectedSelectedAddons.map((a) => a.name));
});

test('Selected settings are saved if to switch from Model to Assistant to Model. Addon stays selected in model2 if it was added by user.', async ({
  dialHomePage,
  entitySettings,
  temperatureSlider,
  addons,
  talkToSelector,
  setTestIds,
}) => {
  setTestIds('EPMRTC-1047');
  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
  await entitySettings.setSystemPrompt(sysPrompt);
  await temperatureSlider.setTemperature(temp);
  await addons.selectAddon(presalesSearchAddon.name);
  await addons.selectAddon(wolframAddon.name);
  await talkToSelector.selectAssistant(presalesAssistant.name);
  const expectedAssistantAddons = ModelsUtil.getOpenAIEntitySelectedAddons(
    AssistantIds.ASSISTANT10K,
  );
  if (
    !expectedAssistantAddons.map((a) => a.id).includes(AddonIds.ADDON_WOLFRAM)
  ) {
    expectedAssistantAddons.push(wolframAddon);
  }
  if (
    !expectedAssistantAddons
      .map((a) => a.id)
      .includes(AddonIds.ADDON_EPAM10K_SEMANTIC_SEARCH)
  ) {
    expectedAssistantAddons.push(presalesSearchAddon);
  }

  let selectedAddons = await addons.getSelectedAddons();
  expect
    .soft(selectedAddons, ExpectedMessages.selectedAddonsValid)
    .toEqual(expectedAssistantAddons.map((a) => a.name));

  await addons.removeSelectedAddon(wolframAddon.name);

  const randomModel = GeneratorUtil.randomArrayElement(expectedModels);
  await talkToSelector.selectModel(randomModel.name);

  const systemPrompt = await entitySettings.getSystemPrompt();
  expect
    .soft(systemPrompt, ExpectedMessages.systemPromptIsValid)
    .toBe(sysPrompt);

  const temperature = await temperatureSlider.getTemperature();
  expect
    .soft(temperature, ExpectedMessages.temperatureIsValid)
    .toBe(temp.toString());

  const expectedAddons = ModelsUtil.getOpenAIEntitySelectedAddons(
    randomModel.id,
  );
  if (
    !expectedAddons
      .map((a) => a.id)
      .includes(AddonIds.ADDON_EPAM10K_SEMANTIC_SEARCH)
  ) {
    expectedAddons.push(presalesSearchAddon);
  }
  selectedAddons = await addons.getSelectedAddons();
  expect
    .soft(selectedAddons, ExpectedMessages.selectedAddonsValid)
    .toEqual(expectedAddons.map((a) => a.name));
});

test('Selected settings are saved if to switch from Assistant to Application to Assistant', async ({
  dialHomePage,
  entitySettings,
  temperatureSlider,
  addons,
  talkToSelector,
  modelSelector,
  setIssueIds,
  setTestIds,
}) => {
  setTestIds('EPMRTC-418');
  setIssueIds('105');
  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
  await talkToSelector.selectAssistant(presalesAssistant.name);
  const randomModel = GeneratorUtil.randomArrayElement(expectedModels);
  await modelSelector.selectModel(randomModel.name);
  await temperatureSlider.setTemperature(temp);
  await addons.selectAddon(wolframAddon.name);

  const randomApp = GeneratorUtil.randomArrayElement(
    ModelsUtil.getApplications(),
  );
  await talkToSelector.selectApplication(randomApp.name);
  await talkToSelector.selectAssistant(presalesAssistant.name);

  const assistantModel = await modelSelector.getSelectedModel();
  expect
    .soft(assistantModel, ExpectedMessages.defaultAssistantModelIsValid)
    .toBe(randomModel);

  const isSystemPromptVisible = await entitySettings.systemPrompt.isVisible();
  expect
    .soft(isSystemPromptVisible, ExpectedMessages.systemPromptNotVisible)
    .toBeFalsy();

  const temperature = await temperatureSlider.getTemperature();
  expect
    .soft(temperature, ExpectedMessages.temperatureIsValid)
    .toBe(temp.toString());

  const selectedAddons = await addons.getSelectedAddons();
  const expectedSelectedAddons = ModelsUtil.getOpenAIEntitySelectedAddons(
    randomModel.id,
  );
  if (
    !expectedSelectedAddons.map((a) => a.id).includes(AddonIds.ADDON_WOLFRAM)
  ) {
    expectedSelectedAddons.push(wolframAddon);
  }
  expect
    .soft(selectedAddons, ExpectedMessages.selectedAddonsValid)
    .toEqual(expectedSelectedAddons);
});

test(
  'Assistant has short description on See full list.\n' +
    'Assistant has detailed description on See full list',
  async ({
    dialHomePage,
    recentEntities,
    talkToSelector,
    modelsDialog,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1122', 'EPMRTC-1123');
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    await talkToSelector.seeFullList();

    const expectedAssistant = presalesAssistant;
    const assistantDialogDescription =
      await modelsDialog.getEntityOptionDescription(
        Groups.assistants,
        presalesAssistant.name,
      );
    expect
      .soft(
        expectedAssistant!.description!.includes(assistantDialogDescription!),
        ExpectedMessages.entityHasDescription,
      )
      .toBeTruthy();

    await modelsDialog.expandEntityDescription(
      Groups.assistants,
      presalesAssistant.name,
    );
    const isAssistantDescrFullWidth =
      await modelsDialog.isEntityDescriptionFullWidth(
        Groups.assistants,
        presalesAssistant.name,
      );
    expect
      .soft(
        isAssistantDescrFullWidth,
        ExpectedMessages.entityDescriptionHasFullWidth,
      )
      .toBeTruthy();

    await modelsDialog.selectGroupEntity(
      presalesAssistant.name,
      Groups.assistants,
    );
    const assistantDescription =
      await recentEntities.getRecentEntityDescription(presalesAssistant.name);
    expect
      .soft(
        expectedAssistant!.description!.includes(assistantDescription),
        ExpectedMessages.entityHasDescription,
      )
      .toBeTruthy();
  },
);
