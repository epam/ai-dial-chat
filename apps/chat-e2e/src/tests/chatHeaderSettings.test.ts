import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import { ExpectedMessages } from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

let defaultModel: DialAIEntityModel;

dialTest.beforeAll(async () => {
  defaultModel = ModelsUtil.getDefaultModel()!;
});

//need to update the test
dialTest.skip(
  'Model settings opened in chat are the same as on New chat defaults',
  async ({
    dialHomePage,
    chatHeader,
    entitySettings,
    temperatureSlider,
    addons,
    talkToSelector,
    marketplacePage,
    setTestIds,
    conversationData,
    localStorageManager,
    dataInjector,
  }) => {
    setTestIds('EPMRTC-449');
    let conversation: Conversation;
    const allModels = ModelsUtil.getLatestModels();
    const randomModel = GeneratorUtil.randomArrayElement(
      allModels.filter((m) => m.id !== defaultModel.id),
    );

    await dialTest.step(
      'Prepare conversation with default model and settings',
      async () => {
        conversation = conversationData.prepareDefaultConversation();
        await dataInjector.createConversations([conversation]);
        await localStorageManager.setSelectedConversation(conversation);
        await localStorageManager.setRecentModelsIds(randomModel);
      },
    );

    await dialTest.step(
      'Open conversation settings and change model',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await chatHeader.openConversationSettingsPopup();
        await talkToSelector.selectEntity(randomModel, marketplacePage);
      },
    );

    await dialTest.step(
      'Verify conversation settings are the same as for initial model',
      async () => {
        if (randomModel.features?.systemPrompt) {
          const systemPrompt = await entitySettings.getSystemPrompt();
          expect
            .soft(systemPrompt, ExpectedMessages.defaultSystemPromptIsEmpty)
            .toBe(conversation.prompt);
        }
        const temperature = await temperatureSlider.getTemperature();
        expect
          .soft(temperature, ExpectedMessages.defaultTemperatureIsOne)
          .toBe(conversation.temperature.toString());
        const modelAddons = defaultModel.selectedAddons ?? [];
        const selectedAddons = await addons.getSelectedAddons();
        expect
          .soft(selectedAddons, ExpectedMessages.noAddonsSelected)
          .toEqual(modelAddons);
      },
    );
  },
);
