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
import { ThemeColorAttributes } from '@/src/ui/domData';
import { GeneratorUtil, ModelsUtil, SortingUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { PublishActions } from '@epam/ai-dial-shared';

let expectedConversationIcon: string;
let folderConversationToUnpublish: Conversation;
let expectedErrorColor: string;
let expectedBgDisabledColor: string;

dialTest.beforeAll(async ({ iconApiHelper }) => {
  const defaultModel = ModelsUtil.getDefaultAgent()!;
  expectedConversationIcon = iconApiHelper.getEntityIcon(defaultModel);
  expectedErrorColor = ThemesUtil.getRgbColorByKey(
    ThemeColorAttributes.textError,
  );
  expectedBgDisabledColor = ThemesUtil.getRgbColorByKey(
    ThemeColorAttributes.textSecondary,
  );
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
    publishingRequestDialog,
    publishConversationAssertion,
    baseAssertion,
    publishingRules,
    publishingRequestDialogAssertion,
    adminDialHomePage,
    adminApproveRequiredConversations,
    adminPublishingApprovalModal,
    adminPublicationReviewControl,
    adminOrganizationFolderConversations,
    adminApproveRequiredConversationsAssertion,
    adminOrganizationFolderConversationAssertions,
    adminPublishingApprovalModalAssertion,
    adminPublishingRulesAssertion,
    adminFolderConversationsToApproveAssertion,
    organizationFolderConversationAssertions,
    setTestIds,
    localStorageManager,
    adminLocalStorageManager,
  }) => {
    dialAdminTest.slow();
    setTestIds('EPMDIAL-3178', 'EPMDIAL-3192', 'EPMDIAL-3179');
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
          .withConversationInFolderResource(
            firstConversation,
            PublishActions.ADD,
          )
          .withConversationInFolderResource(
            secondConversation,
            PublishActions.ADD,
          )
          .build();
        folderPublicationRequest =
          await publicationApiHelper.createPublishRequest(publishRequest);
        await adminPublicationApiHelper.approveRequest(
          folderPublicationRequest,
        );
        await localStorageManager.setShowSideBarPanels();
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
        await publishingRequestDialogAssertion.assertElementState(
          publishingRequestDialog,
          'visible',
        );
        await baseAssertion.assertElementText(
          publishingRequestDialog.publishPath,
          publishPath,
        );

        await publishConversationAssertion.assertEntityState(
          { name: firstConversation.name },
          'visible',
        );
        await publishConversationAssertion.assertEntityColor(
          { name: firstConversation.name },
          expectedErrorColor,
        );
        await publishConversationAssertion.assertEntityCheckboxState(
          { name: firstConversation.name },
          CheckboxState.checked,
        );

        await publishConversationAssertion.assertEntityVersion(
          { name: firstConversation.name },
          ExpectedConstants.defaultEntityVersion,
        );
        await publishConversationAssertion.assertEntityVersionColor(
          { name: firstConversation.name },
          expectedErrorColor,
        );
        await publishConversationAssertion.assertTreeEntityIcon(
          { name: firstConversation.name },
          expectedConversationIcon,
        );

        await publishConversationAssertion.assertEntityState(
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
      await publishingRequestDialog.requestName.fillInInput(
        firstConversationUnpublishingRequestName,
      );
      firstUnpublishApiModels =
        await publishingRequestDialog.sendPublicationRequest();
      await publishingRequestDialogAssertion.assertElementState(
        publishingRequestDialog,
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
        await publishingRequestDialogAssertion.assertElementState(
          publishingRequestDialog,
          'visible',
        );
        await publishingRequestDialog.requestName.fillInInput(
          secondConversationUnpublishingRequestName,
        );
        await publishingRequestDialog.sendPublicationRequest();
      },
    );

    await dialTest.step(
      'Create one more unpublish request for the whole folder',
      async () => {
        const unpublishFolderRequestModel = publishRequestBuilder
          .withConversationInFolderResource(
            firstConversation,
            PublishActions.DELETE,
          )
          .withConversationInFolderResource(
            secondConversation,
            PublishActions.DELETE,
          )
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
        await adminLocalStorageManager.setShowSideBarPanels();
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredConversationsAssertion.assertFolderState(
          { name: firstConversationUnpublishingRequestName },
          'visible',
        );
      },
    );

    //TODO: update the step when fixed https://github.com/epam/ai-dial-chat/issues/2064
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
          expectedErrorColor,
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

    //TODO: update the assertion when fixed https://github.com/epam/ai-dial-chat/issues/2064
    await dialAdminTest.step(
      'Verify only 1t conversation is displayed on "Publication approval" modal',
      async () => {
        await adminPublishingApprovalModalAssertion.assertElementText(
          adminPublishingApprovalModal.publishPath,
          publishPath,
        );
        await adminPublishingApprovalModalAssertion.assertRequestCreationDate(
          firstUnpublishApiModels.response,
        );
        await adminPublishingRulesAssertion.assertLabels({
          availabilityLabel: 'visible',
        });
        await adminFolderConversationsToApproveAssertion.assertFolderEntityState(
          { name: publishedFolderName },
          { name: firstConversation.name },
          'visible',
        );
        await adminFolderConversationsToApproveAssertion.assertFolderEntityColor(
          { name: publishedFolderName },
          { name: firstConversation.name },
          expectedErrorColor,
        );
        await adminFolderConversationsToApproveAssertion.assertFolderEntityVersion(
          { name: publishedFolderName },
          { name: firstConversation.name },
          ExpectedConstants.defaultEntityVersion,
        );
        await adminFolderConversationsToApproveAssertion.assertFolderEntityVersionColor(
          { name: publishedFolderName },
          { name: firstConversation.name },
          expectedErrorColor,
        );
        await adminFolderConversationsToApproveAssertion.assertFolderEntityIcon(
          { name: publishedFolderName },
          { name: firstConversation.name },
          expectedConversationIcon,
        );
        await adminFolderConversationsToApproveAssertion.assertFolderEntityState(
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
          ExpectedConstants.duplicatedUnpublishingError({
            name: firstConversation.name,
            version: ExpectedConstants.defaultEntityVersion,
          }),
        );
      },
    );

    await dialAdminTest.step(
      'Verify unpublished conversation is marked as grey under the request and on side panel',
      async () => {
        await adminFolderConversationsToApproveAssertion.assertFolderEntityState(
          { name: publishedFolderName },
          { name: firstConversation.name },
          'visible',
        );
        await adminFolderConversationsToApproveAssertion.assertFolderEntityColor(
          { name: publishedFolderName },
          { name: firstConversation.name },
          expectedBgDisabledColor,
        );

        await adminFolderConversationsToApproveAssertion.assertFolderEntityState(
          { name: publishedFolderName },
          { name: firstConversation.name },
          'visible',
        );
        await adminFolderConversationsToApproveAssertion.assertFolderEntityColor(
          { name: publishedFolderName },
          { name: firstConversation.name },
          expectedBgDisabledColor,
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
        //TODO: enable when the issue is fixed https://github.com/epam/ai-dial-chat/issues/3992
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
    publishingRequestDialog,
    publishConversationAssertion,
    publishingRequestDialogAssertion,
    adminDialHomePage,
    adminApproveRequiredConversations,
    adminPublishingApprovalModal,
    adminPublicationReviewControl,
    adminApproveRequiredConversationsAssertion,
    adminOrganizationFolderConversationAssertions,
    adminPublishingApprovalModalAssertion,
    adminPublishingRulesAssertion,
    adminFolderConversationsToApproveAssertion,
    organizationFolderConversationAssertions,
    setTestIds,
    localStorageManager,
    adminLocalStorageManager,
  }) => {
    setTestIds('EPMDIAL-3180', 'EPMDIAL-3190', 'EPMDIAL-3196');
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
          .withConversationInFolderResource(
            firstConversation,
            PublishActions.ADD,
          )
          .withConversationInFolderResource(
            secondConversation,
            PublishActions.ADD,
          )
          .build();
        folderPublicationRequest =
          await publicationApiHelper.createPublishRequest(publishRequest);
        await adminPublicationApiHelper.approveRequest(
          folderPublicationRequest,
        );
        folderConversations = [firstConversation.name, secondConversation.name];
        await localStorageManager.setShowSideBarPanels();
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
        await publishingRequestDialogAssertion.assertElementState(
          publishingRequestDialog,
          'visible',
        );
        for (const conversation of folderConversations) {
          await publishConversationAssertion.assertEntityState(
            { name: conversation },
            'visible',
          );
          await publishConversationAssertion.assertEntityColor(
            { name: conversation },
            expectedErrorColor,
          );
          await publishConversationAssertion.assertEntityCheckboxState(
            { name: conversation },
            CheckboxState.checked,
          );
          await publishConversationAssertion.assertEntityVersion(
            { name: conversation },
            ExpectedConstants.defaultEntityVersion,
          );
          await publishConversationAssertion.assertEntityVersionColor(
            { name: conversation },
            expectedErrorColor,
          );
          await publishConversationAssertion.assertTreeEntityIcon(
            { name: conversation },
            expectedConversationIcon,
          );
        }
      },
    );

    await dialTest.step('Set a valid request name and submit', async () => {
      await publishingRequestDialog.requestName.fillInInput(
        firstFolderUnpublishingRequestName,
      );
      firstUnpublishApiModels =
        await publishingRequestDialog.sendPublicationRequest();
      await publishingRequestDialogAssertion.assertElementState(
        publishingRequestDialog,
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
        await publishingRequestDialogAssertion.assertElementState(
          publishingRequestDialog,
          'visible',
        );
        await publishingRequestDialog.requestName.fillInInput(
          secondFolderUnpublishingRequestName,
        );
        await publishingRequestDialog.sendPublicationRequest();
      },
    );

    await dialAdminTest.step(
      'Login as admin and verify both folder unpublishing requests are displayed under "Approve required" section',
      async () => {
        await adminLocalStorageManager.setShowSideBarPanels();
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
            expectedErrorColor,
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
          adminPublishingApprovalModal.publishPath,
          PublishPath.Organization,
        );
        await adminPublishingApprovalModalAssertion.assertRequestCreationDate(
          firstUnpublishApiModels.response,
        );
        await adminPublishingRulesAssertion.assertLabels({
          availabilityLabel: 'visible',
        });
        for (const conversation of folderConversations) {
          await adminFolderConversationsToApproveAssertion.assertFolderEntityState(
            { name: publishedFolderName },
            { name: conversation },
            'visible',
          );
          await adminFolderConversationsToApproveAssertion.assertFolderEntityColor(
            { name: publishedFolderName },
            { name: conversation },
            expectedErrorColor,
          );
          await adminFolderConversationsToApproveAssertion.assertFolderEntityVersion(
            { name: publishedFolderName },
            { name: conversation },
            ExpectedConstants.defaultEntityVersion,
          );
          await adminFolderConversationsToApproveAssertion.assertFolderEntityVersionColor(
            { name: publishedFolderName },
            { name: conversation },
            expectedErrorColor,
          );
          await adminFolderConversationsToApproveAssertion.assertFolderEntityIcon(
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
      'Admins approves the 1st request conversation and verifies folder disappears from "Organization" section',
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
            ...SortingUtil.sortStringsArray(
              folderConversations,
              (f) => f.toLowerCase(),
              'asc',
            ).map((name) => ({
              name,
              version: ExpectedConstants.defaultEntityVersion,
            })),
          ),
        );
      },
    );

    await dialAdminTest.step(
      'Verify unpublished conversations are marked as grey under the request and on side panel',
      async () => {
        for (const conversation of folderConversations) {
          await adminFolderConversationsToApproveAssertion.assertFolderEntityState(
            { name: publishedFolderName },
            { name: conversation },
            'visible',
          );
          await adminFolderConversationsToApproveAssertion.assertFolderEntityColor(
            { name: publishedFolderName },
            { name: conversation },
            expectedBgDisabledColor,
          );

          await adminFolderConversationsToApproveAssertion.assertFolderEntityState(
            { name: publishedFolderName },
            { name: conversation },
            'visible',
          );
          await adminFolderConversationsToApproveAssertion.assertFolderEntityColor(
            { name: publishedFolderName },
            { name: conversation },
            expectedBgDisabledColor,
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
    publishingRequestDialog,
    publishingRules,
    folderToPublishAssertion,
    publishingRequestDialogAssertion,
    adminDialHomePage,
    adminApproveRequiredConversations,
    adminPublishingApprovalModal,
    adminPublicationReviewControl,
    adminApproveRequiredConversationsAssertion,
    adminOrganizationFolderConversations,
    adminOrganizationFolderConversationAssertions,
    adminPublishingApprovalModalAssertion,
    adminPublishingRulesAssertion,
    adminFolderConversationsToApproveAssertion,
    organizationFolderConversationAssertions,
    setTestIds,
    localStorageManager,
    adminLocalStorageManager,
  }) => {
    setTestIds('EPMDIAL-3193');
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
          .withConversationInFolderResource(
            nestedConversations[0],
            PublishActions.ADD,
          )
          .withConversationInFolderResource(
            nestedConversations[1],
            PublishActions.ADD,
          )
          .build();
        const folderPublicationRequest =
          await publicationApiHelper.createPublishRequest(publishRequest);
        await adminPublicationApiHelper.approveRequest(
          folderPublicationRequest,
        );
        await localStorageManager.setShowSideBarPanels();

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
        await publishingRequestDialogAssertion.assertElementState(
          publishingRequestDialog,
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
          expectedErrorColor,
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
          ExpectedConstants.defaultEntityVersion,
        );
        await folderToPublishAssertion.assertFolderEntityVersionColor(
          { name: innerFolderName },
          { name: innerFolderConversationName },
          expectedErrorColor,
        );
        await folderToPublishAssertion.assertFolderEntityIcon(
          { name: innerFolderName },
          { name: innerFolderConversationName },
          expectedConversationIcon,
        );
        await publishingRequestDialogAssertion.assertElementText(
          publishingRequestDialog.publishPath,
          publishPath,
        );
        await publishingRequestDialogAssertion.assertElementText(
          publishingRules.publishingPath,
          rootFolderName,
        );
        await publishingRequestDialogAssertion.assertElementState(
          publishingRules.addRuleButton,
          'visible',
        );
        await publishingRequestDialogAssertion.assertElementsCount(
          publishingRules.allRules,
          0,
        );
      },
    );

    await dialTest.step('Set a valid request name and submit', async () => {
      await publishingRequestDialog.requestName.fillInInput(
        folderUnpublishingRequestName,
      );
      unpublishApiModels =
        await publishingRequestDialog.sendPublicationRequest();
      await publishingRequestDialogAssertion.assertElementState(
        publishingRequestDialog,
        'hidden',
      );
    });

    await dialAdminTest.step(
      'Login as admin and verify inner folder unpublishing request is displayed under "Approve required" section',
      async () => {
        await adminLocalStorageManager.setShowSideBarPanels();
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
          expectedErrorColor,
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
          adminPublishingApprovalModal.publishPath,
          publishPath,
        );
        await adminPublishingApprovalModalAssertion.assertRequestCreationDate(
          unpublishApiModels.response,
        );
        await adminPublishingRulesAssertion.assertLabels({
          availabilityLabel: 'visible',
        });
        await adminFolderConversationsToApproveAssertion.assertFolderState(
          { name: innerFolderName },
          'visible',
        );
        await adminFolderConversationsToApproveAssertion.assertFolderEntityState(
          { name: innerFolderName },
          { name: innerFolderConversationName },
          'visible',
        );
        await adminFolderConversationsToApproveAssertion.assertFolderEntityColor(
          { name: innerFolderName },
          { name: innerFolderConversationName },
          expectedErrorColor,
        );
        await adminFolderConversationsToApproveAssertion.assertFolderEntityVersion(
          { name: innerFolderName },
          { name: innerFolderConversationName },
          ExpectedConstants.defaultEntityVersion,
        );
        await adminFolderConversationsToApproveAssertion.assertFolderEntityVersionColor(
          { name: innerFolderName },
          { name: innerFolderConversationName },
          expectedErrorColor,
        );
        await adminFolderConversationsToApproveAssertion.assertFolderEntityIcon(
          { name: innerFolderName },
          { name: innerFolderConversationName },
          expectedConversationIcon,
        );
        await adminFolderConversationsToApproveAssertion.assertFolderState(
          { name: rootFolderName },
          'visible',
        );
        await adminFolderConversationsToApproveAssertion.assertFolderEntityState(
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
      .withConversationInFolderResource(
        folderConversationToUnpublish,
        PublishActions.DELETE,
      )
      .build();
    const folderPublicationRequest =
      await publicationApiHelper.createUnpublishRequest(publishRequest);
    await adminPublicationApiHelper.approveRequest(folderPublicationRequest);
  },
);
