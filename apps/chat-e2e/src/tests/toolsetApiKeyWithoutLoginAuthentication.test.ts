import { MarketplaceI18nKeys } from '@/chat/constants/i18n';
import { ToolsetCredentialsLevel } from '@/chat/types/toolsets';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  Creds,
  EntityEditorToolsetTypes,
  ExpectedConnectToolsetModalData,
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  OAuthOptions,
} from '@/src/testData';
import { ApiKeyMockHelper } from '@/src/testData/toolsets/apiKeyMockHelper';
import { BaseElement } from '@/src/ui/webElements';
import { GeneratorUtil } from '@/src/utils';
import { Toolset, ToolsetAuthTypes } from '@epam/ai-dial-shared';

dialTest(
  'Create toolset with API key without login. Confirmation form.\n' +
    '[Toolsets] Create toolset with API key without login.\n' +
    'Login from card detailed view to toolset with API key from My workspace.\n' +
    '[Toolset]: api key value is hidden with dots in login modal form.\n' +
    'Logout from card detailed view menu for toolset with API key from My workspace.\n' +
    '[Toolset][Connect]: connect button for not public toolset.\n' +
    '[Toolset]: Connect button is available for logged out toolset.\n' +
    '[Toolset]: Connect link format.\n' +
    '[Toolset]: Connect section is available in Toolset editor for not public toolset',
  async ({
    marketplacePage,
    entityEditorPage,
    entityEditorHeader,
    entityDetailsModal,
    setTestIds,
    toolsetLoginModalAssertion,
    toolsetLoginModal,
    toolsetEditorViewForm,
    toolsetEditorViewFormAssertion,
    entityDetailsModalAssertion,
    entityEditorGeneralForm,
    confirmationDialog,
    confirmationDialogAssertion,
    toolsetApiHelper,
    toolsetApiAuthenticationAssertion,
    connectToolsetModal,
    baseAssertion,
    page,
  }) => {
    setTestIds(
      'EPMDIAL-5403',
      'EPMDIAL-5402',
      'EPMDIAL-5405',
      'EPMDIAL-5411',
      'EPMDIAL-5408',
      'EPMDIAL-5620',
      'EPMDIAL-5623',
      'EPMDIAL-5624',
      'EPMDIAL-5626',
    );
    const toolsetEntity = {
      name: GeneratorUtil.randomToolsetName(),
      version: GeneratorUtil.randomEntityVersion(),
      endpoint: GeneratorUtil.randomUrl(),
      apiKey: GeneratorUtil.randomString(7),
    };
    let apiKeyMockHelper: ApiKeyMockHelper;
    let initialToolset: Toolset;
    let savedToolset: Toolset;

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
      'Verify Connect toolset section is visible in the editor with title, hint and Copy URL button',
      async () => {
        await toolsetEditorViewFormAssertion.assertElementState(
          toolsetEditorViewForm.connectToolsetLabel,
          'visible',
        );
        await toolsetEditorViewFormAssertion.assertElementText(
          toolsetEditorViewForm.connectToolsetLabel,
          'Connect toolset',
        );
        await toolsetEditorViewFormAssertion.assertElementState(
          toolsetEditorViewForm.connectToolsetHint,
          'visible',
        );
        await toolsetEditorViewFormAssertion.assertElementText(
          toolsetEditorViewForm.connectToolsetHint,
          'Copy endpoint URL to easily integrate toolset into your workflows',
        );
        await toolsetEditorViewFormAssertion.assertElementState(
          toolsetEditorViewForm.copyUrlButton,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Click Copy URL button in editor and verify URL is copied to clipboard',
      async () => {
        savedToolset = (await toolsetApiHelper.getToolset(
          toolsetEntity.name,
          toolsetEntity.version,
        ))!;
        const copiedUrl = await marketplacePage.captureNextClipboardWrite(() =>
          toolsetEditorViewForm.copyUrlButton.click(),
        );
        toolsetEditorViewFormAssertion.assertValueMatchPattern(
          copiedUrl,
          ExpectedConstants.copyToolsetUrlPattern(savedToolset),
        );
      },
    );

    await dialTest.step(
      'Fill in Endpoint field and select API Key without login authentication option',
      async () => {
        await toolsetEditorViewForm.endpoint.fillInInput(
          toolsetEntity.endpoint,
        );
        await toolsetEditorViewForm.apiKeyContainer.click();
        await toolsetEditorViewForm
          .oAuthOptionRadioButton(OAuthOptions.WithoutLogin)
          .click();
      },
    );

    await dialTest.step(
      "Check that the required field 'API Key parameter name' appears",
      async () => {
        const fieldRequiredIndicator =
          toolsetEditorViewForm.getRequiredIndicator(
            ExpectedConstants.apiKeyParameterNameLabel,
          );
        await toolsetEditorViewFormAssertion.assertElementState(
          fieldRequiredIndicator,
          'visible',
          ExpectedMessages.entityFormFieldShouldHaveAsterisk,
        );
      },
    );

    await dialTest.step(
      'Try to save the toolset and verify the warning appears under the required field, confirmation modal is displayed',
      async () => {
        await entityEditorHeader.saveAndExitButton.click();
        await confirmationDialogAssertion.assertElementState(
          confirmationDialog,
          'visible',
        );
        await confirmationDialog.cancelDialog();
        await toolsetEditorViewFormAssertion.assertElementState(
          toolsetEditorViewForm.apiKeyParameterNameFieldError,
          'visible',
        );
        await toolsetEditorViewFormAssertion.assertElementText(
          toolsetEditorViewForm.apiKeyParameterNameFieldError,
          ExpectedConstants.apiKeyFieldRequiredError,
        );
      },
    );

    await dialTest.step(
      'Set key name field, save the toolset and verify logged-out toolset is successfully created',
      async () => {
        await toolsetEditorViewForm.apiKeyParameterNameFieldInput.fillInInput(
          GeneratorUtil.randomString(5),
        );
        await entityEditorHeader.saveAndExitButton.click();
        await toolsetEditorViewFormAssertion.assertElementState(
          toolsetEditorViewForm,
          'hidden',
        );
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
      'Click Connect button and verify Connect toolset modal is displayed',
      async () => {
        await entityDetailsModal.connectButton.click();
        await baseAssertion.assertElementState(connectToolsetModal, 'visible');
        await baseAssertion.assertElementText(
          connectToolsetModal.header,
          ExpectedConnectToolsetModalData.header,
        );
      },
    );

    await dialTest.step(
      'Click Copy URL button and verify URL is copied to clipboard',
      async () => {
        const copiedUrl = await marketplacePage.captureNextClipboardWrite(() =>
          connectToolsetModal.copyUrlButton.click(),
        );
        baseAssertion.assertValueMatchPattern(
          copiedUrl,
          ExpectedConstants.copyToolsetUrlPattern(savedToolset),
        );
        await connectToolsetModal.getCloseButton().click();
        await baseAssertion.assertElementState(connectToolsetModal, 'hidden');
      },
    );

    await dialTest.step(
      'Click on "Log in" btn and verify "Login" modal is displayed',
      async () => {
        await entityDetailsModal.loginButton.click();
        await toolsetLoginModalAssertion.assertElementState(
          toolsetLoginModal,
          'visible',
        );
        await toolsetLoginModalAssertion.assertModalAttributes({
          expectedName: toolsetEntity.name,
          expectedVersion: toolsetEntity.version,
          expectedDefaultIconState: 'visible',
          expectedLogInBtnState: 'disabled',
        });
      },
    );

    await dialTest.step(
      'Set an Api Key, click on "eye" icon and verify input is unmasked',
      async () => {
        await toolsetLoginModal.apiKeyMaskedFieldInput.fillInInput(
          toolsetEntity.apiKey,
        );
        await toolsetLoginModal.apiKeyFieldMaskedIcon.click();
        await toolsetLoginModalAssertion.assertModalAttributes({
          expectedApiKeyFieldValue: toolsetEntity.apiKey,
        });
      },
    );

    await dialTest.step('Setup ApiKey mocks', async () => {
      //get saved toolset object
      initialToolset = (await toolsetApiHelper.getToolset(
        toolsetEntity.name,
        toolsetEntity.version,
      ))!;

      apiKeyMockHelper = new ApiKeyMockHelper(
        page,
        initialToolset,
        toolsetEntity.endpoint,
      );
      await apiKeyMockHelper.setupMocks();
      apiKeyMockHelper.enableMocking();
    });

    await dialTest.step(
      'Click on "Log in" btn and verify toolset is successfully logged-in',
      async () => {
        await toolsetLoginModal.loginButton.click();
        await toolsetLoginModalAssertion.assertElementState(
          toolsetLoginModal,
          'hidden',
        );
        await entityDetailsModalAssertion.assertEntityCommonAttributes({
          expectedCredsLabel: Creds.myCreds,
        });
      },
    );

    await dialTest.step('Validate sign-in request payload', async () => {
      const signInRequest = apiKeyMockHelper.getSignInRequest()!;
      toolsetApiAuthenticationAssertion.assertSignInRequest(signInRequest, {
        url: initialToolset.id!,
        authType: ToolsetAuthTypes.API_KEY,
        credentialsLevel: ToolsetCredentialsLevel.GLOBAL,
        apiKey: toolsetEntity.apiKey,
      });
    });

    await dialTest.step(
      'Click on "Log out" btn and verify confirmation modal is displayed',
      async () => {
        await entityDetailsModal.logoutButton.click();
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
      },
    );

    await dialTest.step(
      'Confirm and verify toolset is successfully logged-out',
      async () => {
        await confirmationDialog.confirm({ triggeredHttpMethod: 'POST' });
        await entityDetailsModalAssertion.assertEntityCommonAttributes({
          expectedCredsLabel: Creds.loggedOut,
        });
      },
    );

    await dialTest.step('Verify log-out request body', async () => {
      const signOutRequest = apiKeyMockHelper.getSignOutRequest()!;
      toolsetApiAuthenticationAssertion.assertSignOutRequest(signOutRequest, {
        url: initialToolset.id!,
        authType: ToolsetAuthTypes.API_KEY,
        credentialsLevel: ToolsetCredentialsLevel.GLOBAL,
      });
    });
  },
);

dialTest(
  '[Toolsets] Login from context menu to toolset with API key from Marketplace',
  async ({
    marketplacePage,
    marketplaceHeader,
    marketplaceEntitiesSection,
    marketplaceEntities,
    toolsetBuilder,
    toolsetApiHelper,
    toolsetLoginModal,
    toolsetLoginModalAssertion,
    tooltipAssertion,
    baseAssertion,
    setTestIds,
    page,
  }) => {
    setTestIds('EPMDIAL-5404');
    const toolsetEntity = {
      name: GeneratorUtil.randomToolsetName(),
      version: GeneratorUtil.randomEntityVersion(),
      endpoint: GeneratorUtil.randomUrl(),
      apiKeyHeader: GeneratorUtil.randomString(5),
      apiKey: GeneratorUtil.randomString(7),
    };
    let initialToolset: Toolset;
    let toolsetElement: BaseElement;
    let apiKeyMockHelper: ApiKeyMockHelper;

    await dialTest.step(
      'Precondition: Create a toolset with API key auth type, without login, via API',
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

    await dialTest.step('Setup ApiKey mocks', async () => {
      apiKeyMockHelper = new ApiKeyMockHelper(
        page,
        initialToolset,
        toolsetEntity.endpoint,
      );
      await apiKeyMockHelper.setupMocks();
      apiKeyMockHelper.enableMocking();
    });

    await dialTest.step(
      'Open Marketplace Toolsets tab and find the toolset in "Logged out" state',
      async () => {
        await marketplacePage.openToolsetsPage();
        await marketplaceHeader
          .getSearch()
          .inputField.fillInInput(toolsetEntity.name);
        toolsetElement = await marketplaceEntitiesSection.findEntityElement(
          toolsetEntity.name,
        );
        await baseAssertion.assertElementText(
          marketplaceEntities.getEntityElementCredentials(toolsetElement),
          Creds.loggedOut,
        );
      },
    );

    await dialTest.step(
      'Hover over the toolset card, click 3-dots context menu and select "Log in" option',
      async () => {
        await toolsetElement.hoverOver();
        await marketplaceEntities
          .getEntityElementDotsMenu(toolsetElement)
          .click();
        await marketplaceEntities
          .getEntityDropdownMenu()
          .selectMenuOption(MenuOptions.login);
      },
    );

    await dialTest.step(
      'Verify the Login modal is displayed with the expected title, version, API key field, tooltip and disabled "Log in" button',
      async () => {
        await toolsetLoginModalAssertion.assertElementState(
          toolsetLoginModal,
          'visible',
        );
        await toolsetLoginModalAssertion.assertModalAttributes({
          expectedName: toolsetEntity.name,
          expectedVersion: toolsetEntity.version,
          expectedDefaultIconState: 'visible',
          expectedLogInBtnState: 'disabled',
        });

        await toolsetLoginModal.apiKeyFieldHelpIcon.hoverOver();
        await tooltipAssertion.assertTooltipContent(
          MarketplaceI18nKeys.EnterApiKeyForHeader.replace(
            '{{header}}',
            toolsetEntity.apiKeyHeader,
          ),
        );
      },
    );

    await dialTest.step(
      'Input API key value and verify the "Log in" button becomes enabled',
      async () => {
        await toolsetLoginModal.apiKeyMaskedFieldInput.fillInInput(
          toolsetEntity.apiKey,
        );
        await toolsetLoginModalAssertion.assertModalAttributes({
          expectedLogInBtnState: 'enabled',
        });
      },
    );

    await dialTest.step(
      'Click "Log in" button and verify the modal is closed and the toolset state changed to "My Creds"',
      async () => {
        await toolsetLoginModal.loginButton.click();
        await toolsetLoginModalAssertion.assertElementState(
          toolsetLoginModal,
          'hidden',
        );
        await baseAssertion.assertElementText(
          marketplaceEntities.getEntityElementCredentials(toolsetElement),
          Creds.myCreds,
        );
      },
    );
  },
);
