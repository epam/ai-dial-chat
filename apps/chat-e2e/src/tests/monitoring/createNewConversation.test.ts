import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MockedChatApiResponseBodies,
} from '@/src/testData';
import { ModelsUtil } from '@/src/utils';

let defaultModel: DialAIEntityModel;
let recentModelIds: string[];
let recentAddonIds: string[];
let allEntities: DialAIEntityModel[];

dialTest.beforeAll(async () => {
  defaultModel = ModelsUtil.getDefaultAgent()!;
  recentModelIds = ModelsUtil.getRecentModelIds();
  allEntities = ModelsUtil.getOpenAIEntities();
  recentAddonIds = ModelsUtil.getRecentAddonIds();
});

dialTest(
  'Create new conversation and send new message',
  async ({
    dialHomePage,
    conversationAssertion,
    temperatureSlider,
    chat,
    chatMessagesAssertion,
    agentSettingAssertion,
    talkToAgents,
    talkToAgentDialogAssertion,
    talkToAgentDialog,
    conversationSettingsModal,
    addons,
    localStorageManager,
  }) => {
    const expectedAddons = ModelsUtil.getAddons();
    const request = 'test request';

    await dialTest.step(
      'Verify the list of recent entities and default settings for default model',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await chat.changeAgentButton.click();

        const expectedDefaultRecentEntities = [];
        for (const entity of recentModelIds) {
          expectedDefaultRecentEntities.push(
            allEntities.find((e) => e.id === entity)!.name,
          );
        }
        await talkToAgentDialogAssertion.assertElementInnerText(
          talkToAgents.agentNames,
          expectedDefaultRecentEntities,
          ExpectedMessages.recentEntitiesVisible,
        );
        await talkToAgentDialog.cancelButton.click();

        await chat.configureSettingsButton.click();
        await agentSettingAssertion.assertSystemPromptValue(
          ExpectedConstants.emptyString,
        );
        await agentSettingAssertion.assertElementText(
          temperatureSlider.slider,
          ExpectedConstants.defaultTemperature,
          ExpectedMessages.defaultTemperatureIsOne,
        );
        await agentSettingAssertion.assertElementInnerText(
          addons.selectedAddons,
          defaultModel.selectedAddons ?? [],
          ExpectedMessages.noAddonsSelected,
        );

        const expectedDefaultRecentAddons = [];
        for (const addonId of recentAddonIds) {
          expectedDefaultRecentAddons.push(
            expectedAddons.find((a) => a.id === addonId)?.name || addonId,
          );
        }
        await agentSettingAssertion.assertElementInnerText(
          addons.recentAddons,
          expectedDefaultRecentAddons,
          ExpectedMessages.recentAddonsVisible,
        );
        await conversationSettingsModal.cancelButton.click();
      },
    );

    await dialTest.step(
      'Send request to chat and verify response received',
      async () => {
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequestWithKeyboard(request);
        await chatMessagesAssertion.assertMessagesCount(2);
      },
    );

    await dialTest.step(
      'Verify new conversation is moved under Today section in chat bar',
      async () => {
        await conversationAssertion.assertEntitiesCount(1);
        await conversationAssertion.assertEntityState(
          { name: request },
          'visible',
        );
      },
    );
  },
);
