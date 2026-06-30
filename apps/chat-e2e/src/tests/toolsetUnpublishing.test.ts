import {
  Publication,
  PublicationRequestModel,
  PublicationResource,
} from '@/chat/types/publication';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import {
  API,
  Attachment,
  CheckboxState,
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  PublishPath,
} from '@/src/testData';
import { OAuthMockHelper } from '@/src/testData/toolsets/oauthMockHelper';
import { ThemeColorAttributes } from '@/src/ui/domData';
import { BaseElement } from '@/src/ui/webElements';
import { GeneratorUtil, UserUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';
import {
  PublishActions,
  Toolset,
  ToolsetAuthTypes,
  ToolsetTransportType,
} from '@epam/ai-dial-shared';

dialAdminTest(
  'Unpublish toolset with global credentials.\n' +
    'Unpublish toolset from context menu on tile view.\n' +
    `'Publication request created successfully' green toast message appears when user sends request on Unpublish toolset.\n` +
    `[Toolset][Publish]: Error toast "Toolset by this link not found" appeared when user had public toolset's card open in search results and refresh page after toolset was unpublished`,
  async (
    {
      toolsetBuilder,
      toolsetApiHelper,
      publicationApiHelper,
      adminPublicationApiHelper,
      adminUserItemApiHelper,
      publishRequestBuilder,
      marketplacePage,
      marketplaceHeader,
      marketplaceEntitiesSection,
      marketplaceEntities,
      publishingRequestDialog,
      publishingRequestDialogAssertion,
      publishingRulesAssertion,
      toolsetToPublishAssertion,
      adminLocalStorageManager,
      adminDialHomePage,
      adminApproveRequiredPrompts,
      adminToolsetToApproveAssertion,
      adminPublishingApprovalModalAssertion,
      adminPublishingRulesAssertion,
      adminPublishingApprovalModal,
      adminPublishedToolsetReviewModalAssertion,
      adminPublishedToolsetReviewModalControlsAssertion,
      adminPublishedToolsetReviewModal,
      adminApproveRequiredPromptsAssertion,
      toastAssertion,
      toast,
      baseAssertion,
      setTestIds,
      page,
      adminPage,
    },
    testInfo,
  ) => {
    setTestIds('EPMRTC-7187', 'EPMRTC-7044', 'EPMRTC-7167', 'EPMRTC-7142');

    const toolsetEntity = {
      name: GeneratorUtil.randomToolsetName(),
      version: GeneratorUtil.randomEntityVersion(),
      endpoint: GeneratorUtil.randomUrl(),
    };
    const unpublishRequestName = GeneratorUtil.randomUnpublishRequestName();
    const expectedErrorColor = ThemesUtil.getRgbColorByKey(
      ThemeColorAttributes.textError,
    );
    const defaultAuthor = UserUtil.getE2EUsername(testInfo.parallelIndex);

    let initialToolset: Toolset;
    let publishedToolset: Toolset;
    let oauthMockHelper: OAuthMockHelper;
    let toolsetElement: BaseElement;
    let publishApiModels: {
      request: PublicationRequestModel;
      response: Publication;
    };
    let toolsetResource: PublicationResource;
    let adminOAuthMockHelper: OAuthMockHelper;

    await dialAdminTest.step(
      'Precondition: Create toolset via API',
      async () => {
        const toolsetModel = toolsetBuilder
          .withDisplayName(toolsetEntity.name)
          .withDisplayVersion(toolsetEntity.version)
          .withEndpoint(toolsetEntity.endpoint)
          .build();
        await toolsetApiHelper.createToolset(toolsetModel);
        initialToolset = (await toolsetApiHelper.getToolset(
          toolsetEntity.name,
          toolsetEntity.version,
        ))!;
      },
    );

    await dialAdminTest.step(
      'Precondition: Publish toolset via API and approve publication',
      async () => {
        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withToolsetResource(initialToolset, PublishActions.ADD)
          .build();
        const publication: Publication =
          await publicationApiHelper.createPublishRequest(publishRequest);
        await adminPublicationApiHelper.approveRequest(publication);

        toolsetResource = publication.resources.find(
          (r) => r.sourceUrl === initialToolset.id,
        )!;
        publishedToolset = await adminUserItemApiHelper.getItem<Toolset>(
          toolsetResource.targetUrl,
        );
      },
    );

    await dialAdminTest.step(
      'Precondition: Setup OAuth mocks with global credentials for the user',
      async () => {
        oauthMockHelper = new OAuthMockHelper(
          page,
          publishedToolset,
          toolsetEntity.endpoint,
        );
        oauthMockHelper.setIsSignedInGlobal(true);
        await oauthMockHelper.setupMocks();
        oauthMockHelper.enableMocking();
      },
    );

    await dialAdminTest.step(
      'Open marketplace, navigate to toolsets and find published toolset',
      async () => {
        await marketplacePage.openMarketplacePage({
          updateInstalledDeployments: false,
          getInstalledDeployments: true,
          updateInstalledToolsets: false,
          getInstalledToolsets: false,
          getStyles: true,
        });
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.toolsetsTab.click();
        await marketplaceHeader
          .getSearch()
          .inputField.fillInInput(toolsetEntity.name);
        toolsetElement = await marketplaceEntitiesSection.findEntityElement(
          toolsetEntity.name,
          { isWorkspaceEntity: false, isEditable: false },
        );
        await baseAssertion.assertElementState(toolsetElement, 'visible');
      },
    );

    await dialAdminTest.step(
      'Select Unpublish option from toolset card context menu and verify request form has no credentials section',
      async () => {
        await toolsetElement.hoverOver();
        await marketplaceEntities
          .getEntityElementDotsMenu(toolsetElement)
          .click();
        await marketplaceEntities
          .getEntityDropdownMenu()
          .selectMenuOption(MenuOptions.unpublish);
        await publishingRequestDialogAssertion.assertElementState(
          publishingRequestDialog,
          'visible',
        );
        await publishingRequestDialogAssertion.assertGeneralInfo({
          unpublishFromLabel: 'visible',
          unpublishFrom: PublishPath.Organization,
          authorLabel: 'hidden',
        });
        await publishingRulesAssertion.assertLabels({
          allowAccessLabel: 'visible',
          availabilityLabel: 'visible',
        });
        await toolsetToPublishAssertion.assertEntityToPublish(
          { name: toolsetEntity.name },
          {
            expectedState: 'visible',
            expectedColor: expectedErrorColor,
            expectedCheckboxState: CheckboxState.checked,
            expectedVersion: toolsetEntity.version,
            expectedVersionColor: expectedErrorColor,
          },
        );
        await toolsetToPublishAssertion.assertToolsetCredentials({
          expectedState: 'hidden',
        });
      },
    );

    await dialAdminTest.step(
      'Fill unpublish request name and send the request',
      async () => {
        await publishingRequestDialog.requestName.fillInInput(
          unpublishRequestName,
        );
        publishApiModels =
          await publishingRequestDialog.sendPublicationRequest();
        await toastAssertion.assertToastMessage(
          ExpectedConstants.successfulPublishingMessage,
        );
        await toast.closeToast();
        await publishingRequestDialogAssertion.assertElementState(
          publishingRequestDialog,
          'hidden',
        );
      },
    );

    await dialAdminTest.step('Open the toolset card', async () => {
      await toolsetElement.click();
      oauthMockHelper.disableMocking();
    });

    await dialAdminTest.step('Setup admin user OAuth mocks', async () => {
      const publishedToolset = await adminUserItemApiHelper.getItem<Toolset>(
        toolsetResource.targetUrl!,
      );
      adminOAuthMockHelper = new OAuthMockHelper(
        adminPage,
        publishedToolset,
        toolsetEntity.endpoint,
      );
      await adminOAuthMockHelper.setupMocks();
      adminOAuthMockHelper.enableMocking();
    });

    await dialAdminTest.step(
      'Admin opens the unpublish request and verifies no credentials section is displayed',
      async () => {
        await adminLocalStorageManager.setShowSideBarPanels();
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredPrompts.selectRequest(unpublishRequestName);
        await adminPublishingApprovalModalAssertion.assertGeneralInfo({
          requestName: unpublishRequestName,
          unpublishFromLabel: 'visible',
          publishPath: PublishPath.Organization,
          authorLabel: 'visible',
          author: defaultAuthor,
          requestCreatedLabel: 'visible',
          requestCreated: publishApiModels.response,
        });
        await adminPublishingRulesAssertion.assertLabels({
          allowAccessLabel: 'visible',
          noChangesLabel: 'visible',
          availabilityLabel: 'visible',
        });
        await adminToolsetToApproveAssertion.assertEntityToPublish(
          { name: toolsetEntity.name },
          {
            expectedState: 'visible',
            expectedVersion: toolsetEntity.version,
            expectedCheckboxState: CheckboxState.checked,
            expectedColor: expectedErrorColor,
            expectedVersionColor: expectedErrorColor,
          },
        );
        await adminToolsetToApproveAssertion.assertToolsetCredentials({
          expectedState: 'hidden',
        });
        await adminPublishingApprovalModalAssertion.assertButtonsState({
          reviewButtonState: 'visible',
          reviewButtonTitle: ExpectedConstants.goToReviewButtonTitle,
          approveButtonState: 'disabled',
          rejectButtonState: 'enabled',
        });
      },
    );

    await dialAdminTest.step(
      'Click on "Go to a review" button and verify toolset details are displayed',
      async () => {
        await adminPublishingApprovalModal.goToEntityReview();
        await adminPublishedToolsetReviewModalAssertion.assertToolsetAttributes(
          {
            expectedName: toolsetEntity.name,
            expectedVersion: toolsetEntity.version,
            expectedEndpoint: toolsetEntity.endpoint,
            expectedTransportProtocol: ToolsetTransportType.HTTP,
            expectedAuthenticationType: ToolsetAuthTypes.OAUTH,
          },
        );
        await adminPublishedToolsetReviewModalControlsAssertion.assertButtonsState(
          {
            backToPublicationRequestButtonState: 'enabled',
            nextButtonState: 'disabled',
            previousButtonState: 'disabled',
          },
        );
      },
    );

    await dialAdminTest.step(
      'Click on "Back to publication request" and approve unpublishing',
      async () => {
        await adminPublishedToolsetReviewModal
          .getPublicationReviewControl()
          .backToPublicationRequest();
        await adminPublishingApprovalModalAssertion.assertButtonsState({
          reviewButtonState: 'visible',
          reviewButtonTitle: ExpectedConstants.continueReviewButtonTitle,
          approveButtonState: 'enabled',
        });
        adminOAuthMockHelper.disableMocking();
        await adminPublishingApprovalModal.approveRequest();
        await adminApproveRequiredPromptsAssertion.assertFolderState(
          { name: unpublishRequestName },
          'hidden',
        );
      },
    );

    await dialAdminTest.step(
      'Refresh Marketplace page and verify unpublished toolset is not available in the list',
      async () => {
        await marketplacePage.reloadPage();
        await marketplacePage.waitForPageLoaded();
        await toastAssertion.assertToastMessage(
          ExpectedConstants.toolsetNotFoundToast,
        );
        const actualToolsets =
          await marketplaceEntitiesSection.getAllEntities();
        baseAssertion.assertValue(
          actualToolsets.length,
          1,
          ExpectedMessages.elementsCountIsValid,
        );
      },
    );
  },
);

dialSharedWithMeTest(
  'Unpublish toolset by not creator and not admin user.\n' +
    'Unpublish toolset which was published with own icon file',
  async ({
    toolsetBuilder,
    setTestIds,
    additionalShareUserToolsetToPublishAssertion,
    publishRequestBuilder,
    publicationApiHelper,
    adminPublicationApiHelper,
    additionalShareUserMarketplacePage,
    additionalShareUserEntityDetailsModal,
    additionalShareUserEntityDetailsModalAssertion,
    additionalShareUserPublishingRequestDialog,
    additionalShareUserPublishingRequestDialogAssertion,
    additionalShareUserToastAssertion,
    toolsetApiHelper,
    fileApiHelper,
    adminUserItemApiHelper,
    baseAssertion,
  }) => {
    setTestIds('EPMRTC-7037', 'EPMRTC-7872');
    const toolsetEntity = {
      name: GeneratorUtil.randomToolsetName(),
      version: GeneratorUtil.randomEntityVersion(),
      endpoint: GeneratorUtil.randomUrl(),
    };
    let initialToolset: Toolset;
    let publishedToolset: Toolset;
    const filename = GeneratorUtil.randomFilename('svg');
    const iconUrl = await fileApiHelper.putFileWithCustomName(
      filename,
      Attachment.appIconSvg,
    );
    let expectedPublishedIconUrl: string;
    let toolsetResource: PublicationResource;

    await dialSharedWithMeTest.step(
      'Precondition: Create toolset with a custom icon via API',
      async () => {
        const toolsetModel = toolsetBuilder
          .withDisplayName(toolsetEntity.name)
          .withDisplayVersion(toolsetEntity.version)
          .withEndpoint(toolsetEntity.endpoint)
          .withIconUrl(iconUrl)
          .build();
        await toolsetApiHelper.createToolset(toolsetModel);
        initialToolset = (await toolsetApiHelper.getToolset(
          toolsetEntity.name,
          toolsetEntity.version,
        ))!;
      },
    );

    await dialSharedWithMeTest.step(
      'Precondition: Publish toolset via API and approve publication',
      async () => {
        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withToolsetResource(initialToolset, PublishActions.ADD)
          .withFileResource(iconUrl, PublishActions.ADD)
          .build();
        const publication =
          await publicationApiHelper.createPublishRequest(publishRequest);
        await adminPublicationApiHelper.approveRequest(publication);

        toolsetResource = publication.resources.find(
          (r) => r.sourceUrl === initialToolset.id,
        )!;
        publishedToolset = await adminUserItemApiHelper.getItem<Toolset>(
          toolsetResource.targetUrl,
        );

        const fileResource = publication.resources.find((r) =>
          r.reviewUrl.endsWith(filename),
        );
        const iconTargetUrl = fileResource?.targetUrl;
        expectedPublishedIconUrl = iconTargetUrl
          ? `${API.api}/${iconTargetUrl}`
          : '';
      },
    );

    await dialSharedWithMeTest.step(
      'Open the toolset card by the second user and verify the icon is displayed',
      async () => {
        await additionalShareUserMarketplacePage.openToolsetCardPage(
          publishedToolset.reference!,
        );
        await additionalShareUserMarketplacePage.waitForPageLoaded();
        await additionalShareUserEntityDetailsModalAssertion.assertElementState(
          additionalShareUserEntityDetailsModal,
          'visible',
        );
        await additionalShareUserEntityDetailsModalAssertion.assertEntityCommonAttributes(
          { expectedIcon: expectedPublishedIconUrl },
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Crete an unpublish request and verify no error message is displayed in the files section',
      async () => {
        await additionalShareUserEntityDetailsModal.unpublishButton.click();
        await additionalShareUserPublishingRequestDialogAssertion.assertElementState(
          additionalShareUserPublishingRequestDialog,
          'visible',
        );
        await additionalShareUserPublishingRequestDialogAssertion.assertGeneralInfo(
          {
            unpublishFromLabel: 'visible',
            unpublishFrom: PublishPath.Organization,
            authorLabel: 'hidden',
          },
        );
        await additionalShareUserToolsetToPublishAssertion.assertEntityToPublish(
          { name: toolsetEntity.name },
          {
            expectedState: 'visible',
            expectedIcon: expectedPublishedIconUrl,
            expectedCheckboxState: CheckboxState.checked,
            expectedVersion: toolsetEntity.version,
          },
        );
        await additionalShareUserToolsetToPublishAssertion.assertToolsetCredentials(
          {
            expectedState: 'hidden',
          },
        );
        await additionalShareUserPublishingRequestDialogAssertion.assertElementState(
          additionalShareUserPublishingRequestDialog.getFilesToPublishTree()
            .errorMessageContainer,
          'hidden',
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Send the unpublish request and verify it is available for the admin user',
      async () => {
        const unpublishRequest = GeneratorUtil.randomUnpublishRequestName();
        await additionalShareUserPublishingRequestDialog.requestName.fillInInput(
          unpublishRequest,
        );
        await additionalShareUserPublishingRequestDialog.sendPublicationRequest();
        await additionalShareUserToastAssertion.assertToastMessage(
          ExpectedConstants.successfulPublishingMessage,
        );

        const publicationRequests =
          await adminPublicationApiHelper.listPublicationRequests();
        const toolsetUnpublishRequest = publicationRequests.publications.find(
          (p) => p.name === unpublishRequest,
        );
        baseAssertion.assertValueIsNotUndefined(toolsetUnpublishRequest);
      },
    );
  },
);
