import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';

let defaultModel: DialAIEntityModel;

dialTest.beforeAll(async () => {
  defaultModel = ModelsUtil.getDefaultAgent()!;
});

dialTest(
  'Model settings opened in chat are the same as on New chat defaults',
  async ({
    dialHomePage,
    chatHeader,
    agentSettingAssertion,
    talkToAgentDialog,
    setTestIds,
    conversationData,
    localStorageManager,
    dataInjector,
    conversations,
  }) => {
    setTestIds('EPMDIAL-5968');
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
        await localStorageManager.setRecentModelsIdsAndUseLastModel(
          randomModel,
        );
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Open conversation settings and change model',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(conversation.name);
        await chatHeader.chatAgent.click();
        await talkToAgentDialog.selectAgent(randomModel);
        await talkToAgentDialog.waitForState({ state: 'hidden' });
      },
    );

    await dialTest.step(
      'Verify conversation settings are the same as for initial model',
      async () => {
        await chatHeader.openConversationSettingsPopup();
        if (ModelsUtil.doesModelAllowSystemPrompt(randomModel)) {
          await agentSettingAssertion.assertSystemPromptValue(
            conversation.prompt,
          );
        }
        if (ModelsUtil.doesModelAllowTemperature(randomModel)) {
          await agentSettingAssertion.assertTemperature(
            conversation.temperature.toString(),
          );
        }
      },
    );
  },
);
