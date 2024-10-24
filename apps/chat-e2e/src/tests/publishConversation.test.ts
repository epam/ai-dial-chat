import { Conversation } from '@/chat/types/chat';
import { Publication, PublicationRequestModel } from '@/chat/types/publication';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  PublishPath,
} from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';

const publicationsToReject: Publication[] = [];
const publicationsToUnpublish: Publication[] = [];

dialAdminTest(
  'Publish single chat without attachments.\n' +
    'Publication request name: spaces in the middle of request name stay.\n' +
    'Publish: Send request button tooltips.\n' +
    'Publication request name can not be blank.\n' +
    'File section displayed when no files in request.\n' +
    'Error message when create publish request for already published chat.\n' +
    'Publish chat: context menu options available for published chats',
  async ({
    dialHomePage,
    conversationData,
    dataInjector,
    conversations,
    organizationConversations,
    conversationDropdownMenu,
    publishingRequestModal,
    conversationsToPublish,
    publishingRequestModalAssertion,
    iconApiHelper,
    tooltipAssertion,
    adminDialHomePage,
    adminApproveRequiredConversations,
    adminPublishingApprovalModal,
    adminPublicationReviewControl,
    organizationConversationAssertion,
    adminApproveRequiredConversationsAssertion,
    adminPublishingApprovalModalAssertion,
    adminConversationToApproveAssertion,
    conversationDropdownMenuAssertion,
    errorToastAssertion,
    setTestIds,
  }) => {
    dialAdminTest.slow();
    setTestIds(
      'EPMRTC-3270',
      'EPMRTC-3585',
      'EPMRTC-4013',
      'EPMRTC-3578',
      'EPMRTC-3928',
      'EPMRTC-4070',
      'EPMRTC-3278',
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
        await publishingRequestModalAssertion.assertPublishingRequestModalState(
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
        await conversationsToPublish
          .getEntityCheckbox(conversation.name)
          .click();
        await publishingRequestModal.sendRequestButton.hoverOver();
        await tooltipAssertion.assertTooltipContent(
          ExpectedConstants.nothingToPublishTooltip,
        );
      },
    );

    await dialTest.step('Check conversation and send request', async () => {
      await conversationsToPublish.getEntityCheckbox(conversation.name).click();
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
        await adminPublishingApprovalModalAssertion.assertPublishingApprovalModalState(
          'visible',
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
          '0.0.1',
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
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal.rejectButton,
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Approve request by admin and verify publication is displayed under "Organization" section',
      async () => {
        await adminApproveRequiredConversations.selectRequestConversation(
          requestName,
          conversation.name,
        );
        await adminPublicationReviewControl.backToPublicationRequest();
        await adminPublishingApprovalModal.approveRequest();

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
        await conversationsToPublish
          .getEntityVersion(conversation.name)
          .fill(ExpectedConstants.defaultAppVersion);
        await publishingRequestModal.sendRequestButton.click();
        await errorToastAssertion.assertToastIsVisible();
        await errorToastAssertion.assertToastMessage(
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
  },
);

dialAdminTest(
  'Publish request name: tab is changed to space if to use it in chat name.\n' +
    'Publication request name: Spaces at the beginning or end of chat name are removed.\n' +
    'Publication request name with hieroglyph, specific letters',
  async ({
    conversationData,
    dataInjector,
    publishRequestBuilder,
    publicationApiHelper,
    adminDialHomePage,
    adminApproveRequiredConversationsAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3575', 'EPMRTC-3584', 'EPMRTC-3589');
    const publicationNames = [
      'name\t\twith\ttabs',
      `  ${GeneratorUtil.randomPublicationRequestName()}  `,
      'あおㅁㄹñ¿äß맞습니다. 한국어 학습의 인기는 그 나라의 문화와 경제뿐만 아니라 언어 자체의 매력에서도 비롯됩니다. 한국어는 한글이라는 고유한 문자 시스템을 사용하는데, 이는 15세기에 세종대왕에 의해 창안되었습니다. 한글은 그 논리적이고 과학적인 설계로 인해 배우기 쉬운 것으로 여겨지며, 이 또',
    ];
    let conversation: Conversation;

    await dialTest.step(
      'Create a publication request and verify publication name is correct',
      async () => {
        for (const publicationName of publicationNames) {
          conversation = conversationData.prepareDefaultConversation();
          await dataInjector.createConversations([conversation]);
          const publishRequest = publishRequestBuilder
            .withName(publicationName)
            .withConversationResource(conversation)
            .build();
          const response =
            await publicationApiHelper.createPublishRequest(publishRequest);
          publicationsToReject.push(response);
          conversationData.resetData();

          await adminDialHomePage.openHomePage();
          await adminDialHomePage.waitForPageLoaded();
          await adminApproveRequiredConversationsAssertion.assertFolderState(
            { name: publicationName.trim().replaceAll('\t', ' ') },
            'visible',
          );
        }
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

    for (const request of publicationsToReject) {
      await adminPublicationApiHelper.rejectRequest(request);
    }
  },
);
