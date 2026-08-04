import { Conversation } from '@/chat/types/chat';
import { Publication } from '@/chat/types/publication';
import { ToolsetCredentialsLevel } from '@/chat/types/toolsets';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import {
  Attachment,
  Creds,
  EntityEditorAppTypes,
  ExpectedConstants,
  MenuOptions,
  MockedChatApiResponseBodies,
  UploadMenuOptions,
} from '@/src/testData';
import { ApiKeyMockHelper } from '@/src/testData/toolsets/apiKeyMockHelper';
import { OAuthMockHelper } from '@/src/testData/toolsets/oauthMockHelper';
import { AddQuickApp2SettingsFormSelector } from '@/src/ui/selectors/dialogSelectors';
import { GeneratorUtil } from '@/src/utils';
import {
  PublishActions,
  Toolset,
  ToolsetAuthTypes,
} from '@epam/ai-dial-shared';

dialAdminTest(
  '[Quick app 2.0] Manage credentials form is available for public toolsets from Quick app 2.0 editor', // EPMDIAL-5557
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
    setTestIds('EPMDIAL-5557');
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
  '[Quick app 2.0] Login form for one not public toolset in App editor - Log in Oauth\n' + // EPMDIAL-5096
    '[Quick app 2.0] Login form for one not public toolset in App editor - Log in API key\n' + // EPMDIAL-5097
    '[Quick app 2.0] Login form for more than one not public toolset in App editor - Login for each\n' + // EPMDIAL-5100
    '[Quick app 2.0] Login form for one not public toolset in App editor - Decline\n' + // EPMDIAL-5098
    '[Quick app 2.0] Login form for more than one not public toolset in App editor - Decline one', // EPMDIAL-5101
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
      'EPMDIAL-5096',
      'EPMDIAL-5097',
      'EPMDIAL-5100',
      'EPMDIAL-5098',
      'EPMDIAL-5101',
    );
    const oauthToolsetName = GeneratorUtil.randomToolsetName();
    const apiKeyToolsetName = GeneratorUtil.randomToolsetName();
    const declineToolsetName = GeneratorUtil.randomToolsetName();
    const oauthEndpoint = GeneratorUtil.randomUrl();
    const apiKeyEndpoint = GeneratorUtil.randomUrl();
    const declineEndpoint = GeneratorUtil.randomUrl();
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
        // The backend rejects a toolset with a real OAuth endpoint, so mock it.
        oauthMock = await toolsetSignInMock.loggedOutOAuthMock(
          oauthToolset,
          oauthEndpoint,
        );
        apiKeyMock = await toolsetSignInMock.loggedOutApiKeyMock(
          apiKeyToolset,
          apiKeyEndpoint,
          ExpectedConstants.apiKeyHeaderName,
        );
        const declineMock = await toolsetSignInMock.loggedOutOAuthMock(
          declineToolset,
          declineEndpoint,
        );

        await toolsetSignInMock.setupToolsetsListingRoute(
          await toolsetApiHelper.listToolsets(),
          [oauthMock, apiKeyMock, declineMock],
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
      'EPMDIAL-5098/8564: decline one toolset — its row is removed with a toast, the rest stay',
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
      'EPMDIAL-5096: log in the OAuth toolset via the popup — its row disappears',
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
      'EPMDIAL-5097: log in the API key toolset — its row disappears and the modal closes',
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
  '[Quick app 2.0] Login form for one not public toolset in App editor - Decline all\n' + // EPMDIAL-5099
    '[Quick app 2.0] Login form for more than one not public toolset in App editor - Decline all', // EPMDIAL-5102
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
    setTestIds('EPMDIAL-5099', 'EPMDIAL-5102');
    const firstToolsetName = GeneratorUtil.randomToolsetName();
    const secondToolsetName = GeneratorUtil.randomToolsetName();
    const endpoint = GeneratorUtil.randomUrl();
    const secondEndpoint = GeneratorUtil.randomUrl();
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
        await toolsetSignInMock.setupToolsetsListingRoute(
          await toolsetApiHelper.listToolsets(),
          [
            await toolsetSignInMock.loggedOutOAuthMock(firstToolset, endpoint),
            await toolsetSignInMock.loggedOutOAuthMock(
              secondToolset,
              secondEndpoint,
            ),
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

dialTest(
  '[Quick app 2.0] Login modal form is displayed for each message in chat if quick app has at least one logged out toolset despite login was declined in previous message\n' + // EPMDIAL-5116
    '[Quick app 2.0] Login modal form is displayed for each regenerated message in chat if quick app has at least one logged out toolset despite login was declined in previous message', // EPMDIAL-5117
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
    chatMessages,
    toolsetLoginEventsModal,
    toolsetSignInMock,
    toast,
    baseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-5116', 'EPMDIAL-5117');
    const declinedToolsetName = GeneratorUtil.randomToolsetName();
    const loggedInToolsetName = GeneratorUtil.randomToolsetName();
    const endpoint = GeneratorUtil.randomUrl();
    const declinedEndpoint = GeneratorUtil.randomUrl();
    const quickAppName = GeneratorUtil.randomApplicationName();
    let declinedToolset: Toolset;
    let loggedInToolset: Toolset;
    let oauthMock: OAuthMockHelper;

    await dialTest.step(
      'Precondition: create two own toolsets (logged out)',
      async () => {
        await toolsetApiHelper.createToolset(
          toolsetBuilder.withDisplayName(declinedToolsetName).build(),
        );
        declinedToolset =
          (await toolsetApiHelper.getToolset(declinedToolsetName))!;

        await toolsetApiHelper.createToolset(
          toolsetBuilder.withDisplayName(loggedInToolsetName).build(),
        );
        loggedInToolset =
          (await toolsetApiHelper.getToolset(loggedInToolsetName))!;
      },
    );

    await dialTest.step(
      'Mock both toolsets as logged-out OAuth and serve the enriched listing',
      async () => {
        oauthMock = await toolsetSignInMock.loggedOutOAuthMock(
          loggedInToolset,
          endpoint,
        );
        await toolsetSignInMock.setupToolsetsListingRoute(
          await toolsetApiHelper.listToolsets(),
          [
            oauthMock,
            await toolsetSignInMock.loggedOutOAuthMock(
              declinedToolset,
              declinedEndpoint,
            ),
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
            .addToolset(declinedToolset.id!)
            .addToolset(loggedInToolset.id!)
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
          declinedToolset,
          loggedInToolset,
        ]);
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await sendMessage.messageInput.fillInInput(
          GeneratorUtil.randomString(10),
        );
        await sendMessage.sendMessageButton.click();
        await baseAssertion.assertElementState(
          toolsetLoginEventsModal,
          'visible',
        );
      },
    );

    // NOTE: the ticket also expects a tools-initialization error in the response
    // stages after a decline. It is not asserted here: that text comes from the
    // real orchestration, while this test mocks /api/chat, so the stages would
    // only ever echo our own mock. Covered manually.
    await dialTest.step(
      'Decline one toolset and log in to the other — the modal closes',
      async () => {
        await toolsetLoginEventsModal
          .getDeclineButton(declinedToolsetName)
          .click();
        await baseAssertion.assertElementText(
          toast,
          ExpectedConstants.toolsetSignInRequestDeclined,
        );
        await toast.closeToast();

        const popupPromise = page.waitForEvent('popup');
        await toolsetLoginEventsModal
          .getLoginButton(loggedInToolsetName)
          .click();
        await oauthMock.navigateToCallback(await popupPromise);
        await baseAssertion.assertElementState(
          toolsetLoginEventsModal,
          'hidden',
        );
        await toast.closeToast();
      },
    );

    await dialTest.step(
      'EPMDIAL-5116: send the next message — the declined toolset asks to log in again',
      async () => {
        await sendMessage.messageInput.fillInInput(
          GeneratorUtil.randomString(10),
        );
        await sendMessage.sendMessageButton.click();
        // Queue the request only after the message is sent, mirroring the
        // backend asking again for a still logged-out toolset. Queueing it
        // earlier would pop the modal on the channel's own reconnect, before
        // the message was even sent. The logged-in one is not asked again.
        toolsetSignInMock.requestSignInAgain([declinedToolset]);
        await baseAssertion.assertElementState(
          toolsetLoginEventsModal,
          'visible',
        );
        await baseAssertion.assertElementState(
          toolsetLoginEventsModal.getRowByToolsetName(declinedToolsetName),
          'visible',
        );
        await baseAssertion.assertElementState(
          toolsetLoginEventsModal.getRowByToolsetName(loggedInToolsetName),
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Decline it again so the modal closes and a response is generated',
      async () => {
        await toolsetLoginEventsModal
          .getDeclineButton(declinedToolsetName)
          .click();
        await toast.closeToast();
        await baseAssertion.assertElementState(
          toolsetLoginEventsModal,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'EPMDIAL-5117: regenerate the response — the login form appears again',
      async () => {
        await chatMessages.regenerateResponse(false);
        toolsetSignInMock.requestSignInAgain([declinedToolset]);
        await baseAssertion.assertElementState(
          toolsetLoginEventsModal,
          'visible',
        );
        await baseAssertion.assertElementState(
          toolsetLoginEventsModal.getRowByToolsetName(declinedToolsetName),
          'visible',
        );
      },
    );
  },
);

dialTest(
  '[Quick app 2.0] [Not Admin] login form for one public toolset in Chat - Login happens with personal creds', // EPMDIAL-5105
  async ({
    page,
    marketplacePage,
    marketplaceHeader,
    marketplaceEntitiesSection,
    entityDetailsModal,
    dialHomePage,
    sendMessage,
    quickApp2Builder,
    toolsetBuilder,
    toolsetApiHelper,
    publicationApiHelper,
    adminPublicationApiHelper,
    adminUserItemApiHelper,
    publishRequestBuilder,
    applicationApiHelper,
    modelApiHelper,
    toolsetLoginEventsModal,
    toolsetSignInMock,
    toolsetApiAuthenticationAssertion,
    baseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-5105');
    const toolsetName = GeneratorUtil.randomToolsetName();
    const endpoint = GeneratorUtil.randomUrl();
    const quickAppName = GeneratorUtil.randomApplicationName();
    let publishedToolset: Toolset;
    let oauthMock: OAuthMockHelper;

    await dialTest.step(
      'Precondition: create and publish a toolset so it becomes public',
      async () => {
        await toolsetApiHelper.createToolset(
          toolsetBuilder.withDisplayName(toolsetName).build(),
        );
        const initialToolset =
          (await toolsetApiHelper.getToolset(toolsetName))!;

        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withToolsetResource(initialToolset, PublishActions.ADD)
          .build();
        const publication =
          await publicationApiHelper.createPublishRequest(publishRequest);
        await adminPublicationApiHelper.approveRequest(publication);

        const toolsetResource = publication.resources.find(
          (r) => r.sourceUrl === initialToolset.id,
        )!;
        publishedToolset = await adminUserItemApiHelper.getItem<Toolset>(
          toolsetResource.targetUrl,
        );
        // A published toolset comes back without `id`, so keep the resource path
        // — it is what the app config and the sign-in events refer to.
        publishedToolset.id ??= toolsetResource.targetUrl;
      },
    );

    await dialTest.step(
      'Mock the public toolset as logged out with both org and personal creds',
      async () => {
        oauthMock = await toolsetSignInMock.loggedOutOAuthMock(
          publishedToolset,
          endpoint,
        );
        await toolsetSignInMock.setupToolsetsListingRoute(
          await toolsetApiHelper.listToolsets(),
          [oauthMock],
        );
      },
    );

    await dialTest.step(
      'Precondition: create a Quick app 2.0 with the public toolset',
      async () => {
        const toolSupportingModel =
          await modelApiHelper.getToolSupportingModel();
        await applicationApiHelper.createApplication(
          quickApp2Builder
            .withDisplayName(quickAppName)
            .withOrchestratorModel(toolSupportingModel.id)
            .addToolset(publishedToolset.id!)
            .build(),
        );
      },
    );

    await dialTest.step(
      'Open the Quick app 2.0 card and click Use application to start a chat',
      async () => {
        await marketplacePage.openMyWorkspacePage({
          updateInstalledDeployments: false,
          getStyles: true,
        });
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader
          .getSearch()
          .inputField.fillInInput(quickAppName);
        const quickAppCard =
          await marketplaceEntitiesSection.findEntityElement(quickAppName);
        await quickAppCard.click();
        await baseAssertion.assertElementState(entityDetailsModal, 'visible');
        await entityDetailsModal.clickUseButton({
          isInstalledDeploymentsUpdated: false,
        });
        await baseAssertion.assertElementState(
          sendMessage.messageInput,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Send a message in the chat to trigger the sign-in modal',
      async () => {
        await toolsetSignInMock.setupSignInChannel([publishedToolset]);
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await sendMessage.messageInput.fillInInput(
          GeneratorUtil.randomString(10),
        );
        await sendMessage.sendMessageButton.click();
        await baseAssertion.assertElementState(
          toolsetLoginEventsModal,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Log in and verify a public toolset is signed in with personal creds',
      async () => {
        const popupPromise = page.waitForEvent('popup');
        await toolsetLoginEventsModal.getLoginButton(toolsetName).click();
        await oauthMock.navigateToCallback(await popupPromise);
        await baseAssertion.assertElementState(
          toolsetLoginEventsModal,
          'hidden',
        );
        toolsetApiAuthenticationAssertion.assertSignInRequest(
          oauthMock.getUserSignInRequest()!,
          {
            url: publishedToolset.name!,
            authType: ToolsetAuthTypes.OAUTH,
            credentialsLevel: ToolsetCredentialsLevel.USER,
            authorizationCode: oauthMock.getAuthorizationCode(),
          },
        );
      },
    );
  },
);

dialAdminTest(
  '[Quick app 2.0] [Admin] login form for one public toolset in App editor - Login happens with personal creds\n' + // EPMDIAL-5114
    '[Quick app 2.0] [Admin] login form for one public toolset in Chat - Login happens with personal creds\n' + // EPMDIAL-5104
    '[Quick app 2.0] [Admin] personal creds are used by default if admin is asked to login during conversation\n' + // EPMDIAL-5115
    '[Quick app 2.0] No login form for a public toolset which is logged in with org creds', // EPMDIAL-5106
  async ({
    adminPage,
    adminMarketplacePage,
    adminMarketplaceHeader,
    adminMarketplaceEntitiesSection,
    adminEntityEditorPage,
    adminEntityEditorHeader,
    adminQuickApp2EditorViewForm,
    adminEntityDetailsModal,
    adminEntityDetailsModalAssertion,
    adminDialHomePage,
    adminSendMessage,
    adminToolsetLoginEventsModal,
    adminToolsetLoginModal,
    adminToolsetSignInMock,
    adminToolsetApiHelper,
    adminApplicationApiHelper,
    adminModelApiHelper,
    adminToast,
    quickApp2Builder,
    toolsetBuilder,
    toolsetApiHelper,
    publicationApiHelper,
    adminPublicationApiHelper,
    adminUserItemApiHelper,
    publishRequestBuilder,
    baseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-5114', 'EPMDIAL-5104', 'EPMDIAL-5115', 'EPMDIAL-5106');
    const editorToolsetName = GeneratorUtil.randomToolsetName();
    const chatToolsetName = GeneratorUtil.randomToolsetName();
    const orgToolsetName = GeneratorUtil.randomToolsetName();
    const quickAppName = GeneratorUtil.randomApplicationName();
    const version = ExpectedConstants.defaultEntityVersion;
    let editorToolset: Toolset;
    let chatToolset: Toolset;
    let orgToolset: Toolset;
    let editorMock: OAuthMockHelper;
    let chatMock: OAuthMockHelper;

    await dialAdminTest.step(
      'Precondition: create three toolsets and publish them so they become public',
      async () => {
        const created: Toolset[] = [];
        for (const name of [
          editorToolsetName,
          chatToolsetName,
          orgToolsetName,
        ]) {
          await toolsetApiHelper.createToolset(
            toolsetBuilder.withDisplayName(name).build(),
          );
          created.push((await toolsetApiHelper.getToolset(name))!);
        }

        let publishRequest = publishRequestBuilder.withName(
          GeneratorUtil.randomPublicationRequestName(),
        );
        for (const toolset of created) {
          publishRequest = publishRequest.withToolsetResource(
            toolset,
            PublishActions.ADD,
          );
        }
        const publication: Publication =
          await publicationApiHelper.createPublishRequest(
            publishRequest.build(),
          );
        await adminPublicationApiHelper.approveRequest(publication);

        const published: Toolset[] = [];
        for (const toolset of created) {
          const resource = publication.resources.find(
            (r) => r.sourceUrl === toolset.id,
          )!;
          const item = await adminUserItemApiHelper.getItem<Toolset>(
            resource.targetUrl,
          );
          // A published toolset comes back without `id`.
          item.id ??= resource.targetUrl;
          published.push(item);
        }
        [editorToolset, chatToolset, orgToolset] = published;
      },
    );

    await dialAdminTest.step(
      'Mock two toolsets as logged out and the third as logged in with org creds',
      async () => {
        editorMock = await adminToolsetSignInMock.loggedOutOAuthMock(
          editorToolset,
          GeneratorUtil.randomUrl(),
        );
        chatMock = await adminToolsetSignInMock.loggedOutOAuthMock(
          chatToolset,
          GeneratorUtil.randomUrl(),
        );
        const orgMock = await adminToolsetSignInMock.loggedOutOAuthMock(
          orgToolset,
          GeneratorUtil.randomUrl(),
        );
        orgMock.setIsSignedInGlobal(true);

        await adminToolsetSignInMock.setupToolsetsListingRoute(
          await adminToolsetApiHelper.listToolsets(),
          [editorMock, chatMock, orgMock],
        );
      },
    );

    await dialAdminTest.step(
      'Precondition: admin creates a Quick app 2.0 with all three public toolsets',
      async () => {
        const toolSupportingModel =
          await adminModelApiHelper.getToolSupportingModel();
        await adminApplicationApiHelper.createApplication(
          quickApp2Builder
            .withDisplayName(quickAppName)
            .withOrchestratorModel(toolSupportingModel.id)
            .addToolset(editorToolset.id!)
            .addToolset(chatToolset.id!)
            .addToolset(orgToolset.id!)
            .build(),
        );
      },
    );

    await dialAdminTest.step(
      'Open the Quick app 2.0 in edit mode and send a message in the preview',
      async () => {
        const quickApp = await adminModelApiHelper.getAgentByNameAndVersion({
          name: quickAppName,
        });
        await adminMarketplacePage.openEditQuickApp2Page(quickApp.reference);
        await adminEntityEditorPage.waitForPageLoadedForEdit(
          EntityEditorAppTypes.QuickApp2,
        );

        // Only this one - the form must close after its login, otherwise it
        // covers the chip we click next. The chat toolset is asked for later.
        await adminToolsetSignInMock.setupSignInChannel([editorToolset]);
        await adminDialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await adminSendMessage.messageInput.fillInInput(
          GeneratorUtil.randomString(10),
        );
        await adminSendMessage.sendMessageButton.click();
      },
    );

    await dialAdminTest.step(
      'EPMDIAL-5106: the org-logged-in toolset is not asked for a login and its chip is not red',
      async () => {
        // NOTE: the ticket's "no login form appeared" is not asserted - with a
        // mocked channel its absence would only prove we pushed no event.
        await baseAssertion.assertElementState(
          adminToolsetLoginEventsModal,
          'visible',
        );
        await baseAssertion.assertElementState(
          adminToolsetLoginEventsModal.getRowByToolsetName(orgToolsetName),
          'hidden',
        );
        await baseAssertion.assertElementClass(
          adminQuickApp2EditorViewForm.getChipByName(orgToolsetName),
          new RegExp(AddQuickApp2SettingsFormSelector.activeChipClass),
        );
        await baseAssertion.assertElementClass(
          adminQuickApp2EditorViewForm.getChipByName(editorToolsetName),
          new RegExp(AddQuickApp2SettingsFormSelector.errorChipClass),
        );
      },
    );

    await dialAdminTest.step(
      'EPMDIAL-5114/8566: log in from the preview - no creds type to choose, personal creds are used',
      async () => {
        const popupPromise = adminPage.waitForEvent('popup');
        await adminToolsetLoginEventsModal
          .getLoginButton(editorToolsetName)
          .click();
        // The creds type is only offered in the Manage creds dialog.
        await baseAssertion.assertElementState(
          adminToolsetLoginModal,
          'hidden',
        );
        await editorMock.navigateToCallback(await popupPromise);

        await baseAssertion.assertElementText(
          adminToast,
          ExpectedConstants.personalLoginSuccessfulMessage(
            editorToolsetName,
            version,
          ),
        );
        await adminToast.closeToast();
      },
    );

    await dialAdminTest.step(
      'EPMDIAL-5114: the toolset card in the Agents & Toolsets field shows My creds',
      async () => {
        await baseAssertion.assertElementState(
          adminToolsetLoginEventsModal,
          'hidden',
        );
        await baseAssertion.assertElementClass(
          adminQuickApp2EditorViewForm.getChipByName(editorToolsetName),
          new RegExp(AddQuickApp2SettingsFormSelector.activeChipClass),
        );
        await adminQuickApp2EditorViewForm.clickChipByName(editorToolsetName);
        await adminEntityDetailsModalAssertion.assertEntityCommonAttributes({
          expectedCredsLabel: Creds.myCreds,
        });
        await adminEntityDetailsModal.closeButton.click();
      },
    );

    await dialAdminTest.step(
      'Leave the editor with Save & Exit and start a chat from the app card',
      async () => {
        await adminEntityEditorHeader.saveAndExitButton.click();
        await adminMarketplacePage.waitForPageLoaded();
        await adminMarketplaceHeader
          .getSearch()
          .inputField.fillInInput(quickAppName);
        const quickAppCard =
          await adminMarketplaceEntitiesSection.findEntityElement(quickAppName);
        await quickAppCard.click();
        await adminEntityDetailsModal.clickUseButton({});
        // Side panels stay collapsed here, so waitForPageLoaded would hang.
        await baseAssertion.assertElementState(
          adminSendMessage.messageInput,
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'EPMDIAL-5104/8594: log in from the chat - personal creds are used again',
      async () => {
        await adminSendMessage.messageInput.fillInInput(
          GeneratorUtil.randomString(10),
        );
        await adminSendMessage.sendMessageButton.click();
        // Queue only after the message is sent - the channel from the editor is
        // still alive and reconnects on its own, so it would pop the form early.
        adminToolsetSignInMock.requestSignInAgain([chatToolset]);
        await baseAssertion.assertElementState(
          adminToolsetLoginEventsModal,
          'visible',
        );

        const popupPromise = adminPage.waitForEvent('popup');
        await adminToolsetLoginEventsModal
          .getLoginButton(chatToolsetName)
          .click();
        await baseAssertion.assertElementState(
          adminToolsetLoginModal,
          'hidden',
        );
        await chatMock.navigateToCallback(await popupPromise);

        await baseAssertion.assertElementText(
          adminToast,
          ExpectedConstants.personalLoginSuccessfulMessage(
            chatToolsetName,
            version,
          ),
        );
        await adminToast.closeToast();
      },
    );

    await dialAdminTest.step(
      'EPMDIAL-5115: the toolset is marked as logged in with My creds in the Marketplace',
      async () => {
        await adminDialHomePage.goToMarketplace();
        await adminMarketplacePage.waitForPageLoaded();
        await adminMarketplaceHeader.toolsetsTab.click();
        await adminMarketplaceHeader
          .getSearch()
          .inputField.fillInInput(chatToolsetName);
        const toolsetCard =
          await adminMarketplaceEntitiesSection.findEntityElement(
            chatToolsetName,
          );
        await toolsetCard.click();
        await adminEntityDetailsModalAssertion.assertEntityCommonAttributes({
          expectedCredsLabel: Creds.myCreds,
        });
      },
    );
  },
);

dialTest(
  '[Quick app 2.0] Compare mode: one form for all toolsets from both apps is displayed\n' + // EPMDIAL-5113
    '[Quick app 2.0] Login form for quick app 2.0 with toolset and model\n' + // EPMDIAL-5111
    '[Quick app 2.0] Login form for quick app 2.0 with toolset and app\n' + // EPMDIAL-5110
    '[Quick app 2.0] Login form is displayed when replaying a chat with a logged out toolset', // EPMDIAL-5112
  async ({
    page,
    dialHomePage,
    localStorageManager,
    conversationData,
    dataInjector,
    conversations,
    conversationDropdownMenu,
    compare,
    compareConversation,
    chat,
    chatMessagesAssertion,
    sendMessage,
    attachmentDropdownMenu,
    fileManagerModal,
    fileManagerModalGrid,
    fileApiHelper,
    quickApp2Builder,
    customApplicationBuilder,
    toolsetBuilder,
    toolsetApiHelper,
    applicationApiHelper,
    modelApiHelper,
    toolsetLoginEventsModal,
    toolsetSignInMock,
    toast,
    baseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-5113', 'EPMDIAL-5111', 'EPMDIAL-5110', 'EPMDIAL-5112');
    const modelToolsetName = GeneratorUtil.randomToolsetName();
    const replayToolsetName = GeneratorUtil.randomToolsetName();
    const appToolsetName = GeneratorUtil.randomToolsetName();
    const attachedAppName = GeneratorUtil.randomApplicationName();
    const modelQuickAppName = GeneratorUtil.randomApplicationName();
    const replayQuickAppName = GeneratorUtil.randomApplicationName();
    const appQuickAppName = GeneratorUtil.randomApplicationName();
    let modelToolset: Toolset;
    let replayToolset: Toolset;
    let appToolset: Toolset;
    let modelMock: OAuthMockHelper;
    let replayMock: OAuthMockHelper;
    let appMock: OAuthMockHelper;
    let modelConversation: Conversation;
    let replaySourceConversation: Conversation;
    let replayConversation: Conversation;
    let appConversation: Conversation;

    await dialTest.step(
      'Precondition: create three own toolsets and mock them as logged-out OAuth',
      async () => {
        for (const name of [
          modelToolsetName,
          replayToolsetName,
          appToolsetName,
        ]) {
          await toolsetApiHelper.createToolset(
            toolsetBuilder.withDisplayName(name).build(),
          );
        }
        modelToolset = (await toolsetApiHelper.getToolset(modelToolsetName))!;
        replayToolset = (await toolsetApiHelper.getToolset(replayToolsetName))!;
        appToolset = (await toolsetApiHelper.getToolset(appToolsetName))!;

        modelMock = await toolsetSignInMock.loggedOutOAuthMock(
          modelToolset,
          GeneratorUtil.randomUrl(),
        );
        replayMock = await toolsetSignInMock.loggedOutOAuthMock(
          replayToolset,
          GeneratorUtil.randomUrl(),
        );
        appMock = await toolsetSignInMock.loggedOutOAuthMock(
          appToolset,
          GeneratorUtil.randomUrl(),
        );
        await toolsetSignInMock.setupToolsetsListingRoute(
          await toolsetApiHelper.listToolsets(),
          [modelMock, replayMock, appMock],
        );
      },
    );

    await dialTest.step(
      'Precondition: create three Quick apps 2.0 - two with a toolset and a model, one with a toolset and an app',
      async () => {
        const model = await modelApiHelper.getToolSupportingModel();

        await applicationApiHelper.createApplication(
          customApplicationBuilder.withDisplayName(attachedAppName).build(),
        );
        const attachedApp = await modelApiHelper.getAgentByNameAndVersion({
          name: attachedAppName,
        });

        for (const [name, toolset] of [
          [modelQuickAppName, modelToolset],
          [replayQuickAppName, replayToolset],
        ] as [string, Toolset][]) {
          await applicationApiHelper.createApplication(
            quickApp2Builder
              .withDisplayName(name)
              .withOrchestratorModel(model.id)
              .addToolset(toolset.id!)
              .addModel(model.id)
              .build(),
          );
        }

        await applicationApiHelper.createApplication(
          quickApp2Builder
            .withDisplayName(appQuickAppName)
            .withOrchestratorModel(model.id)
            .addToolset(appToolset.id!)
            .addApp({ id: attachedApp.id, name: attachedApp.name })
            .withInputAttachmentTypes(ExpectedConstants.pdfAttachmentType)
            .withMaxInputAttachments(1)
            .build(),
        );
      },
    );

    await dialTest.step(
      'Precondition: create a conversation per app and a replay of one of them',
      async () => {
        const [modelQuickApp, replayQuickApp, appQuickApp] = await Promise.all(
          [modelQuickAppName, replayQuickAppName, appQuickAppName].map((name) =>
            modelApiHelper.getAgentByNameAndVersion({ name }),
          ),
        );

        modelConversation =
          conversationData.prepareDefaultConversation(modelQuickApp);
        conversationData.resetData();
        replaySourceConversation =
          conversationData.prepareDefaultConversation(replayQuickApp);
        conversationData.resetData();
        replayConversation = conversationData.prepareDefaultReplayConversation(
          replaySourceConversation,
        );
        conversationData.resetData();
        appConversation =
          conversationData.prepareDefaultConversation(appQuickApp);

        await dataInjector.createConversations([
          modelConversation,
          replaySourceConversation,
          replayConversation,
          appConversation,
        ]);
        await fileApiHelper.putFile(Attachment.pdfName);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'EPMDIAL-5113: compare the two apps and verify one form lists the toolsets of both',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await conversations.openEntityDropdownMenu(modelConversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.compare);
        await compareConversation.checkShowAllConversations();
        await compareConversation.selectCompareConversation(
          replaySourceConversation.name,
        );
        await compare.waitForComparedConversationsLoaded();

        await toolsetSignInMock.setupSignInChannel([
          modelToolset,
          replayToolset,
        ]);
        await chat.sendRequestInCompareMode(GeneratorUtil.randomString(10), {
          leftEntity: modelConversation.model.id,
          rightEntity: replaySourceConversation.model.id,
        });

        await baseAssertion.assertElementState(
          toolsetLoginEventsModal,
          'visible',
        );
        for (const name of [modelToolsetName, replayToolsetName]) {
          await baseAssertion.assertElementState(
            toolsetLoginEventsModal.getRowByToolsetName(name),
            'visible',
          );
        }
        await toolsetLoginEventsModal.declineAllButton.click();
        await baseAssertion.assertElementText(
          toast,
          ExpectedConstants.allToolsetSignInRequestsDeclined,
        );
        await toast.closeToast();
      },
    );

    await dialTest.step(
      'EPMDIAL-5111: send a message in the chat with the app that has a toolset and a model, then log in',
      async () => {
        await conversations.selectEntity(modelConversation.name);
        await sendMessage.messageInput.fillInInput(
          GeneratorUtil.randomString(10),
        );
        await sendMessage.sendMessageButton.click();
        toolsetSignInMock.requestSignInAgain([modelToolset]);

        await baseAssertion.assertElementState(
          toolsetLoginEventsModal,
          'visible',
        );
        const popupPromise = page.waitForEvent('popup');
        await toolsetLoginEventsModal.getLoginButton(modelToolsetName).click();
        await modelMock.navigateToCallback(await popupPromise);
        await baseAssertion.assertElementState(
          toolsetLoginEventsModal,
          'hidden',
        );
        await chatMessagesAssertion.assertMessagesCount(6);
      },
    );

    await dialTest.step(
      'EPMDIAL-5110: attach a pdf in the chat with the app that has a toolset and an app, then log in',
      async () => {
        await conversations.selectEntity(appConversation.name);
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
        );
        const attachmentCheckbox =
          await fileManagerModalGrid.gridCheckboxByNameCell(Attachment.pdfName);
        await attachmentCheckbox.click();
        await fileManagerModal.getAttachButton().click();

        await sendMessage.messageInput.fillInInput(
          GeneratorUtil.randomString(10),
        );
        await sendMessage.sendMessageButton.click();
        toolsetSignInMock.requestSignInAgain([appToolset]);

        await baseAssertion.assertElementState(
          toolsetLoginEventsModal,
          'visible',
        );
        const popupPromise = page.waitForEvent('popup');
        await toolsetLoginEventsModal.getLoginButton(appToolsetName).click();
        await appMock.navigateToCallback(await popupPromise);
        await baseAssertion.assertElementState(
          toolsetLoginEventsModal,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'EPMDIAL-5112: start a replay and verify the login form appears again',
      async () => {
        await conversations.selectEntity(replayConversation.name);
        await chat.replay.click();
        toolsetSignInMock.requestSignInAgain([replayToolset]);

        await baseAssertion.assertElementState(
          toolsetLoginEventsModal,
          'visible',
        );
        const popupPromise = page.waitForEvent('popup');
        await toolsetLoginEventsModal.getLoginButton(replayToolsetName).click();
        await replayMock.navigateToCallback(await popupPromise);
        await baseAssertion.assertElementState(
          toolsetLoginEventsModal,
          'hidden',
        );
        await chatMessagesAssertion.assertMessagesCount(2);
      },
    );
  },
);

dialAdminTest(
  '[Quick app 2.0] [Admin view] login form for one public toolset in App editor for public app', // EPMDIAL-5109
  async ({
    adminPage,
    adminMarketplacePage,
    adminMarketplaceHeader,
    adminMarketplaceEntitiesSection,
    adminEntityEditorPage,
    adminQuickApp2EditorViewForm,
    adminEntityDetailsModal,
    adminDialHomePage,
    adminSendMessage,
    adminToolsetLoginEventsModal,
    adminToolsetSignInMock,
    adminToolsetApiHelper,
    quickApp2Builder,
    toolsetBuilder,
    toolsetApiHelper,
    applicationApiHelper,
    modelApiHelper,
    publicationApiHelper,
    adminPublicationApiHelper,
    adminUserItemApiHelper,
    publishRequestBuilder,
    baseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-5109');
    const toolsetName = GeneratorUtil.randomToolsetName();
    const quickAppName = GeneratorUtil.randomApplicationName();
    let publishedToolset: Toolset;
    let oauthMock: OAuthMockHelper;

    await dialAdminTest.step(
      'Precondition: publish a toolset, then a Quick app 2.0 that uses it',
      async () => {
        await toolsetApiHelper.createToolset(
          toolsetBuilder.withDisplayName(toolsetName).build(),
        );
        const toolset = (await toolsetApiHelper.getToolset(toolsetName))!;

        const toolsetPublication =
          await publicationApiHelper.createPublishRequest(
            publishRequestBuilder
              .withName(GeneratorUtil.randomPublicationRequestName())
              .withToolsetResource(toolset, PublishActions.ADD)
              .build(),
          );
        await adminPublicationApiHelper.approveRequest(toolsetPublication);
        const toolsetResource = toolsetPublication.resources.find(
          (r) => r.sourceUrl === toolset.id,
        )!;
        publishedToolset = await adminUserItemApiHelper.getItem<Toolset>(
          toolsetResource.targetUrl,
        );
        // A published toolset comes back without `id`.
        publishedToolset.id ??= toolsetResource.targetUrl;

        const model = await modelApiHelper.getToolSupportingModel();
        const quickApp = await applicationApiHelper.createApplication(
          quickApp2Builder
            .withDisplayName(quickAppName)
            .withOrchestratorModel(model.id)
            .addToolset(publishedToolset.id)
            .build(),
        );
        const appPublication = await publicationApiHelper.createPublishRequest(
          publishRequestBuilder
            .withName(GeneratorUtil.randomPublicationRequestName())
            .withApplicationResource(quickApp, PublishActions.ADD)
            .build(),
        );
        await adminPublicationApiHelper.approveRequest(appPublication);
      },
    );

    await dialAdminTest.step(
      'Mock the public toolset as logged out with both org and personal creds',
      async () => {
        oauthMock = await adminToolsetSignInMock.loggedOutOAuthMock(
          publishedToolset,
          GeneratorUtil.randomUrl(),
        );
        await adminToolsetSignInMock.setupToolsetsListingRoute(
          await adminToolsetApiHelper.listToolsets(),
          [oauthMock],
        );
      },
    );

    await dialAdminTest.step(
      'Admin opens the published Quick app 2.0 in view mode',
      async () => {
        await adminMarketplacePage.openMarketplacePage({
          updateInstalledDeployments: false,
          updateInstalledToolsets: false,
          getInstalledToolsets: false,
        });
        await adminMarketplacePage.waitForPageLoaded();
        await adminMarketplaceHeader.agentsTab.click();
        await adminMarketplaceHeader
          .getSearch()
          .inputField.fillInInput(quickAppName);
        const quickAppCard =
          await adminMarketplaceEntitiesSection.findEntityElement(quickAppName);
        await quickAppCard.click();
        await adminEntityDetailsModal.viewButton.click();
        await adminEntityEditorPage.waitForPageLoadedForEdit(
          EntityEditorAppTypes.QuickApp2,
        );
        await baseAssertion.assertElementClass(
          adminQuickApp2EditorViewForm.getChipByName(toolsetName),
          new RegExp(AddQuickApp2SettingsFormSelector.errorChipClass),
        );
      },
    );

    await dialAdminTest.step(
      'Send a message in the preview and log in to the toolset',
      async () => {
        await adminToolsetSignInMock.setupSignInChannel([publishedToolset]);
        await adminDialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await adminSendMessage.messageInput.fillInInput(
          GeneratorUtil.randomString(10),
        );
        await adminSendMessage.sendMessageButton.click();
        await baseAssertion.assertElementState(
          adminToolsetLoginEventsModal,
          'visible',
        );

        const popupPromise = adminPage.waitForEvent('popup');
        await adminToolsetLoginEventsModal.getLoginButton(toolsetName).click();
        await oauthMock.navigateToCallback(await popupPromise);
        await baseAssertion.assertElementState(
          adminToolsetLoginEventsModal,
          'hidden',
        );
      },
    );

    await dialAdminTest.step(
      'The chip turns from red to blue and its card stays closed in view mode',
      async () => {
        await baseAssertion.assertElementClass(
          adminQuickApp2EditorViewForm.getChipByName(toolsetName),
          new RegExp(AddQuickApp2SettingsFormSelector.activeChipClass),
        );
        await adminQuickApp2EditorViewForm.clickChipByName(toolsetName);
        await baseAssertion.assertElementState(
          adminEntityDetailsModal,
          'hidden',
        );
      },
    );
  },
);

dialAdminTest(
  '[Quick app 2.0] [Admin view] login form for one public toolset in App editor for app in Approve required - Log in OAuth\n' + // EPMDIAL-5108
    '[Quick app 2.0] [Admin view] NO login form for one not public toolset in App editor for app in Approve required', // EPMDIAL-5107
  async ({
    adminPage,
    adminDialHomePage,
    adminApproveRequiredConversations,
    adminPublishingApprovalModal,
    adminPublishedApplicationReviewModal,
    adminEntityEditorPage,
    adminQuickApp2EditorViewForm,
    adminEntityDetailsModal,
    adminEntityDetailsModalAssertion,
    adminSendMessage,
    adminChatMessagesAssertion,
    adminToolsetLoginEventsModal,
    adminToolsetSignInMock,
    adminToolsetApiHelper,
    adminToast,
    quickApp2Builder,
    toolsetBuilder,
    toolsetApiHelper,
    applicationApiHelper,
    modelApiHelper,
    publicationApiHelper,
    adminPublicationApiHelper,
    adminUserItemApiHelper,
    publishRequestBuilder,
    baseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-5108', 'EPMDIAL-5107');
    const publicToolsetName = GeneratorUtil.randomToolsetName();
    const ownToolsetName = GeneratorUtil.randomToolsetName();
    const publicToolsetAppName = GeneratorUtil.randomApplicationName();
    const ownToolsetAppName = GeneratorUtil.randomApplicationName();
    const publicToolsetRequestName =
      GeneratorUtil.randomPublicationRequestName();
    const ownToolsetRequestName = GeneratorUtil.randomPublicationRequestName();
    const version = ExpectedConstants.defaultEntityVersion;
    let publicToolset: Toolset;
    let oauthMock: OAuthMockHelper;

    await dialAdminTest.step(
      'Precondition: publish one toolset and keep the other private',
      async () => {
        for (const name of [publicToolsetName, ownToolsetName]) {
          await toolsetApiHelper.createToolset(
            toolsetBuilder.withDisplayName(name).build(),
          );
        }
        const createdToolset =
          (await toolsetApiHelper.getToolset(publicToolsetName))!;

        const publication = await publicationApiHelper.createPublishRequest(
          publishRequestBuilder
            .withName(GeneratorUtil.randomPublicationRequestName())
            .withToolsetResource(createdToolset, PublishActions.ADD)
            .build(),
        );
        await adminPublicationApiHelper.approveRequest(publication);
        const resource = publication.resources.find(
          (r) => r.sourceUrl === createdToolset.id,
        )!;
        publicToolset = await adminUserItemApiHelper.getItem<Toolset>(
          resource.targetUrl,
        );
        // A published toolset comes back without `id`.
        publicToolset.id ??= resource.targetUrl;
      },
    );

    await dialAdminTest.step(
      'Precondition: create a Quick app 2.0 per toolset and a publication request for each',
      async () => {
        const model = await modelApiHelper.getToolSupportingModel();
        const ownToolset = (await toolsetApiHelper.getToolset(ownToolsetName))!;

        const publicToolsetApp = await applicationApiHelper.createApplication(
          quickApp2Builder
            .withDisplayName(publicToolsetAppName)
            .withOrchestratorModel(model.id)
            .addToolset(publicToolset.id!)
            .build(),
        );
        const ownToolsetApp = await applicationApiHelper.createApplication(
          quickApp2Builder
            .withDisplayName(ownToolsetAppName)
            .withOrchestratorModel(model.id)
            .addToolset(ownToolset.id!)
            .build(),
        );

        // Left pending on purpose - the apps must stay in Approve required.
        await publicationApiHelper.createPublishRequest(
          publishRequestBuilder
            .withName(publicToolsetRequestName)
            .withApplicationResource(publicToolsetApp, PublishActions.ADD)
            .build(),
        );
        await publicationApiHelper.createPublishRequest(
          publishRequestBuilder
            .withName(ownToolsetRequestName)
            .withApplicationResource(ownToolsetApp, PublishActions.ADD)
            .build(),
        );
      },
    );

    await dialAdminTest.step(
      'Mock the public toolset as logged out for the admin',
      async () => {
        oauthMock = await adminToolsetSignInMock.loggedOutOAuthMock(
          publicToolset,
          GeneratorUtil.randomUrl(),
        );
        await adminToolsetSignInMock.setupToolsetsListingRoute(
          await adminToolsetApiHelper.listToolsets(),
          [oauthMock],
        );
      },
    );

    await dialAdminTest.step(
      'Admin opens the publication request with the public toolset and goes to edit',
      async () => {
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredConversations.selectRequest(
          publicToolsetRequestName,
        );
        await adminPublishingApprovalModal.goToEntityReview();
        await baseAssertion.assertElementState(
          adminPublishedApplicationReviewModal,
          'visible',
        );
        await adminPublishedApplicationReviewModal.editApplicationButton.click();
        await adminEntityEditorPage.waitForPageLoadedForEdit(
          EntityEditorAppTypes.QuickApp2,
        );
      },
    );

    await dialAdminTest.step(
      'EPMDIAL-5108: send a message in the preview and log in from the form',
      async () => {
        await adminToolsetSignInMock.setupSignInChannel([publicToolset]);
        await adminDialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await adminSendMessage.messageInput.fillInInput(
          GeneratorUtil.randomString(10),
        );
        await adminSendMessage.sendMessageButton.click();
        await baseAssertion.assertElementState(
          adminToolsetLoginEventsModal,
          'visible',
        );

        const popupPromise = adminPage.waitForEvent('popup');
        await adminToolsetLoginEventsModal
          .getLoginButton(publicToolsetName)
          .click();
        await oauthMock.navigateToCallback(await popupPromise);
        await baseAssertion.assertElementState(
          adminToolsetLoginEventsModal,
          'hidden',
        );
        await baseAssertion.assertElementText(
          adminToast,
          ExpectedConstants.personalLoginSuccessfulMessage(
            publicToolsetName,
            version,
          ),
        );
        await adminToast.closeToast();
      },
    );

    await dialAdminTest.step(
      'EPMDIAL-5108: the toolset card shows the toolset is logged in with My creds',
      async () => {
        await adminQuickApp2EditorViewForm.clickChipByName(publicToolsetName);
        await adminEntityDetailsModalAssertion.assertEntityCommonAttributes({
          expectedCredsLabel: Creds.myCreds,
        });
        await adminEntityDetailsModal.closeButton.click();
      },
    );

    await dialAdminTest.step(
      'Admin opens the publication request with the private toolset and goes to edit',
      async () => {
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredConversations.selectRequest(
          ownToolsetRequestName,
        );
        await adminPublishingApprovalModal.goToEntityReview();
        await adminPublishedApplicationReviewModal.editApplicationButton.click();
        await adminEntityEditorPage.waitForPageLoadedForEdit(
          EntityEditorAppTypes.QuickApp2,
        );
      },
    );

    await dialAdminTest.step(
      'EPMDIAL-5107: the private toolset is not available to the admin and no login is asked',
      async () => {
        // The admin cannot see someone else's private toolset, so it resolves to
        // nothing in the listing and the chip goes red.
        await baseAssertion.assertElementClass(
          adminQuickApp2EditorViewForm.getChipByName(ownToolsetName),
          new RegExp(AddQuickApp2SettingsFormSelector.errorChipClass),
        );

        await adminSendMessage.messageInput.fillInInput(
          GeneratorUtil.randomString(10),
        );
        await adminSendMessage.sendMessageButton.click();
        await adminChatMessagesAssertion.assertMessagesCount(2);
        // NOTE: the ticket also expects a Forbidden error in the response. That
        // text comes from the real orchestration while the response here is
        // mocked, so only the absence of the login form is checked.
        await baseAssertion.assertElementState(
          adminToolsetLoginEventsModal,
          'hidden',
        );
      },
    );
  },
);
