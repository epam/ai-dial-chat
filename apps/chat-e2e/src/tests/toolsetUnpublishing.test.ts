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
import {
  BaseElement,
  PublishVersionChecklistDropdown,
} from '@/src/ui/webElements';
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
    setTestIds('EPMDIAL-5496', 'EPMDIAL-5493', 'EPMDIAL-5495', 'EPMDIAL-5498');

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
      publishedToolset = await adminUserItemApiHelper.getItem<Toolset>(
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
        const editableToolset =
          await marketplaceEntitiesSection.findEntityElement(
            toolsetEntity.name,
            { isWorkspaceEntity: true, isEditable: true },
          );
        await baseAssertion.assertElementState(editableToolset, 'visible');
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
    setTestIds('EPMDIAL-5492', 'EPMDIAL-5502');
    const toolsetEntity = {
      name: GeneratorUtil.randomToolsetName(),
      version: GeneratorUtil.randomEntityVersion(),
      endpoint: GeneratorUtil.randomUrl(),
    };
    let filename: string;
    let iconUrl: string;
    let initialToolset: Toolset;
    let publishedToolset: Toolset;
    let expectedPublishedIconUrl: string;
    let toolsetResource: PublicationResource;

    await dialSharedWithMeTest.step(
      'Precondition: Upload an svg icon via API',
      async () => {
        filename = GeneratorUtil.randomFilename('svg');
        iconUrl = await fileApiHelper.putFileWithCustomName(
          filename,
          Attachment.appIconSvg,
        );
      },
    );

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

dialAdminTest(
  '[Unpublish]: Select one version for unpublish (2 versions of 2)',
  async ({
    toolsetBuilder,
    toolsetApiHelper,
    publishRequestBuilder,
    publicationApiHelper,
    adminPublicationApiHelper,
    marketplacePage,
    marketplaceHeader,
    marketplaceEntitiesSection,
    entityDetailsModal,
    entityDetailsModalAssertion,
    publishingRequestDialog,
    toolsetsToPublishTree,
    publishingRequestDialogAssertion,
    toolsetToPublishAssertion,
    adminLocalStorageManager,
    adminDialHomePage,
    adminApproveRequiredPrompts,
    adminToolsetsToApprove,
    adminToolsetToApproveAssertion,
    toastAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-5504');
    const toolsetEntity = {
      name: GeneratorUtil.randomToolsetName(),
      endpoint: GeneratorUtil.randomUrl(),
      firstVersion: '0.0.1',
      secondVersion: '0.0.2',
    };
    const unpublishRequestName = GeneratorUtil.randomUnpublishRequestName();
    let versionChecklistDropdown: PublishVersionChecklistDropdown;

    await dialAdminTest.step(
      'Precondition: Create and publish versions 0.0.1 and 0.0.2 of the toolset via API',
      async () => {
        for (const version of [
          toolsetEntity.firstVersion,
          toolsetEntity.secondVersion,
        ]) {
          const toolsetModel = toolsetBuilder
            .withDisplayName(toolsetEntity.name)
            .withDisplayVersion(version)
            .withEndpoint(toolsetEntity.endpoint)
            .build();
          await toolsetApiHelper.createToolset(toolsetModel);
          const toolset = (await toolsetApiHelper.getToolset(
            toolsetEntity.name,
            version,
          ))!;
          const publishRequest = publishRequestBuilder
            .withName(GeneratorUtil.randomPublicationRequestName())
            .withToolsetResource(toolset, PublishActions.ADD)
            .build();
          const publication: Publication =
            await publicationApiHelper.createPublishRequest(publishRequest);
          await adminPublicationApiHelper.approveRequest(publication);
        }
      },
    );

    await dialAdminTest.step(
      'Open Marketplace, find the public toolset and click on its card',
      async () => {
        await marketplacePage.openMarketplacePage({
          updateInstalledDeployments: false,
          updateInstalledToolsets: false,
          getInstalledToolsets: false,
          getStyles: true,
        });
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.toolsetsTab.click();
        await marketplaceHeader
          .getSearch()
          .inputField.fillInInput(toolsetEntity.name);
        const toolsetElement =
          await marketplaceEntitiesSection.findEntityElement(
            toolsetEntity.name,
            { isWorkspaceEntity: false, isEditable: false },
          );
        await toolsetElement.click();
        await entityDetailsModalAssertion.assertElementState(
          entityDetailsModal,
          'visible',
        );
        await entityDetailsModalAssertion.assertEntityVersion(
          toolsetEntity.secondVersion,
        );
      },
    );

    await dialAdminTest.step(
      'Select version 0.0.1 from the dropdown and verify it is displayed on the card',
      async () => {
        await entityDetailsModal.versionMenuTrigger.click();
        await entityDetailsModal
          .getVersionDropdownMenu()
          .selectMenuOption(toolsetEntity.firstVersion);
        await entityDetailsModalAssertion.assertEntityVersion(
          toolsetEntity.firstVersion,
        );
      },
    );

    await dialAdminTest.step(
      'Click Unpublish button and verify version 0.0.1 is displayed near the toolset name in the unpublish modal',
      async () => {
        await entityDetailsModal.unpublishButton.click();
        await publishingRequestDialogAssertion.assertElementState(
          publishingRequestDialog,
          'visible',
        );
        await toolsetToPublishAssertion.assertEntityToPublish(
          { name: toolsetEntity.name },
          {
            expectedState: 'visible',
            expectedVersion: toolsetEntity.firstVersion,
          },
        );
      },
    );

    await dialAdminTest.step(
      'Expand the version dropdown and verify only version 0.0.1 checkbox is checked',
      async () => {
        await toolsetsToPublishTree
          .getEntityVersionElement(toolsetEntity.name)
          .click();
        versionChecklistDropdown =
          toolsetsToPublishTree.getVersionChecklistDropdown();
        await toolsetToPublishAssertion.assertElementState(
          versionChecklistDropdown,
          'visible',
        );
        await toolsetToPublishAssertion.assertCheckboxState(
          versionChecklistDropdown.getVersionCheckbox(
            toolsetEntity.firstVersion,
          ),
          CheckboxState.checked,
        );
        await toolsetToPublishAssertion.assertCheckboxState(
          versionChecklistDropdown.getVersionCheckbox(
            toolsetEntity.secondVersion,
          ),
          CheckboxState.unchecked,
        );
      },
    );

    await dialAdminTest.step(
      'Collapse the dropdown and verify version 0.0.1 is still displayed near the toolset name',
      async () => {
        await toolsetsToPublishTree
          .getEntityVersionElement(toolsetEntity.name)
          .click();
        await toolsetToPublishAssertion.assertElementState(
          versionChecklistDropdown,
          'hidden',
        );
        await toolsetToPublishAssertion.assertEntityToPublish(
          { name: toolsetEntity.name },
          {
            expectedState: 'visible',
            expectedVersion: toolsetEntity.firstVersion,
          },
        );
      },
    );

    await dialAdminTest.step(
      'Send the unpublish request and verify a confirmation toast is displayed',
      async () => {
        await publishingRequestDialog.requestName.fillInInput(
          unpublishRequestName,
        );
        await publishingRequestDialog.sendPublicationRequest();
        await toastAssertion.assertToastMessage(
          ExpectedConstants.successfulPublishingMessage,
        );
        await publishingRequestDialogAssertion.assertElementState(
          publishingRequestDialog,
          'hidden',
        );
      },
    );

    await dialAdminTest.step(
      'As admin, find the request and verify only version 0.0.1 is selected for unpublishing',
      async () => {
        await adminLocalStorageManager.setShowSideBarPanels();
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredPrompts.selectRequest(unpublishRequestName);
        await adminToolsetToApproveAssertion.assertEntityToPublish(
          { name: toolsetEntity.name },
          {
            expectedState: 'visible',
            expectedVersion: toolsetEntity.firstVersion,
          },
        );
        await adminToolsetToApproveAssertion.assertElementsCount(
          adminToolsetsToApprove.getEntities(),
          1,
        );
      },
    );
  },
);

dialAdminTest(
  '[Unpublish]: Select few versions for unpublish (3 versions of 4)',
  async ({
    toolsetBuilder,
    toolsetApiHelper,
    publishRequestBuilder,
    publicationApiHelper,
    adminPublicationApiHelper,
    marketplacePage,
    marketplaceHeader,
    marketplaceEntitiesSection,
    entityDetailsModal,
    entityDetailsModalAssertion,
    publishingRequestDialog,
    publishingRequestDialogAssertion,
    toolsetToPublishAssertion,
    adminLocalStorageManager,
    adminDialHomePage,
    adminApproveRequiredPrompts,
    adminApproveRequiredPromptsAssertion,
    adminToolsetsToApprove,
    adminToolsetToApproveAssertion,
    adminPublishingApprovalModal,
    adminPublishingApprovalModalAssertion,
    adminPublishedToolsetReviewModal,
    adminPublishedToolsetReviewModalAssertion,
    adminPublishedToolsetReviewModalControlsAssertion,
    toastAssertion,
    toolsetsToPublishTree,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-5505');
    const toolsetEntity = {
      name: GeneratorUtil.randomToolsetName(),
      endpoint: GeneratorUtil.randomUrl(),
      versions: ['0.0.1', '0.0.2', '0.0.3', '0.0.4'],
    };
    const versionsToUnpublish = ['0.0.1', '0.0.2', '0.0.4'];
    const remainingVersion = '0.0.3';
    const unpublishRequestName = GeneratorUtil.randomUnpublishRequestName();
    let versionChecklistDropdown: PublishVersionChecklistDropdown;

    await dialAdminTest.step(
      'Precondition: Create and publish 4 versions of the toolset via API',
      async () => {
        for (const version of toolsetEntity.versions) {
          const toolsetModel = toolsetBuilder
            .withDisplayName(toolsetEntity.name)
            .withDisplayVersion(version)
            .withEndpoint(toolsetEntity.endpoint)
            .build();
          await toolsetApiHelper.createToolset(toolsetModel);
          const initialToolset = (await toolsetApiHelper.getToolset(
            toolsetEntity.name,
            version,
          ))!;
          const publishRequest = publishRequestBuilder
            .withName(GeneratorUtil.randomPublicationRequestName())
            .withToolsetResource(initialToolset, PublishActions.ADD)
            .build();
          const publication: Publication =
            await publicationApiHelper.createPublishRequest(publishRequest);
          await adminPublicationApiHelper.approveRequest(publication);
        }
      },
    );

    await dialAdminTest.step(
      'Open Marketplace, find the public toolset and click on its card',
      async () => {
        await marketplacePage.openMarketplacePage({
          updateInstalledDeployments: false,
          updateInstalledToolsets: false,
          getInstalledToolsets: false,
          getStyles: true,
        });
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.toolsetsTab.click();
        await marketplaceHeader
          .getSearch()
          .inputField.fillInInput(toolsetEntity.name);
        const toolsetElement =
          await marketplaceEntitiesSection.findEntityElement(
            toolsetEntity.name,
            { isWorkspaceEntity: false, isEditable: false },
          );
        await toolsetElement.click();
        await entityDetailsModalAssertion.assertElementState(
          entityDetailsModal,
          'visible',
        );
        await entityDetailsModalAssertion.assertEntityVersion(
          toolsetEntity.versions[3],
        );
      },
    );

    await dialAdminTest.step(
      'Click Unpublish button and verify the latest version is displayed near the toolset name in the unpublish modal',
      async () => {
        await entityDetailsModal.unpublishButton.click();
        await publishingRequestDialogAssertion.assertElementState(
          publishingRequestDialog,
          'visible',
        );
        await toolsetToPublishAssertion.assertEntityToPublish(
          { name: toolsetEntity.name },
          {
            expectedState: 'visible',
            expectedVersion: toolsetEntity.versions[3],
          },
        );
      },
    );

    await dialAdminTest.step(
      'Expand the version dropdown and verify only the latest version checkbox is checked',
      async () => {
        await toolsetsToPublishTree
          .getEntityVersionElement(toolsetEntity.name)
          .click();
        versionChecklistDropdown =
          toolsetsToPublishTree.getVersionChecklistDropdown();
        await publishingRequestDialogAssertion.assertElementState(
          versionChecklistDropdown,
          'visible',
        );
        await publishingRequestDialogAssertion.assertCheckboxState(
          versionChecklistDropdown.getVersionCheckbox(
            toolsetEntity.versions[3],
          ),
          CheckboxState.checked,
        );
        for (const version of toolsetEntity.versions.slice(0, 3)) {
          await publishingRequestDialogAssertion.assertCheckboxState(
            versionChecklistDropdown.getVersionCheckbox(version),
            CheckboxState.unchecked,
          );
        }
      },
    );

    await dialAdminTest.step(
      'Select versions 0.0.1 and 0.0.2, collapse the dropdown and verify "Few" is displayed near the toolset name',
      async () => {
        await versionChecklistDropdown
          .getVersionCheckboxLabel(toolsetEntity.versions[0])
          .click();
        await versionChecklistDropdown
          .getVersionCheckboxLabel(toolsetEntity.versions[1])
          .click();
        await toolsetsToPublishTree
          .getEntityVersionElement(toolsetEntity.name)
          .click();
        await publishingRequestDialogAssertion.assertElementState(
          versionChecklistDropdown,
          'hidden',
        );
        await toolsetToPublishAssertion.assertEntityToPublish(
          { name: toolsetEntity.name },
          {
            expectedState: 'visible',
            expectedVersion: ExpectedConstants.fewVersionsLabel,
          },
        );
      },
    );

    await dialAdminTest.step(
      'Send the unpublish request and verify a confirmation toast is displayed',
      async () => {
        await publishingRequestDialog.requestName.fillInInput(
          unpublishRequestName,
        );
        await publishingRequestDialog.sendPublicationRequest();
        await toastAssertion.assertToastMessage(
          ExpectedConstants.successfulPublishingMessage,
        );
        await publishingRequestDialogAssertion.assertElementState(
          publishingRequestDialog,
          'hidden',
        );
      },
    );

    await dialAdminTest.step(
      'As admin, find the request and verify "Few" is displayed near the toolset name',
      async () => {
        await adminLocalStorageManager.setShowSideBarPanels();
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredPrompts.selectRequest(unpublishRequestName);
        await adminToolsetToApproveAssertion.assertEntityToPublish(
          { name: toolsetEntity.name },
          {
            expectedState: 'visible',
            expectedVersion: ExpectedConstants.fewVersionsLabel,
          },
        );
      },
    );

    await dialAdminTest.step(
      'Expand the version dropdown and verify versions 0.0.1, 0.0.2 and 0.0.4 are checked',
      async () => {
        await adminToolsetsToApprove
          .getEntityVersionElement(toolsetEntity.name)
          .click();
        const adminVersionChecklistDropdown =
          adminToolsetsToApprove.getVersionChecklistDropdown();
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminVersionChecklistDropdown,
          'visible',
        );
        for (const version of versionsToUnpublish) {
          await adminPublishingApprovalModalAssertion.assertCheckboxState(
            adminVersionChecklistDropdown.getVersionCheckbox(version),
            CheckboxState.checked,
          );
        }
        await adminPublishingApprovalModalAssertion.assertCheckboxState(
          adminVersionChecklistDropdown.getVersionCheckbox(remainingVersion),
          CheckboxState.unchecked,
        );
      },
    );

    await dialAdminTest.step(
      'Click "Go to a review", navigate through all selected versions using arrows and go back to the publication request',
      async () => {
        await adminPublishingApprovalModal.goToEntityReview();
        await adminPublishedToolsetReviewModalAssertion.assertElementState(
          adminPublishedToolsetReviewModal,
          'visible',
        );
        const reviewControl =
          adminPublishedToolsetReviewModal.getPublicationReviewControl();

        await adminPublishedToolsetReviewModalAssertion.assertToolsetAttributes(
          { expectedVersion: versionsToUnpublish[0] },
        );
        await adminPublishedToolsetReviewModalControlsAssertion.assertButtonsState(
          { previousButtonState: 'disabled', nextButtonState: 'enabled' },
        );

        await reviewControl.goNext();
        await adminPublishedToolsetReviewModalAssertion.assertToolsetAttributes(
          { expectedVersion: versionsToUnpublish[1] },
        );
        await adminPublishedToolsetReviewModalControlsAssertion.assertButtonsState(
          { previousButtonState: 'enabled', nextButtonState: 'enabled' },
        );

        await reviewControl.goNext();
        await adminPublishedToolsetReviewModalAssertion.assertToolsetAttributes(
          { expectedVersion: versionsToUnpublish[2] },
        );
        await adminPublishedToolsetReviewModalControlsAssertion.assertButtonsState(
          { previousButtonState: 'enabled', nextButtonState: 'disabled' },
        );

        await reviewControl.backToPublicationRequest();
      },
    );

    await dialAdminTest.step('Approve the request', async () => {
      await adminPublishingApprovalModalAssertion.assertButtonsState({
        approveButtonState: 'enabled',
      });
      await adminPublishingApprovalModal.approveRequest();
      await adminApproveRequiredPromptsAssertion.assertFolderState(
        { name: unpublishRequestName },
        'hidden',
      );
    });

    await dialAdminTest.step(
      'Refresh Marketplace page and verify the public toolset has only version 0.0.3 left',
      async () => {
        await marketplacePage.openMarketplacePage({
          updateInstalledDeployments: false,
          updateInstalledToolsets: false,
          getInstalledToolsets: false,
          getStyles: false,
        });
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.toolsetsTab.click();
        await marketplaceHeader
          .getSearch()
          .inputField.fillInInput(toolsetEntity.name);
        const toolsetElement =
          await marketplaceEntitiesSection.findEntityElement(
            toolsetEntity.name,
            { isWorkspaceEntity: false, isEditable: false },
          );
        await toolsetElement.click();
        await entityDetailsModalAssertion.assertElementState(
          entityDetailsModal,
          'visible',
        );
        await entityDetailsModalAssertion.assertEntityVersion(remainingVersion);
        await entityDetailsModalAssertion.assertElementState(
          entityDetailsModal.getVersionDropdownMenu(),
          'hidden',
        );
      },
    );
  },
);

dialAdminTest(
  '[Admin view][Unpublish]: remove version for toolset in unpublish request',
  async ({
    toolsetBuilder,
    toolsetApiHelper,
    publishRequestBuilder,
    publicationApiHelper,
    adminPublicationApiHelper,
    adminUserItemApiHelper,
    adminLocalStorageManager,
    adminDialHomePage,
    adminApproveRequiredPrompts,
    adminApproveRequiredPromptsAssertion,
    adminToolsetsToApprove,
    adminToolsetToApproveAssertion,
    adminPublishingApprovalModal,
    adminPublishingApprovalModalAssertion,
    adminPublishedToolsetReviewModal,
    adminPublishedToolsetReviewModalAssertion,
    adminPublishedToolsetReviewModalControlsAssertion,
    baseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-5525');
    const toolsetEntity = {
      name: GeneratorUtil.randomToolsetName(),
      endpoint: GeneratorUtil.randomUrl(),
      versions: ['0.0.1', '0.0.2', '0.0.3'],
    };
    const versionsToUnpublish = ['0.0.1', '0.0.3'];
    const versionsAfterUnpublish = ['0.0.1', '0.0.2'];
    const remainingVersionToUnpublish = '0.0.3';
    const versionToUncheck = '0.0.1';
    const unpublishRequestName = GeneratorUtil.randomUnpublishRequestName();
    let targetFolder: string;
    const toolsetResources: PublicationResource[] = [];
    const toolsetResourcesByVersion: Record<string, PublicationResource> = {};
    let versionChecklistDropdown: PublishVersionChecklistDropdown;

    await dialAdminTest.step(
      'Precondition: Create and publish 3 versions of the toolset via API',
      async () => {
        for (const version of toolsetEntity.versions) {
          const toolsetModel = toolsetBuilder
            .withDisplayName(toolsetEntity.name)
            .withDisplayVersion(version)
            .withEndpoint(toolsetEntity.endpoint)
            .build();
          await toolsetApiHelper.createToolset(toolsetModel);
          const initialToolset = (await toolsetApiHelper.getToolset(
            toolsetEntity.name,
            version,
          ))! as Toolset;
          const publishRequest = publishRequestBuilder
            .withName(GeneratorUtil.randomPublicationRequestName())
            .withToolsetResource(initialToolset, PublishActions.ADD)
            .build();
          const publication: Publication =
            await publicationApiHelper.createPublishRequest(publishRequest);
          await adminPublicationApiHelper.approveRequest(publication);
          targetFolder = publication.targetFolder;
          const toolsetResource = publication.resources.find(
            (r) => r.sourceUrl === initialToolset.id,
          )!;
          toolsetResourcesByVersion[version] = toolsetResource;
          if (versionsToUnpublish.includes(version)) {
            toolsetResources.push(toolsetResource);
          }
        }
      },
    );

    await dialAdminTest.step(
      'Precondition: Create an unpublish request for versions 0.0.1 and 0.0.3 via API',
      async () => {
        const unpublishRequestModel: PublicationRequestModel = {
          name: unpublishRequestName,
          targetFolder: targetFolder,
          resources: toolsetResources.map((r) => ({
            action: PublishActions.DELETE,
            sourceUrl: r.targetUrl,
            targetUrl: r.targetUrl,
          })),
        };
        await publicationApiHelper.createUnpublishRequest(
          unpublishRequestModel,
        );
      },
    );

    await dialAdminTest.step(
      'Admin opens the unpublish request in "Approve required" section',
      async () => {
        await adminLocalStorageManager.setShowSideBarPanels();
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredPrompts.selectRequest(unpublishRequestName);
        await adminToolsetToApproveAssertion.assertEntityToPublish(
          { name: toolsetEntity.name },
          {
            expectedState: 'visible',
            expectedVersion: ExpectedConstants.fewVersionsLabel,
          },
        );
      },
    );

    await dialAdminTest.step(
      'Click on the version dropdown near the toolset name and verify versions 0.0.1 and 0.0.3 are checked',
      async () => {
        await adminToolsetsToApprove
          .getEntityVersionElement(toolsetEntity.name)
          .click();
        versionChecklistDropdown =
          adminToolsetsToApprove.getVersionChecklistDropdown();
        await adminPublishingApprovalModalAssertion.assertElementState(
          versionChecklistDropdown,
          'visible',
        );
        for (const version of versionsToUnpublish) {
          await adminPublishingApprovalModalAssertion.assertCheckboxState(
            versionChecklistDropdown.getVersionCheckbox(version),
            CheckboxState.checked,
          );
        }
        await adminPublishingApprovalModalAssertion.assertCheckboxState(
          versionChecklistDropdown.getVersionCheckbox(
            toolsetEntity.versions[1],
          ),
          CheckboxState.unchecked,
        );
      },
    );

    await dialAdminTest.step(
      'Uncheck version 0.0.1, collapse the dropdown and verify version 0.0.3 is displayed',
      async () => {
        await versionChecklistDropdown
          .getVersionCheckboxLabel(versionToUncheck)
          .click();
        await adminToolsetsToApprove
          .getEntityVersionElement(toolsetEntity.name)
          .click();
        await adminPublishingApprovalModalAssertion.assertElementState(
          versionChecklistDropdown,
          'hidden',
        );
        await adminToolsetToApproveAssertion.assertEntityToPublish(
          { name: toolsetEntity.name },
          {
            expectedState: 'visible',
            expectedVersion: remainingVersionToUnpublish,
          },
        );
      },
    );

    await dialAdminTest.step(
      'Click "Go to a review" and verify version 0.0.3 is displayed',
      async () => {
        await adminPublishingApprovalModal.goToEntityReview();
        await adminPublishedToolsetReviewModalAssertion.assertElementState(
          adminPublishedToolsetReviewModal,
          'visible',
        );
        await adminPublishedToolsetReviewModalAssertion.assertToolsetAttributes(
          { expectedVersion: remainingVersionToUnpublish },
        );
      },
    );

    await dialAdminTest.step(
      'Try to switch to the next version and verify the arrow buttons are disabled',
      async () => {
        await adminPublishedToolsetReviewModalControlsAssertion.assertButtonsState(
          { nextButtonState: 'disabled', previousButtonState: 'disabled' },
        );
      },
    );

    await dialAdminTest.step(
      'Click "Back to publication request" and verify "Approve selected" button is enabled',
      async () => {
        await adminPublishedToolsetReviewModal
          .getPublicationReviewControl()
          .backToPublicationRequest();
        await adminPublishingApprovalModalAssertion.assertButtonsState({
          approveButtonState: 'enabled',
        });
      },
    );

    await dialAdminTest.step(
      'Click "Approve selected" button and verify the request was approved',
      async () => {
        await adminPublishingApprovalModal.approveRequest();
        await adminApproveRequiredPromptsAssertion.assertFolderState(
          { name: unpublishRequestName },
          'hidden',
        );
      },
    );

    await dialAdminTest.step(
      'Verify via API that the published toolset still has versions 0.0.1 and 0.0.2',
      async () => {
        for (const version of versionsAfterUnpublish) {
          const publishedToolset =
            await adminUserItemApiHelper.getItem<Toolset>(
              toolsetResourcesByVersion[version].targetUrl,
            );
          baseAssertion.assertValue(publishedToolset.display_version, version);
        }
      },
    );
  },
);
