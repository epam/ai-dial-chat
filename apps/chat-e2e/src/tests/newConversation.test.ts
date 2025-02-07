import { Conversation } from '@/chat/types/chat';
import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  MockedChatApiResponseBodies,
} from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

dialTest(
  'Click on + resets all settings on new conversation. Change agent pop-up opens\n' +
    'Click on + does not create a new conversation if new conversation was on the screen\n' +
    'Click on + resets all settings on new conversation. When temperature was changed in previous chat.',
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
    conversationAssertion,
  }) => {
    setTestIds('EPMRTC-4717', 'EPMRTC-4837', 'EPMRTC-4920');
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
    await dialHomePage.addInitScript(
      (data) => {
        const { storageKey, storageValue } = data;
        localStorage.setItem(storageKey,
          typeof storageValue === 'string'
            ? storageValue
            : JSON.stringify(storageValue)
        );
      },
      {
        storageKey: 'lastConversationSettings',
        storageValue: '',
      },
    );

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

    await dialTest.step('Change settings and apply', async () => {
      await chat.configureSettingsButton.click();
      await agentSettings.setSystemPrompt('Act like a dog');
      await temperatureSlider.setTemperature(0.7);
      await addons.selectAddon(addon.name);
      await conversationSettingsModal.applyChangesButton.click();
    });

    await dialTest.step(
      'Send a user message and click on the "New conversation" header button and check that the settings are changed, temperature is not changed',
      async () => {
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        // await dialHomePage.interceptAndChangePutApiConversationsOnce({temperature: 0.5});
        await chat.sendRequestWithButton('test request');
        await header.createNewConversation();
      },
    );

    await dialTest.step(
      'Check that the settings are reset, temperature is not changed after sending a message and starting a new conversation',
      async () => {
        await chat.configureSettingsButton.click();
        await agentInfoAssertion.assertElementText(
          agentSettings.systemPrompt,
          ExpectedConstants.emptyString,
        );
        agentInfoAssertion.assertValue(
          await temperatureSlider.getTemperature(),
          '0.7',
          ExpectedMessages.temperatureIsValid,
        );
        agentInfoAssertion.assertValue(
          await addons.getSelectedAddons().then((a) => a.length),
          0,
          ExpectedMessages.noAddonsSelected,
        );
        await conversationSettingsModal.cancelButton.click();
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
      await temperatureSlider.setTemperature(0.2);
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

    await dialTest.step(
      'Verify settings are completely reset after not sending a message in a chat',
      async () => {
        await chat.configureSettingsButton.click();
        await agentInfoAssertion.assertElementText(
          agentSettings.systemPrompt,
          ExpectedConstants.emptyString,
        );
        agentInfoAssertion.assertValue(
          await temperatureSlider.getTemperature(),
          '0.7',
          ExpectedMessages.temperatureIsValid,
        );
        agentInfoAssertion.assertValue(
          await addons.getSelectedAddons().then((a) => a.length),
          0,
          ExpectedMessages.noAddonsSelected,
        );
      },
    );
  },
);

dialTest.only(
  'New conversation disappears, chat history is shown on the central part if to click on the chat with history\n' +
    'New conversation appears if user deletes focused Chat1. Chat2 stays unselected.\n' +
  'New conversation appears if user deletes focused chat. No data label appears instead.',
  async ({
    dialHomePage,
    header,
    conversationData,
    dataInjector,
    conversations,
    conversationAssertion,
    chatMessagesAssertion,
    setTestIds,
    conversationDropdownMenu,
    confirmationDialog,
    chat,
           chatBarAssertion,
  }) => {
    setTestIds('EPMRTC-4791', 'EPMRTC-4776', 'EPMRTC-4804');
    const firstConversation =
      conversationData.prepareModelConversationBasedOnRequests([
        'first request',
        'second request',
      ]);
    conversationData.resetData();
    const secondConversation = conversationData.prepareDefaultConversation();
    await dataInjector.createConversations([
      firstConversation,
      secondConversation,
    ]);

    await dialTest.step('Open app and create new conversation', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
    });

    await dialTest.step(
      'Select conversation with history and verify it is highlighted, its content is displayed',
      async () => {
        await conversations.selectConversation(firstConversation.name);
        await conversationAssertion.assertSelectedConversation(
          firstConversation.name,
        );
        await chatMessagesAssertion.assertMessagesCount(
          firstConversation.messages.length,
        );
      },
    );

    await dialTest.step('Verify no new conversation is created', async () => {
      await conversationAssertion.assertEntitiesCount(2);
    });

    await dialTest.step('Select first conversation and delete it', async () => {
      await conversations.openEntityDropdownMenu(firstConversation.name);
      await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
      await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
    });

    await dialTest.step(
      'Verify new conversation is shown and second conversation is not selected',
      async () => {
        await dialHomePage.waitForPageLoaded();
        await chat.getSendMessage().waitForState({ state: 'attached' });
        await chat.changeAgentButton.waitForState();
        await chat.configureSettingsButton.waitForState();
        await conversationAssertion.assertEntityState(
          { name: secondConversation.name },
          'visible',
        );
        await conversationAssertion.assertEntityState(
          { name: firstConversation.name },
          'hidden',
        );
        await conversationAssertion.assertNoConversationIsSelected();
      },
    );

    await dialTest.step('Verify only one conversation remains', async () => {
      await conversationAssertion.assertEntitiesCount(1);
    });

    await dialTest.step('Select second conversation and delete it', async () => {
      await conversations.openEntityDropdownMenu(secondConversation.name);
      await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
      await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
      await chatBarAssertion.assertNoDataInConversations();
    });
  },
);
