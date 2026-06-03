import {
  Publication,
  PublicationRequestModel,
  PublicationResource,
} from '@/chat/types/publication';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import {
  API,
  Attachment,
  CheckboxState,
  Creds,
  EntityEditorToolsetTypes,
  ExpectedConstants,
  MenuOptions,
  OAuthMockHelper,
  OAuthOptions,
  PublishPath,
} from '@/src/testData';
import { Attributes, ThemeColorAttributes } from '@/src/ui/domData';
import { BaseElement } from '@/src/ui/webElements';
import { GeneratorUtil, UserUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';
import {
  Toolset,
  ToolsetAuthTypes,
  ToolsetTransportType,
} from '@epam/ai-dial-shared';

dialAdminTest(
  '[Toolsets] Create publish request toolset with OAuth With login (without creds).\n' +
    'Publish toolset from context menu from card list view (tile view).\n' +
    'Not logged in toolset can not be published with credentials.\n' +
    "'Publication request created successfully' green toast message appears when user sends request on Publish toolset.\n" +
    "[Admin view][Toolset]: Icon is displayed on toolset's review form for admin for toolset with custom icon file.\n" +
    'Review publication request for toolset with OAuth.\n' +
    'Review form for toolset from publication request.\n' +
    'Admin is able to view content of public toolset.\n' +
    '[Admin view]: Public toolset with OAuth with login (without creds) is logged out by default.\n' +
    'Without login option is not displayed for OAuth authentication type.\n' +
    '[Toolset][Admin view]: Exit button for public toolset when admin open Editor using View option',
  async (
    {
      marketplacePage,
      marketplaceHeader,
      marketplaceEntitiesSection,
      marketplaceEntities,
      toolsetBuilder,
      setTestIds,
      publishingRequestDialog,
      publishingRequestDialogAssertion,
      publishingRulesAssertion,
      toolsetToPublishAssertion,
      toast,
      toastAssertion,
      adminLocalStorageManager,
      adminDialHomePage,
      adminApproveRequiredConversationsAssertion,
      adminApproveRequiredPromptsAssertion,
      adminApproveRequiredConversations,
      adminPublishingApprovalModal,
      adminPublishingApprovalModalAssertion,
      adminPublishingRulesAssertion,
      adminToolsetToApproveAssertion,
      adminPublishFilesAssertion,
      adminPublishedToolsetReviewModalAssertion,
      adminPublishedToolsetReviewModalControlsAssertion,
      toolsetApiHelper,
      fileApiHelper,
      adminUserItemApiHelper,
      adminPublishedToolsetReviewModal,
      adminMarketplacePage,
      adminMarketplaceHeader,
      adminMarketplaceEntitiesSection,
      adminEntityDetailsModal,
      adminEntityEditorPage,
      adminToolsetEditorViewForm,
      adminEntityEditorHeader,
      adminToolsetEditorViewFormAssertion,
      adminTooltipPortalAssertion,
      adminEntityDetailsModalAssertion,
      adminEntityEditorGeneralFormAssertion,
      baseAssertion,
      page,
      adminPage,
    },
    testInfo,
  ) => {
    setTestIds(
      'EPMRTC-7020',
      'EPMRTC-7045',
      'EPMRTC-7159',
      'EPMRTC-7168',
      'EPMRTC-7035',
      'EPMRTC-7033',
      'EPMRTC-7023',
      'EPMRTC-7022',
      'EPMRTC-7144',
      'EPMRTC-7409',
      'EPMRTC-7860',
    );
    const toolsetEntity = {
      name: GeneratorUtil.randomToolsetName(),
      version: GeneratorUtil.randomEntityVersion(),
      endpoint: GeneratorUtil.randomUrl(),
      description: GeneratorUtil.randomString(7),
      topics: [GeneratorUtil.randomString(5)],
      allowedTools: ['read', 'write'],
    };
    let oauthMockHelper: OAuthMockHelper;
    let adminOAuthMockHelper: OAuthMockHelper;
    let initialToolset: Toolset;
    const defaultAuthor = UserUtil.getE2EUsername(testInfo.parallelIndex);
    const filename = GeneratorUtil.randomFilename('svg');
    const iconUrl = await fileApiHelper.putFileWithCustomName(
      filename,
      Attachment.appIconSvg,
    );
    const expectedIconUrl = `${API.api}/${iconUrl}`;
    let expectedIconReviewUrl: string;
    let expectedPublishedIconUrl: string;
    let toolsetResource: PublicationResource;
    const requestName = GeneratorUtil.randomPublicationRequestName();
    let publishApiModels: {
      request: PublicationRequestModel;
      response: Publication;
    };
    let toolsetElement: BaseElement;

    await dialAdminTest.step(
      'Precondition: Create toolset via API',
      async () => {
        const toolsetModel = toolsetBuilder
          .withDisplayName(toolsetEntity.name)
          .withDisplayVersion(toolsetEntity.version)
          .withEndpoint(toolsetEntity.endpoint)
          .withDescription(toolsetEntity.description)
          .withDescriptionKeywords(...toolsetEntity.topics)
          .withAllowedTools(...toolsetEntity.allowedTools)
          .withIconUrl(iconUrl)
          .build();
        await toolsetApiHelper.createToolset(toolsetModel);
        initialToolset = (await toolsetApiHelper.getToolset(
          toolsetEntity.name,
          toolsetEntity.version,
        ))!;
      },
    );

    await dialAdminTest.step('Setup main user OAuth mocks', async () => {
      oauthMockHelper = new OAuthMockHelper(
        page,
        initialToolset,
        toolsetEntity.endpoint,
      );
      await oauthMockHelper.setupToolsetRoutes();
      await oauthMockHelper.setupToolsetListingRoute();
      oauthMockHelper.enableMocking();
    });

    await dialAdminTest.step(
      `Find created toolset and select "Publish" option from card's dots menu`,
      async () => {
        await marketplacePage.openToolsetsPage();
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader
          .getSearch()
          .inputField.fillInInput(toolsetEntity.name);
        toolsetElement = await marketplaceEntitiesSection.findEntityElement(
          toolsetEntity.name,
        );
        await toolsetElement.hoverOver();
        await marketplaceEntities
          .getEntityElementDotsMenu(toolsetElement)
          .click();
        await marketplaceEntities
          .getEntityDropdownMenu()
          .selectMenuOption(MenuOptions.publish);
      },
    );

    await dialAdminTest.step(
      'Verify Publish request modal is opened for the toolset, Credentials checkbox is hidden',
      async () => {
        await publishingRequestDialogAssertion.assertElementState(
          publishingRequestDialog,
          'visible',
        );
        await publishingRequestDialogAssertion.assertGeneralInfo({
          publishToLabel: 'visible',
          publishTo: PublishPath.Organization,
          author: defaultAuthor,
        });
        await publishingRulesAssertion.assertLabels({
          allowAccessLabel: 'visible',
          availabilityLabel: 'visible',
        });
        await toolsetToPublishAssertion.assertEntityToPublish(
          { name: toolsetEntity.name },
          {
            expectedState: 'visible',
            expectedCheckboxState: CheckboxState.checked,
            expectedVersion: toolsetEntity.version,
            expectedIcon: expectedIconUrl,
          },
        );
        await toolsetToPublishAssertion.assertToolsetCredentials({
          expectedState: 'hidden',
        });
      },
    );

    await dialAdminTest.step(
      'Send the request and verify successful toast is shown',
      async () => {
        await publishingRequestDialog.requestName.fillInInput(requestName);
        publishApiModels =
          await publishingRequestDialog.sendPublicationRequest();
        await publishingRequestDialogAssertion.assertElementState(
          publishingRequestDialog,
          'hidden',
        );
        await toastAssertion.assertToastMessage(
          ExpectedConstants.successfulPublishingMessage,
        );
        await toast.closeToast();

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

    await dialAdminTest.step('Setup admin user OAuth mocks', async () => {
      toolsetResource = publishApiModels.response.resources.find(
        (r) => r.sourceUrl === initialToolset.id,
      )!;
      const reviewedToolset = await adminUserItemApiHelper.getItem<Toolset>(
        toolsetResource.reviewUrl,
      );
      adminOAuthMockHelper = new OAuthMockHelper(
        adminPage,
        reviewedToolset,
        toolsetEntity.endpoint,
      );
      await adminOAuthMockHelper.setupToolsetRoutes();
      await adminOAuthMockHelper.setupToolsetListingRoute();
      adminOAuthMockHelper.enableMocking();
    });

    await dialAdminTest.step(
      'Login as admin and verify app publishing request is displayed under "Approve required" section on both side panels',
      async () => {
        await adminLocalStorageManager.setShowSideBarPanels();
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
          publicAuthor: defaultAuthor,
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
          editButtonState: 'enabled',
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
            expectedIcon: expectedIconReviewUrl,
            expectedDescription: toolsetEntity.description,
            expectedTopics: toolsetEntity.topics,
            expectedEndpoint: toolsetEntity.endpoint,
            expectedTransportProtocol: ToolsetTransportType.HTTP,
            expectedAuthenticationType: ToolsetAuthTypes.OAUTH,
            //TODO: enable when fixed https://github.com/epam/ai-dial-chat/issues/5202
            // expectedAllowedTools: toolsetEntity.allowedTools,
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
      'Click on "Back to publication request" and approve it',
      async () => {
        await adminPublishedToolsetReviewModal
          .getPublicationReviewControl()
          .backToPublicationRequest();
        await adminPublishingApprovalModalAssertion.assertButtonsState({
          reviewButtonState: 'visible',
          reviewButtonTitle: ExpectedConstants.continueReviewButtonTitle,
          approveButtonState: 'enabled',
        });

        //need to temporarily disable mocking since the toolset listing is triggered when clicking the 'approve' btn
        adminOAuthMockHelper.disableMocking();

        await adminPublishingApprovalModal.approveRequest();
        await adminApproveRequiredConversationsAssertion.assertFolderState(
          { name: requestName },
          'hidden',
        );
        await adminApproveRequiredPromptsAssertion.assertFolderState(
          { name: requestName },
          'hidden',
        );

        //mock published toolset
        const publishedToolset = await adminUserItemApiHelper.getItem<Toolset>(
          toolsetResource.targetUrl,
        );
        adminOAuthMockHelper.enableMocking();
        await adminOAuthMockHelper.setupToolsetListingRoute(publishedToolset);
        await adminOAuthMockHelper.setupToolsetRoutes(publishedToolset);
      },
    );

    await dialAdminTest.step(
      'Go to the Marketplace page and verify published toolset is available in the list',
      async () => {
        await adminMarketplacePage.openMarketplacePage({
          updateInstalledDeployments: false,
          getInstalledDeployments: true,
          updateInstalledToolsets: false,
          getInstalledToolsets: true,
          getStyles: true,
        });
        await adminMarketplacePage.waitForPageLoaded();
        await adminMarketplaceHeader.toolsetsTab.click();
        await adminMarketplaceHeader
          .getSearch()
          .inputField.fillInInput(toolsetEntity.name);
        toolsetElement =
          await adminMarketplaceEntitiesSection.findEntityElement(
            toolsetEntity.name,
          );
        await baseAssertion.assertElementState(toolsetElement, 'visible');
      },
    );

    await dialAdminTest.step(
      'Click on the found card and verify the details',
      async () => {
        await toolsetElement.click();
        await adminEntityDetailsModalAssertion.assertElementState(
          adminEntityDetailsModal,
          'visible',
        );
        await adminEntityDetailsModalAssertion.assertEntityCommonAttributes({
          expectedName: toolsetEntity.name,
          expectedVersion: toolsetEntity.version,
          expectedDescription: toolsetEntity.description,
          expectedReleaseDate: publishApiModels.response.createdAt,
          expectedAuthor: defaultAuthor,
          expectedTopics: toolsetEntity.topics,
          expectedIcon: expectedPublishedIconUrl,
          expectedCredsLabel: Creds.loggedOut,
        });
      },
    );

    await dialAdminTest.step(
      'Click on View btn and verify toolset editor is opened, "With login" OAuth option is selected',
      async () => {
        await adminEntityDetailsModal.viewButton.click();
        await adminEntityEditorPage.waitForPageLoadedForEdit(
          EntityEditorToolsetTypes.Toolset,
        );
        await adminToolsetEditorViewFormAssertion.assertToolsetEditorViewFormAttributes(
          { selectedAuthType: ToolsetAuthTypes.OAUTH },
        );
        await adminToolsetEditorViewFormAssertion.assertElementAttribute(
          adminToolsetEditorViewForm.oAuthOption(OAuthOptions.WithLogin),
          Attributes.checked,
          '',
        );
        await adminToolsetEditorViewFormAssertion.assertElementState(
          adminToolsetEditorViewForm.oAuthOption(
            OAuthOptions.WithLoginAndConfig,
          ),
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Verify toolset editor is opened in read only mode and the tooltip is displayed on hover over the controls',
      async () => {
        await adminToolsetEditorViewFormAssertion.assertFormIsReadOnly(
          ToolsetAuthTypes.OAUTH,
        );
        await adminToolsetEditorViewForm.endpoint.hoverOver();
        await adminTooltipPortalAssertion.assertTooltipContent(
          ExpectedConstants.readOnlyToolsetMessage,
        );
        await adminEntityEditorHeader.goOnGeneralInfoStepWithHeaderStepper({
          isHttpMethodTriggered: false,
        });
        await adminEntityEditorPage.waitForPageLoaded(
          EntityEditorToolsetTypes.Toolset,
        );
        await adminEntityEditorGeneralFormAssertion.assertFormIsReadOnly();
        await baseAssertion.assertElementState(
          adminEntityEditorHeader.exitButton,
          'visible',
        );
        await baseAssertion.assertElementState(
          adminEntityEditorHeader.saveAndExitButton,
          'hidden',
        );
      },
    );
  },
);
