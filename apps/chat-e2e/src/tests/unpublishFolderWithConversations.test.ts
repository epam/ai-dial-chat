import { Conversation } from '@/chat/types/chat';
import { FolderInterface } from '@/chat/types/folder';
import { Publication, PublicationRequestModel } from '@/chat/types/publication';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import {
  CheckboxState,
  ExpectedConstants,
  FolderConversation,
  MenuOptions,
  PublishPath,
} from '@/src/testData';
import { PublicationProps } from '@/src/testData/api';
import { Colors } from '@/src/ui/domData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { PublishActions } from '@epam/ai-dial-shared';

let expectedConversationIcon: string;
let folderConversationToUnpublish: Conversation;

dialTest.beforeAll(async ({ iconApiHelper }) => {
  const defaultModel = ModelsUtil.getDefaultModel()!;
  expectedConversationIcon = iconApiHelper.getEntityIcon(defaultModel);
});

dialAdminTest(
  'Unpublish chat inside folder.\n' +
    'Unpublish request for folder structure where one chat was already unpublished.\n' +
    'Unpublish all chats from folder: folder is deleted from Organization',
  async ({
    dialHomePage,
    conversationData,
    publishRequestBuilder,
    publicationApiHelper,
    adminPublicationApiHelper,
    dataInjector,
    organizationFolderConversations,
    conversationDropdownMenu,
    publishingRequestModal,
    conversationToPublishAssertion,
    baseAssertion,
    publishingRules,
    publishingRequestModalAssertion,
    adminDialHomePage,
    adminApproveRequiredConversations,
    adminPublishingApprovalModal,
    adminPublicationReviewControl,
    adminOrganizationFolderConversations,
    adminApproveRequiredConversationsAssertion,
    adminOrganizationFolderConversationAssertions,
    adminPublishingApprovalModalAssertion,
    adminFolderToApproveAssertion,
    organizationFolderConversationAssertions,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3386', 'EPMRTC-3802', 'EPMRTC-3389');
    let firstConversation: Conversation;
    let secondConversation: Conversation;
    let conversationsFolder: FolderConversation;
    let publishedFolderName: string;
    const firstConversationUnpublishingRequestName =
      GeneratorUtil.randomUnpublishRequestName();
    const secondConversationUnpublishingRequestName =
      GeneratorUtil.randomUnpublishRequestName();
    let firstUnpublishApiModels: {
      request: PublicationRequestModel;
      response: Publication;
    };
    let folderPublicationRequest: Publication;
    let publishPath: string;
    let unpublishFolderResponse: PublicationProps;

    await dialTest.step(
      'Create and approve publishing of folder with 2 conversations inside',
      async () => {
        firstConversation = conversationData.prepareDefaultConversation();
        conversationData.resetData();
        secondConversation = conversationData.prepareDefaultConversation();
        conversationData.resetData();
        conversationsFolder = conversationData.prepareConversationsInFolder([
          firstConversation,
          secondConversation,
        ]);
        await dataInjector.createConversations(
          conversationsFolder.conversations,
          conversationsFolder.folders,
        );
        publishedFolderName = conversationsFolder.folders.name;
        publishPath = `${PublishPath.Organization}/${publishedFolderName}`;

        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withConversationResource(firstConversation, PublishActions.ADD)
          .withConversationResource(secondConversation, PublishActions.ADD)
          .build();
        folderPublicationRequest =
          await publicationApiHelper.createPublishRequest(publishRequest);
        await adminPublicationApiHelper.approveRequest(
          folderPublicationRequest,
        );
      },
    );

    await dialTest.step(
      'Select "Unpublish" menu option for the 1st conversation and verify "Publish request" modal is opened',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await organizationFolderConversations.expandFolder(publishedFolderName);
        await organizationFolderConversations.openFolderEntityDropdownMenu(
          publishedFolderName,
          firstConversation.name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.unpublish);
        await publishingRequestModalAssertion.assertElementState(
          publishingRequestModal,
          'visible',
        );
        await baseAssertion.assertElementText(
          publishingRequestModal.getChangePublishToPath().path,
          publishPath,
        );

        await conversationToPublishAssertion.assertEntityState(
          { name: firstConversation.name },
          'visible',
        );
        await conversationToPublishAssertion.assertEntityColor(
          { name: firstConversation.name },
          Colors.textError,
        );
        await conversationToPublishAssertion.assertEntityCheckboxState(
          { name: firstConversation.name },
          CheckboxState.checked,
        );

        await conversationToPublishAssertion.assertEntityVersion(
          { name: firstConversation.name },
          ExpectedConstants.defaultAppVersion,
        );
        await conversationToPublishAssertion.assertEntityVersionColor(
          { name: firstConversation.name },
          Colors.textError,
        );
        await conversationToPublishAssertion.assertTreeEntityIcon(
          { name: firstConversation.name },
          expectedConversationIcon,
        );

        await conversationToPublishAssertion.assertEntityState(
          { name: secondConversation.name },
          'hidden',
        );

        await baseAssertion.assertElementText(
          publishingRules.publishingPath,
          publishedFolderName,
        );
        await baseAssertion.assertElementState(
          publishingRules.addRuleButton,
          'visible',
        );
        await baseAssertion.assertElementsCount(publishingRules.allRules, 0);
      },
    );

    await dialTest.step('Set a valid request name and submit', async () => {
      await publishingRequestModal.requestName.fillInInput(
        firstConversationUnpublishingRequestName,
      );
      firstUnpublishApiModels =
        await publishingRequestModal.sendPublicationRequest();
      await publishingRequestModalAssertion.assertElementState(
        publishingRequestModal,
        'hidden',
      );
    });

    await dialTest.step(
      'Create unpublish request for the 2nd folder conversation',
      async () => {
        await organizationFolderConversations.openFolderEntityDropdownMenu(
          publishedFolderName,
          secondConversation.name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.unpublish);
        await publishingRequestModalAssertion.assertElementState(
          publishingRequestModal,
          'visible',
        );
        await publishingRequestModal.requestName.fillInInput(
          secondConversationUnpublishingRequestName,
        );
        await publishingRequestModal.sendPublicationRequest();
      },
    );

    await dialTest.step(
      'Create one more unpublish request for the whole folder',
      async () => {
        const unpublishFolderRequestModel = publishRequestBuilder
          .withConversationResource(firstConversation, PublishActions.DELETE)
          .withConversationResource(secondConversation, PublishActions.DELETE)
          .build();
        unpublishFolderResponse =
          await publicationApiHelper.createUnpublishRequest(
            unpublishFolderRequestModel,
          );
      },
    );

    await dialAdminTest.step(
      'Login as admin and verify conversation unpublishing request is displayed under "Approve required" section',
      async () => {
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredConversationsAssertion.assertFolderState(
          { name: firstConversationUnpublishingRequestName },
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Expand request folder and verify "Publication approval" modal is displayed',
      async () => {
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          firstConversationUnpublishingRequestName,
        );
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          publishedFolderName,
          { isHttpMethodTriggered: false },
        );
        await adminApproveRequiredConversationsAssertion.assertFolderEntityState(
          { name: firstConversationUnpublishingRequestName },
          { name: firstConversation.name },
          'visible',
        );
        await adminApproveRequiredConversationsAssertion.assertFolderEntityColor(
          { name: firstConversationUnpublishingRequestName },
          { name: firstConversation.name },
          Colors.textError,
        );
        await adminApproveRequiredConversationsAssertion.assertFolderEntityState(
          { name: firstConversationUnpublishingRequestName },
          { name: secondConversation.name },
          'hidden',
        );
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal,
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Verify only 1t conversation is displayed on "Publication approval" modal',
      async () => {
        await adminPublishingApprovalModalAssertion.assertElementText(
          adminPublishingApprovalModal.publishToPath,
          publishPath,
        );
        await adminPublishingApprovalModalAssertion.assertRequestCreationDate(
          firstUnpublishApiModels.response,
        );
        await adminPublishingApprovalModalAssertion.assertAvailabilityLabelState(
          'visible',
        );
        await adminFolderToApproveAssertion.assertFolderEntityState(
          { name: publishedFolderName },
          { name: firstConversation.name },
          'visible',
        );
        await adminFolderToApproveAssertion.assertFolderEntityColor(
          { name: publishedFolderName },
          { name: firstConversation.name },
          Colors.textError,
        );
        await adminFolderToApproveAssertion.assertFolderEntityVersion(
          { name: publishedFolderName },
          { name: firstConversation.name },
          ExpectedConstants.defaultAppVersion,
        );
        await adminFolderToApproveAssertion.assertFolderEntityVersionColor(
          { name: publishedFolderName },
          { name: firstConversation.name },
          Colors.textError,
        );
        await adminFolderToApproveAssertion.assertFolderEntityIcon(
          { name: publishedFolderName },
          { name: firstConversation.name },
          expectedConversationIcon,
        );
        await adminFolderToApproveAssertion.assertFolderEntityState(
          { name: publishedFolderName },
          { name: secondConversation.name },
          'hidden',
        );
      },
    );

    await dialAdminTest.step(
      'Admins reviews and approves the request and verify publication disappears from "Approve required", only one conversation left in "Organization" section',
      async () => {
        await adminPublishingApprovalModal.goToEntityReview();
        await adminPublicationReviewControl.backToPublicationRequest();
        await adminPublishingApprovalModal.approveRequest();
        await adminApproveRequiredConversationsAssertion.assertFolderState(
          { name: firstConversationUnpublishingRequestName },
          'hidden',
        );
        await adminOrganizationFolderConversations.expandFolder(
          publishedFolderName,
        );
        await adminOrganizationFolderConversationAssertions.assertFolderEntityState(
          { name: publishedFolderName },
          { name: firstConversation.name },
          'hidden',
        );
        await adminOrganizationFolderConversationAssertions.assertFolderEntityState(
          { name: publishedFolderName },
          { name: secondConversation.name },
          'visible',
        );

        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await organizationFolderConversations.expandFolder(publishedFolderName);
        await organizationFolderConversationAssertions.assertFolderEntityState(
          { name: publishedFolderName },
          { name: firstConversation.name },
          'hidden',
        );
        await organizationFolderConversationAssertions.assertFolderEntityState(
          { name: publishedFolderName },
          { name: secondConversation.name },
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Admin expands the folder unpublishing request and verify error message is displayed instead of "Go to a review" link',
      async () => {
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          unpublishFolderResponse.name!,
        );
        await adminPublishingApprovalModalAssertion.assertElementActionabilityState(
          adminPublishingApprovalModal.approveButton,
          'disabled',
        );
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal.goToReviewButton,
          'hidden',
        );
        await adminPublishingApprovalModalAssertion.assertElementText(
          adminPublishingApprovalModal.duplicatedUnpublishingError,
          ExpectedConstants.duplicatedUnpublishingError(firstConversation.name),
        );
      },
    );

    await dialAdminTest.step(
      'Verify unpublished conversation is marked as grey under the request and on side panel',
      async () => {
        await adminFolderToApproveAssertion.assertFolderEntityState(
          { name: publishedFolderName },
          { name: firstConversation.name },
          'visible',
        );
        await adminFolderToApproveAssertion.assertFolderEntityColor(
          { name: publishedFolderName },
          { name: firstConversation.name },
          Colors.controlsBackgroundDisable,
        );

        await adminFolderToApproveAssertion.assertFolderEntityState(
          { name: publishedFolderName },
          { name: firstConversation.name },
          'visible',
        );
        await adminFolderToApproveAssertion.assertFolderEntityColor(
          { name: publishedFolderName },
          { name: firstConversation.name },
          Colors.controlsBackgroundDisable,
        );
      },
    );

    await dialAdminTest.step(
      'Admins reviews and approves the second request and verifies published folder disappears from "Organization" section',
      async () => {
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          secondConversationUnpublishingRequestName,
        );
        await adminPublishingApprovalModal.goToEntityReview();
        await adminPublicationReviewControl.backToPublicationRequest();
        await adminPublishingApprovalModal.approveRequest();
        await adminApproveRequiredConversationsAssertion.assertFolderState(
          { name: secondConversationUnpublishingRequestName },
          'hidden',
        );
        //TODO: enable when the issue is fixed https://github.com/epam/ai-dial-chat/issues/2727
        // await adminOrganizationFolderConversationAssertions.assertFolderState(
        //   { name: publishedFolderName },
        //   'hidden',
        // );

        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await organizationFolderConversationAssertions.assertFolderState(
          { name: publishedFolderName },
          'hidden',
        );
      },
    );
  },
);

dialAdminTest(
  'Unpublish request for folder with more than one chat.\n' +
    '2 Unpublish requests for folder structure.\n' +
    'Admin review 2 Unpublish requests for chat from folder',
  async ({
    dialHomePage,
    conversationData,
    publishRequestBuilder,
    publicationApiHelper,
    adminPublicationApiHelper,
    dataInjector,
    organizationFolderConversations,
    conversationDropdownMenu,
    publishingRequestModal,
    conversationToPublishAssertion,
    publishingRequestModalAssertion,
    adminDialHomePage,
    adminApproveRequiredConversations,
    adminPublishingApprovalModal,
    baseAssertion,
    adminPublicationReviewControl,
    adminApproveRequiredConversationsAssertion,
    adminOrganizationFolderConversationAssertions,
    adminPublishingApprovalModalAssertion,
    adminFolderToApproveAssertion,
    organizationFolderConversationAssertions,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3429', 'EPMRTC-3800', 'EPMRTC-3801');
    let firstConversation: Conversation;
    let secondConversation: Conversation;
    let conversationsFolder: FolderConversation;
    let publishedFolderName: string;
    const firstFolderUnpublishingRequestName =
      GeneratorUtil.randomUnpublishRequestName();
    const secondFolderUnpublishingRequestName =
      GeneratorUtil.randomUnpublishRequestName();
    let firstUnpublishApiModels: {
      request: PublicationRequestModel;
      response: Publication;
    };
    let folderPublicationRequest: Publication;
    let folderConversations: string[];

    await dialTest.step(
      'Create and approve publishing of folder with 2 conversations inside',
      async () => {
        firstConversation = conversationData.prepareDefaultConversation();
        conversationData.resetData();
        secondConversation = conversationData.prepareDefaultConversation();
        conversationData.resetData();
        conversationsFolder = conversationData.prepareConversationsInFolder([
          firstConversation,
          secondConversation,
        ]);
        await dataInjector.createConversations(
          conversationsFolder.conversations,
          conversationsFolder.folders,
        );
        publishedFolderName = conversationsFolder.folders.name;

        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withConversationResource(firstConversation, PublishActions.ADD)
          .withConversationResource(secondConversation, PublishActions.ADD)
          .build();
        folderPublicationRequest =
          await publicationApiHelper.createPublishRequest(publishRequest);
        await adminPublicationApiHelper.approveRequest(
          folderPublicationRequest,
        );
        folderConversations = [firstConversation.name, secondConversation.name];
      },
    );

    await dialTest.step(
      'Select "Unpublish" menu option for the folder and verify "Publish request" modal is opened',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await organizationFolderConversations.openFolderDropdownMenu(
          publishedFolderName,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.unpublish);
        await publishingRequestModalAssertion.assertElementState(
          publishingRequestModal,
          'visible',
        );
        for (const conversation of folderConversations) {
          await conversationToPublishAssertion.assertEntityState(
            { name: conversation },
            'visible',
          );
          await conversationToPublishAssertion.assertEntityColor(
            { name: conversation },
            Colors.textError,
          );
          await conversationToPublishAssertion.assertEntityCheckboxState(
            { name: conversation },
            CheckboxState.checked,
          );
          await conversationToPublishAssertion.assertEntityVersion(
            { name: conversation },
            ExpectedConstants.defaultAppVersion,
          );
          await conversationToPublishAssertion.assertEntityVersionColor(
            { name: conversation },
            Colors.textError,
          );
          await conversationToPublishAssertion.assertTreeEntityIcon(
            { name: conversation },
            expectedConversationIcon,
          );
        }
      },
    );

    await dialTest.step('Set a valid request name and submit', async () => {
      await publishingRequestModal.requestName.fillInInput(
        firstFolderUnpublishingRequestName,
      );
      firstUnpublishApiModels =
        await publishingRequestModal.sendPublicationRequest();
      await publishingRequestModalAssertion.assertElementState(
        publishingRequestModal,
        'hidden',
      );
    });

    await dialTest.step(
      'Create one more unpublish request for the folder conversation',
      async () => {
        await organizationFolderConversations.openFolderDropdownMenu(
          publishedFolderName,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.unpublish);
        await publishingRequestModalAssertion.assertElementState(
          publishingRequestModal,
          'visible',
        );
        await publishingRequestModal.requestName.fillInInput(
          secondFolderUnpublishingRequestName,
        );
        await publishingRequestModal.sendPublicationRequest();
      },
    );

    await dialAdminTest.step(
      'Login as admin and verify both folder unpublishing requests are displayed under "Approve required" section',
      async () => {
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredConversationsAssertion.assertFolderState(
          { name: firstFolderUnpublishingRequestName },
          'visible',
        );
        await adminApproveRequiredConversationsAssertion.assertFolderState(
          { name: secondFolderUnpublishingRequestName },
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Expand the first request folder and verify "Publication approval" modal is displayed',
      async () => {
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          firstFolderUnpublishingRequestName,
        );
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          publishedFolderName,
          { isHttpMethodTriggered: false },
        );
        for (const conversation of folderConversations) {
          await adminApproveRequiredConversationsAssertion.assertFolderEntityState(
            { name: firstFolderUnpublishingRequestName },
            { name: conversation },
            'visible',
          );
          await adminApproveRequiredConversationsAssertion.assertFolderEntityColor(
            { name: firstFolderUnpublishingRequestName },
            { name: conversation },
            Colors.textError,
          );
        }
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal,
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Verify both conversations are displayed on "Publication approval" modal',
      async () => {
        await adminPublishingApprovalModalAssertion.assertElementText(
          adminPublishingApprovalModal.publishToPath,
          PublishPath.Organization,
        );
        await adminPublishingApprovalModalAssertion.assertRequestCreationDate(
          firstUnpublishApiModels.response,
        );
        await adminPublishingApprovalModalAssertion.assertAvailabilityLabelState(
          'visible',
        );
        for (const conversation of folderConversations) {
          await adminFolderToApproveAssertion.assertFolderEntityState(
            { name: publishedFolderName },
            { name: conversation },
            'visible',
          );
          await adminFolderToApproveAssertion.assertFolderEntityColor(
            { name: publishedFolderName },
            { name: conversation },
            Colors.textError,
          );
          await adminFolderToApproveAssertion.assertFolderEntityVersion(
            { name: publishedFolderName },
            { name: conversation },
            ExpectedConstants.defaultAppVersion,
          );
          await adminFolderToApproveAssertion.assertFolderEntityVersionColor(
            { name: publishedFolderName },
            { name: conversation },
            Colors.textError,
          );
          await adminFolderToApproveAssertion.assertFolderEntityIcon(
            { name: publishedFolderName },
            { name: conversation },
            expectedConversationIcon,
          );
        }
      },
    );

    await dialAdminTest.step(
      'Admins reviews the 1st request conversation, back to publication and checks the 1st unpublishing modal is opened',
      async () => {
        await adminPublishingApprovalModal.goToEntityReview();
        await adminPublicationReviewControl.backToPublicationRequest();
        await adminPublishingApprovalModalAssertion.assertElementText(
          adminPublishingApprovalModal.publishName,
          firstFolderUnpublishingRequestName,
        );
        await adminPublishingApprovalModal.goToEntityReview();
        await adminPublicationReviewControl.backToPublicationRequest();
      },
    );

    await dialAdminTest.step(
      'Admins approves the 1st request conversation and verifies folder disappears from "Organization" section ',
      async () => {
        await adminPublishingApprovalModal.approveRequest();
        await adminApproveRequiredConversationsAssertion.assertFolderState(
          { name: firstFolderUnpublishingRequestName },
          'hidden',
        );
        await adminOrganizationFolderConversationAssertions.assertFolderState(
          { name: publishedFolderName },
          'hidden',
        );

        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await organizationFolderConversationAssertions.assertFolderState(
          { name: publishedFolderName },
          'hidden',
        );
      },
    );

    await dialAdminTest.step(
      'Admin expands the 2nd folder unpublishing request and verifies error message is displayed instead of "Go to a review" link',
      async () => {
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          secondFolderUnpublishingRequestName,
        );
        await adminPublishingApprovalModalAssertion.assertElementActionabilityState(
          adminPublishingApprovalModal.approveButton,
          'disabled',
        );
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal.goToReviewButton,
          'hidden',
        );
        await adminPublishingApprovalModalAssertion.assertElementText(
          adminPublishingApprovalModal.duplicatedUnpublishingError,
          ExpectedConstants.duplicatedUnpublishingError(
            ...baseAssertion.sortStringsArray(
              folderConversations,
              (f) => f.toLowerCase(),
              'asc',
            ),
          ),
        );
      },
    );

    await dialAdminTest.step(
      'Verify unpublished conversations are marked as grey under the request and on side panel',
      async () => {
        for (const conversation of folderConversations) {
          await adminFolderToApproveAssertion.assertFolderEntityState(
            { name: publishedFolderName },
            { name: conversation },
            'visible',
          );
          await adminFolderToApproveAssertion.assertFolderEntityColor(
            { name: publishedFolderName },
            { name: conversation },
            Colors.controlsBackgroundDisable,
          );

          await adminFolderToApproveAssertion.assertFolderEntityState(
            { name: publishedFolderName },
            { name: conversation },
            'visible',
          );
          await adminFolderToApproveAssertion.assertFolderEntityColor(
            { name: publishedFolderName },
            { name: conversation },
            Colors.controlsBackgroundDisable,
          );
        }
      },
    );
  },
);

dialAdminTest(
  'Unpublish folder from folder structure',
  async ({
    dialHomePage,
    conversationData,
    publishRequestBuilder,
    publicationApiHelper,
    adminPublicationApiHelper,
    dataInjector,
    organizationFolderConversations,
    conversationDropdownMenu,
    publishingRequestModal,
    publishingRules,
    folderToPublishAssertion,
    publishingRequestModalAssertion,
    adminDialHomePage,
    adminApproveRequiredConversations,
    adminPublishingApprovalModal,
    adminPublicationReviewControl,
    adminApproveRequiredConversationsAssertion,
    adminOrganizationFolderConversations,
    adminOrganizationFolderConversationAssertions,
    adminPublishingApprovalModalAssertion,
    adminFolderToApproveAssertion,
    organizationFolderConversationAssertions,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3808');
    let nestedFolders: FolderInterface[];
    let nestedConversations: Conversation[];
    const nestedFolderLevel = 2;
    const folderUnpublishingRequestName =
      GeneratorUtil.randomUnpublishRequestName();
    let unpublishApiModels: {
      request: PublicationRequestModel;
      response: Publication;
    };
    let publishPath: string;
    let rootFolderName: string;
    let rootFolderConversationName: string;
    let innerFolderName: string;
    let innerFolderConversationName: string;

    await dialTest.step(
      'Create and approve publishing of 2 nested folders with 2 conversations inside',
      async () => {
        nestedFolders = conversationData.prepareNestedFolder(nestedFolderLevel);
        nestedConversations =
          conversationData.prepareConversationsForNestedFolders(nestedFolders);
        await dataInjector.createConversations(
          nestedConversations,
          ...nestedFolders,
        );

        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withConversationResource(nestedConversations[0], PublishActions.ADD)
          .withConversationResource(nestedConversations[1], PublishActions.ADD)
          .build();
        const folderPublicationRequest =
          await publicationApiHelper.createPublishRequest(publishRequest);
        await adminPublicationApiHelper.approveRequest(
          folderPublicationRequest,
        );

        rootFolderName = nestedFolders[0].name;
        rootFolderConversationName = nestedConversations[0].name;
        innerFolderName = nestedFolders[1].name;
        innerFolderConversationName = nestedConversations[1].name;
        publishPath = `${PublishPath.Organization}/${rootFolderName}`;
        folderConversationToUnpublish = nestedConversations[0];
      },
    );

    await dialTest.step(
      'Select "Unpublish" menu option for the nested folder and verify "Publish request" modal is opened',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await organizationFolderConversations.expandFolder(rootFolderName);
        await organizationFolderConversations.openFolderDropdownMenu(
          innerFolderName,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.unpublish);
        await publishingRequestModalAssertion.assertElementState(
          publishingRequestModal,
          'visible',
        );
        await folderToPublishAssertion.assertFolderState(
          { name: innerFolderName },
          'visible',
        );
        await folderToPublishAssertion.assertFolderEntityState(
          { name: innerFolderName },
          { name: innerFolderConversationName },
          'visible',
        );
        await folderToPublishAssertion.assertFolderState(
          { name: rootFolderName },
          'hidden',
        );
        await folderToPublishAssertion.assertFolderEntityColor(
          { name: innerFolderName },
          { name: innerFolderConversationName },
          Colors.textError,
        );
        await folderToPublishAssertion.assertFolderCheckboxState(
          { name: innerFolderName },
          CheckboxState.checked,
        );
        await folderToPublishAssertion.assertFolderEntityCheckboxState(
          { name: innerFolderName },
          { name: innerFolderConversationName },
          CheckboxState.checked,
        );
        await folderToPublishAssertion.assertFolderEntityVersion(
          { name: innerFolderName },
          { name: innerFolderConversationName },
          ExpectedConstants.defaultAppVersion,
        );
        await folderToPublishAssertion.assertFolderEntityVersionColor(
          { name: innerFolderName },
          { name: innerFolderConversationName },
          Colors.textError,
        );
        await folderToPublishAssertion.assertFolderEntityIcon(
          { name: innerFolderName },
          { name: innerFolderConversationName },
          expectedConversationIcon,
        );
        await publishingRequestModalAssertion.assertElementText(
          publishingRequestModal.getChangePublishToPath().path,
          publishPath,
        );
        await publishingRequestModalAssertion.assertElementText(
          publishingRules.publishingPath,
          rootFolderName,
        );
        await publishingRequestModalAssertion.assertElementState(
          publishingRules.addRuleButton,
          'visible',
        );
        await publishingRequestModalAssertion.assertElementsCount(
          publishingRules.allRules,
          0,
        );
      },
    );

    await dialTest.step('Set a valid request name and submit', async () => {
      await publishingRequestModal.requestName.fillInInput(
        folderUnpublishingRequestName,
      );
      unpublishApiModels =
        await publishingRequestModal.sendPublicationRequest();
      await publishingRequestModalAssertion.assertElementState(
        publishingRequestModal,
        'hidden',
      );
    });

    await dialAdminTest.step(
      'Login as admin and verify inner folder unpublishing request is displayed under "Approve required" section',
      async () => {
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredConversationsAssertion.assertFolderState(
          { name: folderUnpublishingRequestName },
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Expand the request folder and verify "Publication approval" modal is displayed',
      async () => {
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          folderUnpublishingRequestName,
        );
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          rootFolderName,
          { isHttpMethodTriggered: false },
        );
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          innerFolderName,
          { isHttpMethodTriggered: false },
        );
        await adminApproveRequiredConversationsAssertion.assertFolderEntityState(
          { name: innerFolderName },
          { name: innerFolderConversationName },
          'visible',
        );
        await adminApproveRequiredConversationsAssertion.assertFolderEntityColor(
          { name: innerFolderName },
          { name: innerFolderConversationName },
          Colors.textError,
        );
        await adminApproveRequiredConversationsAssertion.assertFolderState(
          { name: rootFolderName },
          'visible',
        );
        await adminApproveRequiredConversationsAssertion.assertFolderEntityState(
          { name: rootFolderName },
          { name: rootFolderConversationName },
          'hidden',
        );
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal,
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Verify only inner folder with content is displayed on "Publication approval" modal',
      async () => {
        await adminPublishingApprovalModalAssertion.assertElementText(
          adminPublishingApprovalModal.publishToPath,
          publishPath,
        );
        await adminPublishingApprovalModalAssertion.assertRequestCreationDate(
          unpublishApiModels.response,
        );
        await adminPublishingApprovalModalAssertion.assertAvailabilityLabelState(
          'visible',
        );
        await adminFolderToApproveAssertion.assertFolderState(
          { name: innerFolderName },
          'visible',
        );
        await adminFolderToApproveAssertion.assertFolderEntityState(
          { name: innerFolderName },
          { name: innerFolderConversationName },
          'visible',
        );
        await adminFolderToApproveAssertion.assertFolderEntityColor(
          { name: innerFolderName },
          { name: innerFolderConversationName },
          Colors.textError,
        );
        await adminFolderToApproveAssertion.assertFolderEntityVersion(
          { name: innerFolderName },
          { name: innerFolderConversationName },
          ExpectedConstants.defaultAppVersion,
        );
        await adminFolderToApproveAssertion.assertFolderEntityVersionColor(
          { name: innerFolderName },
          { name: innerFolderConversationName },
          Colors.textError,
        );
        await adminFolderToApproveAssertion.assertFolderEntityIcon(
          { name: innerFolderName },
          { name: innerFolderConversationName },
          expectedConversationIcon,
        );
        await adminFolderToApproveAssertion.assertFolderState(
          { name: rootFolderName },
          'visible',
        );
        await adminFolderToApproveAssertion.assertFolderEntityState(
          { name: rootFolderName },
          { name: rootFolderConversationName },
          'hidden',
        );
      },
    );

    await dialAdminTest.step(
      'Admins reviews and approves the request conversation and checks only root folder with content is displayed in the "Organization" section',
      async () => {
        await adminPublishingApprovalModal.goToEntityReview();
        await adminPublicationReviewControl.backToPublicationRequest();
        await adminPublishingApprovalModal.approveRequest();
        await adminApproveRequiredConversationsAssertion.assertFolderState(
          { name: folderUnpublishingRequestName },
          'hidden',
        );
        await adminOrganizationFolderConversationAssertions.assertFolderState(
          { name: rootFolderName },
          'visible',
        );
        await adminOrganizationFolderConversations.expandFolder(rootFolderName);
        await adminOrganizationFolderConversationAssertions.assertFolderState(
          { name: innerFolderName },
          'hidden',
        );
        await adminOrganizationFolderConversationAssertions.assertFolderEntityState(
          { name: rootFolderName },
          { name: rootFolderConversationName },
          'visible',
        );
        await adminOrganizationFolderConversationAssertions.assertFolderEntityState(
          { name: rootFolderName },
          { name: innerFolderConversationName },
          'hidden',
        );
      },
    );

    await dialAdminTest.step(
      'Main user refreshes the page and verifies only root folder remains in the "Organization" section',
      async () => {
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await organizationFolderConversationAssertions.assertFolderState(
          { name: rootFolderName },
          'visible',
        );
        await organizationFolderConversations.expandFolder(rootFolderName);
        await organizationFolderConversationAssertions.assertFolderState(
          { name: innerFolderName },
          'hidden',
        );
        await organizationFolderConversationAssertions.assertFolderEntityState(
          { name: rootFolderName },
          { name: rootFolderConversationName },
          'visible',
        );
        await organizationFolderConversationAssertions.assertFolderEntityState(
          { name: rootFolderName },
          { name: innerFolderConversationName },
          'hidden',
        );
      },
    );
  },
);

dialTest.afterAll(
  async ({
    publicationApiHelper,
    adminPublicationApiHelper,
    publishRequestBuilder,
  }) => {
    const publishRequest = publishRequestBuilder
      .withConversationResource(
        folderConversationToUnpublish,
        PublishActions.DELETE,
      )
      .build();
    const folderPublicationRequest =
      await publicationApiHelper.createUnpublishRequest(publishRequest);
    await adminPublicationApiHelper.approveRequest(folderPublicationRequest);
  },
);
