import { Routes } from '@/chat/constants/routes';
import { ToolsetCredentialsLevel } from '@/chat/types/toolsets';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  Creds,
  EntityEditorToolsetTypes,
  OAuthQueryParams,
} from '@/src/testData';
import { OAuthMockHelper } from '@/src/testData/toolsets/oauthMockHelper';
import { ThemeColorAttributes } from '@/src/ui/domData';
import { GeneratorUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { Toolset, ToolsetAuthTypes } from '@epam/ai-dial-shared';

dialTest(
  'Create toolset with OAuth (without configuration)',
  async ({
    marketplacePage,
    entityEditorPage,
    entityEditorHeader,
    entityDetailsModal,
    setTestIds,
    baseAssertion,
    toolsetEditorViewForm,
    toolsetEditorSettingsPreviewCard,
    toolsetEditorSettingsPreviewCardAssertion,
    entityDetailsModalAssertion,
    entityEditorGeneralForm,
    toolsetApiHelper,
    page,
  }) => {
    setTestIds('EPMRTC-6969');
    const toolsetEntity = {
      name: GeneratorUtil.randomToolsetName(),
      version: GeneratorUtil.randomEntityVersion(),
      endpoint: GeneratorUtil.randomUrl(),
    };
    let oauthMockHelper: OAuthMockHelper;
    let initialToolset: Toolset;

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
        await toolsetEditorViewForm.signInButton.click();
        await oauthMockHelper.waitForOAuthRedirect();
      },
    );

    await dialTest.step('Verify OAuth redirect query', async () => {
      const state = oauthMockHelper.getState();
      const redirectUrl = new URL(state.capturedOAuthUrl!);
      const params = redirectUrl.searchParams;
      const mockConfig = oauthMockHelper.getMockConfig();

      baseAssertion.assertValueIsNotUndefined(state.capturedState);
      baseAssertion.assertValue(
        params.get(OAuthQueryParams.responseType),
        'code',
      );
      baseAssertion.assertValue(
        params.get(OAuthQueryParams.codeChallengeMethod),
        mockConfig.code_challenge_method,
      );
      baseAssertion.assertValue(
        params.get(OAuthQueryParams.clientId),
        mockConfig.client_id,
      );
      baseAssertion.assertStringIncludes(
        params.get(OAuthQueryParams.redirectUri)!,
        Routes.ToolsetSignIn,
      );
      baseAssertion.assertValue(
        params.get(OAuthQueryParams.scope),
        mockConfig.scopes_supported.join(' '),
      );
    });

    await dialTest.step(
      'Navigate to OAuth callback and wait for sign-in API was called',
      async () => {
        await oauthMockHelper.navigateToCallback();
        await oauthMockHelper.waitForSignInApiCall();
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorToolsetTypes.Toolset,
        );
      },
    );

    await dialTest.step('Validate sign-in request payload', async () => {
      const signInRequest = oauthMockHelper.getSignInRequest()!;
      baseAssertion.assertValue(signInRequest.url, initialToolset.id);
      baseAssertion.assertValue(
        signInRequest.authenticationType,
        ToolsetAuthTypes.OAUTH,
      );
      baseAssertion.assertValue(
        signInRequest.credentialsLevel,
        ToolsetCredentialsLevel.GLOBAL,
      );
      baseAssertion.assertValue(
        signInRequest.code,
        oauthMockHelper.getAuthorizationCode(),
      );
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
      },
    );

    await dialTest.step('Wait for redirect back to editor', async () => {
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
    });

    await dialTest.step('Cleanup mocking', async () => {
      await oauthMockHelper.cleanup();
    });
  },
);
