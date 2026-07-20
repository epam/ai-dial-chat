import { Publication } from '@/chat/types/publication';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import { EntityEditorAppTypes, MenuOptions } from '@/src/testData';
import { OAuthMockHelper } from '@/src/testData/toolsets/oauthMockHelper';
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
