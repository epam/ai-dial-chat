import { Conversation } from '@/chat/types/chat';
import { Publication, PublicationRequestModel } from '@/chat/types/publication';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  MenuOptions,
  MockedChatApiResponseBodies,
} from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { PublishActions } from '@epam/ai-dial-shared';

dialAdminTest(
  'Admin can not update chat from unpublish request',
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
    adminChatHeaderAssertion,
    adminTooltipAssertion,
    adminChatHeaderDropdownMenu,
    adminApproveRequiredConversationDropdownMenu,
  }) => {
    setTestIds('EPMRTC-6472');
    let publishedConversation: Conversation;
    const requestName = GeneratorUtil.randomUnpublishRequestName();
    let publication: Publication;

    await dialTest.step(
      'Create and approve single conversation publishing and unpublish request via API',
      async () => {
        publishedConversation = conversationData.prepareDefaultConversation();
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

        publication.name = requestName;
        await publicationApiHelper.createUnpublishRequest(publication);
      },
    );

    await dialAdminTest.step(
      'Login as admin, open unpublish request and click on "Go to a review" link',
      async () => {
        await adminLocalStorageManager.setShowSideBarPanels();
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
        const defaultAgent = ModelsUtil.getDefaultAgent()!;
        await adminChatHeader.hoverOverChatModel();
        await adminTooltipAssertion.assertTooltipContent(
          ExpectedConstants.modelTooltip(
            defaultAgent.name,
            defaultAgent.version,
          ),
        );
        await adminChatHeader.chatAgent.click();
        await adminChatHeaderAssertion.assertHeaderTitle(
          publishedConversation.name,
        );
      },
    );

    await dialAdminTest.step(
      `Verify settings icon in chat's header is not clickable, conversation settings is displayed on hover`,
      async () => {
        const defaultAgent = ModelsUtil.getDefaultAgent()!;
        await adminChatHeader.hoverOverChatSettings();
        await adminTooltipAssertion.assertTooltipContent(
          ExpectedConstants.settingsTooltip(defaultAgent.type),
        );
        await adminChatHeader.conversationSettings.click();
        await adminChatHeaderAssertion.assertHeaderTitle(
          publishedConversation.name,
        );
      },
    );

    await dialAdminTest.step(
      `Click on 3 dots in chat's header and check that there is no "Rename" option`,
      async () => {
        await adminChatHeader.dotsMenu.click();
        const allMenuOptions =
          await adminChatHeaderDropdownMenu.getAllMenuOptions();
        baseAssertion.assertArrayExcludesAll(
          allMenuOptions,
          [MenuOptions.rename],
          'Menu options',
        );
      },
    );

    await dialAdminTest.step(
      'Go back to the approval modal and check context menu for the chat in "Approve required" section',
      async () => {
        await adminPublicationReviewControl.backToPublicationRequest();
        await adminApproveRequiredConversations.openFolderEntityDropdownMenu(
          requestName,
          publishedConversation.name,
        );
        const allMenuOptions =
          await adminApproveRequiredConversationDropdownMenu.getAllMenuOptions();
        baseAssertion.assertArrayExcludesAll(
          allMenuOptions,
          [MenuOptions.rename],
          'Menu options',
        );
      },
    );
  },
);

dialAdminTest.only(
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
    localStorageManager,
    adminChatHeaderAssertion,
    adminConversationSettings,
    adminTalkToAgentDialog,
    adminChat,
    adminChatMessages,
    iconApiHelper,
    adminEntitySettingsAssertion,
    adminChatMessagesAssertion,
    adminSendMessage,
           adminPublicationReviewControl,
  }) => {
    setTestIds('EPMRTC-6736', 'EPMRTC-6737', 'EPMRTC-6475', 'EPMRTC-6485');
    let conversation: Conversation;
    const requestName = GeneratorUtil.randomPublicationRequestName();
    const newSystemPrompt = 'new system prompt';
    const newTemp = '0.5';
    const model = GeneratorUtil.randomArrayElement(
      ModelsUtil.getModels().filter(
        (m) => m.features?.temperature && m.features?.systemPrompt,
      ),
    )!;
    const modelIcon = iconApiHelper.getEntityIcon(model);

    await dialTest.step(
      'Prepare conversation and publication request',
      async () => {
        conversation = conversationData.prepareDefaultConversation();
        await dataInjector.createConversations([conversation]);
        await localStorageManager.setShowSideBarPanels();

        const publishRequest = publishRequestBuilder
          .withName(requestName)
          .withConversationInFolderResource(conversation, PublishActions.ADD)
          .build();
        await publicationApiHelper.createPublishRequest(publishRequest);
      },
    );

    await dialAdminTest.step(
      'Login as admin, open publication request and click on "Go to a review" link',
      async () => {
        await adminLocalStorageManager.setShowSideBarPanels();
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
      'Edit 1st message, save and verify it is updated and response is regenerated',
      async () => {
        const updatedMessage = 'updated message';
        await adminDialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        const firstMessage = conversation.messages[0].content;
        await adminChatMessages.openEditMessageMode(firstMessage);
        await adminChatMessages.editMessage(firstMessage, updatedMessage);
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
        await adminDialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await adminPublicationReviewControl.editButton.click();
        await adminSendMessage.send(newMessage);
        await adminChatMessagesAssertion.assertLastMessageContent('Response');
        await adminChatMessagesAssertion.assertMessagesCount(4);
      },
    );

    await dialAdminTest.step(
      'Click on agent icon, select another agent and verify it is updated',
      async () => {
        await adminChatHeader.chatAgent.click();
        await adminTalkToAgentDialog.selectAgent(model.name);
        //TODO the DIAL reboots
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
        //TODO why do we need to that again?
        await adminDialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await adminChat.sendRequestWithButton('test');
        await adminChatMessages.waitForResponseReceived();
      },
    );
  },
);

dialAdminTest(
  'Regenerate last message for chat form publication request',
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
    localStorageManager,
    adminChatHeaderAssertion,
    adminChatMessages,
    adminChatMessagesAssertion,
  }) => {
    setTestIds('EPMRTC-6488');
    let conversation: Conversation;
    const requestName = GeneratorUtil.randomPublicationRequestName();

    await dialTest.step(
      'Prepare conversation and publication request',
      async () => {
        conversation = conversationData.prepareDefaultConversation();
        await dataInjector.createConversations([conversation]);
        await localStorageManager.setShowSideBarPanels();

        const publishRequest = publishRequestBuilder
          .withName(requestName)
          .withConversationInFolderResource(conversation, PublishActions.ADD)
          .build();
        await publicationApiHelper.createPublishRequest(publishRequest);
      },
    );

    await dialAdminTest.step(
      'Login as admin, open publication request and click on "Go to a review" link',
      async () => {
        await adminLocalStorageManager.setShowSideBarPanels();
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
      'Regenerate last response and verify it is regenerated',
      async () => {
        await adminDialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await adminChatMessages.regenerateResponse();
        await adminChatMessagesAssertion.assertLastMessageContent('Response');
      },
    );
  },
);
