import dialTest from '@/src/core/dialFixtures';
import { EntityEditorAppTypes, MenuOptions } from '@/src/testData';
import { OAuthMockHelper } from '@/src/testData/toolsets/oauthMockHelper';
import { GeneratorUtil } from '@/src/utils';
import { PublishActions, Toolset } from '@epam/ai-dial-shared';

dialTest(
  '[Quick app 2.0] Context menu is not available for cards for agents and toolsets without login\n' + // EPMRTC-6943
    '[Quick app 2.0] Context menu with login/logout available for cards for toolsets with login', // EPMRTC-7265
  async ({
    marketplacePage,
    entityEditorPage,
    entityEditorGeneralForm,
    quickApp2EditorViewForm,
    agentAndToolsetSelectModal,
    agentAndToolsetSelectModalEntityMenuAssertion,
    toolsetBuilder,
    toolsetApiHelper,
    customApplicationBuilder,
    applicationApiHelper,
    adminApplicationApiHelper,
    adminPublicationApiHelper,
    publishRequestBuilder,
    baseAssertion,
    page,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-6943', 'EPMRTC-7265');
    const loginToolsetName = GeneratorUtil.randomToolsetName();
    const noLoginToolsetName = GeneratorUtil.randomToolsetName();
    const ownAppName = GeneratorUtil.randomApplicationName();
    const publicAgentName = GeneratorUtil.randomApplicationName();
    const quickAppName = GeneratorUtil.randomApplicationName();
    let loginToolset: Toolset;

    await dialTest.step(
      'Precondition: create own toolsets (with/without login) and an own app; publish a public agent',
      async () => {
        await toolsetApiHelper.createToolset(
          toolsetBuilder.withDisplayName(loginToolsetName).build(),
        );
        loginToolset = (await toolsetApiHelper.getToolset(loginToolsetName))!;

        await toolsetApiHelper.createToolset(
          toolsetBuilder.withDisplayName(noLoginToolsetName).build(),
        );
        await applicationApiHelper.createApplication(
          customApplicationBuilder.withDisplayName(ownAppName).build(),
        );

        const adminApp = await adminApplicationApiHelper.createApplication(
          customApplicationBuilder.withDisplayName(publicAgentName).build(),
        );
        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withApplicationResource(adminApp, PublishActions.ADD)
          .build();
        const publication =
          await adminPublicationApiHelper.createPublishRequest(publishRequest);
        await adminPublicationApiHelper.approveRequest(publication);
      },
    );

    await dialTest.step(
      'Make one own toolset appear as supporting login (mock its auth settings)',
      async () => {
        // The backend rejects a real OAuth endpoint, so inject auth_settings into
        // the toolset listing. No login is performed here.
        const oauthMock = new OAuthMockHelper(
          page,
          loginToolset,
          GeneratorUtil.randomUrl(),
        );
        await oauthMock.setupToolsetListingRoute();
        oauthMock.enableMocking();
      },
    );

    await dialTest.step(
      'Open Quick app 2.0 creation and proceed to App settings',
      async () => {
        await marketplacePage.openCreateQuickApp2Page({
          updateInstalledEntities: false,
        });
        await entityEditorPage.waitForPageLoaded(
          EntityEditorAppTypes.QuickApp2,
        );
        await entityEditorGeneralForm.fillInEntityFields({
          name: quickAppName,
        });
        await entityEditorGeneralForm.goNext();
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorAppTypes.QuickApp2,
        );
        await quickApp2EditorViewForm.addAgentsButton.click();
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Toolset with login: its card has a context menu with the Log in option',
      async () => {
        const card =
          await agentAndToolsetSelectModal.searchForEntity(loginToolsetName);
        await card.hoverOver();
        const dotsMenu = agentAndToolsetSelectModal
          .getEntities()
          .getEntityElementDotsMenu(card);
        await baseAssertion.assertElementState(dotsMenu, 'visible');
        await dotsMenu.click();
        await agentAndToolsetSelectModalEntityMenuAssertion.assertMenuIncludesOptions(
          MenuOptions.login,
        );
        await dotsMenu.click(); // close the menu before moving on
      },
    );

    await dialTest.step(
      'Own toolset without login and own app: their cards have no context menu',
      async () => {
        for (const name of [noLoginToolsetName, ownAppName]) {
          const card = await agentAndToolsetSelectModal.searchForEntity(name);
          await baseAssertion.assertElementState(card, 'visible');
          await card.hoverOver();
          await baseAssertion.assertElementState(
            agentAndToolsetSelectModal
              .getEntities()
              .getEntityElementDotsMenu(card),
            'hidden',
          );
        }
      },
    );

    await dialTest.step(
      'Public agent on the Marketplace tab: its card has no context menu',
      async () => {
        await agentAndToolsetSelectModal.marketplaceTab.click();
        const card =
          await agentAndToolsetSelectModal.searchForEntity(publicAgentName);
        await baseAssertion.assertElementState(card, 'visible');
        await card.hoverOver();
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal
            .getEntities()
            .getEntityElementDotsMenu(card),
          'hidden',
        );
      },
    );
  },
);
