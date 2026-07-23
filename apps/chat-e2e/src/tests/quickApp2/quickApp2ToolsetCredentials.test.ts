import { EntityType } from '@/chat/types/common';
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
import { GeneratorUtil } from '@/src/utils';
import {
  PublishActions,
  Toolset,
  ToolsetAuthStatus,
  ToolsetAuthTypes,
} from '@epam/ai-dial-shared';

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

dialTest.only(
  '[Quick app 2.0] Login form for one not public toolset in App editor - Log in Oauth\n' + // EPMRTC-8559
    '[Quick app 2.0] Login form for one not public toolset in App editor - Log in API key', // EPMRTC-8561
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
    baseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-8559', 'EPMRTC-8561');
    const oauthToolsetName = GeneratorUtil.randomToolsetName();
    const apiKeyToolsetName = GeneratorUtil.randomToolsetName();
    const oauthEndpoint = GeneratorUtil.randomUrl();
    const apiKeyEndpoint = GeneratorUtil.randomUrl();
    const quickAppName = GeneratorUtil.randomApplicationName();
    let oauthToolset: Toolset;
    let apiKeyToolset: Toolset;
    let oauthMock: OAuthMockHelper;
    let apiKeyMock: ApiKeyMockHelper;

    await dialTest.step(
      'Precondition: create two own toolsets (to appear as OAuth / API key, logged out)',
      async () => {
        await toolsetApiHelper.createToolset(
          toolsetBuilder.withDisplayName(oauthToolsetName).build(),
        );
        oauthToolset = (await toolsetApiHelper.getToolset(oauthToolsetName))!;

        await toolsetApiHelper.createToolset(
          toolsetBuilder.withDisplayName(apiKeyToolsetName).build(),
        );
        apiKeyToolset = (await toolsetApiHelper.getToolset(apiKeyToolsetName))!;
      },
    );

    await dialTest.step(
      'Make both toolsets appear as logged-out OAuth / API key (mock their auth settings)',
      async () => {
        // Real creation with OAuth/API key auth_settings and a fake endpoint is
        // rejected by the backend, so — like the other login tests — inject
        // auth_settings into the mocked toolset routes. Set up each helper
        // granularly WITHOUT its listing route so a single listing handler
        // (below) can enrich BOTH toolsets in one response.
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

        // The login modal fetches GET /api/toolsets-listing via rxjs fromFetch
        // during chat streaming. Fetching the real listing from inside the
        // route handler (route.fetch / page.request) gets torn down with the
        // page fetch lifecycle and hangs forever (endless spinner). Instead,
        // grab the real listing ONCE via the test's own API context, enrich
        // both toolsets, and let the route fulfill instantly from that cache.
        const mockConfig = oauthMock.getMockConfig();
        const listing = await toolsetApiHelper.listToolsets();
        for (const toolset of listing) {
          if (toolset.reference === oauthToolset.reference) {
            toolset.auth_settings = {
              authentication_type: ToolsetAuthTypes.OAUTH,
              authorization_endpoint: mockConfig.authorization_endpoint,
              token_endpoint: mockConfig.token_endpoint,
              scopes_supported: mockConfig.scopes_supported,
              code_challenge_method: mockConfig.code_challenge_method,
              global_auth_status: ToolsetAuthStatus.SIGNED_OUT,
              user_level_auth_status: ToolsetAuthStatus.SIGNED_OUT,
            };
          } else if (toolset.reference === apiKeyToolset.reference) {
            toolset.auth_settings = {
              authentication_type: ToolsetAuthTypes.API_KEY,
              // The login form pre-fills (and requires) the key header from
              // here; without it the hidden config field stays empty and the
              // Log in button never enables.
              api_key_header: ExpectedConstants.apiKeyHeaderName,
              global_auth_status: ToolsetAuthStatus.SIGNED_OUT,
              user_level_auth_status: ToolsetAuthStatus.SIGNED_OUT,
            };
          }
        }
        await page.context().route(`**${API.toolsetsHost()}`, (route) =>
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: listing }),
          }),
        );
      },
    );

    await dialTest.step(
      'Precondition: create a Quick app 2.0 via API with a tool-supporting orchestrator and both toolsets attached',
      async () => {
        const allEntities = await modelApiHelper.getModels();
        const toolSupportingModel = allEntities.find(
          (entity) =>
            entity.type === EntityType.Model && entity.features?.tools,
        )!;
        await applicationApiHelper.createApplication(
          quickApp2Builder
            .withDisplayName(quickAppName)
            .withOrchestratorModel(toolSupportingModel.id)
            .addToolset(oauthToolset.id!)
            .addToolset(apiKeyToolset.id!)
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
      'Mock the live-chat sign-in channel to require login for both toolsets, then send a message to trigger it',
      async () => {
        // The sign-in modal is driven by the SSE channel
        // '/api/client-channels/subscribe' (Feature.LiveChatInteraction) — the
        // real backend only pushes it for a toolset that actually needs login,
        // so for our mocked NONE-auth toolsets we push the events ourselves.
        // Each event's toolsetId is decoded via decodeApiUrl on the client; use
        // the toolset id so it matches both the toolsets map key and the
        // logInToolsetSuccess payload that resolves (removes) the event.
        const events = [oauthToolset, apiKeyToolset]
          .map((toolset, index) =>
            [
              'data:',
              JSON.stringify({
                id: `${index + 1}`,
                method: 'toolset/signin',
                params: { toolsetId: toolset.id },
              }),
            ].join(' '),
          )
          .join('\n');
        // The real channel is a single long-lived stream; our mock closes the
        // response, so the client reconnects every few seconds. Push the events
        // only on the FIRST subscribe — otherwise each reconnect re-adds the
        // already-resolved events and the logged-in toolset rows reappear. Keep
        // the channel id on every response so report stays resolvable.
        let eventsPushed = false;
        await page.route(`**${API.subscribeHost()}`, async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'text/event-stream',
            headers: { 'x-dial-client-channel-id': 'e2e-mocked-channel' },
            body: eventsPushed ? '' : events,
          });
          eventsPushed = true;
        });
        // A signed-in toolset is reported back to the channel; the row is only
        // removed on report success, so the fake channel id must resolve too.
        await page.route(`**${API.reportHost()}`, (route) =>
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: '{}',
          }),
        );

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
      'The login modal lists both toolsets with Login, Decline and Decline all',
      async () => {
        await baseAssertion.assertElementState(
          toolsetLoginEventsModal,
          'visible',
        );
        await baseAssertion.assertElementText(
          toolsetLoginEventsModal.header,
          ExpectedConstants.toolsetLoginRequiredTitle,
        );
        for (const name of [oauthToolsetName, apiKeyToolsetName]) {
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
        // The API key toolset still needs a login.
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
        // Last pending login resolved — the whole modal unmounts.
        await baseAssertion.assertElementState(
          toolsetLoginEventsModal,
          'hidden',
        );
      },
    );
  },
);
