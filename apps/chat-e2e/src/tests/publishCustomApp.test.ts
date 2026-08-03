import { ApiApplicationModelRegular } from '@/chat/types/applications';
import { DialAIEntityModel } from '@/chat/types/models';
import { Publication, PublicationRequestModel } from '@/chat/types/publication';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  Attachment,
  CheckboxState,
  ExpectedConstants,
  MenuOptions,
  PublishPath,
} from '@/src/testData';
import { ThemeColorAttributes } from '@/src/ui/domData';
import { BaseElement } from '@/src/ui/webElements';
import { GeneratorUtil, UserUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';

dialAdminTest(
  'Publish custom app from context menu from card list view.\n' +
    'Publish custom app: version of app is displayed.\n' +
    'Author field is editable on publication request.\n' +
    `[Admin view]:" Author's public name" is displayed on publish request.\n` +
    'Custom app: Admin review publish request for application.\n' +
    'Custom app: Admin review custom app details in publication request.\n' +
    'Icons from published apps displayed in Manage attachments for admin without page refresh.\n' +
    'Apps from approved requests displayed in DIAL Marketplace for admin without page refresh',
  async (
    {
      marketplacePage,
      adminMarketplacePage,
      marketplaceHeader,
      marketplaceEntitiesSection,
      marketplaceEntities,
      customApplicationBuilder,
      applicationApiHelper,
      adminNavigationPanel,
      adminFileManagerGridAssertion,
      adminFileManagerToolbar,
      adminMarketplaceHeader,
      adminMarketplaceEntitiesSection,
      baseAssertion,
      publishingRequestDialog,
      publishingRequestDialogAssertion,
      publishingRulesAssertion,
      appToPublishAssertion,
      fileApiHelper,
      adminDialHomePage,
      adminApproveRequiredConversations,
      adminPublishingApprovalModal,
      adminPublishedAppReviewModalControlsAssertion,
      adminPublishedApplicationReviewModal,
      adminPublishedAppReviewModalAssertion,
      adminApproveRequiredConversationsAssertion,
      adminApproveRequiredPromptsAssertion,
      adminPublishingApprovalModalAssertion,
      adminPublishingRulesAssertion,
      adminPublishFilesAssertion,
      adminAppToApproveAssertion,
      adminTooltip,
      adminTooltipAssertion,
      setTestIds,
      localStorageManager,
      adminLocalStorageManager,
      adminEntityDetailsModal,
      adminEntityDetailsModalAssertion,
    },
    testInfo,
  ) => {
    setTestIds(
      'EPMDIAL-4205',
      'EPMDIAL-4300',
      'EPMDIAL-4310',
      'EPMDIAL-4316',
      'EPMDIAL-4238',
      'EPMDIAL-4240',
      'EPMDIAL-4242',
      'EPMDIAL-4241',
    );
    const appName = GeneratorUtil.randomApplicationName();
    const appVersion = GeneratorUtil.randomEntityVersion();
    const appDescription = GeneratorUtil.randomString(10);
    const firstTopic = GeneratorUtil.randomString(5);
    const secondTopic = GeneratorUtil.randomString(5);
    const features = {
      rate_endpoint: ExpectedConstants.appRateEndpointDefaultFeature,
    };
    const attachmentType = 'image/png';
    const maxAttachments = 3;

    const requestName = GeneratorUtil.randomPublicationRequestName();
    let encodedFileUrl: string;
    let expectedIconUrl: string;
    let applicationModel: ApiApplicationModelRegular;
    let appEntity: DialAIEntityModel;
    let publishApiModels: {
      request: PublicationRequestModel;
      response: Publication;
    };
    let expectedIconReviewUrl: string;
    let expectedPublishedIconUrl: string;
    let appElement: BaseElement;
    const defaultAuthor = UserUtil.getE2EUsername(testInfo.parallelIndex);
    const updatedAuthor = GeneratorUtil.randomString(7);
    const filename = GeneratorUtil.randomFilename('svg');

    await dialTest.step(
      'Upload a svg file with custom name via API',
      async () => {
        const iconUrl = await fileApiHelper.putFileWithCustomName(
          filename,
          Attachment.appIconSvg,
        );
        encodedFileUrl =
          iconUrl.substring(0, iconUrl.lastIndexOf('/') + 1) +
          encodeURIComponent(filename);
        expectedIconUrl = `${API.api}/${encodedFileUrl}`;
      },
    );

    await dialTest.step('Create a custom app via API', async () => {
      applicationModel = customApplicationBuilder
        .withDisplayName(appName)
        .withDisplayVersion(appVersion)
        .withDescription(appDescription)
        .withDescriptionKeywords(firstTopic, secondTopic)
        .withFeaturesData(features)
        .withInputAttachmentTypes(attachmentType)
        .withMaxInputAttachments(maxAttachments)
        .withIconUrl(encodedFileUrl)
        .build();
      await applicationApiHelper.createApplication(applicationModel);
      appEntity = {
        name: appName,
        version: appVersion,
        iconUrl: encodedFileUrl,
        description: appDescription,
      } as DialAIEntityModel;
    });

    await dialTest.step(
      'Find created app, open dots dropdown menu and select "Publish" option',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await adminLocalStorageManager.setShowSideBarPanels();
        await marketplacePage.openMyWorkspacePage();
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.getSearch().inputField.fillInInput(appName);
        appElement =
          await marketplaceEntitiesSection.findEntityElement(appEntity);
        await appElement.hoverOver();
        await marketplaceEntities.getEntityElementDotsMenu(appElement).click();
        await marketplaceEntities
          .getEntityDropdownMenu()
          .selectMenuOption(MenuOptions.publish);
      },
    );

    await dialTest.step(
      'Verify Publish modal with valid data is displayed',
      async () => {
        await publishingRequestDialogAssertion.assertElementState(
          publishingRequestDialog,
          'visible',
        );
        await publishingRequestDialogAssertion.assertGeneralInfo({
          publishTo: PublishPath.Organization,
          author: defaultAuthor,
        });
        await publishingRulesAssertion.assertLabels({
          allowAccessLabel: 'visible',
          availabilityLabel: 'visible',
        });
        await appToPublishAssertion.assertEntityToPublish(
          { name: appName },
          {
            expectedState: 'visible',
            expectedCheckboxState: CheckboxState.checked,
            expectedVersion: appVersion,
            expectedIcon: expectedIconUrl,
          },
        );
      },
    );

    await dialTest.step(
      'Set publication request name, update Author and send the request',
      async () => {
        await publishingRequestDialog.requestName.fillInInput(requestName);
        await publishingRequestDialog.author.fillInInput(updatedAuthor);
        publishApiModels =
          await publishingRequestDialog.sendPublicationRequest();

        const fileResource = publishApiModels.response.resources.find((r) =>
          r.reviewUrl.endsWith(filename),
        );
        const iconReviewUrl = fileResource?.reviewUrl;
        expectedIconReviewUrl = iconReviewUrl
          ? `${API.api}/${iconReviewUrl}`
          : '';
        const iconTargetUrl = fileResource?.targetUrl;
        expectedPublishedIconUrl = iconTargetUrl
          ? `${API.api}/${iconTargetUrl}`
          : '';
      },
    );

    await dialAdminTest.step(
      'Login as admin and verify app publishing request is displayed under "Approve required" section on both side panels',
      async () => {
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredConversationsAssertion.assertFolderState(
          { name: requestName },
          'visible',
        );
        await adminApproveRequiredPromptsAssertion.assertFolderState(
          { name: requestName },
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Click on publication request and verify both requests are selected, "Publication approval" modal is displayed',
      async () => {
        await adminApproveRequiredConversations.selectRequest(requestName);
        await adminApproveRequiredConversationsAssertion.assertFolderBackgroundColor(
          { name: requestName },
          ThemesUtil.getRgbColorByKey(
            ThemeColorAttributes.bgAccentSecondaryAlpha,
          ),
        );
        await adminApproveRequiredConversationsAssertion.assertFolderNameColor(
          { name: requestName },
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textSuccess),
        );
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
          publishPath: PublishPath.Organization,
          authorLabel: 'visible',
          author: defaultAuthor,
          publicAuthorLabel: 'visible',
          publicAuthor: updatedAuthor,
          requestCreatedLabel: 'visible',
          requestCreated: publishApiModels.response,
        });
        await adminPublishingRulesAssertion.assertLabels({
          allowAccessLabel: 'visible',
          noChangesLabel: 'visible',
          availabilityLabel: 'visible',
        });
        await adminAppToApproveAssertion.assertEntityToPublish(
          { name: appName },
          {
            expectedState: 'visible',
            expectedVersion: appVersion,
            expectedCheckboxState: CheckboxState.checked,
            //TODO: enable when fixed https://github.com/epam/ai-dial-chat/issues/2699
            // expectedIcon: expectedIconUrl
          },
        );
        await adminPublishFilesAssertion.assertFileToPublish(
          { name: filename },
          {
            expectedState: 'visible',
            expectedCheckboxState: CheckboxState.checked,
            expectedDownloadUrl: expectedIconReviewUrl,
          },
        );
        await adminPublishingApprovalModalAssertion.assertButtonsState({
          reviewButtonState: 'visible',
          approveButtonState: 'disabled',
          rejectButtonState: 'enabled',
        });
      },
    );

    await dialAdminTest.step(
      'Hover over public author help icon and verify tooltip is displayed',
      async () => {
        await adminPublishingApprovalModal.publicAuthorHelpIcon.hoverOver();
        await adminTooltipAssertion.assertElementState(adminTooltip, 'visible');
        await adminTooltipAssertion.assertTooltipContent(
          ExpectedConstants.publicAuthorTooltip,
        );
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
          expectedIcon: expectedIconReviewUrl,
          expectedDescription: appDescription,
          expectedTopics: [firstTopic, secondTopic],
          expectedFeatures: features,
          expectedAttachmentTypes: [attachmentType],
          expectedMaxAttachmentNumbers: maxAttachments,
          expectedCompletionUrl: applicationModel.endpoint,
        });
        await adminPublishedAppReviewModalControlsAssertion.assertButtonsState({
          backToPublicationRequestButtonState: 'enabled',
          nextButtonState: 'disabled',
          previousButtonState: 'disabled',
        });
      },
    );

    await dialAdminTest.step(
      'Click on "Back to publication request", approve it and verify app icon appears under "Organization" section on File Manager page',
      async () => {
        await adminPublishedApplicationReviewModal
          .getPublicationReviewControl()
          .backToPublicationRequest();
        await adminPublishingApprovalModalAssertion.assertButtonsState({
          reviewButtonState: 'visible',
          reviewButtonTitle: ExpectedConstants.continueReviewButtonTitle,
          approveButtonState: 'enabled',
        });
        await adminPublishingApprovalModal.approveRequest({
          isModelsListRetrieved: true,
        });
        await adminApproveRequiredConversationsAssertion.assertFolderState(
          { name: requestName },
          'hidden',
        );
        await adminApproveRequiredPromptsAssertion.assertFolderState(
          { name: requestName },
          'hidden',
        );

        await adminNavigationPanel.goToFileManager();
        await adminFileManagerToolbar.organizationTab.click();
        await adminFileManagerGridAssertion.assertGridRowByNameState(
          filename,
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Go to the Marketplace page and verify published app is available in the list',
      async () => {
        await adminNavigationPanel.goToMarketplaceHome();
        await adminMarketplacePage.waitForPageLoaded();
        await adminMarketplaceHeader
          .getSearch()
          .inputField.fillInInput(appName);
        appElement =
          await adminMarketplaceEntitiesSection.findEntityElement(appEntity);
        await baseAssertion.assertElementState(appElement, 'visible');
      },
    );

    await dialAdminTest.step(
      'Click on the found card and verify the details',
      async () => {
        await appElement.click();
        await adminEntityDetailsModalAssertion.assertElementState(
          adminEntityDetailsModal,
          'visible',
        );
        await adminEntityDetailsModalAssertion.assertEntityName(appName);
        await adminEntityDetailsModalAssertion.assertDescription(
          appDescription,
        );
        await adminEntityDetailsModalAssertion.assertEntityVersion(appVersion);
        await adminEntityDetailsModalAssertion.assertEntityIcon(
          adminEntityDetailsModal.icon,
          expectedPublishedIconUrl,
        );
        await adminEntityDetailsModalAssertion.assertEntityAuthor(
          updatedAuthor,
        );
        await adminEntityDetailsModalAssertion.assertEntityReleaseDate(
          publishApiModels.response.createdAt,
        );
        await adminEntityDetailsModalAssertion.assertEntityTopics([
          firstTopic,
          secondTopic,
        ]);
      },
    );
  },
);
