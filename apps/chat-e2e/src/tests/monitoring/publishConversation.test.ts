import { Publication, PublicationRequestModel } from '@/chat/types/publication';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import { ExpectedConstants, MenuOptions, PublishPath } from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { Conversation } from '@epam/ai-dial-shared';

dialAdminTest(
  'Publish single chat',
  async ({
    dialHomePage,
    conversationData,
    dataInjector,
    conversations,
    conversationDropdownMenu,
    publishingRequestModal,
    iconApiHelper,
    adminDialHomePage,
    adminApproveRequiredConversations,
    adminPublishingApprovalModal,
    adminPublicationReviewControl,
    organizationConversationAssertion,
    adminApproveRequiredConversationsAssertion,
    adminOrganizationConversationAssertion,
    adminPublishingApprovalModalAssertion,
    adminConversationToApproveAssertion,
    baseAssertion,
    localStorageManager,
    adminLocalStorageManager,
  }) => {
    let conversation: Conversation;
    const requestName = GeneratorUtil.randomPublicationRequestName();
    const expectedConversationIcon = iconApiHelper.getEntityIcon(
      ModelsUtil.getDefaultAgent()!,
    );
    let publishApiModels: {
      request: PublicationRequestModel;
      response: Publication;
    };

    await dialTest.step('Prepare a new conversation via API', async () => {
      conversation = conversationData.prepareDefaultConversation();
      await dataInjector.createConversations([conversation]);
      await localStorageManager.setShowSideBarPanels();
    });

    await dialTest.step(
      'Select "Publish" conversation dropdown menu option and verify publishing modal is opened, no files are available for publishing, Send button is disabled',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.openEntityDropdownMenu(conversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.publish);
        await baseAssertion.assertElementState(
          publishingRequestModal,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Set publication request name and send the request',
      async () => {
        await publishingRequestModal.requestName.fillInInput(requestName);
        publishApiModels =
          await publishingRequestModal.sendPublicationRequest();
      },
    );

    await dialAdminTest.step(
      'Login as admin and verify conversation publishing request is displayed under "Approve required" section',
      async () => {
        await adminLocalStorageManager.setShowSideBarPanels();
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
        await adminPublishingApprovalModalAssertion.assertPublishToPath(
          PublishPath.Organization,
        );
        await adminPublishingApprovalModalAssertion.assertRequestCreationDate(
          publishApiModels.response,
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
      },
    );

    await dialAdminTest.step(
      'Review the request, approve it and verify publication disappears from "Approve required" and displayed under "Organization" section',
      async () => {
        await adminPublishingApprovalModal.goToEntityReview({
          isHttpMethodTriggered: false,
        });
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
  },
);
