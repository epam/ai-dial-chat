import { Publication } from '@/chat/types/publication';
import { ToolsetCredentialsLevel } from '@/chat/types/toolsets';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import { Creds } from '@/src/testData';
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
  '[Toolsets] Login with org and personal creds to public toolset with API key authentication type',
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
    adminPage,
  }) => {
    setTestIds('EPMRTC-8005');

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
    let apiKeyMockHelper: ApiKeyMockHelper;

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

    await dialAdminTest.step('Setup ApiKey mocks for admin page', async () => {
      apiKeyMockHelper = new ApiKeyMockHelper(
        adminPage,
        publishedToolset,
        toolsetEntity.endpoint,
      );
      await apiKeyMockHelper.setupMocks();
      apiKeyMockHelper.enableMocking();
    });

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
        await adminToolsetLoginModal.orgCredsLoginButton.click();
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
        const orgSignInRequest = apiKeyMockHelper.getOrgSignInRequest()!;
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
      'Click Manage creds button again, fill in API key and log in',
      async () => {
        await adminEntityDetailsModal.manageCredsButton.click();
        await adminToolsetLoginModal.myCredsAccordion.click();
        await adminToolsetLoginModal.myCredsApiKeyInput.fillInInput(
          toolsetEntity.userApiKey,
        );
        await adminToolsetLoginModal.myCredsLoginButton.click();
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
        const userSignInRequest = apiKeyMockHelper.getUserSignInRequest()!;
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
