import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import { ExpectedMessages } from '@/src/testData';
import { Colors } from '@/src/ui/domData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

const sysPrompt = 'test prompt';
const temp = 0.8;

let models: DialAIEntityModel[];
let defaultModel: DialAIEntityModel;

dialTest.beforeAll(async () => {
  models = ModelsUtil.getLatestModels();
  defaultModel = ModelsUtil.getDefaultModel()!;
});

//need to update the test
dialTest.skip(
  'Selected settings are saved if to switch from Model1 to Model2',
  async ({
    dialHomePage,
    entitySettings,
    temperatureSlider,
    addons,
    setTestIds,
    talkToSelector,
    marketplacePage,
    talkToEntities,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-1046');
    const randomModel = GeneratorUtil.randomArrayElement(
      models.filter(
        (m) => m.id !== defaultModel.id && m.features?.systemPrompt === true,
      ),
    );
    await localStorageManager.setRecentModelsIds(randomModel);
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });

    await talkToSelector.selectEntity(randomModel, marketplacePage);
    await talkToEntities.waitForTalkToEntitySelected(randomModel);
    await entitySettings.setSystemPrompt(sysPrompt);
    await temperatureSlider.setTemperature(temp);

    const modelBorderColors = await talkToEntities
      .getTalkToEntity(randomModel)
      .getAllBorderColors();
    Object.values(modelBorderColors).forEach((borders) => {
      borders.forEach((borderColor) => {
        expect
          .soft(borderColor, ExpectedMessages.talkToEntityIsSelected)
          .toBe(Colors.controlsBackgroundAccent);
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
      .toEqual([]);
  },
);

dialTest(
  'System prompt contains combinations with :',
  async ({ dialHomePage, entitySettings, setTestIds }) => {
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
  },
);
