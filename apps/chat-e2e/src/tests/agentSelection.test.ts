import { Publication } from '@/chat/types/publication';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import {
  ExpectedConstants,
  MenuOptions,
  MockedChatApiResponseBodies,
} from '@/src/testData';
import { ImportConversation } from '@/src/testData/conversationHistory/importConversation';
import { BaseElement } from '@/src/ui/webElements';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { PublishActions } from '@epam/ai-dial-shared';

const publicationsToUnpublish: Publication[] = [];

dialTest(
  'Previously used model is selected for New conversation: change model in "Change agent"\n' +
    'Previously used model is selected for New conversation: change model in My workspace through Use model\n' +
    `[Select an agent for conversation] My workspace tab is opened by default if to click on 'Go to My workspace' from 'Select an agent for conversation' window.\n` +
    'RecentModelIds[0] is updated if remove latest used model from My applications\n' +
    'RecentModelIds updated when click "Add the agent to My workspace to continue"',
  async ({
    dialHomePage,
    chat,
    talkToAgentDialog,
    chatBar,
    marketplacePage,
    marketplaceHeader,
    agentInfoAssertion,
    setTestIds,
    localStorageManager,
    iconApiHelper,
    entityDetailsModal,
    navigationPanel,
    confirmationDialog,
    talkToAgentDialogAssertion,
    conversations,
    conversationData,
    dataInjector,
    chatAssertion,
    localStorageAssertion,
    marketplaceEntitiesSection,
    toast,
  }) => {
    dialTest.slow();
    setTestIds(
      'EPMDIAL-5808',
      'EPMDIAL-5810',
      'EPMDIAL-5826',
      'EPMDIAL-5821',
      'EPMDIAL-5822',
    );
    let searchInput: BaseElement;
    const models = GeneratorUtil.randomArrayElements(
      ModelsUtil.getLatestModels().filter((m) => m.iconUrl !== undefined),
      2,
    );
    const [initialModel1, initialModel2] = models;

    // Get all available models, exclude initial models, and select one for this test case
    const availableModels = ModelsUtil.getLatestModels().filter(
      (m) => m.id !== initialModel1.id && m.id !== initialModel2.id,
    );
    const addedModel = GeneratorUtil.randomArrayElement(availableModels);

    // Create a conversation with the addedModel, which is not in the workspace
    const conversation =
      conversationData.prepareDefaultConversation(addedModel);
    await dataInjector.createConversations([conversation]);

    await dialTest.step(
      'Prepare models and set recent models in local storage',
      async () => {
        await localStorageManager.setRecentModelsIdsOnceWithPermanentLastUsedModel(
          ...models,
        );
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Open DIAL and verify the first model is selected',
      async () => {
        await dialHomePage.openHomePage({
          iconsToBeLoaded: [initialModel1.iconUrl],
        });
        await dialHomePage.waitForPageLoaded();
        await agentInfoAssertion.assertAgentName(initialModel1.name);
      },
    );

    await dialTest.step(
      'Click "Change agent", select the second model',
      async () => {
        await chat.changeAgentButton.waitForState();
        await chat.configureSettingsButton.waitForState();
        await chat.changeAgentButton.click();
        await talkToAgentDialog.selectAgent(initialModel2, {
          isHttpMethodTriggered: false,
        });
        await agentInfoAssertion.assertAgentName(initialModel2.name);
        const expectedModelIcon = iconApiHelper.getEntityIcon(initialModel2);
        await agentInfoAssertion.assertAgentIcon(expectedModelIcon);
      },
    );

    await dialTest.step(
      'Verify recentModelsIds in local storage is unchanged',
      async () => {
        await localStorageAssertion.assertRecentModels([
          initialModel1.id,
          initialModel2.id,
        ]);
      },
    );

    await dialTest.step(
      'Refresh the page and verify the first model is still selected',
      async () => {
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await agentInfoAssertion.assertAgentName(initialModel1.name);
      },
    );

    await dialTest.step(
      'Create a new conversation and verify the first model is still selected',
      async () => {
        await chatBar.createNewEntity();
        await talkToAgentDialog.getCloseButton().click();
        await agentInfoAssertion.assertAgentName(initialModel1.name);
      },
    );

    await dialTest.step(
      'Click "New conversation", then "Change agent", then "Go to My workspace"',
      async () => {
        await chat.changeAgentButton.click();
        await talkToAgentDialog.goToMyWorkspace();
        await marketplacePage.waitForPageLoaded();
      },
    );

    await dialTest.step(
      'Click "Use model" for the second model and verify recentModelsIds is updated',
      async () => {
        await marketplaceEntitiesSection.findAndUseAgent(initialModel2);
        await dialHomePage.waitForPageLoaded();
        await localStorageAssertion.assertRecentModels([
          initialModel2.id,
          initialModel1.id,
        ]); // secondModel should be first now
      },
    );

    await dialTest.step(
      'Refresh the page and verify the second model is now selected',
      async () => {
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await agentInfoAssertion.assertAgentName(initialModel2.name);
      },
    );

    await dialTest.step(
      'Create a new conversation and verify the second model is still selected',
      async () => {
        await chatBar.createNewEntity();
        await talkToAgentDialog.getCloseButton().click();
        await agentInfoAssertion.assertAgentName(initialModel2.name);
      },
    );

    await dialTest.step(
      'Click on "DIAL Marketplace", select a new model, and click "Use model"',
      async () => {
        await dialHomePage.goToMarketplace();
        await marketplacePage.waitForPageLoaded();
        searchInput = marketplaceHeader.getSearch().inputField;
        await searchInput.fillInInput(addedModel.name);
        await marketplaceEntitiesSection.findAndUseAgent(addedModel, {
          isInstalledDeploymentsUpdated: true,
        });
        await dialHomePage.waitForPageLoaded();
        await localStorageAssertion.assertRecentModels([
          addedModel.id,
          initialModel2.id,
          initialModel1.id,
        ]);
      },
    );

    await dialTest.step(
      'Click "Change agent" and "Go to My workspace", remove the third model, and go back to chat',
      async () => {
        await dialHomePage.goToMarketplace();
        await marketplacePage.waitForPageLoaded();
        await searchInput.fillInInput(addedModel.name);
        const addedModelElement =
          await marketplaceEntitiesSection.findEntityElement(addedModel);
        await addedModelElement.click();
        await entityDetailsModal.removeBookmarkIcon.click();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'PUT' });
        await navigationPanel.backToChat({ isHttpMethodTriggered: false });
      },
    );

    await dialTest.step(
      'Verify recentModelsIds is updated and the second model is now first',
      async () => {
        await dialHomePage.waitForPageLoaded();
        await localStorageAssertion.assertRecentModels([
          initialModel2.id,
          initialModel1.id,
        ]);
      },
    );

    await dialTest.step(
      'Create a new conversation and verify the second model is still selected',
      async () => {
        await chatBar.createNewEntity();
        await talkToAgentDialogAssertion.assertAgentState(
          initialModel2,
          'visible',
        );
        await talkToAgentDialogAssertion.assertAgentIsSelected(initialModel2);
        await talkToAgentDialog.getCloseButton().click();
        await agentInfoAssertion.assertAgentName(initialModel2.name);
      },
    );

    await dialTest.step(
      'Select a conversation with a model not in My Workspace',
      async () => {
        await conversations.selectEntity(conversation.name);
        await chatAssertion.assertAddAgentButtonState('visible');
      },
    );

    await dialTest.step(
      'Click "Add the agent to My workspace to continue" and verify recentModelsIds is updated',
      async () => {
        await chat.addModelToWorkspace();
        await toast.closeToast();
        await localStorageAssertion.assertRecentModels([
          addedModel.id,
          initialModel2.id,
          initialModel1.id,
        ]);
      },
    );
  },
);

dialAdminTest(
  'RecentModelIds is NOT updated when duplicate chat from Organization\n' +
    'RecentModelIds updated when regenerate message from duplicated chat from Organization\n' +
    'RecentModelIds updated when type new message to duplicated chat from Organization',
  async ({
    dialHomePage,
    agentInfo,
    conversationData,
    dataInjector,
    adminPublicationApiHelper,
    publicationApiHelper,
    publishRequestBuilder,
    setTestIds,
    localStorageManager,
    agentInfoAssertion,
    organizationConversations,
    conversationDropdownMenu,
    chatMessages,
    itemApiHelper,
    conversations,
    chatBar,
    localStorageAssertion,
    chat,
  }) => {
    setTestIds('EPMDIAL-5811', 'EPMDIAL-5812', 'EPMDIAL-5813');

    //Prepare models and set recent models in local storage
    const models = GeneratorUtil.randomArrayElements(
      ModelsUtil.getLatestModels().filter((m) => m.iconUrl !== undefined),
      2,
    );
    const [firstModel, secondModel] = models;
    const conversation1 =
      conversationData.prepareDefaultConversation(secondModel);
    conversationData.resetData();
    const conversation2 = conversationData.prepareDefaultConversation(
      secondModel,
      `${GeneratorUtil.randomString(5)}`,
    );

    await dataInjector.createConversations([conversation1, conversation2]);
    await localStorageManager.setRecentModelsIdsOnceWithPermanentLastUsedModel(
      ...models,
    );

    await dialAdminTest.step(
      'Create a conversation with the second model and publish it',
      async () => {
        for (const conversation of [conversation1, conversation2]) {
          const publishRequest = publishRequestBuilder
            .withName(GeneratorUtil.randomPublicationRequestName())
            .withConversationInFolderResource(conversation, PublishActions.ADD)
            .build();
          const publication =
            await publicationApiHelper.createPublishRequest(publishRequest);
          publicationsToUnpublish.push(publication);

          await adminPublicationApiHelper.approveRequest(publication);
          // delete the original conversation to prevent name duplicates
          await itemApiHelper.deleteEntity(conversation);
          await localStorageManager.setShowSideBarPanels();
        }
      },
    );

    await dialAdminTest.step(
      'Open the application and navigate to the Organization section',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await agentInfo.waitForState();
        await organizationConversations.waitForState();
      },
    );

    await dialAdminTest.step(
      'Duplicate the published conversation',
      async () => {
        for (const conversation of [conversation1, conversation2]) {
          await organizationConversations.openEntityDropdownMenu(
            conversation.name,
          );
          await conversationDropdownMenu.selectMenuOption(
            MenuOptions.duplicate,
            {
              triggeredHttpMethod: 'POST',
            },
          );
        }
      },
    );

    await dialAdminTest.step(
      'Verify that recentModelsIds in local storage remains unchanged',
      async () => {
        await localStorageAssertion.assertRecentModels([
          firstModel.id,
          secondModel.id,
        ]);
      },
    );

    await dialAdminTest.step(
      'Click "New Conversation" and verify the first model is still selected',
      async () => {
        await chatBar.createNewEntity();
        await agentInfoAssertion.assertAgentName(firstModel.name);
      },
    );

    await dialAdminTest.step(
      'Refresh the page and verify the first model is still selected',
      async () => {
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await agentInfoAssertion.assertAgentName(firstModel.name);
      },
    );

    await dialAdminTest.step(
      'Click Regenerate button and check recentModelIds state',
      async () => {
        await conversations.selectEntity(conversation1.name);
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chatMessages.regenerateResponse();
        await localStorageAssertion.assertRecentModels([
          secondModel.id,
          firstModel.id,
        ]);
      },
    );

    await dialAdminTest.step(
      'Click New Conversation and check that the model is not changed',
      async () => {
        await chatBar.createNewEntity();
        await agentInfoAssertion.assertAgentName(secondModel.name);
        await localStorageAssertion.assertRecentModels([
          secondModel.id,
          firstModel.id,
        ]);
      },
    );

    await dialAdminTest.step(
      'Type a new message in the duplicated chat and get a response and verify recentModelIds is updated',
      async () => {
        await conversations.selectEntity(conversation2.name); // Select the duplicated conversation
        await chat.sendRequestWithButton(GeneratorUtil.randomString(5));
        await localStorageAssertion.assertRecentModels([
          secondModel.id,
          firstModel.id,
        ]);
      },
    );

    await dialAdminTest.step(
      'Click New Conversation and check that the model is not changed',
      async () => {
        await chatBar.createNewEntity();
        await agentInfoAssertion.assertAgentName(secondModel.name);
        await localStorageAssertion.assertRecentModels([
          secondModel.id,
          firstModel.id,
        ]);
      },
    );
  },
);

dialTest(
  'RecentModelIds in NOT updated when duplicate own chat with model which is not in My workspace\n' +
    'RecentModelIds in NOT updated when duplicate when import chat with different model\n' +
    "RecentModelIds updated when type new message to imported chat. Chat's model is not in RecentModelIds[0]\n" +
    "RecentModelIds updated when regenerate message to imported chat. Chat's model is not in RecentModelIds[0]",
  async ({
    dialHomePage,
    agentInfoAssertion,
    setTestIds,
    localStorageManager,
    conversationData,
    dataInjector,
    chat,
    conversations,
    conversationDropdownMenu,
    chatBar,
    chatMessages,
    localStorageAssertion,
  }) => {
    setTestIds('EPMDIAL-5814', 'EPMDIAL-5818', 'EPMDIAL-5819', 'EPMDIAL-5820');
    dialTest.slow();
    const models = GeneratorUtil.randomArrayElements(
      ModelsUtil.getLatestModels().filter((m) => m.iconUrl !== undefined),
      2,
    );
    const [initialModel1, initialModel2] = models;

    // Get all available models, exclude initial models, and select one more
    const availableModels = ModelsUtil.getLatestModels().filter(
      (m) => m.id !== initialModel1.id && m.id !== initialModel2.id,
    );
    const addedModel = GeneratorUtil.randomArrayElement(availableModels);
    await localStorageManager.setRecentModelsIdsOnceWithPermanentLastUsedModel(
      ...models,
    );
    await localStorageManager.setShowSideBarPanels();

    // Create conversations
    const conversation2Name = GeneratorUtil.randomString(10);
    const conversation1Api =
      conversationData.prepareDefaultConversation(addedModel);
    conversationData.resetData();
    await dataInjector.createConversations([conversation1Api]);

    const conversation2Export1 =
      conversationData.prepareDefaultConversation(initialModel2);
    conversationData.resetData();
    const conversation2Export2 =
      conversationData.prepareDefaultConversation(initialModel1);

    // Export conversations
    const exportedConversation =
      ImportConversation.prepareConversationFile(conversation2Export1);
    const exportedConversation2 =
      ImportConversation.prepareConversationFile(conversation2Export2);

    await dialTest.step('Open the DIAL', async () => {
      await dialHomePage.openHomePage({
        iconsToBeLoaded: [initialModel1.iconUrl],
      });
      await dialHomePage.waitForPageLoaded();
      await agentInfoAssertion.assertAgentName(initialModel1.name);
    });

    await dialTest.step(
      'Create a new conversation with the first model',
      async () => {
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequestWithButton(conversation2Name);
      },
    );

    await dialTest.step(
      'Duplicate previously existed chat, verify recentModelsIds in local storage is unchanged',
      async () => {
        await conversations.selectEntity(conversation1Api.name);
        await conversations.openEntityDropdownMenu(conversation1Api.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.duplicate, {
          triggeredHttpMethod: 'POST',
        });
        await localStorageAssertion.assertRecentModelsDoesNotContain(
          addedModel.id,
        );
      },
    );

    await dialTest.step(
      'Create a new conversation and verify the first model is still selected',
      async () => {
        await chatBar.createNewEntity();
        await agentInfoAssertion.assertAgentName(initialModel1.name);
      },
    );

    await dialTest.step(
      'Refresh the page and verify the first model is still selected',
      async () => {
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await agentInfoAssertion.assertAgentName(initialModel1.name);
      },
    );

    await dialTest.step(
      'Import conversation and verify recentModelsIds is unchanged',
      async () => {
        await dialHomePage.importFile(exportedConversation, () =>
          chatBar.importButton.click(),
        );
        await localStorageAssertion.assertRecentModels([
          initialModel1.id,
          initialModel2.id,
        ]);
      },
    );

    await dialTest.step(
      'Create a new conversation and verify the first model is still selected',
      async () => {
        await chatBar.createNewEntity();
        await agentInfoAssertion.assertAgentName(initialModel1.name);
      },
    );

    await dialTest.step(
      'Refresh the page and verify the first model is still selected',
      async () => {
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await agentInfoAssertion.assertAgentName(initialModel1.name);
      },
    );

    await dialTest.step(
      'Type new message to imported chat and verify recentModelsIds is updated',
      async () => {
        await conversations.selectEntity(conversation2Export1.name);
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequestWithButton(GeneratorUtil.randomString(10));
        await localStorageAssertion.assertRecentModels([
          initialModel2.id,
          initialModel1.id,
        ]);
      },
    );

    await dialTest.step(
      'Create a new conversation and verify the first model is still selected',
      async () => {
        await chatBar.createNewEntity();
        await agentInfoAssertion.assertAgentName(initialModel2.name);
      },
    );

    await dialTest.step(
      'Import one more conversation and select it, regenerate response, and verify recentModelsIds is updated',
      async () => {
        await dialHomePage.importFile(exportedConversation2, () =>
          chatBar.importButton.click(),
        );
        await conversations.selectEntity(conversation2Export2.name);
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chatMessages.regenerateResponse();
        await localStorageAssertion.assertRecentModels([
          initialModel1.id,
          initialModel2.id,
        ]);
      },
    );

    await dialTest.step(
      'Create a new conversation and verify is selected',
      async () => {
        await chatBar.createNewEntity();
        await agentInfoAssertion.assertAgentName(initialModel1.name);
      },
    );
  },
);

dialTest(
  'RecentModelIds[0] is updated if remove latest used model from My applications.\n' +
    `[First screen] 'Add agent to My workspace to continue' appears if the agent was removed from My workspace`,
  async ({
    dialHomePage,
    chatBar,
    navigationPanel,
    chat,
    talkToAgentDialog,
    marketplacePage,
    iconApiHelper,
    agentInfoAssertion,
    setTestIds,
    localStorageManager,
    entityDetailsModal,
    confirmationDialog,
    localStorageAssertion,
    chatAssertion,
    sendMessage,
    sendMessageAssertion,
    marketplaceEntitiesSection,
    talkToAgentDialogAssertion,
  }) => {
    setTestIds('EPMDIAL-5821', 'EPMDIAL-5749');
    const models = GeneratorUtil.randomArrayElements(
      ModelsUtil.getLatestModels().filter((m) => m.iconUrl !== undefined),
      2,
    );
    const [firstModel, secondModel] = models;
    await localStorageManager.setRecentModelsIdsOnceWithPermanentLastUsedModel(
      ...models,
    );
    await localStorageManager.setShowSideBarPanels();

    await dialTest.step('Open DIAL', async () => {
      await dialHomePage.openHomePage({
        iconsToBeLoaded: [firstModel.iconUrl],
      });
      await dialHomePage.waitForPageLoaded();
      await agentInfoAssertion.assertAgentName(firstModel.name);
    });

    await dialTest.step(
      'Navigate to "My workspace" and remove the first model',
      async () => {
        await chat.changeAgentButton.click();
        await talkToAgentDialog.goToMyWorkspace();
        await marketplacePage.waitForPageLoaded();
        const firstModelElement =
          await marketplaceEntitiesSection.findEntityElement(firstModel);
        await firstModelElement.click();
        await entityDetailsModal.removeBookmarkIcon.click();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'PUT' });
        await navigationPanel.backToChat({ isHttpMethodTriggered: false });
        await dialHomePage.waitForPageLoaded();
      },
    );

    await dialTest.step(
      'Verify "Add the agent to My workspace to continue" btn is displayed instead of input',
      async () => {
        await chatAssertion.assertAddAgentButtonState('visible');
        await chatAssertion.assertElementText(
          chat.addModelButton,
          ExpectedConstants.addAgentToWorkspaceTitle,
        );
        await sendMessageAssertion.assertElementState(
          sendMessage.messageInput,
          'hidden',
        );
        await agentInfoAssertion.assertAgentName(firstModel.name);
        await agentInfoAssertion.assertShortDescription(firstModel);
        await agentInfoAssertion.assertAgentVersion(firstModel.version);
        const expectedModelIcon = iconApiHelper.getEntityIcon(firstModel);
        await agentInfoAssertion.assertAgentIcon(expectedModelIcon);
        await chatAssertion.assertElementState(
          chat.changeAgentButton,
          'visible',
        );
        await chatAssertion.assertElementState(
          chat.configureSettingsButton,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Verify recentModelIds is updated and the second model is selected',
      async () => {
        await chatBar.createNewEntity();
        await talkToAgentDialogAssertion.assertAgentIsSelected(secondModel);
        await talkToAgentDialog.getCloseButton().click();
        await localStorageAssertion.assertRecentModels([secondModel.id]);
        await agentInfoAssertion.assertAgentName(secondModel.name);
      },
    );
  },
);

dialSharedWithMeTest(
  'RecentModelIds in NOT updated when duplicate when duplicate chat from Shared with me\n' +
    'RecentModelIds updated when type new message to duplicated chat from Shared with me\n' +
    'RecentModelIds updated when regenerate message from duplicated chat from Shared with me',
  async ({
    dialHomePage,
    conversationData,
    additionalShareUserDataInjector,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    setTestIds,
    localStorageManager,
    chatBar,
    agentInfoAssertion,
    sharedWithMeConversations,
    conversationDropdownMenu,
    localStorageAssertion,
    conversations,
    chat,
    chatMessages,
  }) => {
    setTestIds('EPMDIAL-5815', 'EPMDIAL-5816', 'EPMDIAL-5817');
    const models = GeneratorUtil.randomArrayElements(
      ModelsUtil.getLatestModels().filter((m) => m.iconUrl !== undefined),
      2,
    );
    const [initialModel1, initialModel2] = models;

    // Prepare shared conversations
    const sharedConversation1 =
      conversationData.prepareDefaultConversation(initialModel2);
    conversationData.resetData();
    const sharedConversation2 =
      conversationData.prepareDefaultConversation(initialModel1);
    await additionalShareUserDataInjector.createConversations([
      sharedConversation1,
      sharedConversation2,
    ]);
    const shareByLinkResponse =
      await additionalUserShareApiHelper.shareEntityByLink([
        sharedConversation1,
        sharedConversation2,
      ]);
    await mainUserShareApiHelper.acceptInvite(shareByLinkResponse);
    await localStorageManager.setRecentModelsIdsOnceWithPermanentLastUsedModel(
      ...models,
    );
    await localStorageManager.setShowSideBarPanels();

    await dialSharedWithMeTest.step('Open DIAL by the main user', async () => {
      await dialHomePage.openHomePage({
        iconsToBeLoaded: [initialModel1.iconUrl],
      });
      await dialHomePage.waitForPageLoaded();
      await agentInfoAssertion.assertAgentName(initialModel1.name);
    });

    await dialSharedWithMeTest.step(
      'Duplicate shared chats and verify recentModelsIds is not changed',
      async () => {
        for (const conversation of [sharedConversation1, sharedConversation2]) {
          await sharedWithMeConversations.openEntityDropdownMenu(
            conversation.name,
          );
          await conversationDropdownMenu.selectMenuOption(
            MenuOptions.duplicate,
            {
              triggeredHttpMethod: 'POST',
            },
          );
          await localStorageAssertion.assertRecentModels([
            initialModel1.id,
            initialModel2.id,
          ]);
        }
      },
    );

    await dialSharedWithMeTest.step(
      'Click new conversation and check that the same model is selected',
      async () => {
        await chatBar.createNewEntity();
        await agentInfoAssertion.assertAgentName(initialModel1.name);
      },
    );

    await dialSharedWithMeTest.step(
      'Refresh the page and check that the same model is selected',
      async () => {
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await agentInfoAssertion.assertAgentName(initialModel1.name);
      },
    );

    await dialSharedWithMeTest.step(
      'Select Duplicated shared chat, send a message, and verify recentModelsIds is changed',
      async () => {
        await conversations.selectEntity(sharedConversation1.name);
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequestWithButton(GeneratorUtil.randomString(10));
        await localStorageAssertion.assertRecentModels([
          initialModel2.id,
          initialModel1.id,
        ]);
      },
    );

    await dialSharedWithMeTest.step(
      'Click new conversation and check that the same model is selected',
      async () => {
        await chatBar.createNewEntity();
        await agentInfoAssertion.assertAgentName(initialModel2.name);
      },
    );

    await dialSharedWithMeTest.step(
      'Select another duplicated shared chat, regenerate a message, and verify recentModelsIds is changed',
      async () => {
        await conversations.selectEntity(sharedConversation2.name);
        await chatMessages.regenerateResponse();
        await localStorageAssertion.assertRecentModels([
          initialModel1.id,
          initialModel2.id,
        ]);
      },
    );
  },
);

dialTest.afterAll(
  async ({ publicationApiHelper, adminPublicationApiHelper }) => {
    for (const publication of publicationsToUnpublish) {
      const unpublishResponse =
        await publicationApiHelper.createUnpublishRequest(publication);
      await adminPublicationApiHelper.approveRequest(unpublishResponse);
    }
  },
);
