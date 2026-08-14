import { EntityType } from '@/chat/types/common';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import { ExpectedMessages } from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

const sysPrompt = 'test prompt';
const temp = 0.8;

let models: DialAIEntityModel[];
let defaultModel: DialAIEntityModel;

dialTest.beforeAll(async () => {
  models = ModelsUtil.getLatestModels();
  defaultModel = ModelsUtil.getDefaultAgent()!;
});

dialTest(
  'Selected settings are saved if to switch from Model1 to Model2',
  async ({
    dialHomePage,
    agentSettings,
    conversationSettingsModal,
    temperatureSlider,
    setTestIds,
    talkToAgentDialog,
    chat,
    agentSettingAssertion,
    localStorageManager,
  }) => {
    setTestIds('EPMDIAL-5707');
    const randomModel = GeneratorUtil.randomArrayElement(
      models.filter(
        (m) =>
          m.id !== defaultModel.id &&
          ModelsUtil.doesModelAllowSystemPrompt(m) &&
          ModelsUtil.doesModelAllowTemperature(m),
      ),
    );
    await localStorageManager.setRecentModelsIdsAndUseLastModel(
      defaultModel,
      randomModel,
    );
    await localStorageManager.setShowSideBarPanels();
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();

    await chat.configureSettingsButton.click();
    if (
      defaultModel.type === EntityType.Model &&
      ModelsUtil.doesModelAllowSystemPrompt(defaultModel)
    ) {
      await agentSettings.setSystemPrompt(sysPrompt);
    }
    if (
      defaultModel.type === EntityType.Model &&
      ModelsUtil.doesModelAllowTemperature(defaultModel)
    ) {
      await temperatureSlider.setTemperature(temp);
    }
    // no conversation exists yet, and neither setting is guaranteed to have
    // changed above — no PUT is guaranteed to fire
    await conversationSettingsModal.applyChanges({ waitForUpdate: false });

    await chat.changeAgentButton.click();
    await talkToAgentDialog.selectAgent(randomModel, {
      isHttpMethodTriggered: false,
    });

    await chat.configureSettingsButton.click();
    if (
      defaultModel.type === EntityType.Model &&
      ModelsUtil.doesModelAllowSystemPrompt(defaultModel)
    ) {
      await agentSettingAssertion.assertSystemPromptValue(sysPrompt);
    }
    if (
      defaultModel.type === EntityType.Model &&
      ModelsUtil.doesModelAllowTemperature(defaultModel)
    ) {
      const temperature = await temperatureSlider.getTemperature();
      expect
        .soft(temperature, ExpectedMessages.temperatureIsValid)
        .toBe(temp.toString());
    }
  },
);

dialTest(
  'System prompt contains combinations with :',
  async ({
    dialHomePage,
    agentSettings,
    agentSettingAssertion,
    chat,
    setTestIds,
    localStorageManager,
  }) => {
    setTestIds('EPMDIAL-5710');
    const prompts = [
      'test:',
      'test. test:',
      'test :',
      ' test:',
      'test test. test:',
    ];
    await localStorageManager.setShowSideBarPanels();
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await chat.configureSettingsButton.click();
    for (const prompt of prompts) {
      await agentSettings.setSystemPrompt(prompt);
      await agentSettingAssertion.assertSystemPromptValue(prompt);
      await agentSettings.clearSystemPrompt();
    }
  },
);
