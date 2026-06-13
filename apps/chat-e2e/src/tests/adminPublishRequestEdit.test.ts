import { Conversation } from '@/chat/types/chat';
import { Publication, PublicationRequestModel } from '@/chat/types/publication';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  Attachment,
  ExpectedConstants,
  ExpectedMessages,
  FolderConversation,
  MenuOptions,
  MockedChatApiResponseBodies,
  UploadMenuOptions,
} from '@/src/testData';
import { DateUtil, GeneratorUtil, ModelsUtil, UserUtil } from '@/src/utils';
import { PublishActions } from '@epam/ai-dial-shared';
import path from 'path';

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
        await adminChatHeader.chatAgent.click();
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
        await adminChatHeader.conversationSettings.click();
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
        await adminInformationModal.getCloseButton().click();
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
          m.id !== ModelsUtil.getDefaultAgent()?.id &&
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
        await adminTalkToAgentDialog.selectAgent(model, {
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
    adminFileManagerModal,
    adminFileManagerModalGrid,
    adminChatHeaderAssertion,
    adminPublishFilesAssertion,
    adminChatMessages,
    adminInputAttachments,
    adminChat,
  }) => {
    setTestIds('EPMRTC-6599', 'EPMRTC-6607', 'EPMRTC-6604');
    let conversation: Conversation;
    const requestName = GeneratorUtil.randomPublicationRequestName();
    const model = GeneratorUtil.randomArrayElement(
      ModelsUtil.getLatestModelsWithAttachment().filter(
        (m) =>
          m.inputAttachmentTypes?.length == 1 &&
          m.inputAttachmentTypes[0] === Attachment.imageTypesExtension,
      ),
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
          { triggeredHttpMethod: 'GET', apiHost: API.filesListingHost() },
        );
        const attachmentCheckbox =
          await adminFileManagerModalGrid.gridCheckboxByNameCell(
            Attachment.cloudImageName,
          );
        await attachmentCheckbox.click();
        await adminFileManagerModal.getAttachButton().click();
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
          { triggeredHttpMethod: 'GET', apiHost: API.filesListingHost() },
        );
        const attachmentCheckbox =
          await adminFileManagerModalGrid.gridCheckboxByNameCell(
            Attachment.sunImageName,
          );
        await attachmentCheckbox.click();
        await adminFileManagerModal.getAttachButton().click();
        await adminChat.sendRequestWithButton(newPrompt);
        await adminChatMessagesAssertion.assertLastMessageContent('response');
      },
    );

    await dialAdminTest.step(
      'Click on "Back to publication request" and verify both files are displayed in request',
      async () => {
        await adminPublicationReviewControl.backToPublicationRequest();
        await adminPublishFilesAssertion.assertEntityState(
          { name: Attachment.sunImageName },
          'visible',
        );
        await adminPublishFilesAssertion.assertEntityState(
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
        await adminPublishFilesAssertion.assertEntityState(
          { name: Attachment.sunImageName },
          'visible',
        );
        await adminPublishFilesAssertion.assertEntityState(
          { name: Attachment.cloudImageName },
          'visible',
        );
      },
    );
  },
);

dialAdminTest(
  '[Admin view][Edit chat] Generated file by agent appears in review.\n' +
    'Organization: The chat with a generated file is published\n' +
    'Organization: the chat with added by user file is published\n' +
    '[Admin view][Edit chat] Re-generated file by agent appears in review. Initial file stays\n' +
    "Edit file's name attached to chat\n" +
    'Edit file name: download renamed file',
  async (
    {
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
      adminPublishFilesAssertion,
      adminFileApiHelper,
      adminChat,
      dialHomePage,
      organizationConversations,
      localStorageManager,
      chatMessagesAssertion,
      fileManagerToolbar,
      fileManagerGridAssertion,
      navigationPanel,
      fileApiHelper,
      adminFileManagerModal,
      adminFileManagerModalGrid,
      adminChatMessages,
      adminAttachmentDropdownMenu,
      adminSendMessage,
      baseAssertion,
      adminFilesToApproveTree,
    },
    testInfo,
  ) => {
    setTestIds(
      'EPMRTC-6605',
      'EPMRTC-6608',
      'EPMRTC-6609',
      'EPMRTC-6606',
      'EPMRTC-6464',
      'EPMRTC-6798',
      'EPMRTC-6797',
    );
    let conversation: Conversation;
    const requestName = GeneratorUtil.randomPublicationRequestName();
    const model = GeneratorUtil.randomArrayElement(
      ModelsUtil.getLatestModelsWithAttachment(true, ['*/*']),
    );
    const requestPrompt = 'generate a picture';
    let publicationBucket: string;
    let publication: Publication;
    let updatedCloudImageName: string;

    await dialTest.step(
      'Prepare conversation with attachment-supported model and publication request',
      async () => {
        const imageUrl1 = await fileApiHelper.putFile(
          Attachment.cloudImageName,
          {
            parentPath: API.modelFilePath(model.id),
          },
        );
        await adminFileApiHelper.putFile(Attachment.flowerImageName);
        await adminFileApiHelper.putFile(Attachment.longImageName);
        const mockResponseImageUrl = await adminFileApiHelper.putFile(
          Attachment.heartImageName,
        );

        const attachmentConversation =
          conversationData.prepareConversationWithAttachmentInResponse(
            imageUrl1,
            model!,
          );
        conversationData.resetData();
        const textConversation =
          conversationData.prepareDefaultConversation(model);
        conversationData.resetData();
        conversation = conversationData.prepareHistoryConversation(
          attachmentConversation,
          textConversation,
        );
        await dataInjector.createConversations([conversation]);

        const publishRequest = publishRequestBuilder
          .withName(requestName)
          .withDisplayAuthor(UserUtil.getE2EUsername(testInfo.parallelIndex))
          .withConversationInFolderResource(conversation, PublishActions.ADD)
          .withFileResource(imageUrl1, PublishActions.ADD_IF_ABSENT)
          .build();
        publication =
          await publicationApiHelper.createPublishRequest(publishRequest);
        publicationBucket =
          publicationApiHelper.getPublicationBucket(publication);
        await adminFileApiHelper.putFileToPublicationBucket(
          publication,
          mockResponseImageUrl,
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

    await dialAdminTest.step('Toggle edit mode', async () => {
      await adminPublicationReviewControl.editButton.click();
      await adminDialHomePage.mockChatImageResponse(
        model.id,
        Attachment.heartImageName,
        { customPath: `${API.filesHostSegment}/${publicationBucket}` },
      );
    });

    await dialAdminTest.step(
      'By administrator regenerate the last message and check that re-generated file appears in the publication request',
      async () => {
        await adminChatMessages.regenerateResponse();
        await adminChatMessagesAssertion.assertMessageDownloadUrl(
          4,
          `${API.filesHostSegment}/${publicationBucket}/${Attachment.heartImageName}`,
        );
        await adminPublicationReviewControl.backToPublicationRequest();
        await adminPublishFilesAssertion.assertEntityState(
          { name: Attachment.heartImageName },
          'visible',
        );
        await adminPublishingApprovalModal.goToEntityReview();
        await adminPublicationReviewControl.editButton.click();
      },
    );

    await dialAdminTest.step(
      'By administrator update user-message with new file',
      async () => {
        await adminChatMessages.openEditMessageMode(3);
        await adminChatMessages.getChatMessageClipIcon(3).click();
        await adminAttachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
          { isHttpMethodTriggered: true, triggeredHttpMethod: 'GET' },
        );
        const attachmentCheckbox =
          await adminFileManagerModalGrid.gridCheckboxByNameCell(
            Attachment.flowerImageName,
          );
        await attachmentCheckbox.click();
        await adminFileManagerModal.getAttachButton().click();
        await adminChat.saveAndSubmitRequest(true);
        await adminChatMessagesAssertion.assertMessageDownloadUrl(
          3,
          `${API.filesHostSegment}/${publicationBucket}/${Attachment.flowerImageName}`,
        );
        await adminChatMessagesAssertion.assertMessageDownloadUrl(
          4,
          `${API.filesHostSegment}/${publicationBucket}/${Attachment.heartImageName}`,
        );
      },
    );

    await dialAdminTest.step(
      'Send new message and verify response is received',
      async () => {
        await adminChat.sendRequestWithButton(requestPrompt);
        await adminChatMessagesAssertion.assertMessageDownloadUrl(
          2,
          `${API.filesHostSegment}/${publicationBucket}/${Attachment.cloudImageName}`,
        );
        await adminChatMessagesAssertion.assertMessageDownloadUrl(
          6,
          `${API.filesHostSegment}/${publicationBucket}/${Attachment.heartImageName}`,
        );
      },
    );

    await dialAdminTest.step(
      'Send new message with attachment and verify response is received',
      async () => {
        await adminSendMessage.attachmentMenuTrigger.click();
        await adminAttachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
          { isHttpMethodTriggered: true, triggeredHttpMethod: 'GET' },
        );
        const attachmentCheckbox =
          await adminFileManagerModalGrid.gridCheckboxByNameCell(
            Attachment.longImageName,
          );
        await attachmentCheckbox.click();
        await adminFileManagerModal.getAttachButton().click();
        await adminChat.sendRequestWithButton(requestPrompt);
        await adminChatMessagesAssertion.assertMessageDownloadUrl(
          7,
          `${API.filesHostSegment}/${publicationBucket}/${Attachment.longImageName}`,
        );
        await adminChatMessagesAssertion.assertMessageDownloadUrl(
          8,
          `${API.filesHostSegment}/${publicationBucket}/${Attachment.heartImageName}`,
        );
      },
    );

    await dialAdminTest.step(
      'Click on "Back to publication request" and verify generated file and the previous file are displayed in request',
      async () => {
        await adminPublicationReviewControl.backToPublicationRequest();
        for (const attach of [
          Attachment.cloudImageName,
          Attachment.heartImageName,
          Attachment.flowerImageName,
          Attachment.longImageName,
        ]) {
          await adminPublishFilesAssertion.assertEntityState(
            { name: attach },
            'visible',
          );
        }

        //TODO issueId: 5022
        // const filesToApproveTree =
        //   adminPublishingApprovalModal.getFilesToApproveTree();
        // const fileNames = await filesToApproveTree.getAllTreeEntitiesNames();
        // baseAssertion.assertStringsSorting(fileNames, 'asc');
      },
    );

    await dialAdminTest.step(
      'Click edit request, update filename, click update request button and verify updated filename is displayed',
      async () => {
        updatedCloudImageName =
          Attachment.cloudImageName.split('.')[0] +
          '_updated.' +
          Attachment.cloudImageName.split('.')[1];
        await adminPublishingApprovalModal.editButton.click();
        await adminPublishingApprovalModal.renameFileToApprove(
          Attachment.cloudImageName,
          updatedCloudImageName,
        );
        await adminPublishingApprovalModal.updateRequest();
        await adminPublishFilesAssertion.assertEntityState(
          { name: updatedCloudImageName },
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Assert that file can be downloaded and has the updated name and extension',
      async () => {
        const downloadedData = await adminDialHomePage.downloadData(() =>
          adminFilesToApproveTree
            .getFileDownloadIcon(updatedCloudImageName)
            .click(),
        );
        const downloadedPath = downloadedData.path as string;
        const downloadedFileName = downloadedPath.split(path.sep)[
          downloadedPath.split(path.sep).length - 1
        ];
        baseAssertion.assertValuesAreEqual(
          downloadedFileName,
          updatedCloudImageName,
          ExpectedMessages.attachmentIsSuccessfullyDownloaded,
        );
      },
    );

    await dialAdminTest.step('Approve the request', async () => {
      await adminPublishingApprovalModal.approveRequest();
    });

    await dialTest.step(
      'As a user, check that the chat is available in the organization and attachments are visible',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await organizationConversations.selectEntity(conversation.name);

        const expectedAttachments: Record<number, string> = {
          2: updatedCloudImageName,
          3: Attachment.flowerImageName,
          4: Attachment.heartImageName,
          6: Attachment.heartImageName,
          7: Attachment.longImageName,
          8: Attachment.heartImageName,
        };

        for (const [messageIndex, attachmentName] of Object.entries(
          expectedAttachments,
        )) {
          await chatMessagesAssertion.assertMessageDownloadUrl(
            Number(messageIndex),
            `${API.publicFilesHost()}/${attachmentName}`,
          );
        }
      },
    );

    await dialTest.step(
      'Open "File manager" page and verify all files stay at the Organization tab',
      async () => {
        await navigationPanel.goToFileManager();
        await fileManagerToolbar.organizationTab.click();
        for (const attach of [
          updatedCloudImageName,
          Attachment.heartImageName,
          Attachment.flowerImageName,
          Attachment.longImageName,
        ]) {
          await fileManagerGridAssertion.assertGridRowByNameState(
            attach,
            'visible',
          );
        }
      },
    );
  },
);

dialAdminTest(
  '[Admin view][Edit request]: Rename the chat while edit the request.\n' +
    '[Admin view][Edit request]: Rename the chat though the menu in chat header.\n' +
    "[Admin view][Edit request]: Rename the chat through the context menu on the 'Conversations' panel.\n" +
    'Edit author public name. Updated name displayed in Info only after request approved\n + ' +
    '[Admin view][Edit request]: Rename the chat. Special symbols are allowed ( not restricted)\n' +
    '[Admin view][Edit request] Rename the chat several times in a row\n' +
    // "[Admin view][Edit request]: Rename author's public name. Special symbols are allowed (not restricted)\n" +
    'Dot at the end of public author name is permitted\n' +
    '[Admin view][Edit request] Rename the chat with _ underscore sign at the end',
  async (
    {
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
      adminPublishingApprovalModalAssertion,
      adminChatHeader,
      adminChatHeaderDropdownMenu,
      adminRenameConversationModal,
      adminPublicationReviewControl,
      adminApproveRequiredConversationDropdownMenu,
      adminApproveRequiredConversationsAssertion,
      dialHomePage,
      organizationConversations,
      conversationDropdownMenu,
      informationModalAssertion,
      informationModal,
      localStorageManager,
      adminPublishConversationsTreeAssertion,
    },
    testInfo,
  ) => {
    setTestIds(
      'EPMRTC-6474',
      'EPMRTC-6493',
      'EPMRTC-6658',
      'EPMRTC-6456',
      'EPMRTC-6787',
      'EPMRTC-6550',
      // 'EPMRTC-6789',
      'EPMRTC-6502',
      'EPMRTC-6567',
    );
    const conversation: Conversation =
      conversationData.prepareDefaultConversation(
        undefined,
        `${GeneratorUtil.randomConversationName()}___`,
      );
    const requestName = GeneratorUtil.randomPublicationRequestName();
    let updatedName: string;
    let publishRequest: PublicationRequestModel = publishRequestBuilder.build();
    let publicAuthorName: string;
    const currentDate = DateUtil.getCurrentLocalDate();
    const conversationVersion = ExpectedConstants.defaultEntityVersion;

    await dialTest.step(
      'Create a default publication request for chat via API',
      async () => {
        await dataInjector.createConversations([conversation]);
        publishRequest = publishRequestBuilder
          .withName(requestName)
          .withDisplayAuthor(UserUtil.getE2EUsername(testInfo.parallelIndex))
          .withConversationInFolderResource(conversation, PublishActions.ADD)
          .build();
        await publicationApiHelper.createPublishRequest(publishRequest);
        await adminLocalStorageManager.setShowSideBarPanels();
        updatedName = conversation.name;
      },
    );

    await dialAdminTest.step(
      'By admin open publication request and click Edit button',
      async () => {
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          requestName,
        );
        await adminPublishingApprovalModal.editButton.click();
      },
    );

    const conversationRenamingTestSteps = [
      {
        title:
          'Update the name for the chat to have only one underscore at the end and check the chat name and version',
        name: `${GeneratorUtil.randomConversationName()}_`,
      },
      {
        title:
          'Update the chat name to have three underscores at the end again and check the chat name and version',
        name: `${GeneratorUtil.randomConversationName()}___`,
      },
      {
        title:
          "Update chat's name, click Update request button and verify updated chat's name is displayed in the sidebar",
        name: `${conversation.name}_${GeneratorUtil.randomString(7)}_1`,
      },
    ];

    for (const testCase of conversationRenamingTestSteps) {
      await dialAdminTest.step(testCase.title, async () => {
        await adminPublishingApprovalModal.renameConversationToApprove(
          updatedName,
          testCase.name,
        );
        await adminPublishingApprovalModal.updateRequest();

        await adminPublishConversationsTreeAssertion.assertEntityState(
          { name: testCase.name },
          'visible',
        );
        await adminPublishConversationsTreeAssertion.assertEntityVersion(
          { name: testCase.name },
          conversationVersion,
        );
        await adminApproveRequiredConversationsAssertion.assertFolderEntityState(
          { name: requestName },
          { name: testCase.name },
          'visible',
        );
        updatedName = testCase.name;
      });
    }

    await dialAdminTest.step(
      `Click "Go to a review" link and view chat's name on chat's details screen`,
      async () => {
        await adminPublishingApprovalModal.goToEntityReview({
          isHttpMethodTriggered: false,
        });
        await adminChatHeaderAssertion.assertHeaderTitle(updatedName);
      },
    );

    await dialAdminTest.step(
      "In chat's header update chat's name and verify the updated name is displayed in chat's header and sidebar",
      async () => {
        await adminChatHeader.dotsMenu.click();
        await adminChatHeaderDropdownMenu.selectMenuOption(MenuOptions.rename);
        updatedName = `${conversation.name}_${GeneratorUtil.randomString(7)}_2`;
        await adminRenameConversationModal.editConversationNameWithSaveButton(
          updatedName,
          { isHttpMethodTriggered: true },
        );
        await adminChatHeaderAssertion.assertHeaderTitle(updatedName);
        await adminApproveRequiredConversationsAssertion.assertFolderEntityState(
          { name: requestName },
          { name: updatedName },
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Click "Back to publication request" button - updated name is displayed on request form in Conversations section',
      async () => {
        await adminPublicationReviewControl.backToPublicationRequest();
        await adminPublishConversationsTreeAssertion.assertEntityState(
          { name: updatedName },
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      "Go to review conversation again, Hover over chat's name in side panel and select Rename option",
      async () => {
        await adminPublishingApprovalModal.goToEntityReview({
          isHttpMethodTriggered: false,
        });
        await adminApproveRequiredConversations.openFolderEntityDropdownMenu(
          requestName,
          updatedName,
        );
        await adminApproveRequiredConversationDropdownMenu.selectMenuOption(
          MenuOptions.rename,
        );
        updatedName = `${conversation.name}_${GeneratorUtil.randomString(7)}_3`;
        await adminRenameConversationModal.editConversationNameWithSaveButton(
          updatedName,
          { isHttpMethodTriggered: true },
        );
      },
    );

    await dialAdminTest.step(
      "View chat's name in chat's header and in side panel - name was updated in side panel and in chat's header",
      async () => {
        await adminApproveRequiredConversationsAssertion.assertFolderEntityState(
          { name: requestName },
          { name: updatedName },
          'visible',
        );
        await adminChatHeaderAssertion.assertHeaderTitle(updatedName);
      },
    );

    await dialAdminTest.step(
      `Click "Back to publication request" button - chat's name was updated on request form in Conversations section`,
      async () => {
        await adminPublicationReviewControl.backToPublicationRequest();
        await adminPublishConversationsTreeAssertion.assertEntityState(
          { name: updatedName },
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Rename chat multiple times with special symbols and verify updated name with special symbols is displayed in the request',
      async () => {
        for (let i = 1; i <= 2; i++) {
          updatedName =
            await adminPublishingApprovalModal.renameConversationToApprove(
              updatedName,
              `${conversation.name}_${ExpectedConstants.allowedSpecialChars}_${i}`,
            );
          await adminPublishingApprovalModal.updateRequest();
        }
        await adminPublishConversationsTreeAssertion.assertEntityState(
          { name: updatedName },
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Click "Go to a review" link and verify chat name with special symbols is displayed correctly in header and in the sidebar',
      async () => {
        await adminPublishingApprovalModal.goToEntityReview({
          isHttpMethodTriggered: false,
        });
        await adminChatHeaderAssertion.assertHeaderTitle(updatedName);
        await adminApproveRequiredConversationsAssertion.assertFolderEntityState(
          { name: requestName },
          { name: updatedName },
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Click "Back to publication request" button and verify final chat name is displayed',
      async () => {
        await adminPublicationReviewControl.backToPublicationRequest();
        await adminPublishConversationsTreeAssertion.assertEntityState(
          { name: updatedName },
          'visible',
        );
      },
    );

    const publicNameTestSteps = [
      {
        title: "Click Edit button and add '_updated' to author's public name",
        name: (author: string) => `${author}_updated`,
      },
      {
        title:
          "Click Edit button and add a dot at the end of the author's public name",
        name: (author: string) => author,
      },
      // # the step is blocked by the issue with id: 5024
      // {
      //   title: "Click Edit button and add special chars to author's public name",
      //   name: `${publishRequest.displayAuthor}_${ExpectedConstants.allowedSpecialChars}`,
      // },
    ];

    for (const testCase of publicNameTestSteps) {
      await dialAdminTest.step(testCase.title, async () => {
        const publicAuthor = testCase.name(publishRequest.displayAuthor!);
        await adminPublishingApprovalModal.editButton.click();
        await adminPublishingApprovalModal.publicAuthor.fill(publicAuthor);
        await adminPublishingApprovalModal.updateRequest();
        await adminPublishingApprovalModalAssertion.assertGeneralInfo({
          publicAuthor: publicAuthor,
        });
        publicAuthorName = publicAuthor;
      });
    }

    await dialAdminTest.step(
      'Click "Go to a review" and then "Back to publication request" and approve request',
      async () => {
        await adminPublishingApprovalModal.goToEntityReview({
          isHttpMethodTriggered: false,
        });
        await adminPublicationReviewControl.backToPublicationRequest();
        await adminPublishingApprovalModal.approveRequest();
      },
    );

    await dialAdminTest.step(
      'Find published chat in Organization section',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();

        await organizationConversations.openEntityDropdownMenu(updatedName);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.info, {
          triggeredHttpMethod: 'GET',
        });
        await informationModalAssertion.assertFields({
          createdDate: currentDate,
          author: publicAuthorName,
        });
        await informationModal.getCloseButton().click();
      },
    );
  },
);

dialAdminTest(
  // 'Last version is not displayed after update chat\'s name\n'+
  '[Admin view][Edit request]: Edit version for chat ( there is no previous version)\n' +
    '[Admin view][Edit request]:Edit version when there are more that one public version',
  async (
    {
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
      baseAssertion,
      adminPublicationReviewControl,
      adminPublishConversationsTreeAssertion,
      adminChatHeaderAssertion,
    },
    testInfo,
  ) => {
    setTestIds(/*'EPMRTC-6500',*/ 'EPMRTC-6790', 'EPMRTC-6459');
    let publishedConversation: Conversation;
    const initialVersion = '1.1.1';
    const firstVersion = ExpectedConstants.defaultEntityVersion;
    let publishRequest1: PublicationRequestModel;

    const secondVersion = '0.0.2';
    // let publication: Publication;
    // let updatedName: string;
    let publishRequest2: PublicationRequestModel;

    const thirdVersion = '0.0.3';

    await dialTest.step(
      'Create published default conversation with version 0.0.1 via API',
      async () => {
        publishedConversation = conversationData.prepareDefaultConversation();
        await dataInjector.createConversations([publishedConversation]);

        publishRequest1 = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withDisplayAuthor(UserUtil.getE2EUsername(testInfo.parallelIndex))
          .withConversationInFolderResource(
            publishedConversation,
            PublishActions.ADD,
            initialVersion,
          )
          .build();
        // publication =
        await publicationApiHelper.createPublishRequest(publishRequest1);
        // const updatedName = `${publishedConversation.name}_updated`;
      },
    );

    await dialAdminTest.step(
      'By admin open publication request 1 for chat',
      async () => {
        await adminLocalStorageManager.setShowSideBarPanels();
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          publishRequest1.name!,
        );
      },
    );

    await dialAdminTest.step(
      'View that the initial version is displayed on the request form, change and assert version. Approve the request',
      async () => {
        await adminPublishConversationsTreeAssertion.assertEntityState(
          { name: publishedConversation.name },
          'visible',
        );
        await adminPublishConversationsTreeAssertion.assertEntityVersion(
          { name: publishedConversation.name },
          initialVersion,
        );
        await adminPublishingApprovalModal.renameConversationToApproveVersion(
          publishedConversation.name,
          firstVersion,
        );
        await adminPublishingApprovalModal.updateRequest();
        await adminPublishConversationsTreeAssertion.assertEntityVersion(
          { name: publishedConversation.name },
          firstVersion,
        );
        await adminPublishingApprovalModal.goToEntityReview({
          isHttpMethodTriggered: false,
        });
        await baseAssertion.assertElementText(
          adminChatHeader.version,
          `v. ${firstVersion}`,
        );
        await adminPublicationReviewControl.backToPublicationRequest();
      },
    );

    await dialTest.step(
      'Create publish request for default conversation with version 0.0.2 via API, reload the page',
      async () => {
        await adminPublishingApprovalModal.approveRequest();
        publishRequest2 = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withDisplayAuthor(UserUtil.getE2EUsername(testInfo.parallelIndex))
          .withConversationInFolderResource(
            publishedConversation,
            PublishActions.ADD_IF_ABSENT,
            secondVersion,
          )
          .build();
        await publicationApiHelper.createPublishRequest(publishRequest2);
        await adminDialHomePage.reloadPage();
        await adminDialHomePage.waitForPageLoaded();
      },
    );

    //TODO EPMRTC-6500 case needs to be fixed. Issue id: 3410
    // await dialAdminTest.step(
    //   'View that previous version 0.0.1 and current version 0.0.2 are displayed on the request form',
    //   async () => {
    //     await adminApproveRequiredConversations.expandApproveRequiredFolder(
    //       publishRequest2.name!,
    //     );
    //     const conversationsTree =
    //       adminPublishingApprovalModal.getConversationsToApproveTree();
    //     await baseAssertion.assertElementState(
    //       conversationsTree.getEntityByName(publishedConversation.name),
    //       'visible',
    //     );
    //     await baseAssertion.assertElementText(
    //       conversationsTree.getEntityVersion(publishedConversation.name),
    //       secondVersion,
    //     );
    //   },
    // );
    //
    // await dialAdminTest.step(
    //   `Update chat's name and save changes,
    //   async () => {
    //     await adminPublishingApprovalModal.renameConversationToApprove(
    //       publishedConversation.name,
    //       updatedName,
    //     );
    //     await adminPublishingApprovalModal.updateRequest();
    //     // publishedConversation.name = updatedName;
    //   },
    // );
    //
    // await dialAdminTest.step(
    //   'View versions - previous version is not displayed, chat name is updated (publish modal and the conversation header), current version 0.0.2 is shown (modal and header)',
    //   async () => {
    //     const conversationsTree =
    //       adminPublishingApprovalModal.getConversationsToApproveTree();
    //     await baseAssertion.assertElementState(
    //       conversationsTree.getEntityByName(updatedName),
    //       'visible',
    //     );
    //     await baseAssertion.assertElementText(
    //       conversationsTree.getEntityVersion(updatedName),
    //       secondVersion,
    //     );
    //
    //     await adminPublishingApprovalModal.goToEntityReview({
    //       isHttpMethodTriggered: true,
    //     });
    //     await baseAssertion.assertElementText(
    //       adminChatHeader.chatTitle,
    //       updatedName,
    //     );
    //     await baseAssertion.assertElementText(
    //       adminChatHeader.version,
    //       `v. ${secondVersion}`,
    //     );
    //   },
    // );

    await dialAdminTest.step(
      'Сhange version according to format (example 0.0.5) and click "Update request" button, click "Go to a review" link and check version',
      async () => {
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          publishRequest2.name!,
        );
        await adminPublishConversationsTreeAssertion.assertEntityVersion(
          { name: publishedConversation.name },
          secondVersion,
        );

        await adminPublishingApprovalModal.renameConversationToApproveVersion(
          publishedConversation.name,
          thirdVersion,
        );
        await adminPublishingApprovalModal.updateRequest();

        await adminPublishConversationsTreeAssertion.assertEntityVersion(
          { name: publishedConversation.name },
          thirdVersion,
        );
        await adminPublishingApprovalModal.goToEntityReview({
          isHttpMethodTriggered: false,
        });
        await adminChatHeaderAssertion.assertElementText(
          adminChatHeader.version,
          `v. ${thirdVersion}`,
        );
        await adminPublicationReviewControl.backToPublicationRequest();
      },
    );
  },
);

dialAdminTest(
  "Edit folder's name for publish request for folder with chat\n" +
    '[Admin view][Edit request] Rename the folder several times in a row\n' +
    "Update folder's name for publish request for folder with chat with attached file. Input different names for chat's folder and file's folder",
  async (
    {
      conversationData,
      publishRequestBuilder,
      publicationApiHelper,
      adminPublicationReviewControl,
      dataInjector,
      adminDialHomePage,
      adminApproveRequiredConversations,
      adminPublishingApprovalModal,
      setTestIds,
      adminLocalStorageManager,
      baseAssertion,
      dialHomePage,
      localStorageManager,
      adminApproveRequiredConversationsAssertion,
      navigationPanel,
      fileManagerToolbar,
      fileManagerGridAssertion,
      fileManagerFoldersTree,
      fileApiHelper,
      adminFilesToApproveTree,
      organizationFolderConversationAssertions,
    },
    testInfo,
  ) => {
    setTestIds('EPMRTC-6465', 'EPMRTC-6549', 'EPMRTC-6466');
    let folderConversation: FolderConversation;
    const requestName = GeneratorUtil.randomPublicationRequestName();
    let updatedFolderName: string;
    let updatedFileFolderName: string;
    let imageUrl: string;
    const imageName = GeneratorUtil.randomFilename('jpg');

    await dialTest.step(
      'Precondition: Create folder with chat with attached file Folder01->Chat01',
      async () => {
        imageUrl = await fileApiHelper.putFileWithCustomName(
          imageName,
          Attachment.sunImageName,
        );
        const model = GeneratorUtil.randomArrayElement(
          ModelsUtil.getLatestModelsWithAttachment(true, ['*/*']),
        );
        folderConversation =
          conversationData.prepareDefaultConversationInFolder();
        const conversationWithAttachment =
          conversationData.prepareConversationWithAttachmentsInRequest(
            model,
            true,
            folderConversation.folders.name,
            imageUrl,
          );
        conversationData.resetData();
        folderConversation.conversations[0] = conversationWithAttachment;
        await dataInjector.createConversations(
          folderConversation.conversations,
          folderConversation.folders,
        );
      },
    );

    await dialTest.step('Create publication request for Folder01', async () => {
      const publishRequest = publishRequestBuilder
        .withName(requestName)
        .withDisplayAuthor(UserUtil.getE2EUsername(testInfo.parallelIndex))
        .withConversationInFolderResource(
          folderConversation.conversations[0],
          PublishActions.ADD,
        )
        .withFileResource(
          imageUrl,
          PublishActions.ADD_IF_ABSENT,
          folderConversation.folders.name,
        )
        .build();
      await publicationApiHelper.createPublishRequest(publishRequest);
      updatedFolderName = folderConversation.folders.name;
      updatedFileFolderName = folderConversation.folders.name;
    });

    await dialAdminTest.step('By admin open publication request', async () => {
      await adminLocalStorageManager.setShowSideBarPanels();
      await adminDialHomePage.openHomePage();
      await adminDialHomePage.waitForPageLoaded();
      await adminApproveRequiredConversations.expandApproveRequiredFolder(
        requestName,
      );
    });

    await dialAdminTest.step(
      "Update folder's name to Folder01_Updated and click 'Update request' several times in a row",
      async () => {
        for (let i = 1; i <= 2; i++) {
          updatedFolderName =
            await adminPublishingApprovalModal.renameConversationFolderToApprove(
              updatedFolderName,
              `${updatedFolderName}_${i}`,
            );
          await adminPublishingApprovalModal.updateRequest();
          await adminApproveRequiredConversationsAssertion.assertFolderState(
            updatedFolderName,
            'visible',
          );
        }
      },
    );

    await dialAdminTest.step(
      'Update folder name for file and click Update request',
      async () => {
        updatedFileFolderName =
          await adminPublishingApprovalModal.renameFileFolderToApprove(
            updatedFileFolderName,
            `${updatedFileFolderName}_file`,
          );
        await adminPublishingApprovalModal.updateRequest();
        const fileFolder = adminFilesToApproveTree.getFolderByName(
          updatedFileFolderName,
        );
        await baseAssertion.assertElementState(fileFolder, 'visible');
      },
    );

    await dialAdminTest.step(
      'Verify new folder name is displayed on publish request form and approve the request',
      async () => {
        await adminApproveRequiredConversationsAssertion.assertFolderState(
          updatedFolderName,
          'visible',
        );
        await adminPublishingApprovalModal.goToEntityReview({
          isHttpMethodTriggered: false,
        });
        await adminPublicationReviewControl.backToPublicationRequest();
        await adminPublishingApprovalModal.approveRequest();
      },
    );

    await dialTest.step(
      'Check folder name in Organization by a regular user - renamed folder is displayed in Organization',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await organizationFolderConversationAssertions.assertFolderState(
          updatedFolderName,
          'visible',
        );
      },
    );

    await dialTest.step(
      "Check folder's name for file in File manager - updated folder's names are displayed",
      async () => {
        await navigationPanel.goToFileManager();
        await fileManagerToolbar.organizationTab.click();
        await fileManagerGridAssertion.assertGridRowByNameState(
          updatedFileFolderName,
          'visible',
        );
        await fileManagerFoldersTree.expandFolders(
          { isFilesListingTriggered: true },
          updatedFileFolderName,
        );
        await fileManagerGridAssertion.assertGridRowByNameState(
          imageName,
          'visible',
        );
      },
    );
  },
);
