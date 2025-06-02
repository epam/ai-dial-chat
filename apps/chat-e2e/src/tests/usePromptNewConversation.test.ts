import { Publication } from '@/chat/types/publication';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import {
  Attachment,
  MenuOptions,
  MockedChatApiResponseBodies,
  UploadMenuOptions,
} from '@/src/testData';
import { FileModalSection } from '@/src/ui/webElements';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { PublishActions } from '@epam/ai-dial-shared';

dialTest(
  'Use own prompt for new conversation\n' +
    'Use own prompt for chat with history\n' +
    'Use prompt for chat with attached file\n' +
    'Use prompt for chats in Compare mode\n' +
    "prompt body is applied on 'Use' click into the Input message, in the end of existing content",
  async ({
    dialHomePage,
    prompts,
    promptDropdownMenu,
    sendMessageAssertion,
    setTestIds,
    promptData,
    dataInjector,
    sendMessage,
    chat,
    localStorageManager,
    attachFilesModal,
    attachmentDropdownMenu,
    fileApiHelper,
    sendMessageInputAttachmentsAssertions,
    chatBar,
    compare,
    sendMessageInputAttachments,
  }) => {
    setTestIds(
      'EPMRTC-5486',
      'EPMRTC-5487',
      'EPMRTC-5490',
      'EPMRTC-5512',
      'EPMRTC-5497',
    );
    // Select a model that allows file attachments
    const modelWithAttachment = GeneratorUtil.randomArrayElement(
      ModelsUtil.getLatestModelsWithAttachment(),
    );
    await localStorageManager.setRecentModelsIds(modelWithAttachment);

    const prompt = promptData.prepareDefaultPrompt();
    await dataInjector.createPrompts([prompt]);
    const initialMessage = GeneratorUtil.randomString(10);
    const message = GeneratorUtil.randomString(10);
    await localStorageManager.setShowSideBarPanels();
    await fileApiHelper.putFile(Attachment.sunImageName);

    await dialTest.step('Open the DIAL', async () => {
      await dialHomePage.openHomePage({
        iconsToBeLoaded: [modelWithAttachment.iconUrl],
      });
      await dialHomePage.waitForPageLoaded();
    });

    await dialTest.step(
      'Use prompt from context menu in the empty message text area',
      async () => {
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.use, {
          triggeredHttpMethod: 'GET',
        });
        await sendMessageAssertion.assertMessageValue(` ${prompt.content}`);
      },
    );

    await dialTest.step(
      'Type initial message and use the prompt from context menu',
      async () => {
        await sendMessage.messageInput.fillInInput(initialMessage);
        await sendMessageAssertion.assertMessageValue(initialMessage);
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.use);
        await sendMessageAssertion.assertMessageValue(
          `${initialMessage} ${prompt.content}`,
        );
      },
    );

    await dialTest.step(
      'Type message, get response, type data, and use prompt from context menu',
      async () => {
        await sendMessage.clearMessageInput();
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequestWithButton(message);
        await sendMessage.messageInput.fillInInput(initialMessage);
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.use);
        await sendMessageAssertion.assertMessageValue(
          `${initialMessage} ${prompt.content}`,
        );
      },
    );

    await dialTest.step(
      'Attach file, type message, and use prompt from context menu',
      async () => {
        await sendMessage.clearMessageInput();
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
        );
        await attachFilesModal.checkAttachedFile(
          Attachment.sunImageName,
          FileModalSection.AllFiles,
        );
        await attachFilesModal.attachFiles();
        await sendMessage.messageInput.fillInInput(initialMessage);
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.use);
        await sendMessageAssertion.assertMessageValue(
          `${initialMessage} ${prompt.content}`,
        );
        await sendMessageInputAttachmentsAssertions.assertAttachedFileState(
          Attachment.sunImageName,
          'visible',
        );
        await sendMessageInputAttachments
          .removeInputAttachmentIcon(Attachment.sunImageName)
          .click();
      },
    );

    await dialTest.step(
      'Enter compare mode and use prompt from context menu',
      async () => {
        await sendMessage.clearMessageInput();
        await chatBar.openCompareMode();
        await compare.waitForState({ state: 'visible' });
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.use);
        await sendMessageAssertion.assertMessageValue(` ${prompt.content}`);
      },
    );
  },
);

dialTest(
  'Use prompt with parameters for chat',
  async ({
    dialHomePage,
    prompts,
    promptDropdownMenu,
    sendMessageAssertion,
    setTestIds,
    promptData,
    dataInjector,
    sendMessage,
    conversations,
    conversationData,
    variableModalDialog,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-5493');
    const promptParam = 'testParam';
    const promptContent = `This is a prompt with a parameter: {{${promptParam}}}`;
    const prompt = promptData.preparePrompt(promptContent);
    const conversation = conversationData.prepareDefaultConversation();
    await dataInjector.createPrompts([prompt]);
    await dataInjector.createConversations([conversation]);
    const paramValue = GeneratorUtil.randomString(10);
    const initialMessage = GeneratorUtil.randomString(10);
    await localStorageManager.setShowSideBarPanels();

    await dialTest.step('Open DIAL', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
    });

    await dialTest.step(
      'Use prompt from context menu and input parameter value',
      async () => {
        await conversations.selectEntity(conversation.name);
        await sendMessage.messageInput.fillInInput(initialMessage);
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.use, {
          triggeredHttpMethod: 'GET',
        });
        await variableModalDialog.waitForState();
        await variableModalDialog.setVariableValue(promptParam, paramValue);
        await variableModalDialog.submitButton.click();
        await sendMessageAssertion.assertMessageValue(
          `${initialMessage} ${promptContent.replace(
            `{{${promptParam}}}`,
            paramValue,
          )}`,
        );
      },
    );
  },
);

dialTest(
  'Use prompt option is not available for Chat in Replay mode\n' +
    'Use prompt is available for chat in Replay mode when response generation was stopped\n' +
    'Use prompt option is not available for Chat in Playback mode',
  async ({
    dialHomePage,
    conversations,
    chatAssertion,
    prompts,
    promptDropdownMenuAssertion,
    setTestIds,
    conversationData,
    dataInjector,
    promptData,
    sendMessageAssertion,
    chat,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-5494', 'EPMRTC-5504', 'EPMRTC-5495');
    const conversation = conversationData.prepareDefaultConversation();
    conversationData.resetData();
    const conversation2 = conversationData.prepareDefaultConversation();
    conversationData.resetData();
    const replayConversation =
      conversationData.prepareDefaultReplayConversation(conversation);
    conversationData.resetData();
    const partiallyReplayedConversation =
      conversationData.preparePartiallyReplayedConversation(conversation2);
    conversationData.resetData();
    const playbackConversation =
      conversationData.prepareDefaultPlaybackConversation(conversation);
    const prompt = promptData.prepareDefaultPrompt();
    await dataInjector.createConversations([
      replayConversation,
      partiallyReplayedConversation,
      playbackConversation,
    ]);
    await dataInjector.createPrompts([prompt]);
    await localStorageManager.setShowSideBarPanels();

    await dialTest.step(
      'Select replay chat and verify "Start replay" screen',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(replayConversation.name);
        await chatAssertion.assertReplayButtonState('visible');
      },
    );

    await dialTest.step(
      'Verify "Use" option is not available for the prompt',
      async () => {
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenuAssertion.assertMenuOptionActionabilityState(
          MenuOptions.use,
          'disabled',
        );
      },
    );

    await dialTest.step(
      'Select partially replayed chat and verify "Continue replay" screen',
      async () => {
        await conversations.selectEntity(partiallyReplayedConversation.name);
        await sendMessageAssertion.assertContinueReplayButtonState('visible');
      },
    );

    await dialTest.step(
      'Hover over prompt and verify "Use" option is enabled',
      async () => {
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenuAssertion.assertMenuOptionActionabilityState(
          MenuOptions.use,
          'enabled',
        );
      },
    );

    await dialTest.step(
      'Select playback chat and verify "Use" option is disabled',
      async () => {
        await conversations.selectEntity(playbackConversation.name);
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenuAssertion.assertMenuOptionActionabilityState(
          MenuOptions.use,
          'disabled',
        );
      },
    );

    await dialTest.step(
      'Click "Continue" and verify "Use" option is still disabled',
      async () => {
        await chat.playNextChatMessage(false);
        await chat.playNextChatMessage(false);
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenuAssertion.assertMenuOptionActionabilityState(
          MenuOptions.use,
          'disabled',
        );
      },
    );
  },
);

const publicationsToUnpublish: Publication[] = [];

dialAdminTest(
  'Use prompt not available for chat from Organization\n' +
    'Use prompt not available for chat from Approve required.\n' +
    'Use prompt option is not available when publication request is selected.\n' +
    'Use prompt option is available for new conversation when publication request was previously selected',
  async ({
    dialHomePage,
    organizationConversations,
    prompts,
    promptDropdownMenuAssertion,
    setTestIds,
    promptData,
    adminDataInjector,
    dataInjector,
    conversationData,
    publishRequestBuilder,
    publicationApiHelper,
    adminPublicationApiHelper,
    adminDialHomePage,
    adminApproveRequiredConversations,
    adminChatBar,
    adminChat,
    localStorageManager,
    adminLocalStorageManager,
    adminPrompts,
    adminPromptDropdownMenuAssertion,
  }) => {
    setTestIds('EPMRTC-5499', 'EPMRTC-5500', 'EPMRTC-5496', 'EPMRTC-6037');
    const prompt = promptData.prepareDefaultPrompt();
    promptData.resetData();
    const adminPrompt = promptData.prepareDefaultPrompt();
    const conversationForApproval1 =
      conversationData.prepareDefaultConversation();
    conversationData.resetData();
    const conversationToPublish = conversationData.prepareDefaultConversation();
    conversationData.resetData();
    let approvedPublication: Publication;
    let notApprovedPublication: Publication;

    await dataInjector.createPrompts([prompt]);
    await adminDataInjector.createPrompts([adminPrompt]);
    await dataInjector.createConversations([
      conversationForApproval1,
      conversationToPublish,
    ]);
    await localStorageManager.setShowSideBarPanels();
    await adminLocalStorageManager.setShowSideBarPanels();

    await dialAdminTest.step('Publish and approve a conversation', async () => {
      const publishRequest = publishRequestBuilder
        .withName(GeneratorUtil.randomPublicationRequestName())
        .withConversationInFolderResource(
          conversationForApproval1,
          PublishActions.ADD,
        )
        .build();
      approvedPublication =
        await publicationApiHelper.createPublishRequest(publishRequest);
      publicationsToUnpublish.push(approvedPublication);
      await adminPublicationApiHelper.approveRequest(approvedPublication);
    });

    await dialAdminTest.step('Publish a conversation', async () => {
      const publishRequest = publishRequestBuilder
        .withName(GeneratorUtil.randomPublicationRequestName())
        .withConversationInFolderResource(
          conversationToPublish,
          PublishActions.ADD,
        )
        .build();
      notApprovedPublication =
        await publicationApiHelper.createPublishRequest(publishRequest);
    });

    await dialAdminTest.step(
      'Select chat from Organization section and verify "Use" option is disabled',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await organizationConversations.selectEntity(
          conversationForApproval1.name,
        );
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenuAssertion.assertMenuOptionActionabilityState(
          MenuOptions.use,
          'disabled',
        );
      },
    );

    await dialAdminTest.step(
      'Select publication request, go to review, and verify "Use" option is disabled',
      async () => {
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          notApprovedPublication.name!,
        );
        await adminApproveRequiredConversations.selectFolderEntity(
          notApprovedPublication.name!,
          conversationToPublish.name,
        );
        await adminPrompts.openEntityDropdownMenu(adminPrompt.name); // Use admin prompt
        await adminPromptDropdownMenuAssertion.assertMenuOptionActionabilityState(
          MenuOptions.use,
          'disabled',
        );
      },
    );

    await dialAdminTest.step(
      'Select publication request, open prompt dropdown menu and verify "Use" option is disabled',
      async () => {
        await adminApproveRequiredConversations.selectRequest(
          notApprovedPublication.name!,
        );
        await adminPrompts.openEntityDropdownMenu(adminPrompt.name);
        await adminPromptDropdownMenuAssertion.assertMenuOptionActionabilityState(
          MenuOptions.use,
          'disabled',
        );
      },
    );

    await dialAdminTest.step(
      'Select publication request, create new conversation, open prompt dropdown menu and verify "Use" option is enabled',
      async () => {
        await adminApproveRequiredConversations.selectRequest(
          notApprovedPublication.name!,
        );
        await adminChatBar.createNewEntity();
        await adminChat.configureSettingsButton.waitForState();
        await adminChat.changeAgentButton.waitForState();
        await adminPrompts.openEntityDropdownMenu(adminPrompt.name);
        await adminPromptDropdownMenuAssertion.assertMenuOptionActionabilityState(
          MenuOptions.use,
          'enabled',
        );
      },
    );
  },
);

dialTest(
  'Use prompt is not available for chat with not available agent\n' +
    'Use prompt is not available for chat with agent which not added to My workspace\n' +
    'Use prompt is not available for chat with not available addon',
  async ({
    dialHomePage,
    conversations,
    prompts,
    promptDropdownMenuAssertion,
    setTestIds,
    promptData,
    dataInjector,
    conversationData,
    chatAssertion,
    localStorageManager,
    talkToAgentDialog,
    navigationPanel,
    agentDetailsModal,
    confirmationDialog,
    chatHeader,
    marketplaceAgentsSection,
  }) => {
    setTestIds('EPMRTC-5506', 'EPMRTC-5507', 'EPMRTC-5508');
    const prompt = promptData.prepareDefaultPrompt();
    const nonExistentAppName = GeneratorUtil.randomApplicationName();

    const initialModel = GeneratorUtil.randomArrayElement(
      ModelsUtil.getLatestModels().filter((m) => m.iconUrl !== undefined),
    );
    const modelWithAddons = GeneratorUtil.randomArrayElement(
      ModelsUtil.getLatestModels().filter(
        (m) =>
          ModelsUtil.doesModelAllowAddons(m) &&
          m.iconUrl !== undefined &&
          m.id !== initialModel.id,
      ),
    );
    const nonExistentAddon = GeneratorUtil.randomString(10);

    // Conversations setup
    const conversationWithNonExistentApp =
      conversationData.prepareDefaultConversation(nonExistentAppName);
    conversationData.resetData();
    const conversationWithAModelToDelete =
      conversationData.prepareDefaultConversation(initialModel);
    conversationData.resetData();
    const conversationWithNonExistentAddon =
      conversationData.prepareModelConversation(
        1,
        'test',
        [nonExistentAddon],
        modelWithAddons,
      );

    await dataInjector.createPrompts([prompt]);
    await dataInjector.createConversations([
      conversationWithNonExistentApp,
      conversationWithAModelToDelete,
      conversationWithNonExistentAddon,
    ]);
    await localStorageManager.setRecentModelsIdsOnce(
      initialModel,
      modelWithAddons,
    );
    await localStorageManager.setShowSideBarPanels();

    await dialTest.step(
      'Open DIAL main page and select the chat with a non-existent agent',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(conversationWithNonExistentApp.name);
        await chatAssertion.assertNotAllowedModelLabelContent(); // Assert error message
      },
    );

    await dialTest.step(
      'Hover over a prompt and check context menu options',
      async () => {
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenuAssertion.assertMenuOptionActionabilityState(
          MenuOptions.use,
          'disabled',
        );
      },
    );

    await dialTest.step(
      'Open dial and select conversation, open My workspace, remove agent, and go back',
      async () => {
        await conversations.selectEntity(conversationWithAModelToDelete.name);
        await chatHeader.chatModelIcon.click();
        await talkToAgentDialog.goToMyWorkspace();
        const agentElement =
          await marketplaceAgentsSection.findAgentElement(initialModel);
        await agentElement.click();
        await agentDetailsModal.removeBookmarkIcon.click();
        await confirmationDialog.confirm();
        await navigationPanel.backToChat({ isHttpMethodTriggered: false });
      },
    );

    await dialTest.step(
      'Hover over a prompt and check context menu options',
      async () => {
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenuAssertion.assertMenuOptionActionabilityState(
          MenuOptions.use,
          'disabled',
        );
      },
    );

    await dialTest.step(
      'Select conversation with non-existent addon and verify "Use" prompt option is disabled',
      async () => {
        await conversations.selectEntity(conversationWithNonExistentAddon.name);
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenuAssertion.assertMenuOptionActionabilityState(
          MenuOptions.use,
          'disabled',
        );
      },
    );
  },
);

dialSharedWithMeTest(
  'Use prompt not available for chat from Shared with me\n' +
    `View prompt: 'Use prompt' button is disabled for just created new prompt if there is a chat without available input field selected.\n` +
    'Use prompt from "Shared with me" section for chat with history',
  async ({
    dialHomePage,
    sharedWithMeConversations,
    prompts,
    promptBar,
    promptModalDialog,
    promptDropdownMenuAssertion,
    setTestIds,
    promptData,
    additionalShareUserDataInjector,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    conversationData,
    localStorageManager,
    dataInjector,
    sendMessage,
    sendMessageAssertion,
    chatBar,
    promptDropdownMenu,
    promptPreviewModal,
    promptPreviewModalAssertion,
  }) => {
    setTestIds('EPMRTC-5498', 'EPMRTC-6042', 'EPMRTC-5488');
    const prompt = promptData.prepareDefaultPrompt();
    const model = GeneratorUtil.randomArrayElement(
      ModelsUtil.getLatestModels().filter((m) => m.iconUrl !== undefined),
    );
    const conversation = conversationData.prepareDefaultConversation(model);
    const initialMessage = GeneratorUtil.randomString(10);

    await additionalShareUserDataInjector.createConversations([conversation]);
    await dataInjector.createPrompts([prompt]);

    const shareConversationLink =
      await additionalUserShareApiHelper.shareEntityByLink([conversation]);
    await mainUserShareApiHelper.acceptInvite(shareConversationLink);

    const sharePromptLink = await mainUserShareApiHelper.shareEntityByLink([
      prompt,
    ]);
    await additionalUserShareApiHelper.acceptInvite(sharePromptLink);

    await localStorageManager.setRecentModelsIdsOnce(model);
    await localStorageManager.setShowSideBarPanels();

    await dialSharedWithMeTest.step(
      'Select chat from Shared with me section and verify "Use" prompt option is disabled',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await sharedWithMeConversations.selectEntity(conversation.name);
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenuAssertion.assertMenuOptionActionabilityState(
          MenuOptions.use,
          'disabled',
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Create a new prompt and verify "Use" prompt button is disabled within "View prompt" modal',
      async () => {
        await promptBar.createNewEntity();
        await promptModalDialog.fillPromptDetails(
          GeneratorUtil.randomString(5),
          undefined,
          GeneratorUtil.randomString(5),
        );
        await promptModalDialog.saveButton.click();
        await promptPreviewModalAssertion.assertPromptPreviewModalState(
          'visible',
        );
        await promptPreviewModalAssertion.assertElementActionabilityState(
          promptPreviewModal.usePromptButton,
          'disabled',
        );
        await promptPreviewModal.closeButton.click();
      },
    );

    await dialSharedWithMeTest.step(
      'Type message and use prompt from Shared with me',
      async () => {
        await chatBar.createNewEntity();
        await sendMessage.messageInput.fillInInput(initialMessage);
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.use, {
          triggeredHttpMethod: 'GET',
        });
        await sendMessageAssertion.assertMessageValue(
          `${initialMessage} ${prompt.content}`,
        );
      },
    );
  },
);

dialTest(
  'Use prompt from Organization for chat',
  async ({
    dialHomePage,
    sendMessageAssertion,
    setTestIds,
    promptData,
    dataInjector,
    sendMessage,
    localStorageManager,
    publicationApiHelper,
    adminPublicationApiHelper,
    publishRequestBuilder,
    organizationPrompts,
    promptDropdownMenu,
  }) => {
    setTestIds('EPMRTC-5489');
    let version = 1;
    const prompt1 = promptData.preparePrompt(GeneratorUtil.randomString(20));
    promptData.resetData();
    const prompt2 = promptData.preparePrompt(
      GeneratorUtil.randomString(20),
      prompt1.description,
      prompt1.name,
    );

    const initialMessage = GeneratorUtil.randomString(10);
    await localStorageManager.setShowSideBarPanels();

    await dialTest.step('Create and publish prompts one by one', async () => {
      for (const prompt of [prompt1, prompt2]) {
        await dataInjector.createPrompts([prompt]);
        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withPromptResource(prompt, PublishActions.ADD, `0.0.${version++}`)
          .build();
        const publication =
          await publicationApiHelper.createPublishRequest(publishRequest);
        publicationsToUnpublish.push(publication);
        await adminPublicationApiHelper.approveRequest(publication);
      }
    });

    await dialTest.step(
      'Open DIAL, type message, and use prompt from Organization',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await sendMessage.messageInput.fillInInput(initialMessage);
        await organizationPrompts.openEntityDropdownMenu(prompt2.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.use, {
          triggeredHttpMethod: 'GET',
        });
        await sendMessageAssertion.assertMessageValue(
          `${initialMessage} ${prompt2.content}`,
        );
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
