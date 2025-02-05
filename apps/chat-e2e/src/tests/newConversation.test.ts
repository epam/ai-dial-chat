import dialTest from '@/src/core/dialFixtures';
import { ExpectedConstants, ExpectedMessages } from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

dialTest.only(
  'Click on + resets all settings on new conversation. Change agent pop-up opens\n' +
    'Click on + does not create a new conversation if new conversation was on the screen',
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
    conversations,
    conversationAssertion,
  }) => {
    setTestIds('EPMRTC-4717', 'EPMRTC-4837');
    const models = GeneratorUtil.randomArrayElements(
      ModelsUtil.getLatestModels().filter(
        (m) =>
          ModelsUtil.doesModelAllowSystemPrompt(m) &&
          ModelsUtil.doesModelAllowTemperature(m) &&
          ModelsUtil.doesModelAllowAddons(m) &&
          m.iconUrl !== undefined,
      ),
      2,
    );
    const addon = GeneratorUtil.randomArrayElement(ModelsUtil.getAddons());
    await localStorageManager.setRecentModelsIdsOnce(...models);
    await localStorageManager.setRecentAddonsIds(addon);
    let initialConversationIds: string | undefined;

    await dialTest.step(
      'Open Dial and verify the correct model is selected',
      async () => {
        await dialHomePage.openHomePage({
          iconsToBeLoaded: [models[0].iconUrl!],
        });
        await dialHomePage.waitForPageLoaded();
        await chat.getSendMessage().waitForState({ state: 'attached' });
        initialConversationIds =
          await localStorageManager.getSelectedConversationIds();
      },
    );

    await dialTest.step(
      'Change model and verify the correct model is selected',
      async () => {
        await chat.changeAgentButton.waitForState();
        await chat.configureSettingsButton.waitForState();
        await chat.changeAgentButton.click();
        await talkToAgentDialog.selectAgent(models[1], marketplacePage);
        const expectedModelIcon = iconApiHelper.getEntityIcon(models[1]);
        await agentInfoAssertion.assertAgentIcon(expectedModelIcon);
      },
    );

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
        const requestPromise = dialHomePage.waitForRequest({
          method: 'POST',
          shouldNotOccur: true,
          timeout: 20000,
        });
        await header.createNewConversation();
        await talkToAgentDialog.waitForState();
        await talkToAgentDialog.cancelButton.click();
        await requestPromise;
      },
    );

    await dialTest.step(
      'Verify local storage and conversation list remain unchanged',
      async () => {
        const updatedConversationIds =
          await localStorageManager.getSelectedConversationIds();
        expect
          .soft(
            updatedConversationIds,
            'selectedConversationIds should remain the same',
          )
          .toStrictEqual(initialConversationIds);

        await conversationAssertion.assertEntitiesCount(0);
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
        0,
        ExpectedMessages.noAddonsSelected,
      );
    });
  },
);
