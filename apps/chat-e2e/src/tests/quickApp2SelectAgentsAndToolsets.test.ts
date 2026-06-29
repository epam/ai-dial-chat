import dialTest from '@/src/core/dialFixtures';
import { AddAppMenuOptions, EntityEditorAppTypes } from '@/src/testData';
import { GeneratorUtil } from '@/src/utils';
import { PublishActions } from '@epam/ai-dial-shared';

dialTest(
  '[Select agents and toolsets] No changes are applied if user closes the modal on Cancel\n' +
    '[Select agents and toolsets] No changes are applied if user closes the modal on X', // EPMRTC-7320 + EPMRTC-7321
  async ({
    marketplacePage,
    marketplaceHeader,
    addAppDropdownMenu,
    entityEditorPage,
    entityEditorGeneralForm,
    quickApp2EditorViewForm,
    agentAndToolsetSelectModal,
    agentAndToolsetSelectModalAssertion,
    customApplicationBuilder,
    toolsetBuilder,
    applicationApiHelper,
    toolsetApiHelper,
    baseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-7320', 'EPMRTC-7321');
    const agentName = GeneratorUtil.randomApplicationName();
    const toolsetName = GeneratorUtil.randomToolsetName();
    const quickAppName = GeneratorUtil.randomApplicationName();

    await dialTest.step(
      'Precondition: create an agent and a toolset to select via API',
      async () => {
        await applicationApiHelper.createApplication(
          customApplicationBuilder.withDisplayName(agentName).build(),
        );
        await toolsetApiHelper.createToolset(
          toolsetBuilder.withDisplayName(toolsetName).build(),
        );
      },
    );

    await dialTest.step('Open My workspace', async () => {
      await marketplacePage.openMyWorkspacePage({
        updateInstalledDeployments: false,
        getStyles: true,
      });
      await marketplacePage.waitForPageLoaded();
    });

    await dialTest.step('Start Quick app 2.0 creation', async () => {
      await marketplaceHeader.addAppButton.click();
      await addAppDropdownMenu.selectMenuOption(AddAppMenuOptions.quickApp2);
      await entityEditorPage.waitForPageLoaded(EntityEditorAppTypes.QuickApp2);
    });

    await dialTest.step(
      'Fill in the name and proceed to the App settings step',
      async () => {
        await entityEditorGeneralForm.fillInEntityFields({
          name: quickAppName,
        });
        await entityEditorGeneralForm.goNext();
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorAppTypes.QuickApp2,
        );
      },
    );

    await dialTest.step(
      'Select an agent and a toolset, then close the modal on Cancel — nothing is added to the field',
      async () => {
        await quickApp2EditorViewForm.addAgentsButton.click();
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal,
          'visible',
        );
        await agentAndToolsetSelectModal.selectEntities([
          agentName,
          toolsetName,
        ]);
        await agentAndToolsetSelectModalAssertion.assertSelected([
          agentName,
          toolsetName,
        ]);
        await agentAndToolsetSelectModal.getCancelButton().click();
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal,
          'hidden',
        );
        for (const name of [agentName, toolsetName]) {
          await baseAssertion.assertElementState(
            quickApp2EditorViewForm.getChipByName(name),
            'hidden',
          );
        }
        await baseAssertion.assertElementState(
          quickApp2EditorViewForm.noAgentsAndToolsetsPlaceholder,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Reopen the modal — the Selected section is empty',
      async () => {
        await quickApp2EditorViewForm.addAgentsButton.click();
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal,
          'visible',
        );
        await agentAndToolsetSelectModalAssertion.assertNothingSelected();
      },
    );

    await dialTest.step(
      'Select an agent and a toolset, then close the modal on X — nothing is added to the field',
      async () => {
        await agentAndToolsetSelectModal.selectEntities([
          agentName,
          toolsetName,
        ]);
        await agentAndToolsetSelectModalAssertion.assertSelected([
          agentName,
          toolsetName,
        ]);
        await agentAndToolsetSelectModal.getCloseButton().click();
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal,
          'hidden',
        );
        for (const name of [agentName, toolsetName]) {
          await baseAssertion.assertElementState(
            quickApp2EditorViewForm.getChipByName(name),
            'hidden',
          );
        }
        await baseAssertion.assertElementState(
          quickApp2EditorViewForm.noAgentsAndToolsetsPlaceholder,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Reopen the modal — the Selected section is still empty',
      async () => {
        await quickApp2EditorViewForm.addAgentsButton.click();
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal,
          'visible',
        );
        await agentAndToolsetSelectModalAssertion.assertNothingSelected();
      },
    );
  },
);

dialTest(
  '[Select agents and toolsets] the quick app which is currently being CREATED could not be found and added\n' +
    '[Select agents and toolsets] the quick app which is currently being EDITED could not be found and added', // EPMRTC-7285 + EPMRTC-7286
  async ({
    marketplacePage,
    marketplaceHeader,
    addAppDropdownMenu,
    entityEditorPage,
    entityEditorGeneralForm,
    entityEditorHeader,
    entityDetailsModal,
    quickApp2EditorViewForm,
    agentAndToolsetSelectModal,
    baseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-7285', 'EPMRTC-7286');
    const quickAppName = GeneratorUtil.randomApplicationName();

    await dialTest.step('Open My workspace', async () => {
      await marketplacePage.openMyWorkspacePage({
        updateInstalledDeployments: false,
        getStyles: true,
      });
      await marketplacePage.waitForPageLoaded();
    });

    await dialTest.step('Start Quick app 2.0 creation', async () => {
      await marketplaceHeader.addAppButton.click();
      await addAppDropdownMenu.selectMenuOption(AddAppMenuOptions.quickApp2);
      await entityEditorPage.waitForPageLoaded(EntityEditorAppTypes.QuickApp2);
    });

    await dialTest.step(
      'Fill in the name and proceed to the App settings step',
      async () => {
        await entityEditorGeneralForm.fillInEntityFields({
          name: quickAppName,
        });
        await entityEditorGeneralForm.goNext();
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorAppTypes.QuickApp2,
        );
      },
    );

    await dialTest.step(
      'Search the app being created in the select modal — it cannot add itself',
      async () => {
        await quickApp2EditorViewForm.addAgentsButton.click();
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal,
          'visible',
        );
        await agentAndToolsetSelectModal.searchInput.fillInInput(quickAppName);
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal.noResultsFound,
          'visible',
        );
        await agentAndToolsetSelectModal.getCloseButton().click();
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Save the app and exit — the entity details modal opens',
      async () => {
        await entityEditorHeader.saveAndExitButton.click();
        await baseAssertion.assertElementState(entityDetailsModal, 'visible');
      },
    );

    await dialTest.step(
      'Open the saved app for editing from the details modal',
      async () => {
        await entityDetailsModal.editButton.click();
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorAppTypes.QuickApp2,
        );
      },
    );

    await dialTest.step(
      'Search the app being edited in the select modal — it cannot add itself',
      async () => {
        await quickApp2EditorViewForm.addAgentsButton.click();
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal,
          'visible',
        );
        await agentAndToolsetSelectModal.searchInput.fillInInput(quickAppName);
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal.noResultsFound,
          'visible',
        );
      },
    );
  },
);

dialTest(
  '[Select agents and toolsets] Agent and toolsets are added if user closes the modal on Confirm\n' +
    '[Select agents and toolsets] Agent or toolset added from Marketplace tab are NOT added to My workspace automatically on Confirm\n' +
    '[Select agents and toolsets] My workspace tab is always pre-selected',
  async ({
    marketplacePage,
    marketplaceHeader,
    addAppDropdownMenu,
    entityEditorPage,
    entityEditorGeneralForm,
    quickApp2EditorViewForm,
    agentAndToolsetSelectModal,
    agentAndToolsetSelectModalAssertion,
    customApplicationBuilder,
    toolsetBuilder,
    adminApplicationApiHelper,
    adminToolsetApiHelper,
    adminPublicationApiHelper,
    publishRequestBuilder,
    baseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-7322', 'EPMRTC-7220', 'EPMRTC-7963');
    const appName = GeneratorUtil.randomApplicationName();
    const toolsetName = GeneratorUtil.randomToolsetName();
    const quickAppName = GeneratorUtil.randomApplicationName();
    const marketplaceEntities = [appName, toolsetName];

    await dialTest.step(
      'Precondition: admin publishes an app and a toolset to the Marketplace',
      async () => {
        const adminApp = await adminApplicationApiHelper.createApplication(
          customApplicationBuilder.withDisplayName(appName).build(),
        );
        const toolsetModel = toolsetBuilder
          .withDisplayName(toolsetName)
          .build();
        await adminToolsetApiHelper.createToolset(toolsetModel);
        const adminToolset =
          (await adminToolsetApiHelper.getToolset(toolsetName))!;
        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withApplicationResource(adminApp, PublishActions.ADD)
          .withToolsetResource(adminToolset, PublishActions.ADD)
          .build();
        const publication =
          await adminPublicationApiHelper.createPublishRequest(publishRequest);
        await adminPublicationApiHelper.approveRequest(publication);
      },
    );

    await dialTest.step('Open My workspace', async () => {
      await marketplacePage.openMyWorkspacePage({
        updateInstalledDeployments: false,
        getStyles: true,
      });
      await marketplacePage.waitForPageLoaded();
    });

    await dialTest.step('Start Quick app 2.0 creation', async () => {
      await marketplaceHeader.addAppButton.click();
      await addAppDropdownMenu.selectMenuOption(AddAppMenuOptions.quickApp2);
      await entityEditorPage.waitForPageLoaded(EntityEditorAppTypes.QuickApp2);
    });

    await dialTest.step(
      'Fill in the name and proceed to the App settings step',
      async () => {
        await entityEditorGeneralForm.fillInEntityFields({
          name: quickAppName,
        });
        await entityEditorGeneralForm.goNext();
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorAppTypes.QuickApp2,
        );
      },
    );

    await dialTest.step(
      'Open the select modal — My workspace tab is pre-selected, then pick the published app and toolset from Marketplace',
      async () => {
        await quickApp2EditorViewForm.addAgentsButton.click();
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal,
          'visible',
        );
        await agentAndToolsetSelectModalAssertion.assertTabIsActive(
          agentAndToolsetSelectModal.myWorkspaceTab,
        );
        await agentAndToolsetSelectModal.marketplaceTab.click();
        await agentAndToolsetSelectModal.selectEntities(marketplaceEntities);
        await agentAndToolsetSelectModalAssertion.assertSelected(
          marketplaceEntities,
        );
      },
    );

    await dialTest.step(
      'Confirm — the app and toolset are added to the field',
      async () => {
        await agentAndToolsetSelectModal.confirmButton.click();
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal,
          'hidden',
        );
        for (const name of marketplaceEntities) {
          await baseAssertion.assertElementState(
            quickApp2EditorViewForm.getChipByName(name),
            'visible',
          );
        }
      },
    );

    await dialTest.step(
      'Reopen the modal — My workspace tab is pre-selected again and the picked items are NOT in My workspace',
      async () => {
        await quickApp2EditorViewForm.addAgentsButton.click();
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal,
          'visible',
        );
        await agentAndToolsetSelectModalAssertion.assertTabIsActive(
          agentAndToolsetSelectModal.myWorkspaceTab,
        );
        for (const name of marketplaceEntities) {
          await agentAndToolsetSelectModal.searchInput.fillInInput(name);
          await baseAssertion.assertElementState(
            agentAndToolsetSelectModal.noResultsFound,
            'visible',
          );
        }
      },
    );
  },
);
