import { Publication } from '@/chat/types/publication';
import { ToolsetCredentialsLevel } from '@/chat/types/toolsets';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import { Creds, ExpectedConstants } from '@/src/testData';
import { ApiKeyMockHelper } from '@/src/testData/toolsets/apiKeyMockHelper';
import { ThemeColorAttributes } from '@/src/ui/domData';
import { GeneratorUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';
import {
  PublishActions,
  Toolset,
  ToolsetAuthTypes,
} from '@epam/ai-dial-shared';

dialAdminTest(
  '[Toolsets] Login with org and personal creds to public toolset with API key authentication type.\n' +
    'Toast message on successfully login for public toolset.\n' +
    'Admin logged in with orgl creds to public toolset - normal user see logged in with Org creds toolset',
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
    adminToast,
    marketplacePage,
    marketplaceHeader,
    marketplaceEntitiesSection,
    entityDetailsModal,
    entityDetailsModalAssertion,
    setTestIds,
    adminPage,
    page,
  }) => {
    setTestIds('EPMRTC-8005', 'EPMRTC-7995', 'EPMRTC-8002');

    const toolsetEntity = {
      name: GeneratorUtil.randomToolsetName(),
      version: GeneratorUtil.randomEntityVersion(),
      endpoint: GeneratorUtil.randomUrl(),
      apiKeyHeader: GeneratorUtil.randomString(5),
      orgApiKey: GeneratorUtil.randomString(7),
      userApiKey: GeneratorUtil.randomString(7),
    };
    let initialToolset: Toolset;
    let publishedToolset: Toolset;
    let orgToolset: Toolset;
    let adminApiKeyMockHelper: ApiKeyMockHelper;
    let userApiKeyMockHelper: ApiKeyMockHelper;

    await dialAdminTest.step(
      'Precondition: Create API-key toolset via API',
      async () => {
        const toolsetModel = toolsetBuilder
          .withDisplayName(toolsetEntity.name)
          .withDisplayVersion(toolsetEntity.version)
          .withEndpoint(toolsetEntity.endpoint)
          .withAuthSettings({
            authentication_type: ToolsetAuthTypes.API_KEY,
            api_key_header: toolsetEntity.apiKeyHeader,
          })
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
      'Setup ApiKey mocks for admin user page',
      async () => {
        adminApiKeyMockHelper = new ApiKeyMockHelper(
          adminPage,
          publishedToolset,
          toolsetEntity.endpoint,
        );
        await adminApiKeyMockHelper.setupMocks();
        adminApiKeyMockHelper.enableMocking();
      },
    );

    await dialAdminTest.step(
      'Open admin marketplace, navigate to toolsets and find published toolset',
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
          expectedManageCredsButtonState: 'visible',
        });
      },
    );

    await dialAdminTest.step(
      'Click Manage creds button -> Organization section, fill in API key and log in',
      async () => {
        await adminEntityDetailsModal.manageCredsButton.click();
        await adminToolsetLoginModal.orgCredsAccordion.click();
        await adminToolsetLoginModalAssertion.assertOrgCredsSectionContent();
        await adminToolsetLoginModal.orgCredsApiKeyInput.fillInInput(
          toolsetEntity.orgApiKey,
        );
        orgToolset =
          await adminToolsetLoginModal.clickOrgCredsLoginButtonForApiKey();
      },
    );

    await dialAdminTest.step(
      'Setup ApiKey mocks for the main user page',
      async () => {
        userApiKeyMockHelper = new ApiKeyMockHelper(
          page,
          orgToolset,
          toolsetEntity.endpoint,
        );
        await userApiKeyMockHelper.setupMocks();
        userApiKeyMockHelper.enableMocking();
        userApiKeyMockHelper.setIsSignedInGlobal(true);
      },
    );

    await dialAdminTest.step(
      'Verify login modal is closed, successful toast is displayed and entity details shows org creds badge',
      async () => {
        await baseAssertion.assertElementText(
          adminToast,
          ExpectedConstants.loginToOrgSuccessfulMessage(
            toolsetEntity.name,
            toolsetEntity.version,
          ),
        );
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
        const orgSignInRequest = adminApiKeyMockHelper.getOrgSignInRequest()!;
        toolsetApiAuthenticationAssertion.assertSignInRequest(
          orgSignInRequest,
          {
            url: publishedToolset.name!,
            authType: ToolsetAuthTypes.API_KEY,
            credentialsLevel: ToolsetCredentialsLevel.GLOBAL,
            apiKey: toolsetEntity.orgApiKey,
          },
        );
      },
    );

    await dialAdminTest.step(
      'Verify regular user sees toolset as logged-in when admin is logged in with Org creds only',
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
          expectedCredsLabel: Creds.orgCreds,
        });
      },
    );

    await dialAdminTest.step(
      'Click Manage creds button again, fill in API key and log in',
      async () => {
        await adminEntityDetailsModal.manageCredsButton.click();
        await adminToolsetLoginModal.myCredsAccordion.click();
        await adminToolsetLoginModal.myCredsApiKeyInput.fillInInput(
          toolsetEntity.userApiKey,
        );
        await adminToolsetLoginModal.clickMyCredsLoginButtonForApiKey();
      },
    );

    await dialAdminTest.step(
      'Verify login modal is closed, successful toast is displayed and entity details shows both MY CREDS and ORG CREDS badges',
      async () => {
        await baseAssertion.assertElementText(
          adminToast,
          ExpectedConstants.personalLoginSuccessfulMessage(
            toolsetEntity.name,
            toolsetEntity.version,
          ),
        );
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
        const userSignInRequest = adminApiKeyMockHelper.getUserSignInRequest()!;
        toolsetApiAuthenticationAssertion.assertSignInRequest(
          userSignInRequest,
          {
            url: publishedToolset.name!,
            authType: ToolsetAuthTypes.API_KEY,
            credentialsLevel: ToolsetCredentialsLevel.USER,
            apiKey: toolsetEntity.userApiKey,
          },
        );
      },
    );
  },
);

dialSharedWithMeTest(
  "[Toolsets] Login to public toolset with global creds with user's own creds (API key)",
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
    setTestIds('EPMRTC-9028');

    const toolsetEntity = {
      name: GeneratorUtil.randomToolsetName(),
      version: GeneratorUtil.randomEntityVersion(),
      endpoint: GeneratorUtil.randomUrl(),
      apiKey: GeneratorUtil.randomString(7),
    };

    let initialToolset: Toolset;
    let publishedToolset: Toolset;
    let apiKeyMockHelper: ApiKeyMockHelper;
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
          .withAuthSettings({
            authentication_type: ToolsetAuthTypes.API_KEY,
            api_key_header: GeneratorUtil.randomString(7),
          })
          .build();
        await toolsetApiHelper.createToolset(toolsetModel);
        initialToolset = (await toolsetApiHelper.getToolset(
          toolsetEntity.name,
          toolsetEntity.version,
        ))!;
      },
    );

    await dialSharedWithMeTest.step(
      'Precondition: Publish toolset with credentials and approve publication',
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
      'Setup API key mocks for user2 page with org creds signed in',
      async () => {
        apiKeyMockHelper = new ApiKeyMockHelper(
          additionalShareUserPage,
          publishedToolset,
          toolsetEntity.endpoint,
        );
        await apiKeyMockHelper.setupMocks();
        apiKeyMockHelper.setIsSignedInGlobal(true);
        apiKeyMockHelper.enableMocking();
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
      'User2 clicks "Login with my creds" btn and verifies API key login form',
      async () => {
        await additionalShareUserEntityDetailsModal.loginWithMyCredsButton.click();
        await additionalShareUserToolsetLoginModalAssertion.assertElementState(
          additionalShareUserToolsetLoginModal,
          'visible',
        );
        await additionalShareUserToolsetLoginModalAssertion.assertElementState(
          additionalShareUserToolsetLoginModal.apiKeyMaskedFieldInput,
          'visible',
        );
      },
    );

    await dialSharedWithMeTest.step(
      'User2 fills in API key and logs in with own credentials',
      async () => {
        await additionalShareUserToolsetLoginModal.apiKeyMaskedFieldInput.fillInInput(
          toolsetEntity.apiKey,
        );
        await additionalShareUserToolsetLoginModal.clickPublicToolsetLoginForApiKey();
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
