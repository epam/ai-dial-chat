import { Publication } from '@/chat/types/publication';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  EntityEditorAppTypes,
  ExpectedConstants,
  MenuOptions,
  MockedChatApiResponseBodies,
} from '@/src/testData';
import { ApiKeyMockHelper } from '@/src/testData/toolsets/apiKeyMockHelper';
import { OAuthMockHelper } from '@/src/testData/toolsets/oauthMockHelper';
import { ToolsetSignInMockHelper } from '@/src/testData/toolsets/toolsetSignInMockHelper';
import { GeneratorUtil } from '@/src/utils';
import { PublishActions, Toolset } from '@epam/ai-dial-shared';

dialAdminTest(
  '[Quick app 2.0] Manage credentials form is available for public toolsets from Quick app 2.0 editor', // EPMRTC-7997
  async ({
    toolsetBuilder,
    toolsetApiHelper,
    publicationApiHelper,
    adminPublicationApiHelper,
    adminUserItemApiHelper,
    publishRequestBuilder,
    adminPage,
    adminMarketplacePage,
    adminEntityEditorPage,
    adminEntityEditorGeneralForm,
    adminQuickApp2EditorViewForm,
    adminAgentAndToolsetSelectModal,
    adminAgentAndToolsetSelectModalEntityMenuAssertion,
    adminEntityDetailsModal,
    baseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-7997');
    const toolsetName = GeneratorUtil.randomToolsetName();
    const toolsetEndpoint = GeneratorUtil.randomUrl();
    const quickAppName = GeneratorUtil.randomApplicationName();
    let initialToolset: Toolset;
    let publishedToolset: Toolset;

    await dialAdminTest.step(
      'Precondition: create and publish a public toolset',
      async () => {
        await toolsetApiHelper.createToolset(
          toolsetBuilder.withDisplayName(toolsetName).build(),
        );
        initialToolset = (await toolsetApiHelper.getToolset(toolsetName))!;

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
      'Make the public toolset appear as supporting login (mock its auth settings)',
      async () => {
        // The backend rejects a toolset with a real OAuth endpoint, so — like the
        // other login tests — inject auth_settings into the toolset listing.
        // No login is performed; we only check the Manage creds controls show up.
        const oauthMock = new OAuthMockHelper(
          adminPage,
          publishedToolset,
          toolsetEndpoint,
        );
        await oauthMock.setupToolsetListingRoute();
        oauthMock.enableMocking();
      },
    );

    await dialAdminTest.step(
      'Admin opens Quick app 2.0 creation and proceeds to App settings',
      async () => {
        await adminMarketplacePage.openCreateQuickApp2Page({
          updateInstalledEntities: false,
        });
        await adminEntityEditorPage.waitForPageLoaded(
          EntityEditorAppTypes.QuickApp2,
        );
        await adminEntityEditorGeneralForm.fillInEntityFields({
          name: quickAppName,
        });
        await adminEntityEditorGeneralForm.goNext();
        await adminEntityEditorPage.waitForPageLoadedForEdit(
          EntityEditorAppTypes.QuickApp2,
        );
      },
    );

    await dialAdminTest.step(
      'Open the Agents & Toolsets picker and find the public toolset',
      async () => {
        await adminQuickApp2EditorViewForm.addAgentsButton.click();
        await baseAssertion.assertElementState(
          adminAgentAndToolsetSelectModal,
          'visible',
        );
        // The public toolset lives on the Marketplace tab.
        await adminAgentAndToolsetSelectModal.marketplaceTab.click();
        await adminAgentAndToolsetSelectModal.searchInput.fillInInput(
          toolsetName,
        );
        await baseAssertion.assertElementState(
          adminAgentAndToolsetSelectModal.getEntityByName(toolsetName),
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      "Open the toolset card's context menu and verify Manage creds option is available",
      async () => {
        const toolsetCard =
          adminAgentAndToolsetSelectModal.getEntityByName(toolsetName);
        const dotsMenu = adminAgentAndToolsetSelectModal
          .getEntities()
          .getEntityElementDotsMenu(toolsetCard);
        await toolsetCard.hoverOver();
        await dotsMenu.click();
        await adminAgentAndToolsetSelectModalEntityMenuAssertion.assertMenuIncludesOptions(
          MenuOptions.manageCreds,
        );
        // Close the menu so the next card click selects instead of dismissing it.
        await dotsMenu.click();
      },
    );

    await dialAdminTest.step(
      'Add the toolset and verify it is displayed in the Agents & Toolsets field',
      async () => {
        await adminAgentAndToolsetSelectModal.selectEntityByName(toolsetName);
        await adminAgentAndToolsetSelectModal.confirmButton.click();
        await baseAssertion.assertElementState(
          adminAgentAndToolsetSelectModal,
          'hidden',
        );
        await baseAssertion.assertElementState(
          adminQuickApp2EditorViewForm.getChipByName(toolsetName),
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      "Open the toolset's card from the field and verify the Manage creds button",
      async () => {
        await adminQuickApp2EditorViewForm.clickChipByName(toolsetName);
        await baseAssertion.assertElementState(
          adminEntityDetailsModal,
          'visible',
        );
        await baseAssertion.assertElementState(
          adminEntityDetailsModal.manageCredsButton,
          'visible',
        );
      },
    );
  },
);

dialTest(
  '[Quick app 2.0] Login form for one not public toolset in App editor - Log in Oauth\n' + // EPMRTC-8559
    '[Quick app 2.0] Login form for one not public toolset in App editor - Log in API key\n' + // EPMRTC-8561
    '[Quick app 2.0] Login form for more than one not public toolset in App editor - Login for each\n' + // EPMRTC-8560
    '[Quick app 2.0] Login form for one not public toolset in App editor - Decline\n' + // EPMRTC-8562
    '[Quick app 2.0] Login form for more than one not public toolset in App editor - Decline one', // EPMRTC-8564
  async ({
    page,
    marketplacePage,
    entityEditorPage,
    quickApp2Builder,
    toolsetBuilder,
    toolsetApiHelper,
    applicationApiHelper,
    modelApiHelper,
    dialHomePage,
    sendMessage,
    toolsetLoginEventsModal,
    previewToolsetLoginModal,
    previewToolsetLoginModalAssertion,
    toolsetSignInMock,
    toast,
    baseAssertion,
    setTestIds,
  }) => {
    setTestIds(
      'EPMRTC-8559',
      'EPMRTC-8561',
      'EPMRTC-8560',
      'EPMRTC-8562',
      'EPMRTC-8564',
    );
    const oauthToolsetName = GeneratorUtil.randomToolsetName();
    const apiKeyToolsetName = GeneratorUtil.randomToolsetName();
    const declineToolsetName = GeneratorUtil.randomToolsetName();
    const oauthEndpoint = GeneratorUtil.randomUrl();
    const apiKeyEndpoint = GeneratorUtil.randomUrl();
    const quickAppName = GeneratorUtil.randomApplicationName();
    let oauthToolset: Toolset;
    let apiKeyToolset: Toolset;
    let declineToolset: Toolset;
    let oauthMock: OAuthMockHelper;
    let apiKeyMock: ApiKeyMockHelper;

    await dialTest.step(
      'Precondition: create three own toolsets (OAuth to log in / decline, API key to log in), all logged out',
      async () => {
        await toolsetApiHelper.createToolset(
          toolsetBuilder.withDisplayName(oauthToolsetName).build(),
        );
        oauthToolset = (await toolsetApiHelper.getToolset(oauthToolsetName))!;

        await toolsetApiHelper.createToolset(
          toolsetBuilder.withDisplayName(apiKeyToolsetName).build(),
        );
        apiKeyToolset = (await toolsetApiHelper.getToolset(apiKeyToolsetName))!;

        await toolsetApiHelper.createToolset(
          toolsetBuilder.withDisplayName(declineToolsetName).build(),
        );
        declineToolset =
          (await toolsetApiHelper.getToolset(declineToolsetName))!;
      },
    );

    await dialTest.step(
      'Mock the toolsets as logged-out OAuth / API key and serve the enriched listing',
      async () => {
        // Real creation with OAuth/API key auth_settings is rejected by the
        // backend, so set up each auth helper WITHOUT its own listing route —
        // the single listing route (below) enriches every toolset at once.
        oauthMock = new OAuthMockHelper(page, oauthToolset, oauthEndpoint);
        await oauthMock.setupToolsetRoutes();
        await oauthMock.setupSignInRoute();
        await oauthMock.setupOAuthRedirectRoute();
        await oauthMock.setupSignOutRoute();
        oauthMock.enableMocking();

        apiKeyMock = new ApiKeyMockHelper(page, apiKeyToolset, apiKeyEndpoint);
        await apiKeyMock.setupToolsetRoutes();
        await apiKeyMock.setupSignInRoute();
        await apiKeyMock.setupSignOutRoute();
        apiKeyMock.enableMocking();

        const oauthSettings = ToolsetSignInMockHelper.loggedOutOAuthSettings(
          oauthMock.getMockConfig(),
        );
        await toolsetSignInMock.setupToolsetsListingRoute(
          await toolsetApiHelper.listToolsets(),
          [
            { toolset: oauthToolset, authSettings: oauthSettings },
            { toolset: declineToolset, authSettings: oauthSettings },
            {
              toolset: apiKeyToolset,
              authSettings: ToolsetSignInMockHelper.loggedOutApiKeySettings(
                ExpectedConstants.apiKeyHeaderName,
              ),
            },
          ],
        );
      },
    );

    await dialTest.step(
      'Precondition: create a Quick app 2.0 via API with a tool-supporting orchestrator and both toolsets attached',
      async () => {
        const toolSupportingModel =
          await modelApiHelper.getToolSupportingModel();
        await applicationApiHelper.createApplication(
          quickApp2Builder
            .withDisplayName(quickAppName)
            .withOrchestratorModel(toolSupportingModel.id)
            .addToolset(oauthToolset.id!)
            .addToolset(apiKeyToolset.id!)
            .addToolset(declineToolset.id!)
            .build(),
        );
      },
    );

    await dialTest.step('Open the Quick app 2.0 in edit mode', async () => {
      const quickApp = await modelApiHelper.getAgentByNameAndVersion({
        name: quickAppName,
      });
      await marketplacePage.openEditQuickApp2Page(quickApp.reference);
      await entityEditorPage.waitForPageLoadedForEdit(
        EntityEditorAppTypes.QuickApp2,
      );
    });

    await dialTest.step(
      'Send a message in the preview to trigger the sign-in modal',
      async () => {
        await toolsetSignInMock.setupSignInChannel([
          oauthToolset,
          apiKeyToolset,
          declineToolset,
        ]);
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await sendMessage.messageInput.fillInInput(
          GeneratorUtil.randomString(10),
        );
        await sendMessage.sendMessageButton.click();
      },
    );

    await dialTest.step(
      'The login modal lists all toolsets with Login, Decline and Decline all',
      async () => {
        await baseAssertion.assertElementState(
          toolsetLoginEventsModal,
          'visible',
        );
        await baseAssertion.assertElementText(
          toolsetLoginEventsModal.header,
          ExpectedConstants.toolsetLoginRequiredTitle,
        );
        for (const name of [
          oauthToolsetName,
          apiKeyToolsetName,
          declineToolsetName,
        ]) {
          await baseAssertion.assertElementState(
            toolsetLoginEventsModal.getRowByToolsetName(name),
            'visible',
          );
          await baseAssertion.assertElementState(
            toolsetLoginEventsModal.getLoginButton(name),
            'visible',
          );
          await baseAssertion.assertElementState(
            toolsetLoginEventsModal.getDeclineButton(name),
            'visible',
          );
        }
        await baseAssertion.assertElementState(
          toolsetLoginEventsModal.declineAllButton,
          'visible',
        );
      },
    );

    await dialTest.step(
      'EPMRTC-8562/8564: decline one toolset — its row is removed with a toast, the rest stay',
      async () => {
        await toolsetLoginEventsModal
          .getDeclineButton(declineToolsetName)
          .click();
        await baseAssertion.assertElementText(
          toast,
          ExpectedConstants.toolsetSignInRequestDeclined,
        );
        await toast.closeToast();
        await baseAssertion.assertElementState(
          toolsetLoginEventsModal.getRowByToolsetName(declineToolsetName),
          'hidden',
        );
        for (const name of [oauthToolsetName, apiKeyToolsetName]) {
          await baseAssertion.assertElementState(
            toolsetLoginEventsModal.getRowByToolsetName(name),
            'visible',
          );
        }
      },
    );

    await dialTest.step(
      'EPMRTC-8559: log in the OAuth toolset via the popup — its row disappears',
      async () => {
        const popupPromise = page.waitForEvent('popup');
        await toolsetLoginEventsModal.getLoginButton(oauthToolsetName).click();
        const loginPopup = await popupPromise;
        await oauthMock.navigateToCallback(loginPopup);
        await baseAssertion.assertElementState(
          toolsetLoginEventsModal.getRowByToolsetName(oauthToolsetName),
          'hidden',
        );
        await baseAssertion.assertElementState(
          toolsetLoginEventsModal.getRowByToolsetName(apiKeyToolsetName),
          'visible',
        );
      },
    );

    await dialTest.step(
      'EPMRTC-8561: log in the API key toolset — its row disappears and the modal closes',
      async () => {
        await toolsetLoginEventsModal.getLoginButton(apiKeyToolsetName).click();
        await previewToolsetLoginModalAssertion.assertElementState(
          previewToolsetLoginModal,
          'visible',
        );
        await previewToolsetLoginModal.apiKeyMaskedFieldInput.fillInInput(
          GeneratorUtil.randomString(10),
        );
        await previewToolsetLoginModal.loginButton.click();
        await baseAssertion.assertElementState(
          toolsetLoginEventsModal,
          'hidden',
        );
      },
    );
  },
);

dialTest(
  '[Quick app 2.0] Login form for one not public toolset in App editor - Decline all\n' + // EPMRTC-8563
    '[Quick app 2.0] Login form for more than one not public toolset in App editor - Decline all', // EPMRTC-8565
  async ({
    marketplacePage,
    entityEditorPage,
    quickApp2Builder,
    toolsetBuilder,
    toolsetApiHelper,
    applicationApiHelper,
    modelApiHelper,
    dialHomePage,
    sendMessage,
    toolsetLoginEventsModal,
    toolsetSignInMock,
    toast,
    baseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-8563', 'EPMRTC-8565');
    const firstToolsetName = GeneratorUtil.randomToolsetName();
    const secondToolsetName = GeneratorUtil.randomToolsetName();
    const endpoint = GeneratorUtil.randomUrl();
    const quickAppName = GeneratorUtil.randomApplicationName();
    let firstToolset: Toolset;
    let secondToolset: Toolset;

    await dialTest.step(
      'Precondition: create two own toolsets (logged out)',
      async () => {
        await toolsetApiHelper.createToolset(
          toolsetBuilder.withDisplayName(firstToolsetName).build(),
        );
        firstToolset = (await toolsetApiHelper.getToolset(firstToolsetName))!;

        await toolsetApiHelper.createToolset(
          toolsetBuilder.withDisplayName(secondToolsetName).build(),
        );
        secondToolset = (await toolsetApiHelper.getToolset(secondToolsetName))!;
      },
    );

    await dialTest.step(
      'Make both toolsets appear as logged-out OAuth (mock the listing)',
      async () => {
        // No login happens here — decline all only needs the toolsets to show
        // up as login-requiring.
        const oauthSettings = ToolsetSignInMockHelper.loggedOutOAuthSettings({
          authorization_endpoint: API.authorizationEndpoint(endpoint),
          token_endpoint: API.tokenEndpoint(endpoint),
        });
        await toolsetSignInMock.setupToolsetsListingRoute(
          await toolsetApiHelper.listToolsets(),
          [
            { toolset: firstToolset, authSettings: oauthSettings },
            { toolset: secondToolset, authSettings: oauthSettings },
          ],
        );
      },
    );

    await dialTest.step(
      'Precondition: create a Quick app 2.0 with a tool-supporting orchestrator and both toolsets',
      async () => {
        const toolSupportingModel =
          await modelApiHelper.getToolSupportingModel();
        await applicationApiHelper.createApplication(
          quickApp2Builder
            .withDisplayName(quickAppName)
            .withOrchestratorModel(toolSupportingModel.id)
            .addToolset(firstToolset.id!)
            .addToolset(secondToolset.id!)
            .build(),
        );
      },
    );

    await dialTest.step('Open the Quick app 2.0 in edit mode', async () => {
      const quickApp = await modelApiHelper.getAgentByNameAndVersion({
        name: quickAppName,
      });
      await marketplacePage.openEditQuickApp2Page(quickApp.reference);
      await entityEditorPage.waitForPageLoadedForEdit(
        EntityEditorAppTypes.QuickApp2,
      );
    });

    await dialTest.step(
      'Send a message in the preview to trigger the sign-in modal',
      async () => {
        await toolsetSignInMock.setupSignInChannel([
          firstToolset,
          secondToolset,
        ]);
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await sendMessage.messageInput.fillInInput(
          GeneratorUtil.randomString(10),
        );
        await sendMessage.sendMessageButton.click();
      },
    );

    await dialTest.step(
      'Click Decline all — a toast is shown and the modal closes',
      async () => {
        await baseAssertion.assertElementState(
          toolsetLoginEventsModal,
          'visible',
        );
        await toolsetLoginEventsModal.declineAllButton.click();
        await baseAssertion.assertElementText(
          toast,
          ExpectedConstants.allToolsetSignInRequestsDeclined,
        );
        await toast.closeToast();
        await baseAssertion.assertElementState(
          toolsetLoginEventsModal,
          'hidden',
        );
      },
    );
  },
);
