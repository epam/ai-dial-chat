import { Publication } from '@/chat/types/publication';
import { ToolsetCredentialsLevel } from '@/chat/types/toolsets';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import {
  API,
  Attachment,
  Creds,
  ExpectedConstants,
  ManageCredsModalText,
} from '@/src/testData';
import { OAuthMockHelper } from '@/src/testData/toolsets/oauthMockHelper';
import { ThemeColorAttributes } from '@/src/ui/domData';
import { GeneratorUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';
import {
  PublishActions,
  Toolset,
  ToolsetAuthTypes,
} from '@epam/ai-dial-shared';
import { Page } from '@playwright/test';

dialAdminTest(
  '[Toolsets] Login with org and personal creds to public toolset with OAuth authentication type.\n' +
    'Org creds label is displayed if admin login to public toolset.\n' +
    'Manage credentials form view.\n' +
    'Manage credentials form: icon is displayed.\n' +
    'Admin logged in with personal creds to public toolset - normal user see logged out toolset',
  async ({
    toolsetBuilder,
    toolsetApiHelper,
    publicationApiHelper,
    adminPublicationApiHelper,
    adminUserItemApiHelper,
    publishRequestBuilder,
    adminMarketplacePage,
    adminMarketplaceHeader,
    adminMarketplaceEntitiesSection,
    adminEntityDetailsModal,
    adminEntityDetailsModalAssertion,
    adminToolsetLoginModal,
    adminToolsetLoginModalAssertion,
    toolsetApiAuthenticationAssertion,
    baseAssertion,
    setTestIds,
    fileApiHelper,
    adminPage,
    page,
    marketplacePage,
    marketplaceHeader,
    marketplaceEntitiesSection,
    entityDetailsModal,
    entityDetailsModalAssertion,
  }) => {
    setTestIds(
      'EPMRTC-7990',
      'EPMRTC-7866',
      'EPMRTC-7991',
      'EPMRTC-7992',
      'EPMRTC-8001',
    );

    const toolsetEntity = {
      name: GeneratorUtil.randomToolsetName(),
      version: GeneratorUtil.randomEntityVersion(),
      endpoint: GeneratorUtil.randomUrl(),
    };
    const filename = GeneratorUtil.randomFilename('svg');
    const iconUrl = await fileApiHelper.putFileWithCustomName(
      filename,
      Attachment.appIconSvg,
    );
    const expectedColor = ThemesUtil.getRgbColorByKey(
      ThemeColorAttributes.textSuccess,
    );

    let initialToolset: Toolset;
    let publishedToolset: Toolset;
    let personalToolset: Toolset;
    let adminOauthMockHelper: OAuthMockHelper;
    let userOAuthMockHelper: OAuthMockHelper;
    let loginPopup: Page;

    await dialAdminTest.step(
      'Precondition: Create toolset via API',
      async () => {
        const toolsetModel = toolsetBuilder
          .withDisplayName(toolsetEntity.name)
          .withDisplayVersion(toolsetEntity.version)
          .withIconUrl(iconUrl)
          .build();
        await toolsetApiHelper.createToolset(toolsetModel);
        initialToolset = (await toolsetApiHelper.getToolset(
          toolsetEntity.name,
          toolsetEntity.version,
        ))!;
      },
    );

    await dialAdminTest.step(
      'Precondition: Publish toolset and approve publication',
      async () => {
        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withToolsetResource(initialToolset, PublishActions.ADD)
          .withFileResource(iconUrl, PublishActions.ADD)
          .build();
        const publication: Publication =
          await publicationApiHelper.createPublishRequest(publishRequest);
        await adminPublicationApiHelper.approveRequest(publication);

        const toolsetResource = publication.resources.find(
          (r) => r.sourceUrl === initialToolset.id,
        )!;
        publishedToolset = await adminUserItemApiHelper.getItem<Toolset>(
          toolsetResource.targetUrl,
        );
      },
    );

    await dialAdminTest.step(
      'Setup OAuth mocks for admin user page',
      async () => {
        adminOauthMockHelper = new OAuthMockHelper(
          adminPage,
          publishedToolset,
          toolsetEntity.endpoint,
        );
        await adminOauthMockHelper.setupMocks();
        adminOauthMockHelper.enableMocking();
      },
    );

    await dialAdminTest.step(
      'Open admin marketplace, navigate to toolsets and find published toolset',
      async () => {
        await adminMarketplacePage.openMarketplacePage({
          updateInstalledDeployments: false,
          getInstalledDeployments: true,
          updateInstalledToolsets: false,
          getInstalledToolsets: false,
          getStyles: true,
        });
        await adminMarketplacePage.waitForPageLoaded();
        await adminMarketplaceHeader.toolsetsTab.click();
        await adminMarketplaceHeader
          .getSearch()
          .inputField.fillInInput(toolsetEntity.name);
        const toolsetElement =
          await adminMarketplaceEntitiesSection.findEntityElement(
            toolsetEntity.name,
          );
        await baseAssertion.assertElementState(toolsetElement, 'visible');
        await toolsetElement.click();
      },
    );

    await dialAdminTest.step(
      'Verify entity details modal is displayed with Manage creds button and logged-out badge',
      async () => {
        await adminEntityDetailsModalAssertion.assertElementState(
          adminEntityDetailsModal,
          'visible',
        );
        await adminEntityDetailsModalAssertion.assertEntityCommonAttributes({
          expectedCredsLabel: Creds.loggedOut,
        });
        await baseAssertion.assertElementState(
          adminEntityDetailsModal.manageCredsButton,
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Click Manage creds button and verify modal attributes',
      async () => {
        await adminEntityDetailsModal.manageCredsButton.click();
        await adminToolsetLoginModalAssertion.assertElementState(
          adminToolsetLoginModal,
          'visible',
        );
        await adminToolsetLoginModalAssertion.assertManageCredsModalCommonAttributes(
          {
            expectedName: toolsetEntity.name,
            expectedVersion: toolsetEntity.version,
            expectedIcon: `${API.api}/${publishedToolset.icon_url}`,
          },
        );
      },
    );

    await dialAdminTest.step(
      'Click Personal section and verify personal creds content is displayed',
      async () => {
        await adminToolsetLoginModal.myCredsAccordion.click();
        await adminToolsetLoginModalAssertion.assertMyCredsSectionContent({
          expectedText: ManageCredsModalText.personalCredsText,
          expectedLoginBtnState: 'visible',
        });
      },
    );

    await dialAdminTest.step(
      'Click Organizational tab and verify org creds content is displayed',
      async () => {
        await adminToolsetLoginModal.orgCredsAccordion.click();
        await adminToolsetLoginModalAssertion.assertOrgCredsSectionContent();
      },
    );

    await dialAdminTest.step(
      'Click login button in org creds tab and complete OAuth flow',
      async () => {
        loginPopup =
          await adminToolsetLoginModal.clickOrgCredsLoginButtonForOAuth();
        await adminOauthMockHelper.navigateToCallback(loginPopup);
      },
    );

    await dialAdminTest.step(
      'Verify login modal is closed and entity details shows org creds badge',
      async () => {
        await adminToolsetLoginModalAssertion.assertElementState(
          adminToolsetLoginModal,
          'hidden',
        );
        await adminEntityDetailsModalAssertion.assertEntityCommonAttributes({
          expectedCredsLabel: Creds.orgCreds,
        });
        await adminEntityDetailsModalAssertion.assertElementColor(
          adminEntityDetailsModal.credsLabel,
          expectedColor,
        );
        await adminEntityDetailsModalAssertion.assertElementBorderColors(
          adminEntityDetailsModal.credsLabel,
          expectedColor,
        );
      },
    );

    await dialAdminTest.step(
      'Validate org sign-in request payload',
      async () => {
        const orgSignInRequest = adminOauthMockHelper.getOrgSignInRequest()!;
        toolsetApiAuthenticationAssertion.assertSignInRequest(
          orgSignInRequest,
          {
            url: publishedToolset.name!,
            authType: ToolsetAuthTypes.OAUTH,
            credentialsLevel: ToolsetCredentialsLevel.GLOBAL,
            authorizationCode: adminOauthMockHelper.getAuthorizationCode(),
          },
        );
      },
    );

    await dialAdminTest.step(
      'Click Manage creds button again, click login button and complete OAuth flow for personal creds',
      async () => {
        await adminEntityDetailsModal.manageCredsButton.click();
        await adminToolsetLoginModal.myCredsAccordion.click();
        loginPopup =
          await adminToolsetLoginModal.clickMyCredsLoginButtonForOAuth();
        const responses = await adminMarketplacePage.waitForExpectedResponses(
          () => adminOauthMockHelper.navigateToCallback(loginPopup),
          [
            {
              apiMethod: 'GET',
              urlPattern: API.toolsetCreateHost(),
              status: 200,
            },
          ],
        );
        personalToolset = (await responses.responses[0].json()) as Toolset;
      },
    );

    await dialAdminTest.step(
      'Setup OAuth mocks for regular user page',
      async () => {
        userOAuthMockHelper = new OAuthMockHelper(
          page,
          personalToolset,
          toolsetEntity.endpoint,
        );
        await userOAuthMockHelper.setupToolsetListingRoute();
        userOAuthMockHelper.enableMocking();
      },
    );

    await dialAdminTest.step(
      'Verify regular user sees toolset as logged-out when admin is logged in with personal creds only',
      async () => {
        await marketplacePage.openMarketplacePage({
          updateInstalledDeployments: false,
          getInstalledDeployments: false,
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
            { isEditable: false, isWorkspaceEntity: false },
          );
        await baseAssertion.assertElementState(toolsetElement, 'visible');
        await toolsetElement.click();
        await entityDetailsModalAssertion.assertElementState(
          entityDetailsModal,
          'visible',
        );
        await entityDetailsModalAssertion.assertEntityCommonAttributes({
          expectedCredsLabel: Creds.loggedOut,
        });
      },
    );

    await dialAdminTest.step(
      'Verify login modal is closed and entity details shows both MY CREDS and ORG CREDS badges',
      async () => {
        await adminToolsetLoginModalAssertion.assertElementState(
          adminToolsetLoginModal,
          'hidden',
        );
        await adminEntityDetailsModalAssertion.assertEntityCommonAttributes({
          expectedCredsLabel: [Creds.myCreds, Creds.orgCreds],
        });
        await adminEntityDetailsModalAssertion.assertElementColor(
          adminEntityDetailsModal.credsLabel.getNthElement(1),
          expectedColor,
        );
        await adminEntityDetailsModalAssertion.assertElementBorderColors(
          adminEntityDetailsModal.credsLabel.getNthElement(1),
          expectedColor,
        );
        await adminEntityDetailsModalAssertion.assertElementColor(
          adminEntityDetailsModal.credsLabel.getNthElement(2),
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.bgLayer0),
        );
        await adminEntityDetailsModalAssertion.assertElementBorderColors(
          adminEntityDetailsModal.credsLabel.getNthElement(2),
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.bgLayer0),
        );
        await adminEntityDetailsModalAssertion.assertElementBackgroundColors(
          adminEntityDetailsModal.credsLabel.getNthElement(2),
          ThemesUtil.getRgbColorByKey(
            ThemeColorAttributes.controlsBgDisableAccent,
          ),
        );
      },
    );

    await dialAdminTest.step(
      'Validate user sign-in request payload',
      async () => {
        const userSignInRequest = adminOauthMockHelper.getUserSignInRequest()!;
        toolsetApiAuthenticationAssertion.assertSignInRequest(
          userSignInRequest,
          {
            url: publishedToolset.name!,
            authType: ToolsetAuthTypes.OAUTH,
            credentialsLevel: ToolsetCredentialsLevel.USER,
            authorizationCode: adminOauthMockHelper.getAuthorizationCode(),
          },
        );
      },
    );
  },
);

dialSharedWithMeTest(
  `[Toolsets] Login to public toolset with global creds with user's own creds (OAuth)`,
  async ({
    toolsetBuilder,
    toolsetApiHelper,
    publicationApiHelper,
    adminPublicationApiHelper,
    adminUserItemApiHelper,
    publishRequestBuilder,
    baseAssertion,
    setTestIds,
    additionalShareUserPage,
    additionalShareUserMarketplacePage,
    additionalShareUserMarketplaceHeader,
    additionalShareUserMarketplaceEntitiesSection,
    additionalShareUserEntityDetailsModal,
    additionalShareUserEntityDetailsModalAssertion,
    additionalShareUserToolsetLoginModal,
    additionalShareUserToolsetLoginModalAssertion,
  }) => {
    setTestIds('EPMRTC-7173');

    const toolsetEntity = {
      name: GeneratorUtil.randomToolsetName(),
      version: GeneratorUtil.randomEntityVersion(),
      endpoint: GeneratorUtil.randomUrl(),
    };

    let initialToolset: Toolset;
    let publishedToolset: Toolset;
    let user2OAuthMockHelper: OAuthMockHelper;
    let user2LoginPopup: Page;
    const expectedColor = ThemesUtil.getRgbColorByKey(
      ThemeColorAttributes.textSuccess,
    );

    await dialSharedWithMeTest.step(
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

    await dialSharedWithMeTest.step(
      'Precondition: Publish toolset and approve publication',
      async () => {
        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withToolsetResource(initialToolset, PublishActions.ADD)
          .build();
        const publication: Publication =
          await publicationApiHelper.createPublishRequest(publishRequest);
        await adminPublicationApiHelper.approveRequest(publication);

        const toolsetResource = publication.resources.find(
          (r) => r.sourceUrl === initialToolset.id,
        )!;
        publishedToolset = await adminUserItemApiHelper.getItem<Toolset>(
          toolsetResource.targetUrl,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Setup OAuth mocks for user2 page with org creds signed in',
      async () => {
        user2OAuthMockHelper = new OAuthMockHelper(
          additionalShareUserPage,
          publishedToolset,
          toolsetEntity.endpoint,
        );
        await user2OAuthMockHelper.setupMocks();
        user2OAuthMockHelper.setIsSignedInGlobal(true);
        user2OAuthMockHelper.enableMocking();
      },
    );

    await dialSharedWithMeTest.step(
      'User2 opens marketplace, navigates to toolsets and finds public toolset',
      async () => {
        await additionalShareUserMarketplacePage.openMarketplacePage({
          updateInstalledDeployments: false,
          getInstalledDeployments: false,
          updateInstalledToolsets: false,
          getInstalledToolsets: false,
          getStyles: true,
        });
        await additionalShareUserMarketplacePage.waitForPageLoaded();
        await additionalShareUserMarketplaceHeader.toolsetsTab.click();
        await additionalShareUserMarketplaceHeader
          .getSearch()
          .inputField.fillInInput(toolsetEntity.name);
        const toolsetElement =
          await additionalShareUserMarketplaceEntitiesSection.findEntityElement(
            toolsetEntity.name,
            { isEditable: false, isWorkspaceEntity: false },
          );
        await baseAssertion.assertElementState(toolsetElement, 'visible');
        await toolsetElement.click();
      },
    );

    await dialSharedWithMeTest.step(
      'Verify entity details modal shows ORG CREDS green indicator for user2',
      async () => {
        await additionalShareUserEntityDetailsModalAssertion.assertElementState(
          additionalShareUserEntityDetailsModal,
          'visible',
        );
        await additionalShareUserEntityDetailsModalAssertion.assertEntityCommonAttributes(
          { expectedCredsLabel: Creds.orgCreds },
        );
        await additionalShareUserEntityDetailsModalAssertion.assertElementColor(
          additionalShareUserEntityDetailsModal.credsLabel,
          expectedColor,
        );
        await additionalShareUserEntityDetailsModalAssertion.assertElementBorderColors(
          additionalShareUserEntityDetailsModal.credsLabel,
          expectedColor,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'User2 clicks "Login with my creds" btn and logs in',
      async () => {
        await additionalShareUserEntityDetailsModal.loginWithMyCredsButton.click();
        await additionalShareUserToolsetLoginModalAssertion.assertElementState(
          additionalShareUserToolsetLoginModal,
          'visible',
        );
        user2LoginPopup =
          await additionalShareUserToolsetLoginModal.clickPublicToolsetLoginForOAuth();
        await user2OAuthMockHelper.navigateToCallback(user2LoginPopup);
      },
    );

    await dialSharedWithMeTest.step(
      'Verify login modal is closed and entity details shows MY CREDS green indicator for user2',
      async () => {
        await additionalShareUserToolsetLoginModalAssertion.assertElementState(
          additionalShareUserToolsetLoginModal,
          'hidden',
        );
        await additionalShareUserEntityDetailsModalAssertion.assertEntityCommonAttributes(
          { expectedCredsLabel: [Creds.myCreds, Creds.orgCreds] },
        );
        const credsLabel =
          additionalShareUserEntityDetailsModal.credsLabel.getNthElement(1);
        await additionalShareUserEntityDetailsModalAssertion.assertElementColor(
          credsLabel,
          expectedColor,
        );
        await additionalShareUserEntityDetailsModalAssertion.assertElementBorderColors(
          credsLabel,
          expectedColor,
        );
      },
    );
  },
);

dialSharedWithMeTest(
  `[Toolsets] Login to public toolset without global creds with user's own creds (OAuth)`,
  async ({
    toolsetBuilder,
    toolsetApiHelper,
    publicationApiHelper,
    adminPublicationApiHelper,
    adminUserItemApiHelper,
    publishRequestBuilder,
    baseAssertion,
    setTestIds,
    additionalShareUserPage,
    additionalShareUserMarketplacePage,
    additionalShareUserMarketplaceHeader,
    additionalShareUserMarketplaceEntitiesSection,
    additionalShareUserEntityDetailsModal,
    additionalShareUserEntityDetailsModalAssertion,
    additionalShareUserToolsetLoginModal,
    additionalShareUserToolsetLoginModalAssertion,
  }) => {
    setTestIds('EPMRTC-7184');

    const toolsetEntity = {
      name: GeneratorUtil.randomToolsetName(),
      version: GeneratorUtil.randomEntityVersion(),
      endpoint: GeneratorUtil.randomUrl(),
    };

    let initialToolset: Toolset;
    let publishedToolset: Toolset;
    let user2OAuthMockHelper: OAuthMockHelper;
    let user2LoginPopup: Page;
    const expectedColor = ThemesUtil.getRgbColorByKey(
      ThemeColorAttributes.textSuccess,
    );
    let expectedErrorColor = ThemesUtil.getRgbColorByKey(
      ThemeColorAttributes.textError,
    );

    await dialSharedWithMeTest.step(
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

    await dialSharedWithMeTest.step(
      'Precondition: Publish toolset without credentials and approve publication',
      async () => {
        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withToolsetResource(initialToolset, PublishActions.ADD)
          .build();
        const publication: Publication =
          await publicationApiHelper.createPublishRequest(publishRequest);
        await adminPublicationApiHelper.approveRequest(publication);

        const toolsetResource = publication.resources.find(
          (r) => r.sourceUrl === initialToolset.id,
        )!;
        publishedToolset = await adminUserItemApiHelper.getItem<Toolset>(
          toolsetResource.targetUrl,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Setup OAuth mocks for user2 page',
      async () => {
        user2OAuthMockHelper = new OAuthMockHelper(
          additionalShareUserPage,
          publishedToolset,
          toolsetEntity.endpoint,
        );
        await user2OAuthMockHelper.setupMocks();
        user2OAuthMockHelper.enableMocking();
      },
    );

    await dialSharedWithMeTest.step(
      'User2 opens marketplace, navigates to toolsets and finds public toolset',
      async () => {
        await additionalShareUserMarketplacePage.openMarketplacePage({
          updateInstalledDeployments: false,
          getInstalledDeployments: false,
          updateInstalledToolsets: false,
          getInstalledToolsets: false,
          getStyles: true,
        });
        await additionalShareUserMarketplacePage.waitForPageLoaded();
        await additionalShareUserMarketplaceHeader.toolsetsTab.click();
        await additionalShareUserMarketplaceHeader
          .getSearch()
          .inputField.fillInInput(toolsetEntity.name);
        const toolsetElement =
          await additionalShareUserMarketplaceEntitiesSection.findEntityElement(
            toolsetEntity.name,
            { isEditable: false, isWorkspaceEntity: false },
          );
        await baseAssertion.assertElementState(toolsetElement, 'visible');
        await toolsetElement.click();
      },
    );

    await dialSharedWithMeTest.step(
      'Verify entity details modal shows LOGGED OUT red indicator for user2',
      async () => {
        await additionalShareUserEntityDetailsModalAssertion.assertElementState(
          additionalShareUserEntityDetailsModal,
          'visible',
        );
        await additionalShareUserEntityDetailsModalAssertion.assertEntityCommonAttributes(
          { expectedCredsLabel: Creds.loggedOut },
        );
        await additionalShareUserEntityDetailsModalAssertion.assertElementColor(
          additionalShareUserEntityDetailsModal.credsLabel,
          expectedErrorColor,
        );
        await additionalShareUserEntityDetailsModalAssertion.assertElementBorderColors(
          additionalShareUserEntityDetailsModal.credsLabel,
          expectedErrorColor,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'User2 clicks Login with user creds button and completes OAuth login',
      async () => {
        await additionalShareUserEntityDetailsModal.loginWithMyCredsButton.click();
        await additionalShareUserToolsetLoginModalAssertion.assertElementState(
          additionalShareUserToolsetLoginModal,
          'visible',
        );
        user2LoginPopup =
          await additionalShareUserToolsetLoginModal.clickPublicToolsetLoginForOAuth();
        await user2OAuthMockHelper.navigateToCallback(user2LoginPopup);
      },
    );

    await dialSharedWithMeTest.step(
      'Verify login modal is closed and entity details shows MY CREDS green indicator for user2',
      async () => {
        await additionalShareUserToolsetLoginModalAssertion.assertElementState(
          additionalShareUserToolsetLoginModal,
          'hidden',
        );
        await additionalShareUserEntityDetailsModalAssertion.assertEntityCommonAttributes(
          { expectedCredsLabel: Creds.myCreds },
        );
        await additionalShareUserEntityDetailsModalAssertion.assertElementColor(
          additionalShareUserEntityDetailsModal.credsLabel,
          expectedColor,
        );
        await additionalShareUserEntityDetailsModalAssertion.assertElementBorderColors(
          additionalShareUserEntityDetailsModal.credsLabel,
          expectedColor,
        );
      },
    );
  },
);

dialAdminTest(
  'Login first with personal creds and then with org creds to public toolset.\n' +
    '[Toolsets] Logout first with personal creds when public toolset is logged with both org creds and personal creds of admin.\n' +
    'Toast message on successfully logout for public toolset.\n' +
    'Logout with org creds when public toolset is logged with org creds only',
  async ({
    toolsetBuilder,
    toolsetApiHelper,
    publicationApiHelper,
    adminPublicationApiHelper,
    adminUserItemApiHelper,
    publishRequestBuilder,
    adminMarketplacePage,
    adminMarketplaceHeader,
    adminMarketplaceEntitiesSection,
    adminEntityDetailsModal,
    adminEntityDetailsModalAssertion,
    adminToolsetLoginModal,
    adminToolsetLoginModalAssertion,
    baseAssertion,
    adminToast,
    setTestIds,
    adminPage,
  }) => {
    setTestIds('EPMRTC-7993', 'EPMRTC-7996', 'EPMRTC-8000', 'EPMRTC-7998');

    const toolsetEntity = {
      name: GeneratorUtil.randomToolsetName(),
      version: GeneratorUtil.randomEntityVersion(),
      endpoint: GeneratorUtil.randomUrl(),
    };
    const expectedColor = ThemesUtil.getRgbColorByKey(
      ThemeColorAttributes.textSuccess,
    );

    let initialToolset: Toolset;
    let publishedToolset: Toolset;
    let adminOauthMockHelper: OAuthMockHelper;
    let loginPopup: Page;

    await dialAdminTest.step(
      'Precondition: Create toolset via API',
      async () => {
        const toolsetModel = toolsetBuilder
          .withDisplayName(toolsetEntity.name)
          .withDisplayVersion(toolsetEntity.version)
          .build();
        await toolsetApiHelper.createToolset(toolsetModel);
        initialToolset = (await toolsetApiHelper.getToolset(
          toolsetEntity.name,
          toolsetEntity.version,
        ))!;
      },
    );

    await dialAdminTest.step(
      'Precondition: Publish toolset and approve publication',
      async () => {
        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withToolsetResource(initialToolset, PublishActions.ADD)
          .build();
        const publication: Publication =
          await publicationApiHelper.createPublishRequest(publishRequest);
        await adminPublicationApiHelper.approveRequest(publication);

        const toolsetResource = publication.resources.find(
          (r) => r.sourceUrl === initialToolset.id,
        )!;
        publishedToolset = await adminUserItemApiHelper.getItem<Toolset>(
          toolsetResource.targetUrl,
        );
      },
    );

    await dialAdminTest.step(
      'Precondition: Setup OAuth mocks for admin user page',
      async () => {
        adminOauthMockHelper = new OAuthMockHelper(
          adminPage,
          publishedToolset,
          toolsetEntity.endpoint,
        );
        await adminOauthMockHelper.setupMocks();
        adminOauthMockHelper.enableMocking();
      },
    );

    await dialAdminTest.step(
      'Open admin marketplace, navigate to toolsets and find published toolset',
      async () => {
        await adminMarketplacePage.openMarketplacePage({
          updateInstalledDeployments: false,
          getInstalledDeployments: true,
          updateInstalledToolsets: false,
          getInstalledToolsets: false,
          getStyles: true,
        });
        await adminMarketplacePage.waitForPageLoaded();
        await adminMarketplaceHeader.toolsetsTab.click();
        await adminMarketplaceHeader
          .getSearch()
          .inputField.fillInInput(toolsetEntity.name);
        const toolsetElement =
          await adminMarketplaceEntitiesSection.findEntityElement(
            toolsetEntity.name,
          );
        await baseAssertion.assertElementState(toolsetElement, 'visible');
        await toolsetElement.click();
      },
    );

    await dialAdminTest.step(
      'Verify entity details modal is displayed with LOGGED OUT label and Manage creds button',
      async () => {
        await adminEntityDetailsModalAssertion.assertElementState(
          adminEntityDetailsModal,
          'visible',
        );
        await adminEntityDetailsModalAssertion.assertEntityCommonAttributes({
          expectedCredsLabel: Creds.loggedOut,
        });
        await baseAssertion.assertElementState(
          adminEntityDetailsModal.manageCredsButton,
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Click Manage creds button, click login button in Personal tab and complete OAuth login process',
      async () => {
        await adminEntityDetailsModal.manageCredsButton.click();
        await adminToolsetLoginModal.myCredsAccordion.click();
        loginPopup =
          await adminToolsetLoginModal.clickMyCredsLoginButtonForOAuth();
        await adminMarketplacePage.waitForExpectedResponses(
          () => adminOauthMockHelper.navigateToCallback(loginPopup),
          [
            {
              apiMethod: 'GET',
              urlPattern: API.toolsetCreateHost(),
              status: 200,
            },
          ],
        );
      },
    );

    await dialAdminTest.step(
      'Verify manage creds modal is closed and MY CREDS label is displayed on the toolset card',
      async () => {
        await adminToolsetLoginModalAssertion.assertElementState(
          adminToolsetLoginModal,
          'hidden',
        );
        await adminEntityDetailsModalAssertion.assertEntityCommonAttributes({
          expectedCredsLabel: Creds.myCreds,
        });
        await adminEntityDetailsModalAssertion.assertElementColor(
          adminEntityDetailsModal.credsLabel,
          expectedColor,
        );
        await adminEntityDetailsModalAssertion.assertElementBorderColors(
          adminEntityDetailsModal.credsLabel,
          expectedColor,
        );
      },
    );

    await dialAdminTest.step(
      'Click Manage creds button again, click login button in Organizational tab and complete OAuth login process',
      async () => {
        await adminEntityDetailsModal.manageCredsButton.click();
        await adminToolsetLoginModal.orgCredsAccordion.click();
        loginPopup =
          await adminToolsetLoginModal.clickOrgCredsLoginButtonForOAuth();
        await adminOauthMockHelper.navigateToCallback(loginPopup);
      },
    );

    await dialAdminTest.step(
      'Verify manage creds modal is closed and MY CREDS label is still displayed on the toolset card',
      async () => {
        await adminToolsetLoginModalAssertion.assertElementState(
          adminToolsetLoginModal,
          'hidden',
        );
        await adminEntityDetailsModalAssertion.assertEntityCommonAttributes({
          expectedCredsLabel: [Creds.myCreds, Creds.orgCreds],
        });
        await adminEntityDetailsModalAssertion.assertElementColor(
          adminEntityDetailsModal.credsLabel.getNthElement(1),
          expectedColor,
        );
        await adminEntityDetailsModalAssertion.assertElementBorderColors(
          adminEntityDetailsModal.credsLabel.getNthElement(1),
          expectedColor,
        );
      },
    );

    await dialAdminTest.step(
      'Click Manage creds button and verify both bars are displayed with logged-in status',
      async () => {
        await adminEntityDetailsModal.manageCredsButton.click();
        await adminToolsetLoginModalAssertion.assertElementState(
          adminToolsetLoginModal,
          'visible',
        );
        await adminToolsetLoginModalAssertion.assertManageCredsModalCommonAttributes(
          {
            expectedName: toolsetEntity.name,
            expectedVersion: toolsetEntity.version,
          },
        );
      },
    );

    await dialAdminTest.step(
      'Click My credentials bar and verify personal section is expanded with logout button visible',
      async () => {
        await adminToolsetLoginModal.myCredsAccordion.click();
        await adminToolsetLoginModalAssertion.assertMyCredsSectionContent({
          expectedText: ManageCredsModalText.myCredsLogoutText,
          expectedLogoutBtnState: 'visible',
        });
      },
    );

    await dialAdminTest.step(
      'Click Logout button in personal credentials section and verify successful message is displayed',
      async () => {
        await adminOauthMockHelper.setupSignOutRoute({
          isSignedInUser: false,
          isSignedInGlobal: true,
        });
        await adminToolsetLoginModal.myCredsLogoutButton.click();
        await baseAssertion.assertElementText(
          adminToast,
          ExpectedConstants.personalLogoutSuccessfulMessage(
            toolsetEntity.name,
            toolsetEntity.version,
          ),
        );
        await adminToast.closeToast();
      },
    );

    await dialAdminTest.step(
      'Verify manage creds modal is closed and ORG CREDS green label is displayed on the toolset card',
      async () => {
        await adminToolsetLoginModalAssertion.assertElementState(
          adminToolsetLoginModal,
          'hidden',
        );
        await adminEntityDetailsModalAssertion.assertEntityCommonAttributes({
          expectedCredsLabel: Creds.orgCreds,
        });
        await adminEntityDetailsModalAssertion.assertElementColor(
          adminEntityDetailsModal.credsLabel,
          expectedColor,
        );
        await adminEntityDetailsModalAssertion.assertElementBorderColors(
          adminEntityDetailsModal.credsLabel,
          expectedColor,
        );
      },
    );

    await dialAdminTest.step(
      'Click Manage creds button, click Organizational tab and verify org creds section shows logout text and logout button',
      async () => {
        await adminEntityDetailsModal.manageCredsButton.click();
        await adminToolsetLoginModal.orgCredsAccordion.click();
        await adminToolsetLoginModalAssertion.assertOrgCredsSectionContent({
          expectedText: ManageCredsModalText.orgCredsAllUsersLogoutText,
          expectedLogoutBtnState: 'visible',
        });
      },
    );

    await dialAdminTest.step(
      'Click Logout button in org credentials section and verify successful message is displayed',
      async () => {
        await adminOauthMockHelper.setupSignOutRoute({
          isSignedInUser: false,
          isSignedInGlobal: false,
        });
        await adminToolsetLoginModal.orgCredsLogoutButton.click();
        await baseAssertion.assertElementText(
          adminToast,
          ExpectedConstants.orgLogoutSuccessfulMessage(
            toolsetEntity.name,
            toolsetEntity.version,
          ),
        );
        await adminToast.closeToast();
      },
    );

    await dialAdminTest.step(
      'Verify manage creds modal is closed and LOGGED OUT label is displayed on the toolset card',
      async () => {
        await adminToolsetLoginModalAssertion.assertElementState(
          adminToolsetLoginModal,
          'hidden',
        );
        await adminEntityDetailsModalAssertion.assertEntityCommonAttributes({
          expectedCredsLabel: Creds.loggedOut,
        });
      },
    );
  },
);
