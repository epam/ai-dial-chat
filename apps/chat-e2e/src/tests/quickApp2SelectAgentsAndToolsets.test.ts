import dialTest from '@/src/core/dialFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import { AddAppMenuOptions, EntityEditorAppTypes } from '@/src/testData';
import { ApplicationsUtil, GeneratorUtil } from '@/src/utils';
import { PublishActions, Toolset } from '@epam/ai-dial-shared';

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

dialSharedWithMeTest(
  "[Select agents and toolsets] available agents and toolsets on 'My workspace'\n" +
    "[Select agents and toolsets] available agents and toolsets on 'Marketplace'\n" +
    "[Select agents and toolsets] External app is not available on 'My workspace'/'Marketplace'", // EPMRTC-7318 + EPMRTC-7319 + EPMRTC-7976
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
    externalApplicationBuilder,
    applicationApiHelper,
    toolsetApiHelper,
    fileApiHelper,
    modelApiHelper,
    adminApplicationApiHelper,
    adminToolsetApiHelper,
    adminPublicationApiHelper,
    publishRequestBuilder,
    additionalUserApplicationApiHelper,
    additionalUserShareApiHelper,
    mainUserShareApiHelper,
    baseAssertion,
    setTestIds,
  }) => {
    dialSharedWithMeTest.slow();
    setTestIds('EPMRTC-7318', 'EPMRTC-7319', 'EPMRTC-7976');
    const myAppName = GeneratorUtil.randomApplicationName();
    const myToolsetName = GeneratorUtil.randomToolsetName();
    const bookmarkedAppName = GeneratorUtil.randomApplicationName();
    const bookmarkedToolsetName = GeneratorUtil.randomToolsetName();
    const publicAppName = GeneratorUtil.randomApplicationName();
    const publicToolsetName = GeneratorUtil.randomToolsetName();
    const sharedAppName = GeneratorUtil.randomApplicationName();
    const externalAppName = GeneratorUtil.randomApplicationName();
    const quickAppName = GeneratorUtil.randomApplicationName();

    const myWorkspaceVisible = [
      myAppName,
      myToolsetName,
      bookmarkedAppName,
      bookmarkedToolsetName,
      sharedAppName,
    ];
    // Not-bookmarked public items and the external app must not be on My workspace.
    const myWorkspaceHidden = [
      publicAppName,
      publicToolsetName,
      externalAppName,
    ];
    const marketplaceVisible = [
      bookmarkedAppName,
      bookmarkedToolsetName,
      publicAppName,
      publicToolsetName,
    ];
    // The external app is not available on the Marketplace tab either.
    const marketplaceHidden = [externalAppName];

    await dialSharedWithMeTest.step(
      'Precondition: main user creates an app and a toolset (My workspace source)',
      async () => {
        await applicationApiHelper.createApplication(
          customApplicationBuilder.withDisplayName(myAppName).build(),
        );
        await toolsetApiHelper.createToolset(
          toolsetBuilder.withDisplayName(myToolsetName).build(),
        );
      },
    );

    let bookmarkedToolset: Toolset | undefined;
    await dialSharedWithMeTest.step(
      'Precondition: admin publishes two apps and two toolsets to the Marketplace',
      async () => {
        const adminBookmarkedApp =
          await adminApplicationApiHelper.createApplication(
            customApplicationBuilder.withDisplayName(bookmarkedAppName).build(),
          );
        const adminPublicApp =
          await adminApplicationApiHelper.createApplication(
            customApplicationBuilder.withDisplayName(publicAppName).build(),
          );
        await adminToolsetApiHelper.createToolset(
          toolsetBuilder.withDisplayName(bookmarkedToolsetName).build(),
        );
        await adminToolsetApiHelper.createToolset(
          toolsetBuilder.withDisplayName(publicToolsetName).build(),
        );
        bookmarkedToolset = (await adminToolsetApiHelper.getToolset(
          bookmarkedToolsetName,
        ))!;
        const adminPublicToolset =
          (await adminToolsetApiHelper.getToolset(publicToolsetName))!;
        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withApplicationResource(adminBookmarkedApp, PublishActions.ADD)
          .withApplicationResource(adminPublicApp, PublishActions.ADD)
          .withToolsetResource(bookmarkedToolset, PublishActions.ADD)
          .withToolsetResource(adminPublicToolset, PublishActions.ADD)
          .build();
        const publication =
          await adminPublicationApiHelper.createPublishRequest(publishRequest);
        await adminPublicationApiHelper.approveRequest(publication);
        bookmarkedToolset = (await toolsetApiHelper.getToolset(
          bookmarkedToolsetName,
        ))!;
      },
    );

    await dialSharedWithMeTest.step(
      'Precondition: an app shared with the main user and a My external app',
      async () => {
        const sharedApp =
          await additionalUserApplicationApiHelper.createApplication(
            customApplicationBuilder.withDisplayName(sharedAppName).build(),
          );
        const shareResponse =
          await additionalUserShareApiHelper.shareAppByLink(sharedApp);
        await mainUserShareApiHelper.acceptInvite(shareResponse);

        await applicationApiHelper.createApplication(
          externalApplicationBuilder
            .withDisplayName(externalAppName)
            .withExternalUrl(`http://${GeneratorUtil.randomString(6)}.com`)
            .withApplicationTypeSchemaId(
              ApplicationsUtil.getAppSchemaByName(
                EntityEditorAppTypes.ExternalApp,
              ),
            )
            .build(),
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Precondition: main user bookmarks one published app and one published toolset',
      async () => {
        const bookmarkedApp = await modelApiHelper.getAgentByNameAndVersion({
          name: bookmarkedAppName,
        });
        await fileApiHelper.updateInstalledDeployments([bookmarkedApp]);
        await fileApiHelper.updateInstalledToolsets([bookmarkedToolset!]);
      },
    );

    await dialSharedWithMeTest.step('Open My workspace', async () => {
      await marketplacePage.openMyWorkspacePage({
        updateInstalledDeployments: false,
        getStyles: true,
        updateInstalledToolsets: false,
      });
      await marketplacePage.waitForPageLoaded();
    });

    await dialSharedWithMeTest.step(
      'Start Quick app 2.0 creation',
      async () => {
        await marketplaceHeader.addAppButton.click();
        await addAppDropdownMenu.selectMenuOption(AddAppMenuOptions.quickApp2);
        await entityEditorPage.waitForPageLoaded(
          EntityEditorAppTypes.QuickApp2,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Fill in the name and proceed to the App settings step',
      async () => {
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

    await dialSharedWithMeTest.step(
      'My workspace tab shows my created and bookmarked items, but not the not-bookmarked public ones',
      async () => {
        await agentAndToolsetSelectModalAssertion.assertTabIsActive(
          agentAndToolsetSelectModal.myWorkspaceTab,
        );
        await agentAndToolsetSelectModalAssertion.assertEntitiesState(
          myWorkspaceVisible,
          'visible',
        );
        await agentAndToolsetSelectModalAssertion.assertEntitiesState(
          myWorkspaceHidden,
          'hidden',
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Marketplace tab shows all published items, but not the external app',
      async () => {
        await agentAndToolsetSelectModal.marketplaceTab.click();
        await agentAndToolsetSelectModalAssertion.assertEntitiesState(
          marketplaceVisible,
          'visible',
        );
        await agentAndToolsetSelectModalAssertion.assertEntitiesState(
          marketplaceHidden,
          'hidden',
        );
      },
    );
  },
);
