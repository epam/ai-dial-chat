import { Conversation } from '@/chat/types/chat';
import { Publication } from '@/chat/types/publication';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  Attachment,
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  MockedChatApiResponseBodies,
  UploadMenuOptions,
} from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { PublishActions } from '@epam/ai-dial-shared';

dialAdminTest(
  'Admin can not update chat from unpublish request.\n' +
    '"Add agent to My workspace to continue" is not displayed for conversation from (un)publish request if open info modal',
  async ({
    conversationData,
    publishRequestBuilder,
    publicationApiHelper,
    adminPublicationApiHelper,
    dataInjector,
    adminDialHomePage,
    adminApproveRequiredConversations,
    adminPublishingApprovalModal,
    adminChatMessages,
    adminPublicationReviewControl,
    adminChatHeader,
    setTestIds,
    adminLocalStorageManager,
    baseAssertion,
    adminTooltipAssertion,
    adminChatHeaderDropdownMenu,
    adminInformationModal,
    adminChatAssertion,
    adminConversationSettings,
    adminTalkToAgentDialog,
    adminConversationInfoTooltipAssertion,
    adminModelInfoTooltip,
    adminChatSettingsTooltip,
    adminApproveRequiredConversationDropdownMenuAssertion,
  }) => {
    setTestIds('EPMRTC-6472', 'EPMRTC-6665');
    let publishedConversation: Conversation;
    const unpublishRequestName = GeneratorUtil.randomUnpublishRequestName();
    let publication: Publication;
    const agent = ModelsUtil.getModels().find((m) => !m.isDefault)!;
    const adminModel = ModelsUtil.getDefaultAgent()!;

    await dialTest.step(
      'Create and approve single conversation publishing and unpublish request via API',
      async () => {
        await adminLocalStorageManager.setRecentModelsIdsAndUseLastModel(
          adminModel!,
        );
        publishedConversation = conversationData.prepareDefaultConversation(
          agent!,
        );
        await dataInjector.createConversations([publishedConversation]);

        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withConversationInFolderResource(
            publishedConversation,
            PublishActions.ADD,
          )
          .build();
        publication =
          await publicationApiHelper.createPublishRequest(publishRequest);
        await adminPublicationApiHelper.approveRequest(publication);

        publication.name = unpublishRequestName;
        await publicationApiHelper.createUnpublishRequest(publication);
        await adminLocalStorageManager.setShowSideBarPanels();
      },
    );

    await dialAdminTest.step(
      'Login as admin, open unpublish request and click on "Go to a review" link',
      async () => {
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          unpublishRequestName,
        );
        await adminPublishingApprovalModal.goToEntityReview();
      },
    );

    await dialAdminTest.step(
      'Verify message and response do not have any icons for update',
      async () => {
        for (const message of publishedConversation.messages) {
          await adminChatMessages.hoverOverMessage(message.content);
          const conversationMessage = adminChatMessages.getChatMessage(
            message.content,
          );
          await baseAssertion.assertElementState(
            conversationMessage,
            'visible',
          );
          await baseAssertion.assertElementState(
            adminChatMessages.messageRegenerateIcon(message.content),
            'hidden',
          );
          await baseAssertion.assertElementState(
            adminChatMessages.messageEditIcon(conversationMessage),
            'hidden',
          );
          await baseAssertion.assertElementState(
            adminChatMessages.messageDeleteIcon(message.content),
            'hidden',
          );
        }
      },
    );

    await dialAdminTest.step(
      'Verify there is no Edit icon in bottom near "Back to publication request" button',
      async () => {
        await baseAssertion.assertElementState(
          adminPublicationReviewControl.editButton,
          'hidden',
        );
      },
    );

    await dialAdminTest.step(
      `Verify agent's icon in the chat's header is not clickable, agent's name and version displayed on hover`,
      async () => {
        await adminChatHeader.hoverOverChatModel();
        await adminConversationInfoTooltipAssertion.assertElementText(
          adminModelInfoTooltip.modelInfo,
          agent.name,
          ExpectedMessages.chatInfoModelIsValid,
        );
        agent.version
          ? await adminConversationInfoTooltipAssertion.assertElementText(
              adminModelInfoTooltip.versionInfo,
              agent.version!,
              ExpectedMessages.agentVersionIsValid,
            )
          : await adminConversationInfoTooltipAssertion.assertElementState(
              adminModelInfoTooltip.versionInfo,
              'hidden',
            );
        // eslint-disable-next-line playwright/no-force-option
        await adminChatHeader.chatAgent.click({ force: true });
        await baseAssertion.assertElementState(
          adminTalkToAgentDialog,
          'hidden',
        );
      },
    );

    await dialAdminTest.step(
      `Verify settings icon in chat's header is not clickable, conversation settings is displayed on hover`,
      async () => {
        await adminChatHeader.hoverOverChatSettings();
        await adminTooltipAssertion.assertElementState(
          adminChatSettingsTooltip.promptInfo,
          'hidden',
        );
        await adminTooltipAssertion.assertElementText(
          adminChatSettingsTooltip.temperatureInfo,
          publishedConversation.temperature,
          ExpectedMessages.chatInfoTemperatureIsValid,
        );
        await adminTooltipAssertion.assertTooltipContains(
          ExpectedConstants.settingsTooltipWithoutChanges(agent.type),
        );
        // eslint-disable-next-line playwright/no-force-option
        await adminChatHeader.conversationSettings.click({ force: true });
        await baseAssertion.assertElementState(
          adminConversationSettings,
          'hidden',
        );
      },
    );

    await dialAdminTest.step(
      `Click on 3 dots in chat's header and check that there is no "Rename" option`,
      async () => {
        await adminChatHeader.dotsMenu.click();
        await adminApproveRequiredConversationDropdownMenuAssertion.assertMenuExcludesOptions(
          MenuOptions.rename,
        );
      },
    );

    await dialAdminTest.step(
      'Open and close Info modal and verify "Add to my workspace" is not visible',
      async () => {
        await adminChatHeaderDropdownMenu.selectMenuOption(MenuOptions.info, {
          triggeredHttpMethod: 'GET',
        });
        await adminInformationModal.cancelButton.click();
        await adminChatAssertion.assertAddAgentButtonState('hidden');
        await baseAssertion.assertElementState(
          adminPublicationReviewControl.backToPublicationRequestButton,
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Go back to the approval modal and check context menu for the chat in "Approve required" section',
      async () => {
        await adminPublicationReviewControl.backToPublicationRequest();
        await adminApproveRequiredConversations.openFolderEntityDropdownMenu(
          unpublishRequestName,
          publishedConversation.name,
        );
        await adminApproveRequiredConversationDropdownMenuAssertion.assertMenuExcludesOptions(
          MenuOptions.rename,
        );
      },
    );
  },
);

dialAdminTest(
  'Update settings of agent for chat from publication request.\n' +
    'Update agent for chat from publication request.\n' +
    'Edit existing message for chat from publication request Approve required.\n' +
    'Add new message to chat from publication request',
  async ({
    conversationData,
    publishRequestBuilder,
    publicationApiHelper,
    dataInjector,
    adminDialHomePage,
    adminApproveRequiredConversations,
    adminPublishingApprovalModal,
    adminChatHeader,
    setTestIds,
    adminLocalStorageManager,
    adminChatHeaderAssertion,
    adminConversationSettings,
    adminTalkToAgentDialog,
    adminChat,
    adminChatMessages,
    iconApiHelper,
    adminEntitySettingsAssertion,
    adminChatMessagesAssertion,
    adminPublicationReviewControl,
  }) => {
    setTestIds('EPMRTC-6736', 'EPMRTC-6737', 'EPMRTC-6475', 'EPMRTC-6485');
    let conversation: Conversation;
    const requestName = GeneratorUtil.randomPublicationRequestName();
    const newSystemPrompt = 'new system prompt';
    const newTemp = '0.5';
    const model = GeneratorUtil.randomArrayElement(
      ModelsUtil.getModels().filter(
        (m) =>
          !m.isDefault &&
          m.features?.temperature == true &&
          m.features?.systemPrompt == true,
      ),
    )!;
    const modelIcon = iconApiHelper.getEntityIcon(model);

    await dialTest.step(
      'Prepare conversation and publication request',
      async () => {
        conversation = conversationData.prepareDefaultConversation();
        await dataInjector.createConversations([conversation]);

        const publishRequest = publishRequestBuilder
          .withName(requestName)
          .withConversationInFolderResource(conversation, PublishActions.ADD)
          .build();
        await publicationApiHelper.createPublishRequest(publishRequest);
        await adminLocalStorageManager.setShowSideBarPanels();
      },
    );

    await dialAdminTest.step(
      'Login as admin, open publication request and click on "Go to a review" link',
      async () => {
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          requestName,
        );
        await adminPublishingApprovalModal.goToEntityReview();
        await adminChatHeaderAssertion.assertHeaderTitle(conversation.name);
      },
    );

    await dialAdminTest.step(
      'Edit 1st message, save and verify it is updated and response is regenerated',
      async () => {
        const updatedMessage = 'updated message';
        await adminDialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await adminChatMessages.openEditMessageMode(1);
        await adminChatMessages.editFirstMessage(updatedMessage);
        await adminChatMessagesAssertion.assertMessageContent(
          1,
          updatedMessage,
        );
        await adminChatMessagesAssertion.assertMessagesCount(2);
      },
    );

    await dialAdminTest.step(
      'Add new message and verify it is added and response is received',
      async () => {
        const newMessage = 'new message';
        await adminPublicationReviewControl.editButton.click();
        await adminChat.sendRequestWithButton(newMessage);
        await adminChatMessagesAssertion.assertLastMessageContent('response');
        await adminChatMessagesAssertion.assertMessagesCount(4);
      },
    );

    await dialAdminTest.step(
      'Click on agent icon, select another agent and verify it is updated',
      async () => {
        await adminChatHeader.chatAgent.click();
        await adminTalkToAgentDialog.selectAgent(model.name, {
          isHttpMethodTriggered: true,
          triggeredHttpMethod: 'POST',
        });
        await adminPublicationReviewControl.editButton.click();
        await adminChatHeaderAssertion.assertHeaderIcon(modelIcon);
      },
    );

    await dialAdminTest.step(
      'Click on settings icon, update settings and save changes',
      async () => {
        await adminChatHeader.openConversationSettingsPopup();
        const agentSettings = adminConversationSettings.getAgentSettings();
        await agentSettings.setSystemPrompt(newSystemPrompt);
        const temperatureSlider = agentSettings.getTemperatureSlider();
        await temperatureSlider.setTemperature(newTemp);
        await adminConversationSettings.applyChangesButton.click();
        await adminChatHeader.openConversationSettingsPopup();
        await adminEntitySettingsAssertion.assertSystemPromptValue(
          newSystemPrompt,
        );
        await adminEntitySettingsAssertion.assertTemperature(newTemp);
        await adminConversationSettings.cancelButton.click();
      },
    );

    await dialAdminTest.step(
      'Send a message and verify response is received',
      async () => {
        await adminChat.sendRequestWithButton('test');
        await adminChatMessages.waitForResponseReceived();
      },
    );
  },
);

dialAdminTest(
  'Regenerate last message for chat form publication request.\n' +
    'Edit chat: remove all messages.\n' +
    '[Admin view][Edit request]: Edit chat icon stays after it was clicked and message input is displayed',
  async ({
    conversationData,
    publishRequestBuilder,
    publicationApiHelper,
    dataInjector,
    adminDialHomePage,
    adminApproveRequiredConversations,
    adminPublishingApprovalModal,
    setTestIds,
    adminLocalStorageManager,
    adminChatHeaderAssertion,
    adminChatMessages,
    adminChatMessagesAssertion,
    adminPublicationReviewControl,
    adminTooltipAssertion,
    baseAssertion,
    adminConfirmationDialog,
    adminSendMessage,
  }) => {
    setTestIds('EPMRTC-6488', 'EPMRTC-6483', 'EPMRTC-6489');
    let conversation: Conversation;
    const requestName = GeneratorUtil.randomPublicationRequestName();

    await dialTest.step(
      'Prepare conversation and publication request',
      async () => {
        conversation = conversationData.prepareDefaultConversation();
        await dataInjector.createConversations([conversation]);

        const publishRequest = publishRequestBuilder
          .withName(requestName)
          .withConversationInFolderResource(conversation, PublishActions.ADD)
          .build();
        await publicationApiHelper.createPublishRequest(publishRequest);
        await adminLocalStorageManager.setShowSideBarPanels();
      },
    );

    await dialAdminTest.step(
      'Login as admin, open publication request and click on "Go to a review" link',
      async () => {
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          requestName,
        );
        await adminPublishingApprovalModal.goToEntityReview();
        await adminChatHeaderAssertion.assertHeaderTitle(conversation.name);
      },
    );

    await dialAdminTest.step(
      'Click on Edit icon and verify it is visible and message input is displayed',
      async () => {
        await baseAssertion.assertElementState(
          adminSendMessage.messageInput,
          'hidden',
        );
        await adminPublicationReviewControl.editButton.click();
        await baseAssertion.assertElementState(
          adminPublicationReviewControl.editButton,
          'visible',
        );
        await baseAssertion.assertElementState(
          adminSendMessage.messageInput,
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Regenerate last response and verify it is regenerated',
      async () => {
        await adminDialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await adminChatMessages.regenerateResponse();
        await adminChatMessagesAssertion.assertLastMessageContent('response');
      },
    );

    await dialAdminTest.step(
      'Remove all messages, go back to publication request and verify Approve button is disabled',
      async () => {
        const messagesCount =
          await adminChatMessages.chatMessages.getElementsCount();
        for (let i = messagesCount; i > 0; i = i - 2) {
          const message = adminChatMessages.getChatMessage(i - 1);
          await message.hover();
          await adminChatMessages.messageDeleteIcon(i - 1).click();
          await adminConfirmationDialog.confirm({ triggeredHttpMethod: 'PUT' });
          await adminChatMessages
            .getChatMessage(i - 2)
            .waitFor({ state: 'detached' });
        }
        await adminPublicationReviewControl.backToPublicationRequest();
        await baseAssertion.assertElementActionabilityState(
          adminPublishingApprovalModal.approveButton,
          'disabled',
        );
        await adminPublishingApprovalModal.approveButton.hoverOver();
        await adminTooltipAssertion.assertTooltipContent(
          ExpectedMessages.requestCannotBeApproved,
        );
      },
    );
  },
);

dialAdminTest(
  '[Admin view][Edit request]: Edit button is not displayed for the chat in Playback mode in publish request',
  async ({
    conversationData,
    publishRequestBuilder,
    publicationApiHelper,
    dataInjector,
    adminDialHomePage,
    adminApproveRequiredConversations,
    adminPublishingApprovalModal,
    setTestIds,
    adminLocalStorageManager,
    baseAssertion,
    adminPublicationReviewControl,
  }) => {
    setTestIds('EPMRTC-6498');
    let conversation: Conversation;
    let playbackConversation: Conversation;
    const requestName = GeneratorUtil.randomPublicationRequestName();

    await dialTest.step(
      'Prepare playback conversation and publication request',
      async () => {
        conversation = conversationData.prepareDefaultConversation();
        playbackConversation =
          conversationData.prepareDefaultPlaybackConversation(conversation);
        await dataInjector.createConversations([
          conversation,
          playbackConversation,
        ]);

        const publishRequest = publishRequestBuilder
          .withName(requestName)
          .withConversationInFolderResource(
            playbackConversation,
            PublishActions.ADD,
          )
          .build();
        await publicationApiHelper.createPublishRequest(publishRequest);
        await adminLocalStorageManager.setShowSideBarPanels();
      },
    );

    await dialAdminTest.step(
      'Login as admin, open publication request and click on "Go to a review" link',
      async () => {
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          requestName,
        );
        await adminPublishingApprovalModal.goToEntityReview({
          isHttpMethodTriggered: false,
        });
      },
    );

    await dialAdminTest.step(
      'Verify there is no Edit icon in bottom near "Back to publication request" button',
      async () => {
        await baseAssertion.assertElementState(
          adminPublicationReviewControl.editButton,
          'hidden',
        );
      },
    );
  },
);

dialAdminTest(
  '[Admin view][Edit chat] Added file appears in review. User sends new prompt.\n' +
    '[Admin view][Edit chat] Added file appears in review. User updates old prompt.\n' +
    '[Admin view][Edit chat] Deleted file in chat history stays in review',
  async ({
    conversationData,
    publishRequestBuilder,
    publicationApiHelper,
    dataInjector,
    adminDialHomePage,
    adminApproveRequiredConversations,
    adminPublishingApprovalModal,
    setTestIds,
    adminLocalStorageManager,
    adminChatMessagesAssertion,
    adminSendMessage,
    adminPublicationReviewControl,
    adminFileApiHelper,
    adminAttachmentDropdownMenu,
    adminAttachFilesModal,
    adminChatHeaderAssertion,
    adminFilesToApproveAssertion,
    adminChatMessages,
    adminInputAttachments,
    adminChat,
  }) => {
    setTestIds('EPMRTC-6599', 'EPMRTC-6607', 'EPMRTC-6604');
    let conversation: Conversation;
    const requestName = GeneratorUtil.randomPublicationRequestName();
    const model = GeneratorUtil.randomArrayElement(
      ModelsUtil.getLatestModelsWithAttachment(),
    );
    const newPrompt = 'what is on the picture?';

    await dialTest.step(
      'Prepare conversation with attachment-supported model, two files and publication request',
      async () => {
        await adminFileApiHelper.putFile(Attachment.sunImageName);
        await adminFileApiHelper.putFile(Attachment.cloudImageName);
        conversation = conversationData.prepareDefaultConversation(model);
        await dataInjector.createConversations([conversation]);

        const publishRequest = publishRequestBuilder
          .withName(requestName)
          .withConversationInFolderResource(conversation, PublishActions.ADD)
          .build();
        await publicationApiHelper.createPublishRequest(publishRequest);
        await adminLocalStorageManager.setShowSideBarPanels();
      },
    );

    await dialAdminTest.step(
      'Login as admin, open publication request and click on "Go to a review" link',
      async () => {
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          requestName,
        );
        await adminPublishingApprovalModal.goToEntityReview({
          isHttpMethodTriggered: false,
        });
        await adminChatHeaderAssertion.assertHeaderTitle(conversation.name);
      },
    );

    await dialAdminTest.step(
      'Attach file to the first message, save and verify response is regenerated',
      async () => {
        await adminDialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        const firstMessage = conversation.messages[0].content;
        await adminChatMessages.openEditMessageMode(firstMessage);
        await adminChatMessages.getChatMessageClipIcon(firstMessage).click();
        await adminAttachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
        );
        await adminAttachFilesModal.checkAttachedFile(
          Attachment.cloudImageName,
        );
        await adminAttachFilesModal.attachFiles();
        await adminChat.saveAndSubmitRequest(true);
        await adminChatMessagesAssertion.assertMessagesCount(2);
        await adminChatMessagesAssertion.assertLastMessageContent('response');
      },
    );

    await dialAdminTest.step(
      'Click on Edit button, attach file, send new message and verify response is received',
      async () => {
        await adminPublicationReviewControl.editButton.click();
        await adminSendMessage.attachmentMenuTrigger.click();
        await adminAttachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
        );
        await adminAttachFilesModal.checkAttachedFile(Attachment.sunImageName);
        await adminAttachFilesModal.attachFiles();
        await adminChat.sendRequestWithButton(newPrompt);
        await adminChatMessagesAssertion.assertLastMessageContent('response');
      },
    );

    await dialAdminTest.step(
      'Click on "Back to publication request" and verify both files are displayed in request',
      async () => {
        await adminPublicationReviewControl.backToPublicationRequest();
        await adminFilesToApproveAssertion.assertEntityState(
          { name: Attachment.sunImageName },
          'visible',
        );
        await adminFilesToApproveAssertion.assertEntityState(
          { name: Attachment.cloudImageName },
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Go back to review, remove attachment from the first message and verify it stays in review',
      async () => {
        await adminPublishingApprovalModal.goToEntityReview({
          isHttpMethodTriggered: false,
        });
        const firstMessage = conversation.messages[0].content;
        await adminChatMessages.openEditMessageMode(firstMessage);
        await adminInputAttachments
          .removeInputAttachmentIcon(Attachment.cloudImageName)
          .click();
        await adminChat.saveAndSubmitRequest(true);
        await adminChatMessagesAssertion.assertMessageContent(1, firstMessage);
        await adminPublicationReviewControl.backToPublicationRequest();
        await adminFilesToApproveAssertion.assertEntityState(
          { name: Attachment.sunImageName },
          'visible',
        );
        await adminFilesToApproveAssertion.assertEntityState(
          { name: Attachment.cloudImageName },
          'visible',
        );
      },
    );
  },
);

dialAdminTest(
  '[Admin view][Edit chat] Generated file by agent appears in review',
  async ({
    conversationData,
    publishRequestBuilder,
    publicationApiHelper,
    dataInjector,
    adminDialHomePage,
    adminApproveRequiredConversations,
    adminPublishingApprovalModal,
    setTestIds,
    adminLocalStorageManager,
    adminChatMessagesAssertion,
    adminPublicationReviewControl,
    adminFilesToApproveAssertion,
    adminFileApiHelper,
    adminChat,
  }) => {
    setTestIds('EPMRTC-6605');
    let conversation: Conversation;
    const requestName = GeneratorUtil.randomPublicationRequestName();
    const model = GeneratorUtil.randomArrayElement(
      ModelsUtil.getLatestModelsWithAttachment(),
    );
    const newPrompt = 'generate a picture';
    let publicationBucket: string;

    await dialTest.step(
      'Prepare conversation with attachment-supported model and publication request',
      async () => {
        conversation = conversationData.prepareDefaultConversation(model!);
        await dataInjector.createConversations([conversation]);

        const publishRequest = publishRequestBuilder
          .withName(requestName)
          .withConversationInFolderResource(conversation, PublishActions.ADD)
          .build();
        const publication =
          await publicationApiHelper.createPublishRequest(publishRequest);
        publicationBucket =
          publicationApiHelper.getPublicationBucket(publication);
        const imageUrl = await adminFileApiHelper.putFile(
          Attachment.sunImageName,
          {
            parentPath: API.modelFilePath(model.id),
          },
        );
        await adminFileApiHelper.putFileToPublicationBucket(
          publication,
          imageUrl,
        );
        await adminLocalStorageManager.setShowSideBarPanels();
      },
    );

    await dialAdminTest.step(
      'Login as admin, open publication request and click on "Go to a review" link',
      async () => {
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          requestName,
        );
        await adminPublishingApprovalModal.goToEntityReview();
      },
    );

    await dialAdminTest.step(
      'Click on Edit button, send new message and verify response is received',
      async () => {
        await adminPublicationReviewControl.editButton.click();
        await adminDialHomePage.mockChatImageResponse(
          model.id,
          Attachment.sunImageName,
          { customPath: `${API.filesHostSegment}/${publicationBucket}` },
        );
        await adminChat.sendRequestWithButton(newPrompt);
        await adminChatMessagesAssertion.assertMessageDownloadUrl(
          4,
          `${API.filesHostSegment}/${publicationBucket}/${Attachment.sunImageName}`,
        );
      },
    );

    await dialAdminTest.step(
      'Click on "Back to publication request" and verify generated file is displayed in request',
      async () => {
        await adminPublicationReviewControl.backToPublicationRequest();
        await adminFilesToApproveAssertion.assertEntityState(
          { name: Attachment.sunImageName },
          'visible',
        );
      },
    );
  },
);
