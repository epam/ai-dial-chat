import { Conversation } from '@/chat/types/chat';
import { Publication, PublicationRequestModel } from '@/chat/types/publication';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  MockedChatApiResponseBodies,
  PublishPath,
} from '@/src/testData';
import { UploadDownloadData } from '@/src/ui/pages';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { PublishActions } from '@epam/ai-dial-shared';

const publicationsToUnpublish: Publication[] = [];

dialAdminTest(
  'Publish single chat without attachments.\n' +
    'Publication request name: spaces in the middle of request name stay.\n' +
    'Publish: Send request button tooltips.\n' +
    'Publication request name can not be blank.\n' +
    'File section displayed when no files in request.\n' +
    'Publish admin: review chat.\n' +
    'Admin area: Publish request details.\n' +
    'Context menu for approve required section ( not playback mode)' +
    'Publish admin: Approve singe chat.\n' +
    'Error message when create publish request for already published chat.\n' +
    'Publish chat: context menu options available for published chats.\n' +
    'Organization section with chats stay when Delete all conversations button click.\n' +
    'Organization section is not exported when export  all conversations',
  async ({
    dialHomePage,
    conversationData,
    dataInjector,
    conversations,
    organizationConversations,
    conversationDropdownMenu,
    publishingRequestModal,
    conversationsToPublishTree,
    publishingRequestModalAssertion,
    iconApiHelper,
    tooltipAssertion,
    adminDialHomePage,
    adminApproveRequiredConversations,
    chatBar,
    chat,
    confirmationDialog,
    adminPublishingApprovalModal,
    adminPublicationReviewControl,
    organizationConversationAssertion,
    adminApproveRequiredConversationsAssertion,
    adminOrganizationConversationAssertion,
    adminPublishingApprovalModalAssertion,
    adminConversationToApproveAssertion,
    conversationDropdownMenuAssertion,
    toastAssertion,
    downloadAssertion,
    adminTooltip,
    adminChatHeaderAssertion,
    adminChatMessagesAssertion,
    adminApproveRequiredConversationDropdownMenuAssertion,
    adminTooltipAssertion,
    baseAssertion,
    setTestIds,
  }) => {
    dialAdminTest.slow();
    setTestIds(
      'EPMRTC-3270',
      'EPMRTC-3585',
      'EPMRTC-4013',
      'EPMRTC-3578',
      'EPMRTC-3928',
      'EPMRTC-3228',
      'EPMRTC-4189',
      'EPMRTC-3503',
      'EPMRTC-3224',
      'EPMRTC-4070',
      'EPMRTC-3278',
      'EPMRTC-3230',
      'EPMRTC-3292',
    );
    let conversation: Conversation;
    const requestName = `${GeneratorUtil.randomPublicationRequestName()}  ${GeneratorUtil.randomPublicationRequestName()}`;
    const expectedConversationIcon = iconApiHelper.getEntityIcon(
      ModelsUtil.getDefaultModel()!,
    );
    let publishApiModels: {
      request: PublicationRequestModel;
      response: Publication;
    };

    await dialTest.step('Prepare a new conversation', async () => {
      conversation = conversationData.prepareDefaultConversation();
      await dataInjector.createConversations([conversation]);
    });

    await dialTest.step(
      'Select "Publish" conversation dropdown menu option and verify publishing modal is opened, no files are available for publishing, Send button is disabled',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(conversation.name);
        await conversations.openEntityDropdownMenu(conversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.publish);
        await baseAssertion.assertElementState(
          publishingRequestModal,
          'visible',
        );
        await publishingRequestModalAssertion.assertNoFilesRequestedToPublish();
        await publishingRequestModalAssertion.assertSendRequestButtonIsDisabled();
      },
    );

    await dialTest.step(
      'Verify tooltip on hover "Send request" button',
      async () => {
        await publishingRequestModal.sendRequestButton.hoverOver();
        await tooltipAssertion.assertTooltipContent(
          ExpectedConstants.noPublishNameTooltip,
        );
      },
    );

    await dialTest.step(
      'Set spaces as publication request name and verify tooltip on hover "Send request" button',
      async () => {
        await publishingRequestModal.requestName.fillInInput(' '.repeat(3));
        await publishingRequestModalAssertion.assertSendRequestButtonIsDisabled();
        await publishingRequestModal.sendRequestButton.hoverOver();
        await tooltipAssertion.assertTooltipContent(
          ExpectedConstants.noPublishNameTooltip,
        );
      },
    );

    await dialTest.step(
      'Set publication request name, uncheck conversation and verify tooltip on hover "Send request" button',
      async () => {
        await publishingRequestModal.requestName.fillInInput(requestName);
        await conversationsToPublishTree
          .getEntityCheckbox(conversation.name)
          .click();
        await publishingRequestModal.sendRequestButton.hoverOver();
        await tooltipAssertion.assertTooltipContent(
          ExpectedConstants.nothingToPublishTooltip,
        );
      },
    );

    await dialTest.step('Check conversation and send request', async () => {
      await conversationsToPublishTree
        .getEntityCheckbox(conversation.name)
        .click();
      publishApiModels = await publishingRequestModal.sendPublicationRequest();
      publicationsToUnpublish.push(publishApiModels.response);
    });

    await dialAdminTest.step(
      'Login as admin and verify conversation publishing request is displayed under "Approve required" section',
      async () => {
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredConversationsAssertion.assertFolderState(
          { name: requestName },
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Expand request folder and verify "Publication approval" modal is displayed',
      async () => {
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          requestName,
        );
        await adminApproveRequiredConversationsAssertion.assertFolderEntityState(
          { name: requestName },
          { name: conversation.name },
          'visible',
        );
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal,
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Verify menu options available for conversation under "Approve required" section',
      async () => {
        await adminApproveRequiredConversations.openFolderEntityDropdownMenu(
          requestName,
          conversation.name,
        );
        await adminApproveRequiredConversationDropdownMenuAssertion.assertMenuOptions(
          [
            MenuOptions.compare,
            MenuOptions.duplicate,
            MenuOptions.replay,
            MenuOptions.playback,
            MenuOptions.export,
          ],
        );
      },
    );

    await dialAdminTest.step(
      'Verify labels and controls on "Publication approval" modal',
      async () => {
        await adminPublishingApprovalModalAssertion.assertPublishToLabelState(
          'visible',
        );
        await adminPublishingApprovalModalAssertion.assertPublishToPath(
          PublishPath.Organization,
        );

        await adminPublishingApprovalModalAssertion.assertRequestCreationDateLabelState(
          'visible',
        );
        await adminPublishingApprovalModalAssertion.assertRequestCreationDate(
          publishApiModels.response,
        );

        await adminPublishingApprovalModalAssertion.assertAllowAccessLabelState(
          'visible',
        );
        await adminPublishingApprovalModalAssertion.assertNoChangesLabelState(
          'visible',
        );
        await adminPublishingApprovalModalAssertion.assertAvailabilityLabelState(
          'visible',
        );

        await adminConversationToApproveAssertion.assertEntityState(
          { name: conversation.name },
          'visible',
        );
        await adminConversationToApproveAssertion.assertEntityVersion(
          { name: conversation.name },
          ExpectedConstants.defaultAppVersion,
        );
        await adminConversationToApproveAssertion.assertTreeEntityIcon(
          { name: conversation.name },
          expectedConversationIcon,
        );

        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal.goToReviewButton,
          'visible',
        );

        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal.approveButton,
          'visible',
        );
        await adminPublishingApprovalModalAssertion.assertElementActionabilityState(
          adminPublishingApprovalModal.approveButton,
          'disabled',
        );
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal.rejectButton,
          'visible',
        );
        await adminPublishingApprovalModalAssertion.assertElementActionabilityState(
          adminPublishingApprovalModal.rejectButton,
          'enabled',
        );
      },
    );

    await dialAdminTest.step(
      'Hover over "Approve" button and verify tooltip is displayed',
      async () => {
        await adminPublishingApprovalModal.approveButton.hoverOver();
        await adminTooltipAssertion.assertElementState(adminTooltip, 'visible');
        await adminTooltipAssertion.assertTooltipContent(
          ExpectedConstants.reviewResourcesTooltip,
        );
      },
    );

    await dialAdminTest.step(
      'Click on "Go to a review" button and verify conversation details are displayed',
      async () => {
        await adminPublishingApprovalModal.goToEntityReview({
          isHttpMethodTriggered: false,
        });
        await adminChatHeaderAssertion.assertHeaderTitle(conversation.name);
        await adminChatMessagesAssertion.assertMessagesCount(
          conversation.messages.length,
        );
        await baseAssertion.assertElementActionabilityState(
          adminPublicationReviewControl.nextButton,
          'disabled',
        );
        await baseAssertion.assertElementActionabilityState(
          adminPublicationReviewControl.previousButton,
          'disabled',
        );
        await baseAssertion.assertElementActionabilityState(
          adminPublicationReviewControl.backToPublicationRequestButton,
          'enabled',
        );
      },
    );

    await dialAdminTest.step(
      'Click "Back to publication request", approve request by admin and verify publication disappears from "Approve required" and displayed under "Organization" section',
      async () => {
        await adminPublicationReviewControl.backToPublicationRequest();
        await adminPublishingApprovalModalAssertion.assertElementActionabilityState(
          adminPublishingApprovalModal.approveButton,
          'enabled',
        );
        await adminPublishingApprovalModal.approveRequest();
        await adminApproveRequiredConversationsAssertion.assertFolderState(
          { name: requestName },
          'hidden',
        );
        await adminOrganizationConversationAssertion.assertEntityState(
          { name: conversation.name },
          'visible',
        );

        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await organizationConversationAssertion.assertEntityState(
          { name: conversation.name },
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Select "Publish" menu option for published conversation, set same name and version and verify error toast is show on send request',
      async () => {
        await conversations.openEntityDropdownMenu(conversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.publish);
        await publishingRequestModal.requestName.fillInInput(requestName);
        await conversationsToPublishTree
          .getEntityVersion(conversation.name)
          .fill(ExpectedConstants.defaultAppVersion);
        await publishingRequestModal.sendRequestButton.click();
        await toastAssertion.assertToastIsVisible();
        await toastAssertion.assertToastMessage(
          ExpectedConstants.duplicatedPublicationErrorMessage(
            publishApiModels.response.resources[0].targetUrl,
          ),
          ExpectedMessages.errorMessageContentIsValid,
        );
      },
    );

    await dialAdminTest.step(
      'Verify context menu options for published conversation',
      async () => {
        await organizationConversations.openEntityDropdownMenu(
          conversation.name,
        );
        await conversationDropdownMenuAssertion.assertMenuOptions([
          MenuOptions.compare,
          MenuOptions.duplicate,
          MenuOptions.replay,
          MenuOptions.playback,
          MenuOptions.export,
          MenuOptions.unpublish,
        ]);
      },
    );

    await dialAdminTest.step(
      'Verify published conversation stay after deleting all conversations',
      async () => {
        await chatBar.deleteAllEntities();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        await organizationConversationAssertion.assertEntityState(
          { name: conversation.name },
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Verify published conversations are not imported',
      async () => {
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequestWithButton('test');
        const exportedData: UploadDownloadData =
          await dialHomePage.downloadData(
            () => chatBar.exportButton.click(),
            GeneratorUtil.exportedWithoutAttachmentsFilename(),
          );
        await downloadAssertion.assertEntitiesAreNotExported(
          exportedData,
          conversation.id,
        );
      },
    );
  },
);

dialAdminTest(
  'Publish request name: tab is changed to space if to use it in chat name.\n' +
    'Publication request name: Spaces at the beginning or end of chat name are removed.\n' +
    'Publication request name with hieroglyph, specific letters.\n' +
    'Chat from Approve required section is not shown in Compare mode drop down list',
  async ({
    conversationData,
    dataInjector,
    publishRequestBuilder,
    publicationApiHelper,
    adminDialHomePage,
    adminApproveRequiredConversations,
    adminApproveRequiredConversationsAssertion,
    adminDataInjector,
    adminConversations,
    adminConversationDropdownMenu,
    adminChat,
    baseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3575', 'EPMRTC-3584', 'EPMRTC-3589', 'EPMRTC-4057');
    const publicationNames = [
      `${GeneratorUtil.randomPublicationRequestName()}name\t\twith\ttabs`,
      `  ${GeneratorUtil.randomPublicationRequestName()}  `,
      `${GeneratorUtil.randomPublicationRequestName()}${ExpectedConstants.hieroglyphChars}`,
    ];
    const conversations: Conversation[] = [];
    let adminConversation: Conversation;

    await dialAdminTest.step(
      'Prepare conversation for admin user',
      async () => {
        adminConversation = conversationData.prepareDefaultConversation();
        conversationData.resetData();
        await adminDataInjector.createConversations([adminConversation]);
      },
    );

    await dialTest.step(
      'Create publication requests and verify publication names are correct',
      async () => {
        for (let i = 1; i <= publicationNames.length; i++) {
          const conversation = conversationData.prepareDefaultConversation();
          conversations.push(conversation);
          conversationData.resetData();
        }
        await dataInjector.createConversations(conversations);

        for (let i = 0; i < publicationNames.length; i++) {
          const publishRequest = publishRequestBuilder
            .withName(publicationNames[i])
            .withConversationResource(conversations[i], PublishActions.ADD)
            .build();
          await publicationApiHelper.createPublishRequest(publishRequest);
        }

        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        for (const publicationName of publicationNames) {
          await adminApproveRequiredConversationsAssertion.assertFolderState(
            { name: publicationName.trim().replaceAll('\t', ' ') },
            'visible',
          );
        }
      },
    );

    await dialAdminTest.step.skip(
      'Open Compare mode for admins conversation and verify conversation from publication request is not available for comparison.\n' +
        'Issue: https://github.com/epam/ai-dial-chat/issues/3012',
      async () => {
        const requestToExpand =
          GeneratorUtil.randomArrayElement(publicationNames);
        const requestIndex = publicationNames.indexOf(requestToExpand);
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          requestToExpand,
        );
        await adminConversations.openEntityDropdownMenu(adminConversation.name);
        await adminConversationDropdownMenu.selectMenuOption(
          MenuOptions.compare,
        );
        const compareConversations = adminChat
          .getCompare()
          .getConversationToCompare();
        await compareConversations.checkShowAllConversations();
        const conversationsList =
          await compareConversations.getCompareConversationNames();
        baseAssertion.assertArrayExcludesAll(
          conversationsList,
          [conversations[requestIndex].name],
          ExpectedMessages.conversationsToCompareOptionsValid,
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
