import { ToolsetCredentialsLevel, ToolsetTool } from '@/chat/types/toolsets';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  Creds,
  EntityEditorToolsetTypes,
  ExpectedConstants,
  OAuthOptions,
  SignInButtonTitles,
} from '@/src/testData';
import { OAuthMockHelper } from '@/src/testData/toolsets/oauthMockHelper';
import { Attributes, ThemeColorAttributes } from '@/src/ui/domData';
import { GeneratorUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { Toolset, ToolsetAuthTypes } from '@epam/ai-dial-shared';
import { Page } from '@playwright/test';

dialTest(
  'Create toolset with OAuth (without configuration).\n' +
    '[Toolset]:Successful OAuth login after updating name and version for toolset (with login).\n' +
    'Change endpoint with OAuth to another endpoint with OAuth',
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
    confirmationDialogAssertion,
    toolsetApiHelper,
    itemApiHelper,
    toolsetApiAuthenticationAssertion,
    page,
  }) => {
    setTestIds('EPMDIAL-5369', 'EPMDIAL-5382', 'EPMDIAL-5375');
    const toolsetEntity = {
      name: GeneratorUtil.randomToolsetName(),
      version: GeneratorUtil.randomEntityVersion(),
      endpoint: GeneratorUtil.randomUrl(),
    };
    const updatedName = GeneratorUtil.randomToolsetName();
    const updatedVersion = GeneratorUtil.randomEntityVersion();
    const updatedEndpoint = GeneratorUtil.randomUrl();
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
      'Fill in Endpoint field and select OAuth Authentication option',
      async () => {
        await toolsetEditorViewForm.endpoint.fillInInput(
          toolsetEntity.endpoint,
        );
        await toolsetEditorViewForm.oauthContainer.click();
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
      );
      await oauthMockHelper.setupMocks();
    });

    await dialTest.step(
      "Click 'Login in' button for 'With login' option",
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

    await dialTest.step(
      'Click on "Edit" icon and navigate to "General info" step',
      async () => {
        await entityDetailsModal.clickEditButton({
          triggeredHttpMethod: 'GET',
        });
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorToolsetTypes.Toolset,
        );
        await entityEditorHeader.goOnGeneralInfoStepWithHeaderStepper({
          isHttpMethodTriggered: false,
        });
        await entityEditorPage.waitForPageLoaded(
          EntityEditorToolsetTypes.Toolset,
        );
      },
    );

    await dialTest.step('Update toolset name and click Next', async () => {
      const toolsetId = oauthMockHelper.getToolset().id!;

      //intercept toolset routes with a new name
      updatedId = toolsetId.replace(toolsetEntity.name, updatedName);
      await oauthMockHelper.setupUpdatedToolsetRoutes({
        display_name: updatedName,
        id: updatedId,
        toolset: updatedId,
      });

      await entityEditorGeneralForm.fillInEntityFields({
        name: updatedName,
      });
      await entityEditorGeneralForm.goNext({
        hostsArray: [API.moveHost],
      });
      await entityEditorPage.waitForPageLoadedForEdit(
        EntityEditorToolsetTypes.Toolset,
      );
    });

    await dialTest.step(
      'Click on "Log out" btn and verify preview card label is changed',
      async () => {
        await toolsetEditorViewForm.clickLogoutButton();
        await confirmationDialogAssertion.assertConfirmationDialogTitle(
          ExpectedConstants.logOutDialogTitle,
        );
        await confirmationDialogAssertion.assertConfirmationMessage(
          ExpectedConstants.logOutDialogMessage,
        );
        await confirmationDialogAssertion.assertElementText(
          confirmationDialog.confirmButton,
          ExpectedConstants.logOutDialogButtonLabel,
        );
        await confirmationDialog.confirm({ triggeredHttpMethod: 'POST' });
        await toolsetEditorSettingsPreviewCardAssertion.assertPreviewCardAttributes(
          { expectedName: updatedName, expectedCredsLabel: Creds.loggedOut },
        );
        await toolsetEditorViewFormAssertion.assertElementText(
          toolsetEditorViewForm.loginButton,
          SignInButtonTitles.logIn,
        );
      },
    );

    await dialTest.step('Verify log-out request body', async () => {
      const signOutRequest = oauthMockHelper.getSignOutRequest()!;
      toolsetApiAuthenticationAssertion.assertSignOutRequest(signOutRequest, {
        url: updatedId,
        authType: ToolsetAuthTypes.OAUTH,
        credentialsLevel: ToolsetCredentialsLevel.GLOBAL,
      });
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

    await dialTest.step(
      'Click on "Log out" btn and proceed to "General Info" step',
      async () => {
        await toolsetEditorViewForm.clickLogoutButton();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'POST' });
        await toolsetEditorSettingsPreviewCardAssertion.assertPreviewCardAttributes(
          { expectedName: updatedName, expectedCredsLabel: Creds.loggedOut },
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
      //intercept toolset routes with a new version
      updatedId = updatedId.replace(toolsetEntity.version, updatedVersion);
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
      realToolset = await itemApiHelper.getItem<Toolset>(updatedId);
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

    await dialTest.step(
      'Click on "Log out" btn and set a new endpoint value',
      async () => {
        await toolsetEditorViewForm.clickLogoutButton();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'POST' });
        await toolsetEditorSettingsPreviewCardAssertion.assertPreviewCardAttributes(
          { expectedName: updatedName, expectedCredsLabel: Creds.loggedOut },
        );
        await toolsetEditorViewForm.endpoint.fillInInput(updatedEndpoint);
      },
    );

    await dialTest.step(
      "Click on 'Login in' button again and verify toolset is successfully logged-in",
      async () => {
        //get real toolset object from BE
        realToolset = await itemApiHelper.getItem<Toolset>(updatedId);

        //intercept toolset routes with a new endpoint
        await oauthMockHelper.setupUpdatedToolsetRoutes({
          endpoint: updatedEndpoint,
        });

        //update real toolset endpoint
        realToolset.endpoint = updatedEndpoint;
        await toolsetApiHelper.createToolset(realToolset);
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

    await dialTest.step('Cleanup mocking', async () => {
      await oauthMockHelper.cleanup();
    });
  },
);

dialTest(
  'Toolset with OAuth with Login can be saved without actual login.\n' +
    '[Toolset]: Available login options for OAuth.\n' +
    'Without login option is not displayed for OAuth authentication type.\n' +
    '[Toolset]: successful second and further OAuth login when login via Toolset Editor',
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
    confirmationDialog,
    page,
  }) => {
    setTestIds('EPMDIAL-5387', 'EPMDIAL-5385', 'EPMDIAL-5388', 'EPMDIAL-5384');
    const toolsetEntity = {
      name: GeneratorUtil.randomToolsetName(),
      version: GeneratorUtil.randomEntityVersion(),
      endpoint: GeneratorUtil.randomUrl(),
    };
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
      'Fill in Endpoint field and select OAuth Authentication option',
      async () => {
        await toolsetEditorViewForm.endpoint.fillInInput(
          toolsetEntity.endpoint,
        );
        await toolsetEditorViewForm.oauthContainer.click();
        //get saved toolset object
        initialToolset = (await toolsetApiHelper.getToolset(
          toolsetEntity.name,
          toolsetEntity.version,
        ))!;
      },
    );

    await dialTest.step(
      'Verify only 2 options are available for OAuth authentication type, "With login" option is checked by default',
      async () => {
        await toolsetEditorViewFormAssertion.assertElementText(
          toolsetEditorViewForm.oAuthOptions,
          [OAuthOptions.WithLogin, OAuthOptions.WithLoginAndConfig],
        );
        await toolsetEditorViewFormAssertion.assertElementAttribute(
          toolsetEditorViewForm.oAuthOption(OAuthOptions.WithLogin),
          Attributes.checked,
          '',
        );
      },
    );

    await dialTest.step('Setup OAuth mocks', async () => {
      oauthMockHelper = new OAuthMockHelper(
        page,
        initialToolset,
        toolsetEntity.endpoint,
      );
      await oauthMockHelper.setupToolsetRoutes();
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
      'Click on "Edit" icon and login the toolset',
      async () => {
        await entityDetailsModal.clickEditButton({
          triggeredHttpMethod: 'GET',
        });
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorToolsetTypes.Toolset,
        );

        await oauthMockHelper.setupMocks();

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

    await dialTest.step('Log-out the toolset', async () => {
      await toolsetEditorViewForm.clickLogoutButton();
      await confirmationDialog.confirm({ triggeredHttpMethod: 'POST' });
      await toolsetEditorSettingsPreviewCardAssertion.assertPreviewCardAttributes(
        {
          expectedName: toolsetEntity.name,
          expectedCredsLabel: Creds.loggedOut,
        },
      );
    });

    await dialTest.step(
      'Login the toolset again and verify it is successful',
      async () => {
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
  },
);

dialTest(
  "[Toolset]: allowed tools are displayed in Toolset editor after toolset's login",
  async ({
    marketplacePage,
    entityEditorPage,
    setTestIds,
    toolsetEditorViewForm,
    toolsetEditorViewFormAssertion,
    toolsetEditorSettingsPreviewCardAssertion,
    entityEditorGeneralForm,
    confirmationDialog,
    toolsetApiHelper,
    page,
  }) => {
    setTestIds('EPMDIAL-5400');
    const toolsetEntity = {
      name: GeneratorUtil.randomToolsetName(),
      version: GeneratorUtil.randomEntityVersion(),
      endpoint: GeneratorUtil.randomUrl(),
    };
    let initialToolset: Toolset;
    let loginPopup: Page;
    const toolNames = ['search_pages', 'create_page', 'update_page'];
    const tools: ToolsetTool[] = toolNames.map((name) => ({
      name,
      title: name,
    }));
    let oauthMockHelper: OAuthMockHelper;

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
      'Fill in Endpoint field and select OAuth Authentication option',
      async () => {
        await toolsetEditorViewForm.endpoint.fillInInput(
          toolsetEntity.endpoint,
        );
        await toolsetEditorViewForm.oauthContainer.click();
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
      );
      await oauthMockHelper.setupMocks();
      await oauthMockHelper.setupToolsetToolsRoute(tools);
    });

    await dialTest.step(
      "Click 'Login in' button for 'With login' option",
      async () => {
        // need to enable mocking before clicking 'Log In'
        oauthMockHelper.enableMocking();
        // store popup — it's needed in the 'Navigate to OAuth callback' step below
        loginPopup = (await toolsetEditorViewForm.clickLoginButton(
          oauthMockHelper.getMockConfig().authorization_endpoint,
        ))!;
      },
    );

    await dialTest.step(
      'Navigate to OAuth callback and wait for sign-in API was called',
      async () => {
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

    await dialTest.step(
      'Click on Allowed tools drop-down and verify the list of available tools is displayed',
      async () => {
        await toolsetEditorViewForm.allowedTools.openMenu();
        const displayedTools = await toolsetEditorViewForm.allowedTools
          .getListboxMenu()
          .getAllOptions();
        toolsetEditorViewFormAssertion.assertValuesAreEqual(
          displayedTools,
          toolNames,
        );
      },
    );

    await dialTest.step(
      'Click on "Log out" btn and verify preview card label is changed',
      async () => {
        await toolsetEditorViewForm.clickLogoutButton();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'POST' });
        await toolsetEditorSettingsPreviewCardAssertion.assertPreviewCardAttributes(
          { expectedCredsLabel: Creds.loggedOut },
        );
        await toolsetEditorViewFormAssertion.assertElementText(
          toolsetEditorViewForm.loginButton,
          SignInButtonTitles.logIn,
        );
      },
    );

    await dialTest.step(
      'Reload the browser and verify Allowed tools field is empty',
      async () => {
        await entityEditorPage.reloadPage();
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorToolsetTypes.Toolset,
        );
        await toolsetEditorViewForm.allowedTools.openMenu();
        const displayedTools = await toolsetEditorViewForm.allowedTools
          .getListboxMenu()
          .getAllOptions();
        toolsetEditorViewFormAssertion.assertValuesAreEqual(displayedTools, []);
      },
    );
  },
);
