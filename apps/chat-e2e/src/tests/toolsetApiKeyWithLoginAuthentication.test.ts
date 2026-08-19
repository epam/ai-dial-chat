import { ToolsetCredentialsLevel, ToolsetTool } from '@/chat/types/toolsets';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  Creds,
  EntityEditorToolsetTypes,
  SignInButtonTitles,
} from '@/src/testData';
import { ApiKeyMockHelper } from '@/src/testData/toolsets/apiKeyMockHelper';
import { GeneratorUtil } from '@/src/utils';
import { Toolset, ToolsetAuthTypes } from '@epam/ai-dial-shared';

dialTest(
  "[Toolset]: allowed tools are displayed in Toolset editor after toolset's login (API key)",
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
    toolsetApiAuthenticationAssertion,
    page,
  }) => {
    setTestIds('EPMDIAL-5415');
    const toolsetEntity = {
      name: GeneratorUtil.randomToolsetName(),
      version: GeneratorUtil.randomEntityVersion(),
      endpoint: GeneratorUtil.randomUrl(),
      apiKeyHeader: GeneratorUtil.randomString(5),
      apiKey: GeneratorUtil.randomString(7),
    };
    let initialToolset: Toolset;
    let apiKeyMockHelper: ApiKeyMockHelper;
    const toolNames = ['search_pages', 'create_page', 'update_page'];
    const tools: ToolsetTool[] = toolNames.map((name) => ({
      name,
      title: name,
    }));

    await dialTest.step('Open toolset creation page directly', async () => {
      await marketplacePage.openCreateToolsetPage();
      await entityEditorPage.waitForPageLoaded(
        EntityEditorToolsetTypes.Toolset,
      );
    });

    await dialTest.step('Fill in name and version and click Next', async () => {
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
    });

    await dialTest.step(
      'Fill in Endpoint field and select API key Authentication option',
      async () => {
        await toolsetEditorViewForm.endpoint.fillInInput(
          toolsetEntity.endpoint,
        );
        await toolsetEditorViewForm.apiKeyContainer.click();
        //get saved toolset object
        initialToolset = (await toolsetApiHelper.getToolset(
          toolsetEntity.name,
          toolsetEntity.version,
        ))!;
      },
    );

    await dialTest.step('Setup ApiKey mocks', async () => {
      apiKeyMockHelper = new ApiKeyMockHelper(
        page,
        {
          ...initialToolset,
          auth_settings: {
            ...initialToolset.auth_settings,
            api_key_header: toolsetEntity.apiKeyHeader,
          },
        },
        toolsetEntity.endpoint,
      );
      await apiKeyMockHelper.setupMocks();
      await apiKeyMockHelper.setupToolsetToolsRoute(tools);
      apiKeyMockHelper.enableMocking();
    });

    await dialTest.step(
      'Fill in API key credentials and click "Log in" button',
      async () => {
        await toolsetEditorViewForm.apiKeyParameterNameFieldInput.fillInInput(
          toolsetEntity.apiKeyHeader,
        );
        await toolsetEditorViewForm.apiKeyParameterValueFieldInput.fillInInput(
          toolsetEntity.apiKey,
        );
        await toolsetEditorViewForm.clickLoginButton();
      },
    );

    await dialTest.step(
      'Verify preview card contains "creds" label and validate sign-in request payload',
      async () => {
        await toolsetEditorSettingsPreviewCardAssertion.assertPreviewCardAttributes(
          { expectedCredsLabel: Creds.myCreds },
        );
        await toolsetEditorViewFormAssertion.assertElementText(
          toolsetEditorViewForm.logoutButton,
          SignInButtonTitles.logOut,
        );
        const signInRequest = apiKeyMockHelper.getSignInRequest()!;
        toolsetApiAuthenticationAssertion.assertSignInRequest(signInRequest, {
          url: initialToolset.id!,
          authType: ToolsetAuthTypes.API_KEY,
          credentialsLevel: ToolsetCredentialsLevel.GLOBAL,
          apiKey: toolsetEntity.apiKey,
        });
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
