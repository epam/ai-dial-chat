import { Publication } from '@/chat/types/publication';
import { ToolsetCredentialsLevel } from '@/chat/types/toolsets';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import { API, Attachment, Creds } from '@/src/testData';
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
    setTestIds('EPMRTC-7990', 'EPMRTC-7991', 'EPMRTC-7992', 'EPMRTC-8001');

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
        await adminToolsetLoginModalAssertion.assertMyCredsSectionContent();
        await adminToolsetLoginModalAssertion.assertElementActionabilityState(
          adminToolsetLoginModal.loginButton,
          'enabled',
        );
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
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textSuccess),
        );
        await adminEntityDetailsModalAssertion.assertElementBorderColors(
          adminEntityDetailsModal.credsLabel,
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textSuccess),
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
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textSuccess),
        );
        await adminEntityDetailsModalAssertion.assertElementBorderColors(
          adminEntityDetailsModal.credsLabel.getNthElement(1),
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textSuccess),
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
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.bgLayer4),
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
