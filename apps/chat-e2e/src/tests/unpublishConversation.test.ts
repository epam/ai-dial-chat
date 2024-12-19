import { Conversation } from '@/chat/types/chat';
import { Publication, PublicationRequestModel } from '@/chat/types/publication';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import {
  CheckboxState,
  ExpectedConstants,
  MenuOptions,
  PublishPath,
} from '@/src/testData';
import { PublicationProps } from '@/src/testData/api';
import { Colors } from '@/src/ui/domData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { PublishActions } from '@epam/ai-dial-shared';

dialAdminTest(
  'Unpublish single chat without attachments.\n' +
    'Unpublish request name can not be blank.\n' +
    'Unpublish request for conversation which was already unpublished',
  async ({
    dialHomePage,
    conversationData,
    publishRequestBuilder,
    publicationApiHelper,
    adminPublicationApiHelper,
    dataInjector,
    organizationConversations,
    conversationDropdownMenu,
    publishingRequestModal,
    iconApiHelper,
    conversationToPublishAssertion,
    baseAssertion,
    organizationConversationAssertion,
    publishingRequestModalAssertion,
    tooltipAssertion,
    adminDialHomePage,
    adminApproveRequiredConversations,
    adminPublishingApprovalModal,
    adminChatMessagesAssertion,
    adminPublicationReviewControl,
    adminChatHeader,
    adminApproveRequiredConversationsAssertion,
    adminOrganizationConversationAssertion,
    adminPublishingApprovalModalAssertion,
    adminConversationToApproveAssertion,
    adminChatHeaderAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3383', 'EPMRTC-3579', 'EPMRTC-3433');
    let publishedConversation: Conversation;
    const requestName = GeneratorUtil.randomUnpublishRequestName();
    let publishApiModels: {
      request: PublicationRequestModel;
      response: Publication;
    };
    let secondUnpublishResponse: PublicationProps;
    const expectedConversationIcon = iconApiHelper.getEntityIcon(
      ModelsUtil.getDefaultModel()!,
    );

    await dialTest.step(
      'Create and approve single conversation publishing',
      async () => {
        publishedConversation = conversationData.prepareDefaultConversation();
        await dataInjector.createConversations([publishedConversation]);

        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withConversationResource(publishedConversation, PublishActions.ADD)
          .build();
        const publication =
          await publicationApiHelper.createPublishRequest(publishRequest);
        await adminPublicationApiHelper.approveRequest(publication);
      },
    );

    await dialTest.step(
      'Select "Unpublish" menu option for published conversation and verify "Publish request" modal is opened',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await organizationConversations.openEntityDropdownMenu(
          publishedConversation.name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.unpublish);
        await publishingRequestModalAssertion.assertElementState(
          publishingRequestModal,
          'visible',
        );
        await baseAssertion.assertElementText(
          publishingRequestModal.getChangePublishToPath().path,
          PublishPath.Organization,
        );
        await baseAssertion.assertElementText(
          publishingRequestModal.allowAccessLabel,
          ExpectedConstants.allowAccessLabel,
        );
        await baseAssertion.assertElementState(
          publishingRequestModal.availabilityLabel,
          'visible',
        );
        await conversationToPublishAssertion.assertEntityState(
          { name: publishedConversation.name },
          'visible',
        );
        await conversationToPublishAssertion.assertEntityColor(
          { name: publishedConversation.name },
          Colors.textError,
        );
        await conversationToPublishAssertion.assertEntityCheckboxState(
          { name: publishedConversation.name },
          CheckboxState.checked,
        );

        await conversationToPublishAssertion.assertEntityVersion(
          { name: publishedConversation.name },
          ExpectedConstants.defaultAppVersion,
        );
        await conversationToPublishAssertion.assertEntityVersionColor(
          { name: publishedConversation.name },
          Colors.textError,
        );
        await conversationToPublishAssertion.assertTreeEntityIcon(
          { name: publishedConversation.name },
          expectedConversationIcon,
        );
      },
    );

    await dialTest.step(
      'Set empty or spaces as request name and verify "Send request" button is disabled',
      async () => {
        for (const name of ['', ' '.repeat(3)]) {
          await publishingRequestModal.requestName.fillInInput(name);
          await publishingRequestModalAssertion.assertSendRequestButtonIsDisabled();
          await publishingRequestModal.sendRequestButton.hoverOver();
          await tooltipAssertion.assertTooltipContent(
            ExpectedConstants.noPublishNameTooltip,
          );
        }
      },
    );

    await dialTest.step('Set a valid request name and submit', async () => {
      await publishingRequestModal.requestName.fillInInput(requestName);
      publishApiModels = await publishingRequestModal.sendPublicationRequest();
      await publishingRequestModalAssertion.assertElementState(
        publishingRequestModal,
        'hidden',
      );
    });

    await dialTest.step(
      'Create duplicated unpublish request for the same conversation',
      async () => {
        secondUnpublishResponse =
          await publicationApiHelper.createUnpublishRequest(
            publishApiModels.response,
          );
      },
    );

    await dialAdminTest.step(
      'Login as admin and verify conversation unpublishing request is displayed under "Approve required" section',
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
          { name: publishedConversation.name },
          'visible',
        );
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal,
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Verify labels and controls on "Publication approval" modal',
      async () => {
        await adminPublishingApprovalModalAssertion.assertElementText(
          adminPublishingApprovalModal.publishToPath,
          PublishPath.Organization,
        );
        await adminPublishingApprovalModalAssertion.assertRequestCreationDate(
          publishApiModels.response,
        );
        await adminConversationToApproveAssertion.assertEntityState(
          { name: publishedConversation.name },
          'visible',
        );
        await adminConversationToApproveAssertion.assertEntityColor(
          { name: publishedConversation.name },
          Colors.textError,
        );
        await adminConversationToApproveAssertion.assertEntityVersion(
          { name: publishedConversation.name },
          ExpectedConstants.defaultAppVersion,
        );
        await adminConversationToApproveAssertion.assertEntityVersionColor(
          { name: publishedConversation.name },
          Colors.textError,
        );
        await adminConversationToApproveAssertion.assertTreeEntityIcon(
          { name: publishedConversation.name },
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
      'Click on "Go to a review" button and verify conversation details are displayed',
      async () => {
        await adminPublishingApprovalModal.goToEntityReview();
        await adminChatHeaderAssertion.assertHeaderTitle(
          publishedConversation.name,
        );
        await adminChatHeaderAssertion.assertElementColor(
          adminChatHeader.chatTitle,
          Colors.textError,
        );
        await adminChatHeaderAssertion.assertElementText(
          adminChatHeader.version,
          `v. ${ExpectedConstants.defaultAppVersion}`,
        );
        await adminChatHeaderAssertion.assertElementColor(
          adminChatHeader.version,
          Colors.textError,
        );
        await adminChatMessagesAssertion.assertMessagesCount(
          publishedConversation.messages.length,
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
      'Click "Back to publication request", approve request by admin and verify publication disappears from "Approve required" and "Organization" sections',
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
          { name: publishedConversation.name },
          'hidden',
        );

        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await organizationConversationAssertion.assertEntityState(
          { name: publishedConversation.name },
          'hidden',
        );
      },
    );

    await dialAdminTest.step(
      'Expand duplicated unpublish request and verify error message is displayed on modal',
      async () => {
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          secondUnpublishResponse.name!,
        );
        await adminPublishingApprovalModalAssertion.assertElementText(
          adminPublishingApprovalModal.duplicatedUnpublishingError,
          ExpectedConstants.duplicatedUnpublishingError(
            publishedConversation.name,
          ),
        );
      },
    );
  },
);
