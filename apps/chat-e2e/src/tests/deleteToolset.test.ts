import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedDeleteToolsetModalData,
  MenuOptions,
} from '@/src/testData';
import { OAuthMockHelper } from '@/src/testData/toolsets/oauthMockHelper';
import { BaseElement } from '@/src/ui/webElements';
import { GeneratorUtil, toolsetNamePrefix } from '@/src/utils';

dialTest(
  'Delete toolset using button on card detailed view',
  async ({
    marketplacePage,
    marketplaceHeader,
    marketplaceEntitiesSection,
    entityDetailsModal,
    entityDetailsModalAssertion,
    confirmationDialog,
    confirmationDialogAssertion,
    toolsetBuilder,
    toolsetApiHelper,
    baseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-6878');
    const toolsetName = GeneratorUtil.randomToolsetName();
    const toolsetVersion = GeneratorUtil.randomEntityVersion();
    let toolsetElement: BaseElement;

    await dialTest.step('Create toolset via API', async () => {
      const toolsetModel = toolsetBuilder
        .withDisplayName(toolsetName)
        .withDisplayVersion(toolsetVersion)
        .build();
      await toolsetApiHelper.createToolset(toolsetModel);
    });

    await dialTest.step(
      'Find toolset card and click on it to open detailed view',
      async () => {
        await marketplacePage.openMarketplacePage();
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.toolsetsTab.click();
        await marketplaceHeader.getSearch().inputField.fillInInput(toolsetName);
        toolsetElement = await marketplaceEntitiesSection.findEntityElement(
          toolsetName,
          { isWorkspaceEntity: true, isEditable: true },
        );
        await toolsetElement.click();
        await entityDetailsModalAssertion.assertElementState(
          entityDetailsModal,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Click Delete icon and verify confirmation dialog is displayed with correct content',
      async () => {
        await entityDetailsModal.deleteButton.click();
        await baseAssertion.assertElementState(confirmationDialog, 'visible');
        await confirmationDialogAssertion.assertConfirmationDialogTitle(
          ExpectedDeleteToolsetModalData.title,
        );
        await confirmationDialogAssertion.assertConfirmationMessage(
          ExpectedDeleteToolsetModalData.message(toolsetName, toolsetVersion),
        );
        await confirmationDialogAssertion.assertElementText(
          confirmationDialog.cancelButton,
          ExpectedDeleteToolsetModalData.cancelButton,
        );
        await confirmationDialogAssertion.assertElementText(
          confirmationDialog.confirmButton,
          ExpectedDeleteToolsetModalData.confirmButton,
        );
      },
    );

    await dialTest.step(
      'Confirm deletion and verify confirmation dialog and entity details modal are closed',
      async () => {
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        await baseAssertion.assertElementState(confirmationDialog, 'hidden');
        await entityDetailsModalAssertion.assertElementState(
          entityDetailsModal,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Verify deleted toolset card is no longer displayed on the page',
      async () => {
        await baseAssertion.assertElementState(toolsetElement, 'hidden');
      },
    );
  },
);

dialTest(
  '[Toolset]: Delete action for toolset with special symbols in name and OAuth type of authentication.\n' +
    'Delete toolset using  context menu option',
  async ({
    marketplacePage,
    marketplaceHeader,
    marketplaceEntitiesSection,
    marketplaceEntities,
    entityDetailsModal,
    entityDetailsModalAssertion,
    confirmationDialog,
    toolsetBuilder,
    toolsetApiHelper,
    baseAssertion,
    setTestIds,
    page,
  }) => {
    setTestIds('EPMRTC-7064', 'EPMRTC-6879');
    const toolsetEntity = {
      name: toolsetNamePrefix + ExpectedConstants.allowedSpecialSymbolsInName(),
      version: GeneratorUtil.randomEntityVersion(),
      endpoint: GeneratorUtil.randomUrl(),
    };
    let oauthMockHelper: OAuthMockHelper;
    let toolsetElement: BaseElement;

    await dialTest.step(
      'Create toolset with special symbols in name via API and set up OAuth mock as pre-authenticated',
      async () => {
        const toolsetModel = toolsetBuilder
          .withDisplayName(toolsetEntity.name)
          .withDisplayVersion(toolsetEntity.version)
          .withEndpoint(toolsetEntity.endpoint)
          .build();
        await toolsetApiHelper.createToolset(toolsetModel);
        const createdToolset = (await toolsetApiHelper.getToolset(
          toolsetEntity.name,
          toolsetEntity.version,
        ))!;
        oauthMockHelper = new OAuthMockHelper(
          page,
          createdToolset,
          toolsetEntity.endpoint,
        );
        oauthMockHelper.setIsSignedInGlobal(true);
        await oauthMockHelper.setupMocks();
        oauthMockHelper.enableMocking();
      },
    );

    await dialTest.step(
      'Open Marketplace Toolsets page, find the toolset card and open its dot menu',
      async () => {
        await marketplacePage.openToolsetsPage();
        await marketplaceHeader
          .getSearch()
          .inputField.fillInInput(toolsetEntity.name);
        toolsetElement = await marketplaceEntitiesSection.findEntityElement(
          toolsetEntity.name,
          { isWorkspaceEntity: true, isEditable: true },
        );
        await toolsetElement.hoverOver();
        await marketplaceEntities
          .getEntityElementDotsMenu(toolsetElement)
          .click();
      },
    );

    await dialTest.step(
      'Select Delete option, confirm deletion and verify toolset is removed',
      async () => {
        await marketplaceEntities
          .getEntityDropdownMenu()
          .selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        await entityDetailsModalAssertion.assertElementState(
          entityDetailsModal,
          'hidden',
        );
        await baseAssertion.assertElementState(toolsetElement, 'hidden');
      },
    );
  },
);
