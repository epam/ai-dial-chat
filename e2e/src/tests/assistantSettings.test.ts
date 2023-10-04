import { OpenAIEntityAddonID, OpenAIEntityAddons } from '@/src/types/openai';

import test from '../core/fixtures';
import { ExpectedConstants, ExpectedMessages, Groups } from '../testData';
import { Colors } from '../ui/domData';

import { GeneratorUtil } from '@/e2e/src/utils';
import { DEFAULT_ASSISTANT_SUBMODEL } from '@/src/constants/default-settings';
import { expect } from '@playwright/test';

const sysPrompt = 'test prompt';
const temp = 0.8;

let expectedSelectedAddons: string[];
let expectedModels: string[];
test.beforeAll(async ({ apiHelper }) => {
  expectedSelectedAddons = await apiHelper.getEntitySelectedAddons(
    ExpectedConstants.presalesAssistant,
  );
  expectedModels = await apiHelper.getModelNames();
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
    await dialHomePage.waitForPageLoaded(true);
    await talkToSelector.selectAssistant(ExpectedConstants.presalesAssistant);

    const assistantBorderColors = await recentEntities
      .getRecentEntity(ExpectedConstants.presalesAssistant)
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
    expect
      .soft(selectedAddons, ExpectedMessages.selectedAddonsValid)
      .toEqual(expectedSelectedAddons);

    for (const addon of selectedAddons) {
      await addons.removeSelectedAddon(addon);
    }
    expect
      .soft(selectedAddons, ExpectedMessages.cannotDeleteSelectedAddon)
      .toEqual(expectedSelectedAddons);

    await modelSelector.click();
    const listEntities = await modelSelector.getListOptions();
    expect
      .soft(listEntities, ExpectedMessages.assistantModelsValid)
      .toEqual(expectedModels);
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
  await dialHomePage.waitForPageLoaded(true);
  await talkToSelector.selectAssistant(ExpectedConstants.presalesAssistant);
  await modelSelector.click();
  const modelsList = await modelSelector.getListOptions();
  const randomModel = GeneratorUtil.randomArrayElement(modelsList);
  await modelSelector.selectModel(randomModel, true);
  await addons.selectAddon(
    OpenAIEntityAddons[OpenAIEntityAddonID.ADDON_WOLFRAM].name,
  );
  await temperatureSlider.setTemperature(0);
  await dialHomePage.reloadPage();
  await dialHomePage.waitForPageLoaded();

  const assistantBorderColors = await recentEntities
    .getRecentEntity(ExpectedConstants.presalesAssistant)
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
  const expectedAddons = expectedSelectedAddons;
  if (
    !expectedAddons.includes(
      OpenAIEntityAddons[OpenAIEntityAddonID.ADDON_WOLFRAM].name,
    )
  ) {
    expectedAddons.push(
      OpenAIEntityAddons[OpenAIEntityAddonID.ADDON_WOLFRAM].name,
    );
  }
  expect
    .soft(selectedAddons, ExpectedMessages.selectedAddonsValid)
    .toEqual(expectedAddons);
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
  await dialHomePage.waitForPageLoaded(true);
  await entitySettings.setSystemPrompt(sysPrompt);
  await temperatureSlider.setTemperature(temp);
  await addons.selectAddon(
    OpenAIEntityAddons[OpenAIEntityAddonID.ADDON_WOLFRAM].name,
  );
  await talkToSelector.selectAssistant(ExpectedConstants.presalesAssistant);

  const assistantBorderColors = await recentEntities
    .getRecentEntity(ExpectedConstants.presalesAssistant)
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
  const expectedAddons = expectedSelectedAddons;
  if (
    !expectedAddons.includes(
      OpenAIEntityAddons[OpenAIEntityAddonID.ADDON_WOLFRAM].name,
    )
  ) {
    expectedAddons.push(
      OpenAIEntityAddons[OpenAIEntityAddonID.ADDON_WOLFRAM].name,
    );
  }
  expect
    .soft(selectedAddons, ExpectedMessages.selectedAddonsValid)
    .toEqual(expectedAddons);
});

test('Selected settings are saved if to switch from Model to Assistant to Model. Addon is not set in model2 if it was added as preselected in Assistant.', async ({
  dialHomePage,
  entitySettings,
  temperatureSlider,
  addons,
  talkToSelector,
  modelSelector,
  setTestIds,
  apiHelper,
}) => {
  setTestIds('EPMRTC-415');
  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded(true);
  const assistantTemp = 0.5;
  await entitySettings.setSystemPrompt(sysPrompt);
  await temperatureSlider.setTemperature(temp);
  await addons.selectAddon(
    OpenAIEntityAddons[OpenAIEntityAddonID.ADDON_WOLFRAM].name,
  );
  await talkToSelector.selectAssistant(ExpectedConstants.presalesAssistant);

  const randomAssistantModel = GeneratorUtil.randomArrayElement(expectedModels);
  await modelSelector.selectModel(randomAssistantModel);
  await temperatureSlider.setTemperature(assistantTemp);

  let selectedAddons = await addons.getSelectedAddons();
  let expectedAddons = expectedSelectedAddons;
  if (
    !expectedAddons.includes(
      OpenAIEntityAddons[OpenAIEntityAddonID.ADDON_WOLFRAM].name,
    )
  ) {
    expectedAddons.push(
      OpenAIEntityAddons[OpenAIEntityAddonID.ADDON_WOLFRAM].name,
    );
  }
  expect
    .soft(selectedAddons, ExpectedMessages.selectedAddonsValid)
    .toEqual(expectedAddons);

  const randomTalkToModel = GeneratorUtil.randomArrayElement(expectedModels);
  await talkToSelector.selectModel(randomTalkToModel);

  const systemPrompt = await entitySettings.getSystemPrompt();
  expect
    .soft(systemPrompt, ExpectedMessages.systemPromptIsValid)
    .toBe(sysPrompt);

  const temperature = await temperatureSlider.getTemperature();
  expect
    .soft(temperature, ExpectedMessages.temperatureIsValid)
    .toBe(assistantTemp.toString());

  selectedAddons = await addons.getSelectedAddons();
  expectedAddons = await apiHelper.getEntitySelectedAddons(randomTalkToModel);
  if (
    !expectedAddons.includes(
      OpenAIEntityAddons[OpenAIEntityAddonID.ADDON_WOLFRAM].name,
    )
  ) {
    expectedAddons.push(
      OpenAIEntityAddons[OpenAIEntityAddonID.ADDON_WOLFRAM].name,
    );
  }
  expect
    .soft(selectedAddons, ExpectedMessages.selectedAddonsValid)
    .toEqual(expectedAddons);
});

test('Selected settings are saved if to switch from Model to Assistant to Model. Addon stays selected in model2 if it was added by user.', async ({
  dialHomePage,
  entitySettings,
  temperatureSlider,
  addons,
  talkToSelector,
  setTestIds,
  apiHelper,
}) => {
  setTestIds('EPMRTC-1047');
  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded(true);
  await entitySettings.setSystemPrompt(sysPrompt);
  await temperatureSlider.setTemperature(temp);
  await addons.selectAddon(ExpectedConstants.epamPresalesSearchAddon);
  await addons.selectAddon(
    OpenAIEntityAddons[OpenAIEntityAddonID.ADDON_WOLFRAM].name,
  );
  await talkToSelector.selectAssistant(ExpectedConstants.presalesAssistant);
  const expectedAssistantAddons = await apiHelper.getEntitySelectedAddons(
    ExpectedConstants.presalesAssistant,
  );
  if (
    !expectedAssistantAddons.includes(
      OpenAIEntityAddons[OpenAIEntityAddonID.ADDON_WOLFRAM].name,
    )
  ) {
    expectedAssistantAddons.push(
      OpenAIEntityAddons[OpenAIEntityAddonID.ADDON_WOLFRAM].name,
    );
  }
  if (
    !expectedAssistantAddons.includes(ExpectedConstants.epamPresalesSearchAddon)
  ) {
    expectedAssistantAddons.push(ExpectedConstants.epamPresalesSearchAddon);
  }

  let selectedAddons = await addons.getSelectedAddons();
  expect
    .soft(selectedAddons, ExpectedMessages.selectedAddonsValid)
    .toEqual(expectedAssistantAddons);

  await addons.removeSelectedAddon(
    OpenAIEntityAddons[OpenAIEntityAddonID.ADDON_WOLFRAM].name,
  );

  const randomModel = GeneratorUtil.randomArrayElement(expectedModels);
  await talkToSelector.selectModel(randomModel);

  const systemPrompt = await entitySettings.getSystemPrompt();
  expect
    .soft(systemPrompt, ExpectedMessages.systemPromptIsValid)
    .toBe(sysPrompt);

  const temperature = await temperatureSlider.getTemperature();
  expect
    .soft(temperature, ExpectedMessages.temperatureIsValid)
    .toBe(temp.toString());

  const expectedAddons = await apiHelper.getEntitySelectedAddons(randomModel);
  if (!expectedAddons.includes(ExpectedConstants.epamPresalesSearchAddon)) {
    expectedAddons.push(ExpectedConstants.epamPresalesSearchAddon);
  }
  selectedAddons = await addons.getSelectedAddons();
  expect
    .soft(selectedAddons, ExpectedMessages.selectedAddonsValid)
    .toEqual(expectedAddons);
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
  apiHelper,
}) => {
  setTestIds('EPMRTC-418');
  setIssueIds('105');
  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded(true);
  await talkToSelector.selectAssistant(ExpectedConstants.presalesAssistant);
  const randomModel = GeneratorUtil.randomArrayElement(expectedModels);
  await modelSelector.selectModel(randomModel);
  await temperatureSlider.setTemperature(temp);
  await addons.selectAddon(
    OpenAIEntityAddons[OpenAIEntityAddonID.ADDON_WOLFRAM].name,
  );

  const randomApp = GeneratorUtil.randomArrayElement(
    await apiHelper.getApplicationNames(),
  );
  await talkToSelector.selectApplication(randomApp);
  await talkToSelector.selectAssistant(ExpectedConstants.presalesAssistant);

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
  const expectedSelectedAddons = await apiHelper.getEntitySelectedAddons(
    randomModel,
  );
  if (
    !expectedSelectedAddons.includes(
      OpenAIEntityAddons[OpenAIEntityAddonID.ADDON_WOLFRAM].name,
    )
  ) {
    expectedSelectedAddons.push(
      OpenAIEntityAddons[OpenAIEntityAddonID.ADDON_WOLFRAM].name,
    );
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
    apiHelper,
  }) => {
    setTestIds('EPMRTC-1122', 'EPMRTC-1123');
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded(true);
    await talkToSelector.seeFullList();

    const expectedAssistant = await apiHelper.getAssistant(
      ExpectedConstants.presalesAssistant,
    );
    const assistantDialogDescription = await modelsDialog
      .entityOptionDescription(
        Groups.assistants,
        ExpectedConstants.presalesAssistant,
      )
      .innerText();
    expect
      .soft(
        expectedAssistant!.description!.includes(assistantDialogDescription),
        ExpectedMessages.entityHasDescription,
      )
      .toBeTruthy();

    await modelsDialog.expandEntityDescription(
      Groups.assistants,
      ExpectedConstants.presalesAssistant,
    );
    const isAssistantDescrFullWidth =
      await modelsDialog.isEntityDescriptionFullWidth(
        Groups.assistants,
        ExpectedConstants.presalesAssistant,
      );
    expect
      .soft(
        isAssistantDescrFullWidth,
        ExpectedMessages.entityDescriptionHasFullWidth,
      )
      .toBeTruthy();

    await modelsDialog.selectGroupEntity(
      ExpectedConstants.presalesAssistant,
      Groups.assistants,
    );
    const assistantDescription =
      await recentEntities.getRecentEntityDescription(
        ExpectedConstants.presalesAssistant,
      );
    expect
      .soft(
        expectedAssistant!.description!.includes(assistantDescription),
        ExpectedMessages.entityHasDescription,
      )
      .toBeTruthy();
  },
);
