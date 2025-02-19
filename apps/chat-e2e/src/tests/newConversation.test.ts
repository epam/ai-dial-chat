import dialTest from '@/src/core/dialFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
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
    setIssueIds,
  }) => {
    setTestIds('EPMRTC-4717', 'EPMRTC-4920', 'EPMRTC-404', 'EPMRTC-403');
    setIssueIds('3116');
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
    await localStorageManager.setLastConversationSettings('');

    await dialTest.step('Open Dial', async () => {
      await dialHomePage.openHomePage({
        iconsToBeLoaded: [models[0].iconUrl!],
      });
      await dialHomePage.waitForPageLoaded();
      await chat.getSendMessage().waitForState();
    });

    const PROMPTS = {
      DOG: 'Act like a dog',
      CAT: 'Act like a cat',
    };
    const TEMPERATURE = {
      HIGH: '0.7',
      LOW: '0.2',
    };

    await dialTest.step('Change settings and apply', async () => {
      await chat.configureSettingsButton.click();
      await agentSettings.setSystemPrompt(PROMPTS.DOG);
      await temperatureSlider.setTemperature(TEMPERATURE.HIGH);
      await addons.selectAddon(addon.name);
      await conversationSettingsModal.applyChangesButton.click();
    });

    await dialTest.step(
      'Send a user message and click on the "New conversation" header button and check that the settings are changed, temperature is not changed',
      async () => {
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
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
          TEMPERATURE.HIGH,
          ExpectedMessages.temperatureIsValid,
        );
        await agentInfoAssertion.assertElementsCount(
          addons.selectedAddons,
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
      await agentSettings.setSystemPrompt(PROMPTS.CAT);
      await temperatureSlider.setTemperature(TEMPERATURE.LOW);
      await addons.selectAddon(addon.name);
      await conversationSettingsModal.applyChangesButton.click();
    });

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
          TEMPERATURE.HIGH,
          ExpectedMessages.temperatureIsValid,
        );
        await agentInfoAssertion.assertElementsCount(
          addons.selectedAddons,
          0,
          ExpectedMessages.noAddonsSelected,
        );
      },
    );
  },
);

dialSharedWithMeTest(
  'New conversation disappears, chat history is shown on the central part if to click on the chat with history\n' +
    'New conversation appears if user deletes focused Chat1. Chat2 stays unselected.\n' +
    'New conversation appears if user deletes focused chat. No data label appears instead.\n' +
    'Shared with me. Delete shared chat\n' +
    'New conversation appears if user deletes focused chat from Shared with me\n' +
    'New conversation appears if user deletes folder with focused chat from Shared with me\n' +
    'New conversation appears if user clicks on logo when Chat is opened',
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
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    additionalShareUserDataInjector,
    sharedWithMeConversations,
    sharedWithMeConversationDropdownMenu,
    sharedWithMeFolderDropdownMenu,
    sharedFolderConversations,
    sharedWithMeConversationAssertion,
  }) => {
    setTestIds(
      'EPMRTC-4791',
      'EPMRTC-4776',
      'EPMRTC-4804',
      'EPMRTC-1834',
      'EPMRTC-4802',
      'EPMRTC-4805',
      'EPMRTC-4817',
    );
    const firstConversation =
      conversationData.prepareModelConversationBasedOnRequests([
        'first request',
        'second request',
      ]);
    conversationData.resetData();
    const secondConversation = conversationData.prepareDefaultConversation();
    conversationData.resetData();
    const sharedConversation = conversationData.prepareDefaultConversation();
    conversationData.resetData();
    await additionalShareUserDataInjector.createConversations([
      sharedConversation,
    ]);
    await dataInjector.createConversations([
      firstConversation,
      secondConversation,
    ]);

    const sharedFolderConversation =
      conversationData.prepareDefaultConversationInFolder();
    conversationData.resetData();
    await additionalShareUserDataInjector.createConversations(
      sharedFolderConversation.conversations,
      sharedFolderConversation.folders,
    );

    await dialTest.step('Prepare shared conversations', async () => {
      const shareByLinkResponse =
        await additionalUserShareApiHelper.shareEntityByLink([
          sharedConversation,
        ]);
      await mainUserShareApiHelper.acceptInvite(shareByLinkResponse);

      const shareFolderByLinkResponse =
        await additionalUserShareApiHelper.shareEntityByLink(
          [sharedFolderConversation.conversations[0]],
          true,
        );
      await mainUserShareApiHelper.acceptInvite(shareFolderByLinkResponse);
    });

    await dialTest.step('Open app and create new conversation', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
    });

    await dialTest.step(
      'Select conversation with history and verify it is highlighted, its content is displayed, no new conversation is created',
      async () => {
        await conversations.selectConversation(firstConversation.name);
        await conversationAssertion.assertSelectedConversation(
          firstConversation.name,
        );
        await chatMessagesAssertion.assertMessagesCount(
          firstConversation.messages.length,
        );
        await conversationAssertion.assertEntitiesCount(2);
      },
    );

    await dialTest.step(
      'Click on DIAL logo and check that new conversation is shown on the central part',
      async () => {
        await header.logo.click();
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
          'visible',
        );
        await conversationAssertion.assertNoConversationIsSelected();
        await conversationAssertion.assertEntitiesCount(2);
      },
    );

    await dialTest.step('Select first conversation and delete it', async () => {
      await conversations.openEntityDropdownMenu(firstConversation.name);
      await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
      await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
    });

    await dialTest.step(
      'Verify new conversation is shown and second conversation is not selected and verify only one conversation remains',
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
        await conversationAssertion.assertEntitiesCount(1);
      },
    );

    await dialTest.step(
      'Select second conversation and delete it',
      async () => {
        await conversations.openEntityDropdownMenu(secondConversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        await chatBarAssertion.assertNoDataInConversations();
        await chat.getSendMessage().waitForState({ state: 'attached' });
        await chat.changeAgentButton.waitForState();
        await chat.configureSettingsButton.waitForState();
      },
    );

    await dialTest.step(
      'Open shared conversation by another user, select Delete and confirm',
      async () => {
        await sharedWithMeConversations.selectConversation(
          sharedConversation.name,
        );
        await sharedWithMeConversations.openEntityDropdownMenu(
          sharedConversation.name,
        );
        await sharedWithMeConversationDropdownMenu.selectMenuOption(
          MenuOptions.delete,
        );
        await confirmationDialog.confirm({
          triggeredHttpMethod: 'POST',
        });
      },
    );

    await dialTest.step(
      'Verify shared conversation is deleted and new conversation is shown',
      async () => {
        await sharedWithMeConversationAssertion.assertEntityState(
          { name: firstConversation.name },
          'hidden',
        );
        await chatBarAssertion.assertNoDataInConversations();
        await chat.getSendMessage().waitForState({ state: 'attached' });
        await chat.changeAgentButton.waitForState();
        await chat.configureSettingsButton.waitForState();
      },
    );

    await dialTest.step(
      'Select conversation inside shared folder, delete folder and verify new conversation is shown',
      async () => {
        await sharedFolderConversations.expandFolder(
          sharedFolderConversation.folders.name,
        );
        await sharedFolderConversations.selectFolderEntity(
          sharedFolderConversation.folders.name,
          sharedFolderConversation.conversations[0].name,
        );
        await sharedFolderConversations.openFolderDropdownMenu(
          sharedFolderConversation.folders.name,
        );
        await sharedWithMeFolderDropdownMenu.selectMenuOption(
          MenuOptions.delete,
        );
        await confirmationDialog.confirm({
          triggeredHttpMethod: 'POST',
        });
        await chatBarAssertion.assertNoDataInConversations();
        await chat.getSendMessage().waitForState({ state: 'attached' });
        await chat.changeAgentButton.waitForState();
        await chat.configureSettingsButton.waitForState();
      },
    );
  },
);

dialTest(
  'New conversation appears if user clicks on logo when DIAL Marketplace panel is opened',
  async ({
    dialHomePage,
    header,
    talkToAgentDialog,
    chatBar,
    setTestIds,
    conversationData,
    dataInjector,
    conversations,
    sendMessageAssertion,
    chat,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-4832');
    const models = GeneratorUtil.randomArrayElements(
      ModelsUtil.getLatestModels().filter(
        (m) =>
          ModelsUtil.doesModelAllowSystemPrompt(m) &&
          ModelsUtil.doesModelAllowTemperature(m) &&
          ModelsUtil.doesModelAllowAddons(m) &&
          m.iconUrl !== undefined,
      ),
      1,
    );
    const conversation = conversationData.prepareDefaultConversation(models[0]);
    await dataInjector.createConversations([conversation]);
    await localStorageManager.setRecentModelsIdsOnce(...models);

    await dialTest.step('Open Dial, navigate to Marketplace', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await conversations.selectConversation(conversation.name);
      await chatBar.dialMarketplaceLink.click();
    });

    await dialTest.step(
      'Click on DIAL logo and verify new conversation mode is shown',
      async () => {
        await header.logo.click();
        await dialHomePage.waitForPageLoaded();
        await chat.getSendMessage().waitForState({ state: 'attached' });
        await chat.changeAgentButton.waitForState();
        await chat.configureSettingsButton.waitForState();
        await sendMessageAssertion.assertInputFieldState('visible', 'enabled');
      },
    );

    await dialTest.step(
      'Navigate to Marketplace again and click on DIAL logo again',
      async () => {
        await chat.changeAgentButton.click();
        await talkToAgentDialog.goToMyWorkspace();
        await header.logo.click();
      },
    );

    await dialTest.step('Verify new conversation is still shown', async () => {
      await dialHomePage.waitForPageLoaded();
      await chat.getSendMessage().waitForState({ state: 'attached' });
      await chat.changeAgentButton.waitForState();
      await chat.configureSettingsButton.waitForState();
      await sendMessageAssertion.assertInputFieldState('visible', 'enabled');
    });
  },
);

dialTest(
  'New conversation 1 is not created if New conversation is on the screen\n' +
    'Click on logo resets all setting on new conversation',
  async ({
    dialHomePage,
    header,
    chat,
    agentSettings,
    temperatureSlider,
    addons,
    talkToAgentDialog,
    agentInfoAssertion,
    setTestIds,
    localStorageManager,
    conversationSettingsModal,
    conversationAssertion,
  }) => {
    setTestIds('EPMRTC-4837', 'EPMRTC-5092');
    const model = GeneratorUtil.randomArrayElement(
      ModelsUtil.getLatestModels().filter(
        (m) =>
          ModelsUtil.doesModelAllowSystemPrompt(m) &&
          ModelsUtil.doesModelAllowTemperature(m) &&
          ModelsUtil.doesModelAllowAddons(m) &&
          m.iconUrl !== undefined,
      ),
    );
    const addon = GeneratorUtil.randomArrayElement(ModelsUtil.getAddons());
    await localStorageManager.setRecentModelsIdsOnce(model);
    await localStorageManager.setRecentAddonsIds(addon);
    await localStorageManager.setLastConversationSettings('');
    let initialConversationIds: string | undefined;

    await dialTest.step(
      'Open Dial and verify the correct model is selected',
      async () => {
        await dialHomePage.openHomePage({
          iconsToBeLoaded: [model.iconUrl!],
        });
        await dialHomePage.waitForPageLoaded();
        await chat.getSendMessage().waitForState({ state: 'attached' });
        initialConversationIds =
          await localStorageManager.getSelectedConversationIds();
      },
    );

    await dialTest.step(
      'Click on "+" button and verify no POST request is made',
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
      'Change settings, apply, click on the logo, verify settings are reset',
      async () => {
        await chat.configureSettingsButton.click();
        await agentSettings.setSystemPrompt('Act like a cat');
        await temperatureSlider.setTemperature(0.2);
        await addons.selectAddon(addon.name);
        await conversationSettingsModal.applyChangesButton.click();
        await header.logo.click();
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
        await agentInfoAssertion.assertElementsCount(
          addons.selectedAddons,
          0,
          ExpectedMessages.noAddonsSelected,
        );
        await conversationSettingsModal.cancelButton.click();
      },
    );
  },
);
