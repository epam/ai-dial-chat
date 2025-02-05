import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
} from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';

dialTest.only(
  'Click on + resets all settings on new conversation. Change agent pop-up opens',
  async ({
    dialHomePage,
    header,
    chat,
    agentSettings,
    temperatureSlider,
    addons,
    talkToAgentDialog,
    marketplacePage,
    agentInfoAssertion,
    setTestIds,
    localStorageManager,
    conversationSettingsModal,
    iconApiHelper,
  }) => {
    setTestIds('EPMRTC-4717');
    const models = GeneratorUtil.randomArrayElements(
      ModelsUtil.getLatestModels().filter(
        (m) =>
          ModelsUtil.doesModelAllowSystemPrompt(m) &&
          ModelsUtil.doesModelAllowTemperature(m) &&
          ModelsUtil.doesModelAllowAddons(m) && m.iconUrl !== undefined
      ),
      2,
    );
    const addon = GeneratorUtil.randomArrayElement(ModelsUtil.getAddons());
    await localStorageManager.setRecentModelsIdsOnce(...models);
    await localStorageManager.setRecentAddonsIds(addon);

    await dialTest.step('Open Dial and verify the correct model is selected', async () => {
      await dialHomePage.openHomePage({
        iconsToBeLoaded: [models[0].iconUrl!],
      });
      await dialHomePage.waitForPageLoaded();
      await chat.getSendMessage().waitForState({ state: 'attached' });
    });

      await dialTest.step('Change model and verify the correct model is selected', async () => {
      await chat.changeAgentButton.waitForState();
      await chat.configureSettingsButton.waitForState();
      await chat.changeAgentButton.click();
      await talkToAgentDialog.selectAgent(models[1], marketplacePage);
      const expectedModelIcon = iconApiHelper.getEntityIcon(models[1]);
      await agentInfoAssertion.assertAgentIcon(expectedModelIcon);
    });

    await dialTest.step('Change settings and apply', async () => {
      await chat.configureSettingsButton.click();
      await agentSettings.setSystemPrompt('Act like a cat');
      await temperatureSlider.setTemperature(0);
      await addons.selectAddon(addon.name);
      await conversationSettingsModal.applyChangesButton.click();
    });

    await dialTest.step(
      'Click on + button and verify agent selection popup is opened',
      async () => {
        await header.createNewConversation();
        await talkToAgentDialog.waitForState();
        await talkToAgentDialog.cancelButton.click();
      },
    );

    await dialTest.step('Verify settings reset', async () => {
      await chat.configureSettingsButton.click();
      await agentInfoAssertion.assertElementText(
        agentSettings.systemPrompt,
        ExpectedConstants.emptyString,
      );
      agentInfoAssertion.assertValue(
        await temperatureSlider.getTemperature(),
        ExpectedConstants.defaultTemperature,
        ExpectedMessages.temperatureIsValid,
      );
      agentInfoAssertion.assertValue(
        await addons.getSelectedAddons().then((a) => a.length),
        1,
        ExpectedMessages.noAddonsSelected,
      );
    });
  },
);
