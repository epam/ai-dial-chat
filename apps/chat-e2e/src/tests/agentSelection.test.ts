import { Publication } from '@/chat/types/publication';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import { MenuOptions, MockedChatApiResponseBodies } from '@/src/testData';
import { ImportConversation } from '@/src/testData/conversationHistory/importConversation';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { PublishActions } from '@epam/ai-dial-shared';

const publicationsToUnpublish: Publication[] = [];

dialTest(
  'Previously used model is selected for New conversation: change model in "Change agent"\n' +
    'Previously used model is selected for New conversation: change model in My workspace through Use model\n' +
    'RecentModelIds[0] is updated if remove latest used model from My applications\n' +
    'RecentModelIds updated when click "Add the agent to My workspace to continue"',
  async ({
    dialHomePage,
    chat,
    talkToAgentDialog,
    chatBar,
    marketplacePage,
    agentInfoAssertion,
    setTestIds,
    localStorageManager,
    iconApiHelper,
    agentDetailsModal,
    navigationPanel,
    confirmationDialog,
    talkToAgentDialogAssertion,
    conversations,
    conversationData,
    dataInjector,
    chatAssertion,
    localStorageAssertion,
    marketplaceAgentsSection,
    toast,
  }) => {
    dialTest.slow();
    setTestIds('EPMRTC-4878', 'EPMRTC-4880', 'EPMRTC-4356', 'EPMRTC-5168');
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
        await localStorageManager.setRecentModelsIdsOnce(...models);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Open Dial and verify the first model is selected',
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
        await talkToAgentDialog.selectAgent(initialModel2, marketplacePage);
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
        await talkToAgentDialog.cancelButton.click();
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
        await marketplaceAgentsSection.findAndUseAgent(initialModel2);
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
        await talkToAgentDialog.cancelButton.click();
        await agentInfoAssertion.assertAgentName(initialModel2.name);
      },
    );

    await dialTest.step(
      'Click on "DIAL Marketplace", select a new model, and click "Use model"',
      async () => {
        await navigationPanel.marketplaceHomeButton.click();
        await marketplacePage.waitForPageLoaded();
        await marketplaceAgentsSection.findAndUseAgent(addedModel, {
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
        await navigationPanel.marketplaceHomeButton.click();
        await marketplacePage.waitForPageLoaded();
        const addedModelElement =
          await marketplaceAgentsSection.findAgentElement(addedModel);
        await addedModelElement.click();
        await agentDetailsModal.removeBookmarkIcon.click();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'PUT' });
        await navigationPanel.backToChatButton.click();
      },
    );

    await dialTest.step(
      'Verify recentModelsIds is updated and the second model is now first',
      async () => {
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
        await talkToAgentDialogAssertion.assertAgentIsSelected(initialModel2);
        await talkToAgentDialog.cancelButton.click();
        await agentInfoAssertion.assertAgentName(initialModel2.name);
      },
    );

    await dialTest.step(
      'Select a conversation with a model not in My Workspace',
      async () => {
        await conversations.selectConversation(conversation.name);
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
    setTestIds('EPMRTC-4881', 'EPMRTC-5162', 'EPMRTC-5163');

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
    await localStorageManager.setRecentModelsIdsOnce(...models);

    await dialAdminTest.step(
      'Create a conversation with the second model and publish it',
      async () => {
        for (const conversation of [conversation1, conversation2]) {
          const publishRequest = publishRequestBuilder
            .withName(GeneratorUtil.randomPublicationRequestName())
            .withConversationResource(conversation, PublishActions.ADD)
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
        await conversations.selectConversation(conversation1.name);
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
        await conversations.selectConversation(conversation2.name); // Select the duplicated conversation
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
    setTestIds('EPMRTC-4883', 'EPMRTC-4884', 'EPMRTC-5177', 'EPMRTC-5167');
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
    await localStorageManager.setRecentModelsIdsOnce(...models);
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

    await dialTest.step('Open the Dial', async () => {
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
        await conversations.selectConversation(conversation1Api.name);
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
        await conversations.selectConversation(conversation2Export1.name);
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
        await conversations.selectConversation(conversation2Export2.name);
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
  'RecentModelIds[0] is updated if remove latest used model from My applications',
  async ({
    dialHomePage,
    chatBar,
    navigationPanel,
    chat,
    talkToAgentDialog,
    agentInfoAssertion,
    setTestIds,
    localStorageManager,
    agentDetailsModal,
    confirmationDialog,
    localStorageAssertion,
    chatAssertion,
    marketplaceAgentsSection,
    talkToAgentDialogAssertion,
  }) => {
    setTestIds('EPMRTC-4356');
    const models = GeneratorUtil.randomArrayElements(
      ModelsUtil.getLatestModels().filter((m) => m.iconUrl !== undefined),
      2,
    );
    const [firstModel, secondModel] = models;
    await localStorageManager.setRecentModelsIdsOnce(...models);
    await localStorageManager.setShowSideBarPanels();

    await dialTest.step('Open Dial', async () => {
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
        const firstModelElement =
          await marketplaceAgentsSection.findAgentElement(firstModel);
        await firstModelElement.click();
        await agentDetailsModal.removeBookmarkIcon.click();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'PUT' });
        await navigationPanel.backToChatButton.click();
      },
    );

    await dialTest.step(
      'Verify recentModelIds is updated and the second model is selected',
      async () => {
        await chatAssertion.assertAddAgentButtonState('visible');
        await chatBar.createNewEntity();
        await talkToAgentDialogAssertion.assertAgentIsSelected(secondModel);
        await talkToAgentDialog.cancelButton.click();
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
    setTestIds('EPMRTC-4882', 'EPMRTC-5165', 'EPMRTC-5164');
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
    await localStorageManager.setRecentModelsIdsOnce(...models);
    await localStorageManager.setShowSideBarPanels();

    await dialSharedWithMeTest.step('Open Dial by the main user', async () => {
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
        await conversations.selectConversation(sharedConversation1.name);
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
        await conversations.selectConversation(sharedConversation2.name);
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
