import dialTest from '@/src/core/dialFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  MockedChatApiResponseBodies,
} from '@/src/testData';
import { NotFound } from '@/src/ui/webElements';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

dialTest(
  'Click on + resets all settings on new conversation. Change agent pop-up opens\n' +
    'Click on + resets all settings on new conversation. When temperature was changed in previous chat.\n' +
    'Default temperature in new chat is set from the previous chat.\n' +
    'Default system prompt in new chat is always empty',
  async ({
    dialHomePage,
    chatBar,
    chat,
    agentSettings,
    temperatureSlider,
    talkToAgentDialog,
    agentInfoAssertion,
    agentSettingAssertion,
    setTestIds,
    localStorageManager,
    conversationSettingsModal,
    iconApiHelper,
    sendMessage,
    conversationAssertion,
  }) => {
    setTestIds('EPMDIAL-5779', 'EPMDIAL-5780', 'EPMDIAL-5701', 'EPMDIAL-5700');
    const models = GeneratorUtil.randomArrayElements(
      ModelsUtil.getLatestModels().filter(
        (m) =>
          ModelsUtil.doesModelAllowSystemPrompt(m) &&
          ModelsUtil.doesModelAllowTemperature(m) &&
          m.iconUrl !== undefined,
      ),
      2,
    );
    await localStorageManager.setRecentModelsIdsOnceWithPermanentLastUsedModel(
      ...models,
    );
    await localStorageManager.setLastConversationSettings('');
    await localStorageManager.setShowSideBarPanels();

    await dialTest.step('Open DIAL', async () => {
      await dialHomePage.openHomePage({
        iconsToBeLoaded: [models[0].iconUrl!],
      });
      await dialHomePage.waitForPageLoaded();
      await sendMessage.waitForState();
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
      // no conversation exists yet — no PUT is guaranteed to fire
      await conversationSettingsModal.applyChanges({ waitForUpdate: false });
    });

    await dialTest.step(
      'Send a user message and click on the "New conversation" header button',
      async () => {
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequestWithButton('test request');
        await chatBar.createNewEntity();
      },
    );

    await dialTest.step(
      'Check that the settings are reset, temperature is not changed after sending a message and starting a new conversation',
      async () => {
        await chat.configureSettingsButton.click();
        await agentSettingAssertion.assertSystemPromptValue(
          ExpectedConstants.emptyString,
        );
        await agentSettingAssertion.assertTemperature(TEMPERATURE.HIGH);
        await conversationSettingsModal.cancelButton.click();
      },
    );

    await dialTest.step(
      'Change model and verify the correct model is selected',
      async () => {
        await chat.changeAgentButton.waitForState();
        await chat.configureSettingsButton.waitForState();
        await chat.changeAgentButton.click();
        await talkToAgentDialog.selectAgent(models[1], {
          isHttpMethodTriggered: false,
        });
        const expectedModelIcon = iconApiHelper.getEntityIcon(models[1]);
        await agentInfoAssertion.assertAgentIcon(expectedModelIcon);
      },
    );

    await dialTest.step('Change settings and apply', async () => {
      await localStorageManager.setLastConversationSettings('');
      await chat.configureSettingsButton.click();
      await agentSettings.setSystemPrompt(PROMPTS.CAT);
      await temperatureSlider.setTemperature(TEMPERATURE.LOW);
      // no conversation exists yet — no PUT is guaranteed to fire
      await conversationSettingsModal.applyChanges({ waitForUpdate: false });
    });

    await dialTest.step(
      'Verify settings are completely reset, temperature is reset to the `lastConversationSettings` value after not sending a message in a chat',
      async () => {
        await chatBar.createNewEntity();
        await talkToAgentDialog.selectAgent(models[1], {
          isHttpMethodTriggered: false,
        });
        await chat.configureSettingsButton.click();
        await agentSettingAssertion.assertSystemPromptValue(
          ExpectedConstants.emptyString,
        );
        await agentSettingAssertion.assertTemperature(TEMPERATURE.HIGH);
        await conversationSettingsModal.cancelButton.click();
      },
    );

    await dialTest.step(
      'Verify conversations count remains the same, no conversations are selected',
      async () => {
        await conversationAssertion.assertNoEntityIsSelected();
        await conversationAssertion.assertEntitiesCount(1);
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
    sendMessage,
    chatBarAssertion,
    baseAssertion,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    additionalShareUserDataInjector,
    sharedWithMeConversations,
    sharedWithMeConversationDropdownMenu,
    sharedWithMeFolderDropdownMenu,
    sharedFolderConversations,
    sharedWithMeConversationAssertion,
    localStorageManager,
    chatMessages,
  }) => {
    setTestIds(
      'EPMDIAL-5782',
      'EPMDIAL-5783',
      'EPMDIAL-5784',
      'EPMDIAL-3040',
      'EPMDIAL-5785',
      'EPMDIAL-5786',
      'EPMDIAL-5787',
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
      await localStorageManager.setShowSideBarPanels();
    });

    await dialTest.step('Open app and create new conversation', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
    });

    await dialTest.step(
      'Select conversation with history and verify it is highlighted, its content is displayed, no new conversation is created',
      async () => {
        await conversations.selectEntity(firstConversation.name);
        await conversationAssertion.assertSelectedEntity(
          firstConversation.name,
        );
        await chatMessagesAssertion.assertElementState(
          chatMessages.chatMessages.getNthElement(
            firstConversation.messages.length,
          ),
          'visible',
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
        await baseAssertion.assertElementState(sendMessage, 'visible');
        await baseAssertion.assertElementState(
          chat.changeAgentButton,
          'visible',
        );
        await baseAssertion.assertElementState(
          chat.configureSettingsButton,
          'visible',
        );
        await conversationAssertion.assertEntityState(
          { name: secondConversation.name },
          'visible',
        );
        await conversationAssertion.assertEntityState(
          { name: firstConversation.name },
          'visible',
        );
        await conversationAssertion.assertNoEntityIsSelected();
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
        await baseAssertion.assertElementState(sendMessage, 'visible');
        await baseAssertion.assertElementState(
          chat.changeAgentButton,
          'visible',
        );
        await baseAssertion.assertElementState(
          chat.configureSettingsButton,
          'visible',
        );
        await conversationAssertion.assertEntityState(
          { name: secondConversation.name },
          'visible',
        );
        await conversationAssertion.assertEntityState(
          { name: firstConversation.name },
          'hidden',
        );
        await conversationAssertion.assertNoEntityIsSelected();
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
        await baseAssertion.assertElementState(sendMessage, 'visible');
        await baseAssertion.assertElementState(
          chat.changeAgentButton,
          'visible',
        );
        await baseAssertion.assertElementState(
          chat.configureSettingsButton,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Open shared conversation by another user, select Delete and confirm',
      async () => {
        await sharedWithMeConversations.selectEntity(sharedConversation.name);
        await sharedWithMeConversations.openEntityDropdownMenu(
          sharedConversation.name,
        );
        await sharedWithMeConversationDropdownMenu.selectMenuOption(
          MenuOptions.unshare,
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
        await baseAssertion.assertElementState(sendMessage, 'visible');
        await baseAssertion.assertElementState(
          chat.changeAgentButton,
          'visible',
        );
        await baseAssertion.assertElementState(
          chat.configureSettingsButton,
          'visible',
        );
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
          MenuOptions.unshare,
        );
        await confirmationDialog.confirm({
          triggeredHttpMethod: 'POST',
        });
        await chatBarAssertion.assertNoDataInConversations();
        await baseAssertion.assertElementState(sendMessage, 'visible');
        await baseAssertion.assertElementState(
          chat.changeAgentButton,
          'visible',
        );
        await baseAssertion.assertElementState(
          chat.configureSettingsButton,
          'visible',
        );
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
    setTestIds,
    conversationData,
    dataInjector,
    conversations,
    sendMessageAssertion,
    chat,
    localStorageManager,
    marketplacePage,
  }) => {
    setTestIds('EPMDIAL-5789');
    const models = GeneratorUtil.randomArrayElements(
      ModelsUtil.getLatestModels().filter(
        (m) =>
          ModelsUtil.doesModelAllowSystemPrompt(m) &&
          ModelsUtil.doesModelAllowTemperature(m) &&
          m.iconUrl !== undefined,
      ),
      1,
    );
    const conversation = conversationData.prepareDefaultConversation(models[0]);
    await dataInjector.createConversations([conversation]);
    await localStorageManager.setRecentModelsIdsOnceWithPermanentLastUsedModel(
      ...models,
    );
    await localStorageManager.setShowSideBarPanels();

    await dialTest.step('Open DIAL, navigate to Marketplace', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await conversations.selectEntity(conversation.name);
      await dialHomePage.goToMarketplace();
      await marketplacePage.waitForPageLoaded();
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
    talkToAgentDialog,
    chatBar,
    agentInfoAssertion,
    agentSettingAssertion,
    setTestIds,
    localStorageManager,
    conversationSettingsModal,
    conversationAssertion,
  }) => {
    setTestIds('EPMDIAL-5781', 'EPMDIAL-5788');
    const model = GeneratorUtil.randomArrayElement(
      ModelsUtil.getLatestModels().filter(
        (m) =>
          ModelsUtil.doesModelAllowSystemPrompt(m) &&
          ModelsUtil.doesModelAllowTemperature(m) &&
          m.iconUrl !== undefined,
      ),
    );
    await localStorageManager.setRecentModelsIdsOnceWithPermanentLastUsedModel(
      model,
    );
    await localStorageManager.setLastConversationSettings('');
    await localStorageManager.setShowSideBarPanels();
    let initialConversationIds: string | undefined;

    await dialTest.step(
      'Open DIAL and verify the correct model is selected',
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
        await chatBar.createNewEntity();
        await talkToAgentDialog.waitForState();
        await talkToAgentDialog.getCloseButton().click();
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
        // no conversation exists yet — no PUT is guaranteed to fire
        await conversationSettingsModal.applyChanges({
          waitForUpdate: false,
        });
        await header.logo.click();
        await chat.configureSettingsButton.click();
        await agentSettingAssertion.assertSystemPromptValue(
          ExpectedConstants.emptyString,
        );
        agentInfoAssertion.assertValue(
          await temperatureSlider.getTemperature(),
          ExpectedConstants.defaultTemperature,
          ExpectedMessages.temperatureIsValid,
        );
        await conversationSettingsModal.cancelButton.click();
      },
    );
  },
);

dialTest(
  'New conversation screen is shown when user clicks on the corresponding button on Error page',
  async ({
    dialHomePage,
    dialErrorPage,
    baseAssertion,
    setTestIds,
    sendMessage,
    chat,
    localStorageManager,
  }) => {
    setTestIds('EPMDIAL-5793');
    let notFoundElement: NotFound;

    await dialTest.step(
      'Open DIAL non existent page and verify messages and "New Conversation" btn is available',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await dialErrorPage.navigateToUrl('/errorpage');
        notFoundElement = dialErrorPage.getNotFound();
        await baseAssertion.assertElementText(
          notFoundElement.header,
          ExpectedConstants.notFoundHeader,
        );
        await baseAssertion.assertElementText(
          notFoundElement.title,
          ExpectedConstants.notFoundTitle,
        );
        await baseAssertion.assertElementText(
          notFoundElement.description,
          ExpectedConstants.notFoundDescription,
        );
        await baseAssertion.assertElementState(
          notFoundElement.newConversationButton,
          'visible',
        );
        await baseAssertion.assertElementActionabilityState(
          notFoundElement.newConversationButton,
          'enabled',
        );
      },
    );

    await dialTest.step(
      'Click on "+" button and verify new conversation is created, dial home is opened',
      async () => {
        await notFoundElement.newConversationButton.click();
        await dialHomePage.waitForPageLoaded();
        await baseAssertion.assertElementState(notFoundElement, 'hidden');
        await baseAssertion.assertElementState(
          chat.configureSettingsButton,
          'visible',
        );
        await baseAssertion.assertElementState(
          chat.changeAgentButton,
          'visible',
        );
        await baseAssertion.assertElementState(
          sendMessage.messageInput,
          'visible',
        );
      },
    );
  },
);
