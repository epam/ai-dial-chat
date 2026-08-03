import { ToolsetCredentialsLevel } from '@/chat/types/toolsets';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  Creds,
  EntityEditorToolsetTypes,
  ExpectedConstants,
  MarketplaceExpectedMessages,
  OAuthOptions,
  SignInButtonTitles,
} from '@/src/testData';
import { OAuthMockHelper } from '@/src/testData/toolsets/oauthMockHelper';
import { Attributes, ThemeColorAttributes } from '@/src/ui/domData';
import { GeneratorUtil, toolsetNamePrefix } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { Toolset, ToolsetAuthTypes } from '@epam/ai-dial-shared';
import { Page } from '@playwright/test';

dialTest(
  '[Toolsets] Create toolset with OAuth (with configuration).\n' +
    '[Toolset]: toolset request all available scopes on login when scopes field is empty.\n' +
    '[Toolset]:Successful OAuth login after updating name and version for toolset (with login& config).\n' +
    'Toolset with special symbols in name able to login vie OAuth',
  async ({
    marketplacePage,
    entityEditorPage,
    entityEditorHeader,
    entityDetailsModal,
    setTestIds,
    baseAssertion,
    toolsetAuthAssertion,
    toolsetEditorViewForm,
    toolsetEditorViewFormAssertion,
    toolsetEditorSettingsPreviewCard,
    toolsetEditorSettingsPreviewCardAssertion,
    entityDetailsModalAssertion,
    entityEditorGeneralForm,
    confirmationDialog,
    toolsetApiHelper,
    itemApiHelper,
    toolsetApiAuthenticationAssertion,
    page,
  }) => {
    setTestIds('EPMDIAL-5370', 'EPMDIAL-5391', 'EPMDIAL-5383', 'EPMDIAL-5371');
    const toolsetEntity = {
      name: toolsetNamePrefix + ExpectedConstants.allowedSpecialSymbolsInName(),
      version: GeneratorUtil.randomEntityVersion(),
      endpoint: GeneratorUtil.randomUrl(),
    };
    const clientId = GeneratorUtil.randomString(7);
    const clientSecret = GeneratorUtil.randomString(7);
    const updatedVersion = GeneratorUtil.randomEntityVersion();
    let updatedId: string;
    let realToolset: Toolset;
    let oauthMockHelper: OAuthMockHelper;
    let initialToolset: Toolset;
    let loginPopup: Page;

    await dialTest.step('Open toolset creation page directly', async () => {
      await marketplacePage.openCreateToolsetPage();
      await entityEditorPage.waitForPageLoaded(
        EntityEditorToolsetTypes.Toolset,
      );
    });

    await dialTest.step(
      'Fill in the required fields and click Next',
      async () => {
        await entityEditorGeneralForm.fillInEntityFields({
          name: toolsetEntity.name,
          version: toolsetEntity.version,
        });
        await entityEditorGeneralForm.goNext({
          hostsArray: [API.toolsetCreateHost(), API.installedToolsetsHost()],
        });
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorToolsetTypes.Toolset,
        );
      },
    );

    await dialTest.step(
      'Fill in Endpoint field, choose OAuth Authentication, select `With login & config` option and fill in required fields',
      async () => {
        await toolsetEditorViewForm.endpoint.fillInInput(
          toolsetEntity.endpoint,
        );
        await toolsetEditorViewForm.oauthContainer.click();
        await toolsetEditorViewForm
          .oAuthOptionRadioButton(OAuthOptions.WithLoginAndConfig)
          .click();
        await toolsetEditorViewForm.clientIdFieldInput.fillInInput(clientId);
        await toolsetEditorViewForm.clientSecretFieldInput.fillInInput(
          clientSecret,
        );
        //get saved toolset object
        initialToolset = (await toolsetApiHelper.getToolset(
          toolsetEntity.name,
          toolsetEntity.version,
        ))!;
      },
    );

    await dialTest.step('Setup OAuth mocks', async () => {
      oauthMockHelper = new OAuthMockHelper(
        page,
        initialToolset,
        toolsetEntity.endpoint,
        {
          mockOAuthConfig: {
            client_id: clientId,
            client_secret: clientSecret,
          },
        },
      );
      await oauthMockHelper.setupMocks();
    });

    await dialTest.step(
      "Click 'Login in' button for 'With login & config' option",
      async () => {
        // need to enable mocking before clicking 'Log In'
        oauthMockHelper.enableMocking();
        // store popup — it's needed in the 'Navigate to OAuth callback' step below
        loginPopup = (await toolsetEditorViewForm.clickLoginButton(
          oauthMockHelper.getMockConfig().authorization_endpoint,
        ))!;
      },
    );

    await dialTest.step('Verify OAuth redirect query', async () => {
      const state = oauthMockHelper.getOAuthState();
      const mockConfig = oauthMockHelper.getMockConfig();
      toolsetApiAuthenticationAssertion.assertOAuthRedirectRequest(
        state,
        mockConfig,
      );
    });

    await dialTest.step(
      'Navigate to OAuth callback and wait for sign-in API was called',
      async () => {
        await oauthMockHelper.navigateToCallback(loginPopup);
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorToolsetTypes.Toolset,
        );
      },
    );

    await dialTest.step('Validate sign-in request payload', async () => {
      const signInRequest = oauthMockHelper.getSignInRequest()!;
      toolsetApiAuthenticationAssertion.assertSignInRequest(signInRequest, {
        url: initialToolset.id!,
        authType: ToolsetAuthTypes.OAUTH,
        credentialsLevel: ToolsetCredentialsLevel.GLOBAL,
        authorizationCode: oauthMockHelper.getAuthorizationCode(),
      });
    });

    await dialTest.step(
      'Verify preview card contains "creds" label',
      async () => {
        await toolsetEditorSettingsPreviewCardAssertion.assertPreviewCardAttributes(
          { expectedCredsLabel: Creds.myCreds },
        );
        await toolsetEditorSettingsPreviewCardAssertion.assertElementColor(
          toolsetEditorSettingsPreviewCard.credsLabel,
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textSuccess),
        );
        await toolsetEditorViewFormAssertion.assertElementText(
          toolsetEditorViewForm.logoutButton,
          SignInButtonTitles.logOut,
        );
        await toolsetEditorViewFormAssertion.assertElementAttribute(
          toolsetEditorViewForm.oAuthOption(OAuthOptions.WithLoginAndConfig),
          Attributes.checked,
          '',
        );
      },
    );

    await dialTest.step(
      'Wait for redirect back to editor and verify logged-in toolset is successfully created',
      async () => {
        await entityEditorHeader.saveAndExitButton.click();
        await baseAssertion.assertElementState(toolsetEditorViewForm, 'hidden');
        await marketplacePage.waitForPageLoaded();
        await entityDetailsModalAssertion.assertElementState(
          entityDetailsModal,
          'visible',
        );
        await entityDetailsModalAssertion.assertEntityCommonAttributes({
          expectedCredsLabel: Creds.myCreds,
        });
      },
    );

    await dialTest.step('Click on "Edit" icon', async () => {
      await entityDetailsModal.clickEditButton({
        triggeredHttpMethod: 'GET',
      });
      await entityEditorPage.waitForPageLoadedForEdit(
        EntityEditorToolsetTypes.Toolset,
      );
    });

    await dialTest.step(
      'Click on "Log out" btn and verify preview card label is changed, all supported scopes are listed',
      async () => {
        await toolsetEditorViewForm.clickLogoutButton();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'POST' });
        await toolsetEditorSettingsPreviewCardAssertion.assertPreviewCardAttributes(
          {
            expectedName: toolsetEntity.name,
            expectedCredsLabel: Creds.loggedOut,
          },
        );
        await toolsetEditorViewFormAssertion.assertElementText(
          toolsetEditorViewForm.loginButton,
          SignInButtonTitles.logIn,
        );

        await toolsetEditorViewForm
          .oAuthOptionRadioButton(OAuthOptions.WithLoginAndConfig)
          .click();
        const actualSupportedScopes =
          await toolsetEditorViewForm.supportedScopes.getSelectedPillValues(
            true,
          );
        toolsetEditorViewFormAssertion.assertArrayIncludesAll(
          actualSupportedScopes,
          oauthMockHelper.getMockConfig().scopes_supported,
          MarketplaceExpectedMessages.toolsetSupportedScopesAreValid,
        );
      },
    );

    await dialTest.step('Verify log-out request body', async () => {
      const signOutRequest = oauthMockHelper.getSignOutRequest()!;
      toolsetApiAuthenticationAssertion.assertSignOutRequest(signOutRequest, {
        url: initialToolset.id!,
        authType: ToolsetAuthTypes.OAUTH,
        credentialsLevel: ToolsetCredentialsLevel.GLOBAL,
      });
    });

    await dialTest.step(
      "Click on 'Login in' button again and verify toolset is successfully logged-in",
      async () => {
        await toolsetEditorViewForm.clientIdFieldInput.fillInInput(clientId);
        await toolsetEditorViewForm.clientSecretFieldInput.fillInInput(
          clientSecret,
        );
        loginPopup = (await toolsetEditorViewForm.clickLoginButton(
          oauthMockHelper.getMockConfig().authorization_endpoint,
        ))!;
        await oauthMockHelper.navigateToCallback(loginPopup);
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorToolsetTypes.Toolset,
        );
        await toolsetAuthAssertion.assertAuthState(
          oauthMockHelper.getSignInRequest()!,
          initialToolset.id!,
          Creds.myCreds,
          SignInButtonTitles.logOut,
        );
      },
    );

    await dialTest.step(
      'Click on "Log out" btn and proceed to "General Info" step',
      async () => {
        await toolsetEditorViewForm.clickLogoutButton();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'POST' });
        await toolsetEditorSettingsPreviewCardAssertion.assertPreviewCardAttributes(
          {
            expectedName: toolsetEntity.name,
            expectedCredsLabel: Creds.loggedOut,
          },
        );
        await entityEditorHeader.goOnGeneralInfoStepWithHeaderStepper({
          isHttpMethodTriggered: false,
        });
        await entityEditorPage.waitForPageLoaded(
          EntityEditorToolsetTypes.Toolset,
        );
      },
    );

    await dialTest.step('Update toolset version and click Next', async () => {
      //get real toolset object from BE
      realToolset = await itemApiHelper.getItem<Toolset>(initialToolset.id!);

      //intercept toolset routes with a new version
      updatedId = initialToolset.id!.replace(
        toolsetEntity.version,
        updatedVersion,
      );
      await oauthMockHelper.setupUpdatedToolsetRoutes({
        display_version: updatedVersion,
        id: updatedId,
        toolset: updatedId,
      });

      await entityEditorGeneralForm.fillInEntityFields({
        version: updatedVersion,
      });
      await entityEditorGeneralForm.goNext({
        hostsArray: [API.moveHost],
      });
      await entityEditorPage.waitForPageLoadedForEdit(
        EntityEditorToolsetTypes.Toolset,
      );
      //update real toolset version
      realToolset.display_version = updatedVersion;
      await toolsetApiHelper.createToolset(realToolset);
    });

    await dialTest.step(
      "Click on 'Login in' button again and verify toolset is successfully logged-in",
      async () => {
        loginPopup = (await toolsetEditorViewForm.clickLoginButton(
          oauthMockHelper.getMockConfig().authorization_endpoint,
        ))!;
        await oauthMockHelper.navigateToCallback(loginPopup);
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorToolsetTypes.Toolset,
        );
        await toolsetAuthAssertion.assertAuthState(
          oauthMockHelper.getSignInRequest()!,
          updatedId,
          Creds.myCreds,
          SignInButtonTitles.logOut,
        );
      },
    );
  },
);

dialTest(
  'Toolset with OAuth with Login&config can be saved without actual login.\n' +
    '[Toolset]: Scopes for OAuth login& config can be added manually',
  async ({
    marketplacePage,
    entityEditorPage,
    entityEditorHeader,
    entityDetailsModal,
    setTestIds,
    baseAssertion,
    toolsetEditorViewForm,
    toolsetEditorSettingsPreviewCardAssertion,
    toolsetEditorViewFormAssertion,
    entityDetailsModalAssertion,
    entityEditorGeneralForm,
    toolsetApiHelper,
    page,
  }) => {
    setTestIds('EPMDIAL-5386', 'EPMDIAL-5390');
    const toolsetEntity = {
      name: GeneratorUtil.randomToolsetName(),
      version: GeneratorUtil.randomEntityVersion(),
      endpoint: GeneratorUtil.randomUrl(),
    };
    const clientId = GeneratorUtil.randomString(7);
    const clientSecret = GeneratorUtil.randomString(7);
    const scope = 'mcp.write';
    let oauthMockHelper: OAuthMockHelper;
    let initialToolset: Toolset;
    let loginPopup: Page;

    await dialTest.step('Open toolset creation page directly', async () => {
      await marketplacePage.openCreateToolsetPage();
      await entityEditorPage.waitForPageLoaded(
        EntityEditorToolsetTypes.Toolset,
      );
    });

    await dialTest.step(
      'Fill in the required fields and click Next',
      async () => {
        await entityEditorGeneralForm.fillInEntityFields({
          name: toolsetEntity.name,
          version: toolsetEntity.version,
        });
        await entityEditorGeneralForm.goNext({
          hostsArray: [API.toolsetCreateHost(), API.installedToolsetsHost()],
        });
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorToolsetTypes.Toolset,
        );
      },
    );

    await dialTest.step(
      'Fill in Endpoint field, select "With login & config" option, fill in the required fields and set supported scope value',
      async () => {
        await toolsetEditorViewForm.endpoint.fillInInput(
          toolsetEntity.endpoint,
        );
        await toolsetEditorViewForm.oauthContainer.click();
        await toolsetEditorViewForm
          .oAuthOptionRadioButton(OAuthOptions.WithLoginAndConfig)
          .click();
        await toolsetEditorViewForm.clientIdFieldInput.fillInInput(clientId);
        await toolsetEditorViewForm.clientSecretFieldInput.fillInInput(
          clientSecret,
        );
        await toolsetEditorViewForm.supportedScopes.comboboxInput.fillInInput(
          scope,
        );
        //get saved toolset object
        initialToolset = (await toolsetApiHelper.getToolset(
          toolsetEntity.name,
          toolsetEntity.version,
        ))!;
      },
    );

    await dialTest.step('Setup OAuth mocks', async () => {
      oauthMockHelper = new OAuthMockHelper(
        page,
        initialToolset,
        toolsetEntity.endpoint,
        {
          mockOAuthConfig: {
            client_id: clientId,
            client_secret: clientSecret,
            scopes_supported: [scope],
          },
        },
      );
      await oauthMockHelper.setupMocks();
      oauthMockHelper.enableMocking();
    });

    await dialTest.step(
      'Click "Save and Exit" button and verify toolset is created with "Logged out" label',
      async () => {
        await entityEditorHeader.saveAndExitButton.click();
        await baseAssertion.assertElementState(toolsetEditorViewForm, 'hidden');
        await marketplacePage.waitForPageLoaded();
        await entityDetailsModalAssertion.assertElementState(
          entityDetailsModal,
          'visible',
        );
        await entityDetailsModalAssertion.assertEntityCommonAttributes({
          expectedCredsLabel: Creds.loggedOut,
        });
      },
    );

    await dialTest.step(
      'Click on "Edit" icon and verify toolset with specified scope can do login',
      async () => {
        await entityDetailsModal.clickEditButton({
          triggeredHttpMethod: 'GET',
        });
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorToolsetTypes.Toolset,
        );
        await toolsetEditorViewForm
          .oAuthOptionRadioButton(OAuthOptions.WithLoginAndConfig)
          .click();
        await toolsetEditorViewForm.clientSecretFieldInput.fillInInput(
          clientSecret,
        );
        loginPopup = (await toolsetEditorViewForm.clickLoginButton(
          oauthMockHelper.getMockConfig().authorization_endpoint,
        ))!;
        await oauthMockHelper.navigateToCallback(loginPopup);
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorToolsetTypes.Toolset,
        );
        await toolsetEditorSettingsPreviewCardAssertion.assertPreviewCardAttributes(
          { expectedCredsLabel: Creds.myCreds },
        );
        await toolsetEditorViewFormAssertion.assertElementText(
          toolsetEditorViewForm.logoutButton,
          SignInButtonTitles.logOut,
        );
      },
    );

    await dialTest.step('Verify toolset is successfully saved', async () => {
      await entityEditorHeader.saveAndExitButton.click();
      await baseAssertion.assertElementState(toolsetEditorViewForm, 'hidden');
      await marketplacePage.waitForPageLoaded();
      await entityDetailsModalAssertion.assertElementState(
        entityDetailsModal,
        'visible',
      );
    });
  },
);
