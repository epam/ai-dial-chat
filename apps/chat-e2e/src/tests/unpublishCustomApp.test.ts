import { BackendEntity } from '@/chat/types/common';
import { Publication, PublicationRequestModel } from '@/chat/types/publication';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  CheckboxState,
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  PublishPath,
} from '@/src/testData';
import { ThemeColorAttributes } from '@/src/ui/domData';
import { BaseElement } from '@/src/ui/webElements';
import { GeneratorUtil, UserUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { PublishActions } from '@epam/ai-dial-shared';

dialAdminTest(
  'Unpublish custom app from context menu on card view.\n' +
    'Author field is not displayed on unpublish request.\n' +
    'Custom app: Admin review unpublish request for app.\n' +
    '[Admin view]: "Author" field is displayed on unpublish request form.\n' +
    `[Admin view]: "Author's public name" field is not displayed in unpublish request.\n` +
    'Custom app: Admin review custom app details in unpublish request',
  async (
    {
      marketplacePage,
      marketplaceHeader,
      marketplaceAgentsSection,
      marketplaceAgents,
      publishingRequestModal,
      publishingRequestModalAssertion,
      appToPublishAssertion,
      adminDialHomePage,
      adminLocalStorageManager,
      adminApproveRequiredPromptsAssertion,
      adminApproveRequiredPrompts,
      adminPublishingApprovalModal,
      adminPublishingApprovalModalAssertion,
      adminAppToApproveAssertion,
      adminPublishedApplicationReviewModal,
      adminPublishedAppReviewModalAssertion,
      adminPublishedAppReviewModalControlsAssertion,
      setTestIds,
      marketplaceAgentsAssertion,
      adminCustomApplicationPublishingUtil,
      publishRequestBuilder,
      customApplicationBuilder,
      applicationApiHelper,
      publicationApiHelper,
      adminPublicationApiHelper,
    },
    testInfo,
  ) => {
    setTestIds(
      'EPMRTC-5941',
      'EPMRTC-5855',
      'EPMRTC-4831',
      'EPMRTC-5859',
      'EPMRTC-5861',
      'EPMRTC-4825',
    );
    const appName = GeneratorUtil.randomApplicationName();
    const appVersion = GeneratorUtil.randomApplicationVersion();
    const appDescription = GeneratorUtil.randomString(10);
    const firstTopic = GeneratorUtil.randomString(5);
    const secondTopic = GeneratorUtil.randomString(5);
    const features = {
      rate_endpoint: ExpectedConstants.appRateEndpointDefaultFeature,
    };
    const attachmentType = 'image/jpeg';
    const maxAttachments = 5;

    let app: BackendEntity;
    let iconTargetUrl: string;
    let expectedIconUrl: string;
    let appElement: BaseElement;
    const expectedErrorColor = ThemesUtil.getRgbColorByKey(
      ThemeColorAttributes.textError,
    );
    const requestName = GeneratorUtil.randomUnpublishRequestName();
    const secondRequestName = GeneratorUtil.randomUnpublishRequestName();
    const defaultAuthor = UserUtil.getE2EUsername(testInfo.parallelIndex);
    let publishApiModels: {
      request: PublicationRequestModel;
      response: Publication;
    };

    await dialAdminTest.step(
      'Prepare and publish a custom application via API',
      async () => {
        const applicationIconUrl =
          await adminCustomApplicationPublishingUtil.uploadApplicationIcon();
        const appModel = customApplicationBuilder
          .withDisplayName(appName)
          .withDisplayVersion(appVersion)
          .withDescription(appDescription)
          .withDescriptionKeywords(firstTopic, secondTopic)
          .withFeaturesData(features)
          .withInputAttachmentTypes(attachmentType)
          .withMaxInputAttachments(maxAttachments)
          .withIconUrl(applicationIconUrl)
          .build();
        app = await applicationApiHelper.createApplication(appModel);
        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withApplicationResource(app, PublishActions.ADD)
          .withFileResource(applicationIconUrl, PublishActions.ADD)
          .build();
        const appPublication =
          await publicationApiHelper.createPublishRequest(publishRequest);
        iconTargetUrl = appPublication.resources.find(
          (r) => r.sourceUrl === applicationIconUrl,
        )!.targetUrl;
        expectedIconUrl = `${API.api}/${iconTargetUrl}`;
        await adminPublicationApiHelper.approveRequest(appPublication);
      },
    );

    await dialAdminTest.step(
      'On the "Marketplace" tab find created application, hover over the card, open dropdown menu and select "Unpublish" option',
      async () => {
        await marketplacePage.openMarketplacePage();
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.searchInput.fillInInput(appName);
        appElement = await marketplaceAgentsSection.findAgentElement(appName, {
          isWorkspaceAgent: false,
          isEditable: false,
        });
        await appElement.hoverOver();
        await marketplaceAgents.getAgentElementDotsMenu(appElement).click();
        await marketplaceAgents
          .getAgentDropdownMenu()
          .selectMenuOption(MenuOptions.unpublish, {
            triggeredHttpMethod: 'GET',
            apiHost: API.applicationCreateHost,
          });
      },
    );

    await dialAdminTest.step(
      'Verify Unpublish modal with valid data is displayed',
      async () => {
        await publishingRequestModalAssertion.assertElementState(
          publishingRequestModal,
          'visible',
        );
        await publishingRequestModalAssertion.assertGeneralInfo({
          unpublishFromLabel: 'visible',
          unpublishFrom: PublishPath.Organization,
          authorLabel: 'hidden',
          allowAccessLabel: 'visible',
          availabilityLabel: 'visible',
        });
        await appToPublishAssertion.assertEntityToPublish(
          { name: appName },
          {
            expectedState: 'visible',
            expectedColor: expectedErrorColor,
            expectedCheckboxState: CheckboxState.checked,
            expectedVersion: appVersion,
            expectedVersionColor: expectedErrorColor,
            expectedIcon: expectedIconUrl,
          },
        );
      },
    );

    await dialAdminTest.step(
      'Set publication request name and send',
      async () => {
        await publishingRequestModal.requestName.fillInInput(requestName);
        publishApiModels =
          await publishingRequestModal.sendPublicationRequest();
        await publishingRequestModalAssertion.assertElementState(
          publishingRequestModal,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Create one more unpublishing request via API',
      async () => {
        const unpublishRequestModel = publishRequestBuilder
          .withName(secondRequestName)
          .withApplicationResource(app, PublishActions.DELETE)
          .withFileResource(iconTargetUrl, PublishActions.DELETE)
          .build();
        await publicationApiHelper.createUnpublishRequest(
          unpublishRequestModel,
        );
      },
    );

    await dialAdminTest.step(
      'Login as admin and verify app unpublishing request is displayed under "Approve required" section on both side panels',
      async () => {
        await adminLocalStorageManager.setShowSideBarPanels();
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        //TODO: enable when rollback the temp solution https://github.com/epam/ai-dial-chat/pull/2649. An unpublish request is displayed on both panels only when it contains app and file resources
        // await adminApproveRequiredConversationsAssertion.assertFolderState(
        //   { name: requestName },
        //   'visible',
        // );
        await adminApproveRequiredPromptsAssertion.assertFolderState(
          { name: requestName },
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Click on publication request and verify both requests are selected, "Publication approval" modal is displayed',
      async () => {
        await adminApproveRequiredPrompts.selectRequest(requestName);
        //TODO: enable when rollback the temp solution https://github.com/epam/ai-dial-chat/pull/2649
        // await adminApproveRequiredConversationsAssertion.assertFolderBackgroundColor(
        //   { name: requestName },
        //   ThemesUtil.getRgbColorByKey(
        //     ThemeColorAttributes.bgAccentSecondaryAlpha,
        //   ),
        // );
        // await adminApproveRequiredConversationsAssertion.assertFolderNameColor(
        //   { name: requestName },
        //   ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textSuccess),
        // );
        await adminApproveRequiredPromptsAssertion.assertFolderBackgroundColor(
          { name: requestName },
          ThemesUtil.getRgbColorByKey(
            ThemeColorAttributes.bgAccentTertiaryAlpha,
          ),
        );
        await adminApproveRequiredPromptsAssertion.assertFolderNameColor(
          { name: requestName },
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textAccentTertiary),
        );
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal,
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Verify data on "Publication approval" modal',
      async () => {
        await adminPublishingApprovalModalAssertion.assertGeneralInfo({
          requestName: requestName,
          publishToLabel: 'visible',
          publishTo: PublishPath.Organization,
          authorLabel: 'visible',
          author: defaultAuthor,
          publicAuthorLabel: 'hidden',
          requestCreatedLabel: 'visible',
          requestCreated: publishApiModels.response,
          allowAccessLabel: 'visible',
          noChangesLabel: 'visible',
          availabilityLabel: 'visible',
        });
        await adminAppToApproveAssertion.assertEntityToPublish(
          { name: appName },
          {
            expectedState: 'visible',
            expectedColor: expectedErrorColor,
            expectedVersion: appVersion,
            expectedVersionColor: expectedErrorColor,
            expectedCheckboxState: CheckboxState.checked,
            //TODO: enable when fixed https://github.com/epam/ai-dial-chat/issues/2699
            // expectedIcon: expectedIconUrl
          },
        );
        //TODO: enable when rollback the temp solution https://github.com/epam/ai-dial-chat/pull/2649
        // await adminFilesToApproveAssertion.assertFileToPublish(
        //   { name: customApp.name },
        //   {
        //     expectedState: 'visible',
        //     expectedCheckboxState: CheckboxState.checked,
        //     expectedDownloadUrl: customApp.iconUrl,
        //   },
        // );
        await adminPublishingApprovalModalAssertion.assertButtonsState({
          reviewButtonState: 'visible',
          reviewButtonTitle: ExpectedConstants.goToReviewButtonTitle,
          approveButtonState: 'disabled',
          rejectButtonState: 'enabled',
        });
      },
    );

    await dialAdminTest.step(
      'Click on "Go to a review" button and verify app details are displayed',
      async () => {
        await adminPublishingApprovalModal.goToEntityReview();
        await adminPublishedAppReviewModalAssertion.assertElementState(
          adminPublishedApplicationReviewModal,
          'visible',
        );
        await adminPublishedAppReviewModalAssertion.assertAppAttributes({
          expectedName: appName,
          expectedVersion: appVersion,
          expectedIcon: expectedIconUrl,
          expectedDescription: appDescription,
          expectedTopics: [firstTopic, secondTopic],
          expectedFeatures: features,
          expectedAttachmentTypes: [attachmentType],
          expectedMaxAttachmentNumbers: maxAttachments,
          expectedCompletionUrl: ExpectedConstants.appDefaultCompletionUrl,
        });
        await adminPublishedAppReviewModalControlsAssertion.assertButtonsState({
          backToPublicationRequestButtonState: 'enabled',
          nextButtonState: 'disabled',
          previousButtonState: 'disabled',
        });
      },
    );

    await dialAdminTest.step(
      'Click on "Back to publication request" and approve',
      async () => {
        await adminPublishedApplicationReviewModal
          .getPublicationReviewControl()
          .backToPublicationRequest();
        await adminPublishingApprovalModalAssertion.assertButtonsState({
          reviewButtonState: 'visible',
          reviewButtonTitle: ExpectedConstants.continueReviewButtonTitle,
          approveButtonState: 'enabled',
        });
        await adminPublishingApprovalModal.approveRequest();
        //TODO: enable when rollback the temp solution https://github.com/epam/ai-dial-chat/pull/2649
        // await adminApproveRequiredConversationsAssertion.assertFolderState(
        //   { name: requestName },
        //   'hidden',
        // );
        await adminApproveRequiredPromptsAssertion.assertFolderState(
          { name: requestName },
          'hidden',
        );
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal,
          'hidden',
        );
      },
    );

    await dialAdminTest.step(
      'By the main user open the Marketplace page and verify published app is not available',
      async () => {
        await marketplacePage.openMarketplacePage({
          updateInstalledDeployments: false,
          getInstalledDeployments: true,
        });
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.searchInput.fillInInput(appName);
        appElement = await marketplaceAgentsSection.findAgentElement(appName, {
          isWorkspaceAgent: true,
          isEditable: true,
        });
        await marketplaceAgentsAssertion.assertElementState(
          appElement,
          'visible',
        );

        const actualAgents = await marketplaceAgentsSection.getAllAgents();
        marketplaceAgentsAssertion.assertValue(
          actualAgents.length,
          1,
          ExpectedMessages.elementsCountIsValid,
        );
      },
    );

    await dialAdminTest.step(
      'By admin select the second request and verify error message is disabled instead of Review btn',
      async () => {
        await adminApproveRequiredPrompts.selectRequest(secondRequestName);
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal,
          'visible',
        );
        await adminPublishingApprovalModalAssertion.assertButtonsState({
          approveButtonState: 'disabled',
        });
        await adminPublishingApprovalModalAssertion.assertElementText(
          adminPublishingApprovalModal.duplicatedUnpublishingError,
          ExpectedConstants.duplicatedUnpublishingError(appName),
        );
      },
    );
  },
);
