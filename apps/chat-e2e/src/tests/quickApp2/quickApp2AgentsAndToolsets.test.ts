import { BackendEntity, EntityType } from '@/chat/types/common';
import { DialAIEntityModel } from '@/chat/types/models';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import { isApiStorageType } from '@/src/hooks/global-setup';
import {
  AddAppMenuOptions,
  AgentToolsetEntityType,
  EntityEditorAppTypes,
  EntityEditorToolsetTypes,
  ExpectedConstants,
} from '@/src/testData';
import { OAuthMockHelper } from '@/src/testData/toolsets/oauthMockHelper';
import { keys } from '@/src/ui/keyboard';
import { ButtonSelectors } from '@/src/ui/selectors/commonSelectors';
import {
  AddQuickApp2SettingsFormSelector,
  ConfirmationDialogSelectors,
} from '@/src/ui/selectors/dialogSelectors';
import { ToolsetLoginModalSelectors } from '@/src/ui/selectors/marketplaceSelectors';
import { ToolsetLoginModal } from '@/src/ui/webElements';
import { DateUtil, GeneratorUtil, UserUtil } from '@/src/utils';
import { PublishActions } from '@epam/ai-dial-shared';
import { Locator, Page } from '@playwright/test';
import { Response } from 'playwright-core';

dialTest(
  '[Agents & Toolsets] Default view when nothing is added\n' +
    '[Quick app 2.0]: Select Agents & Toolsets form is NOT open when user switch between steps after adding any item to this field\n' +
    '[Agents & Toolsets] Sorting: the mix of agents and toolsets sorted according to ASCII sorting order\n' +
    '[Quick app 2.0][UI] the page stays user-friendly while scrolling when Agents&Toolsets field has lots of items', // EPMDIAL-4921 + EPMDIAL-4930 + EPMDIAL-4927 + EPMDIAL-4928
  async ({
    page,
    marketplacePage,
    marketplaceHeader,
    addAppDropdownMenu,
    entityEditorPage,
    entityEditorHeader,
    entityEditorGeneralForm,
    quickApp2EditorViewForm,
    agentAndToolsetSelectModal,
    toolsetBuilder,
    toolsetApiHelper,
    baseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-4921', 'EPMDIAL-4930', 'EPMDIAL-4927', 'EPMDIAL-4928');
    const appName = GeneratorUtil.randomApplicationName();
    const asciiSuffix = [
      '!abc',
      '1abc',
      '[abc',
      '_abc',
      'aabc',
      'Babc',
    ] as const;
    const asciiToolsetNames = asciiSuffix.map((s) => `E2EToolset${s}`);
    const randomToolsetCount = 9;
    const randomToolsetNames: string[] = [];

    await dialTest.step(
      `Precondition: create ${asciiToolsetNames.length} ASCII-boundary toolsets + ${randomToolsetCount} random toolsets via API`,
      async () => {
        for (const name of asciiToolsetNames) {
          await toolsetApiHelper.createToolset(
            toolsetBuilder.withDisplayName(name).build(),
          );
        }
        for (let i = 0; i < randomToolsetCount; i++) {
          const name = GeneratorUtil.randomToolsetName();
          randomToolsetNames.push(name);
          await toolsetApiHelper.createToolset(
            toolsetBuilder.withDisplayName(name).build(),
          );
        }
      },
    );

    await dialTest.step('Open My workspace', async () => {
      await marketplacePage.openMyWorkspacePage({
        updateInstalledDeployments: true,
        getStyles: true,
      });
    });

    await dialTest.step(
      'Click Add app and select Quick app 2.0 from dropdown',
      async () => {
        await marketplaceHeader.addAppButton.click();
        await addAppDropdownMenu.selectMenuOption(AddAppMenuOptions.quickApp2);
        await entityEditorPage.waitForPageLoaded(
          EntityEditorAppTypes.QuickApp2,
        );
      },
    );

    await dialTest.step(
      'Fill in app name and click Next to proceed to App settings step',
      async () => {
        await entityEditorGeneralForm.fillInEntityFields({ name: appName });
        await entityEditorGeneralForm.goNext();
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorAppTypes.QuickApp2,
        );
      },
    );

    await dialTest.step(
      'Verify Agents & Toolsets default empty state: section + placeholder + Add button visible',
      async () => {
        await baseAssertion.assertElementState(
          quickApp2EditorViewForm.contextToolsSection,
          'visible',
        );
        await baseAssertion.assertElementState(
          quickApp2EditorViewForm.noAgentsAndToolsetsPlaceholder,
          'visible',
        );
        await baseAssertion.assertElementState(
          quickApp2EditorViewForm.addAgentsButton,
          'visible',
        );
      },
    );

    await dialTest.step('Add one random toolset via select modal', async () => {
      const firstToolset = randomToolsetNames[0];
      await quickApp2EditorViewForm.addAgentsButton.click();
      await agentAndToolsetSelectModal.searchInput.fillInInput(firstToolset);
      await agentAndToolsetSelectModal.selectEntityByName(firstToolset);
      await agentAndToolsetSelectModal.confirmButton.click();
      await baseAssertion.assertElementState(
        agentAndToolsetSelectModal,
        'hidden',
      );
    });

    await dialTest.step(
      'Switch to General info step via header stepper',
      async () => {
        await entityEditorHeader.goOnGeneralInfoStepWithHeaderStepper();
        await entityEditorPage.waitForPageLoaded(
          EntityEditorAppTypes.QuickApp2,
        );
      },
    );

    await dialTest.step(
      'Switch back to App settings step and verify select modal does NOT reopen',
      async () => {
        await entityEditorHeader.goToEntitySettingsStepWithHeaderStepper({
          isHttpMethodTriggered: false,
        });
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorAppTypes.QuickApp2,
        );
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal,
          'hidden',
        );
      },
    );

    await dialTest.step(
      `Add all ${asciiToolsetNames.length} ASCII-boundary toolsets in reverse order`,
      async () => {
        await quickApp2EditorViewForm.addAgentsButton.click();
        for (const name of [...asciiToolsetNames].reverse()) {
          await agentAndToolsetSelectModal.searchInput.fillInInput(name);
          await agentAndToolsetSelectModal.selectEntityByName(name);
        }
        await agentAndToolsetSelectModal.confirmButton.click();
      },
    );

    await dialTest.step(
      'Verify chips are displayed in case-insensitive ASCII ascending order',
      async () => {
        const chipNames = await quickApp2EditorViewForm.getAllChipNameTexts();
        baseAssertion.assertStringsSorting(chipNames, 'asc');
      },
    );

    await dialTest.step(
      `Add ${randomToolsetCount - 1} more random toolsets (total chips: 15)`,
      async () => {
        await quickApp2EditorViewForm.addAgentsButton.click();
        for (const name of randomToolsetNames.slice(1)) {
          await agentAndToolsetSelectModal.searchInput.fillInInput(name);
          await agentAndToolsetSelectModal.selectEntityByName(name);
        }
        await agentAndToolsetSelectModal.confirmButton.click();
      },
    );

    await dialTest.step(
      'Scroll the form down and back up via mouse wheel',
      async () => {
        const box = await quickApp2EditorViewForm.getElementBoundingBox();
        const centerX = box!.x + box!.width / 2;
        const centerY = box!.y + box!.height / 2;
        await page.mouse.move(centerX, centerY);
        await page.mouse.wheel(0, 10000);
        await page.mouse.wheel(0, -10000);
      },
    );

    await dialTest.step(
      'Verify Agents & Toolsets list is visible after mouse wheel scroll',
      async () => {
        await baseAssertion.assertElementState(
          quickApp2EditorViewForm.agentsAndToolsetsList,
          'visible',
        );
      },
    );

    await dialTest.step('Toggle Code Interpreter ON', async () => {
      await quickApp2EditorViewForm.codeInterpreterToggle.click();
    });

    await dialTest.step(
      'Scroll the form down and back up via keyboard End/Home keys',
      async () => {
        await quickApp2EditorViewForm.click();
        await page.keyboard.press(keys.end);
        await page.keyboard.press(keys.home);
      },
    );

    await dialTest.step(
      'Verify page not broken: Agents & Toolsets list and Code Interpreter field remain visible',
      async () => {
        await baseAssertion.assertElementState(
          quickApp2EditorViewForm.agentsAndToolsetsList,
          'visible',
        );
        await baseAssertion.assertElementState(
          quickApp2EditorViewForm.codeInterpreterField,
          'visible',
        );
      },
    );
  },
);

dialTest(
  '[Quick app 2.0]: Select Agents & Toolsets form is NOT open when login to selected toolset from card detailed view', // EPMDIAL-4931
  async ({
    page,
    marketplacePage,
    marketplaceHeader,
    addAppDropdownMenu,
    entityEditorPage,
    entityEditorHeader,
    entityEditorGeneralForm,
    quickApp2EditorViewForm,
    agentAndToolsetSelectModal,
    entityDetailsModal,
    toolsetEditorViewForm,
    confirmationDialog,
    toolsetBuilder,
    toolsetApiHelper,
    baseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-4931');
    dialTest.slow();
    const appName = GeneratorUtil.randomApplicationName();
    const toolsetName = GeneratorUtil.randomToolsetName();
    const toolsetEndpoint = GeneratorUtil.randomUrl();
    let oauthMockHelper!: OAuthMockHelper;
    let loginPopup!: Page;

    // TODO: workaround — two confirm dialogs render at once (QA2 form + global
    // ToolsetDialogs), so confirmationDialog.confirm() fails; click directly.
    const clickConfirmButton = async (
      confirmButton: Locator,
      {
        triggeredHttpMethod = undefined,
        triggeredHttpHost = undefined,
      }: {
        triggeredHttpMethod?: 'PUT' | 'DELETE' | 'POST' | 'GET';
        triggeredHttpHost?: string;
      } = {},
    ) => {
      if (isApiStorageType && triggeredHttpMethod) {
        const predicate = (resp: Response) =>
          triggeredHttpHost
            ? resp.request().method() === triggeredHttpMethod &&
              resp.url().includes(triggeredHttpHost)
            : resp.request().method() === triggeredHttpMethod;
        const respPromise = page.waitForResponse(predicate);
        await confirmButton.click();
        return respPromise;
      }
      await confirmButton.click();
    };

    await dialTest.step(
      'Precondition: create toolset via API, convert it to OAuth via UI edit, set up mocks, complete the OAuth login flow and save & exit',
      async () => {
        // Create the base toolset via API
        await toolsetApiHelper.createToolset(
          toolsetBuilder.withDisplayName(toolsetName).build(),
        );
        const initialToolset =
          (await toolsetApiHelper.getToolset(toolsetName))!;

        // Open it for edit, set the endpoint, switch auth to OAuth
        await marketplacePage.openEditToolsetPage(initialToolset.id!);
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorToolsetTypes.Toolset,
        );
        await toolsetEditorViewForm.endpoint.fillInInput(toolsetEndpoint);
        await toolsetEditorViewForm.oauthContainer.click();

        // Set up OAuth mocks
        oauthMockHelper = new OAuthMockHelper(
          page,
          initialToolset,
          toolsetEndpoint,
        );
        await oauthMockHelper.setupMocks();

        // Log in via the mocked OAuth popup
        oauthMockHelper.enableMocking();
        loginPopup = (await toolsetEditorViewForm.clickLoginButton(
          oauthMockHelper.getMockConfig().authorization_endpoint,
        ))!;

        // Finish sign-in through the callback
        await oauthMockHelper.navigateToCallback(loginPopup);
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorToolsetTypes.Toolset,
        );

        // Save & Exit — toolset is now saved as OAuth with global creds
        await entityEditorHeader.saveAndExitButton.click();
        await marketplacePage.waitForPageLoaded();
      },
    );

    await dialTest.step(
      'Switch to Agents tab and open Quick app 2.0 creation via Add app dropdown',
      async () => {
        await marketplaceHeader.agentsTab.click();
        await marketplaceHeader.addAppButton.click();
        await addAppDropdownMenu.selectMenuOption(AddAppMenuOptions.quickApp2);
        await entityEditorPage.waitForPageLoaded(
          EntityEditorAppTypes.QuickApp2,
        );
        await entityEditorGeneralForm.fillInEntityFields({ name: appName });
        await entityEditorGeneralForm.goNext();
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorAppTypes.QuickApp2,
        );
      },
    );

    await dialTest.step(
      'Add the OAuth toolset via select modal and confirm',
      async () => {
        await quickApp2EditorViewForm.addAgentsButton.click();
        await agentAndToolsetSelectModal.searchInput.fillInInput(toolsetName);
        await agentAndToolsetSelectModal.selectEntityByName(toolsetName);
        await agentAndToolsetSelectModal.confirmButton.click();
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal,
          'hidden',
        );
      },
    );

    // TODO: workaround for #6530 — save and reopen so the chip details work
    await dialTest.step(
      'Save and exit, then reopen the app via Edit button in the details modal',
      async () => {
        await entityEditorHeader.saveAndExitButton.click();
        await marketplacePage.waitForPageLoaded();
        await baseAssertion.assertElementState(entityDetailsModal, 'visible');
        await entityDetailsModal.clickEditButton();
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorAppTypes.QuickApp2,
        );
      },
    );

    await dialTest.step(
      'Click the toolset chip, verify the details modal opens, then log out so the toolset requires user-level login',
      async () => {
        await quickApp2EditorViewForm.clickChipByName(toolsetName);
        await baseAssertion.assertElementState(entityDetailsModal, 'visible');
        await entityDetailsModal.logoutButton.click();
        await clickConfirmButton(
          confirmationDialog
            .getElementLocator()
            .nth(1)
            .locator(ConfirmationDialogSelectors.confirm),
        );
        await baseAssertion.assertElementState(
          entityDetailsModal.loginButton,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Click Login in details modal, then click Log in in the toolset sign-in modal and complete the OAuth flow via popup',
      async () => {
        oauthMockHelper.enableMocking();
        await entityDetailsModal.loginButton.click();
        // TODO: same duplicate-dialog bug — two sign-in modals render, so scope
        // to the second (interactive) one.
        const signinModal = new ToolsetLoginModal(page);
        signinModal.setElementLocator(signinModal.getElementLocator().nth(1));
        signinModal.loginButton.setElementLocator(
          signinModal
            .getElementLocator()
            .locator(
              ButtonSelectors.buttonContainer(
                ToolsetLoginModalSelectors.loginButton,
              ),
            ),
        );
        await baseAssertion.assertElementState(signinModal, 'visible');
        const popupPromise = page.waitForEvent('popup');
        await signinModal.loginButton.click();
        loginPopup = await popupPromise;
        await loginPopup.waitForLoadState('domcontentloaded');
        await oauthMockHelper.navigateToCallback(loginPopup);
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorAppTypes.QuickApp2,
        );
      },
    );

    await dialTest.step(
      'Verify App settings step is open and select modal did NOT reopen',
      async () => {
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal,
          'hidden',
        );
        await baseAssertion.assertElementState(entityDetailsModal, 'visible');
      },
    );
  },
);

dialTest(
  "[Quick app 2.0]: Toolset's version is displayed on card on click on toolset's bar in Agents&toolsets field", // EPMDIAL-4936
  async ({
    marketplacePage,
    entityEditorPage,
    entityEditorGeneralForm,
    quickApp2EditorViewForm,
    agentAndToolsetSelectModal,
    entityDetailsModal,
    toolsetBuilder,
    toolsetApiHelper,
    baseAssertion,
    setTestIds,
    setIssueIds,
  }) => {
    setTestIds('EPMDIAL-4936');
    setIssueIds('6530');
    const appName = GeneratorUtil.randomApplicationName();
    const toolsetName = GeneratorUtil.randomToolsetName();

    await dialTest.step('Precondition: create toolset via API', async () => {
      await toolsetApiHelper.createToolset(
        toolsetBuilder.withDisplayName(toolsetName).build(),
      );
    });

    await dialTest.step(
      'Open Quick app 2.0 creation page directly',
      async () => {
        await marketplacePage.openCreateQuickApp2Page();
        await entityEditorPage.waitForPageLoaded(
          EntityEditorAppTypes.QuickApp2,
        );
        await entityEditorGeneralForm.fillInEntityFields({ name: appName });
        await entityEditorGeneralForm.goNext();
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorAppTypes.QuickApp2,
        );
      },
    );

    await dialTest.step(
      'Add toolset to the Agents & Toolsets field',
      async () => {
        await quickApp2EditorViewForm.addAgentsButton.click();
        await agentAndToolsetSelectModal.searchInput.fillInInput(toolsetName);
        await agentAndToolsetSelectModal.selectEntityByName(toolsetName);
        await agentAndToolsetSelectModal.confirmButton.click();
        await quickApp2EditorViewForm.click();
      },
    );

    await dialTest.step(
      'Click the toolset chip and verify the entity details modal opens with version displayed',
      async () => {
        await quickApp2EditorViewForm.clickChipByName(toolsetName);
        await baseAssertion.assertElementState(entityDetailsModal, 'visible');
        await baseAssertion.assertElementState(
          entityDetailsModal.entityVersion,
          'visible',
        );
      },
    );
  },
);

dialTest(
  "[Quick app 2.0]: Application's version is displayed on card on click on toolset's bar in Agents&toolsets field\n" +
    "[Quick app 2.0]: Model's version is displayed on card on click on toolset's bar in Agents&toolsets field", // EPMDIAL-4937 + EPMDIAL-4938
  async (
    {
      marketplacePage,
      entityEditorPage,
      quickApp2EditorViewForm,
      entityDetailsModal,
      entityDetailsModalAssertion,
      customApplicationBuilder,
      quickApp2Builder,
      applicationApiHelper,
      modelApiHelper,
      baseAssertion,
      setTestIds,
    },
    testInfo,
  ) => {
    setTestIds('EPMDIAL-4937', 'EPMDIAL-4938');
    const appName = GeneratorUtil.randomApplicationName();
    const quickAppName = GeneratorUtil.randomApplicationName();
    let appId: string;
    let modelWithVersion: DialAIEntityModel;

    await dialTest.step(
      'Precondition: create a custom application via API and pick a model that has a version',
      async () => {
        await applicationApiHelper.createApplication(
          customApplicationBuilder.withDisplayName(appName).build(),
        );
        const allEntities = await modelApiHelper.getModels();
        appId = (
          await modelApiHelper.getAgentByNameAndVersion(
            { name: appName },
            allEntities,
          )
        ).id;
        modelWithVersion = allEntities.find(
          (entity) =>
            entity.type === EntityType.Model && entity.version !== undefined,
        )!;
      },
    );

    await dialTest.step(
      'Precondition: create Quick app 2.0 via API with the application and the model added to Agents & Toolsets',
      async () => {
        await applicationApiHelper.createApplication(
          quickApp2Builder
            .withDisplayName(quickAppName)
            .withOrchestratorModel(modelWithVersion.id)
            .addApp({ id: appId, name: appName })
            .addModel(modelWithVersion.id)
            .build(),
        );
      },
    );

    await dialTest.step(
      'Open the created Quick app 2.0 directly in edit mode',
      async () => {
        const quickApp = await modelApiHelper.getAgentByNameAndVersion({
          name: quickAppName,
        });
        await marketplacePage.openEditQuickApp2Page(quickApp.reference);
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorAppTypes.QuickApp2,
        );
      },
    );

    await dialTest.step(
      "Click the application's bar and verify the details modal shows the application's name, version, author and release date",
      async () => {
        await quickApp2EditorViewForm.clickChipByName(appName);
        await baseAssertion.assertElementState(entityDetailsModal, 'visible');
        await entityDetailsModalAssertion.assertEntityCommonAttributes({
          expectedName: appName,
          expectedVersion: ExpectedConstants.defaultEntityVersion,
          expectedAuthor: UserUtil.getE2EUsername(testInfo.parallelIndex),
          expectedReleaseDate: DateUtil.getCurrentLocalDate(),
        });
      },
    );

    await dialTest.step('Close the application details modal', async () => {
      await entityDetailsModal.closeButton.click();
      await baseAssertion.assertElementState(entityDetailsModal, 'hidden');
    });

    await dialTest.step(
      "Click the model's bar and verify the details modal shows the model's name, version, author, release date and description",
      async () => {
        await quickApp2EditorViewForm.clickChipByName(modelWithVersion.name);
        await baseAssertion.assertElementState(entityDetailsModal, 'visible');
        await entityDetailsModalAssertion.assertEntityCommonAttributes({
          expectedName: modelWithVersion.name,
          expectedVersion: modelWithVersion.version,
          expectedAuthor: modelWithVersion.owner,
          expectedReleaseDate: modelWithVersion.createdAt,
          expectedDescription: modelWithVersion.description as string,
        });
      },
    );
  },
);

dialTest(
  '[Agents & Toolsets] Not available agent and toolset stay selected on browser refresh and when user removes/adds new item\n' +
    '[Quick app 2.0]: One version is displayed on click on bar inside Agents & Toolsets field', // EPMDIAL-4941 + EPMDIAL-4939
  async ({
    marketplacePage,
    entityEditorPage,
    quickApp2EditorViewForm,
    agentAndToolsetSelectModal,
    entityDetailsModal,
    entityDetailsModalAssertion,
    customApplicationBuilder,
    toolsetBuilder,
    quickApp2Builder,
    applicationApiHelper,
    toolsetApiHelper,
    itemApiHelper,
    modelApiHelper,
    baseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-4941', 'EPMDIAL-4939');
    const appToDeleteName = GeneratorUtil.randomApplicationName();
    const appToKeepName = GeneratorUtil.randomApplicationName();
    const agentName = GeneratorUtil.randomApplicationName();
    const firstVersion = '0.0.1';
    const secondVersion = '0.0.2';
    const toolsetToDeleteName = GeneratorUtil.randomToolsetName();
    const toolsetToKeepName = GeneratorUtil.randomToolsetName();
    const newToolsetName = GeneratorUtil.randomToolsetName();
    const quickAppName = GeneratorUtil.randomApplicationName();
    let appToDeleteId: string;
    let toolsetToDeleteId: string;

    await dialTest.step(
      'Precondition: create apps (incl. an agent with two versions) and toolsets via API',
      async () => {
        await applicationApiHelper.createApplication(
          customApplicationBuilder.withDisplayName(appToDeleteName).build(),
        );
        await applicationApiHelper.createApplication(
          customApplicationBuilder.withDisplayName(appToKeepName).build(),
        );
        for (const version of [firstVersion, secondVersion]) {
          await applicationApiHelper.createApplication(
            customApplicationBuilder
              .withDisplayName(agentName)
              .withDisplayVersion(version)
              .build(),
          );
        }
        await toolsetApiHelper.createToolset(
          toolsetBuilder.withDisplayName(toolsetToDeleteName).build(),
        );
        await toolsetApiHelper.createToolset(
          toolsetBuilder.withDisplayName(toolsetToKeepName).build(),
        );
        await toolsetApiHelper.createToolset(
          toolsetBuilder.withDisplayName(newToolsetName).build(),
        );
      },
    );

    await dialTest.step(
      'Precondition: create Quick app 2.0 via API with all 4 items in Agents & Toolsets',
      async () => {
        const allEntities = await modelApiHelper.getModels();
        appToDeleteId = (
          await modelApiHelper.getAgentByNameAndVersion(
            { name: appToDeleteName },
            allEntities,
          )
        ).id;
        const appToKeepId = (
          await modelApiHelper.getAgentByNameAndVersion(
            { name: appToKeepName },
            allEntities,
          )
        ).id;
        const agentFirstVersionId = (
          await modelApiHelper.getAgentByNameAndVersion(
            { name: agentName, version: firstVersion },
            allEntities,
          )
        ).id;
        const agentSecondVersionId = (
          await modelApiHelper.getAgentByNameAndVersion(
            { name: agentName, version: secondVersion },
            allEntities,
          )
        ).id;
        toolsetToDeleteId = (await toolsetApiHelper.getToolset(
          toolsetToDeleteName,
        ))!.id!;
        const toolsetToKeepId = (await toolsetApiHelper.getToolset(
          toolsetToKeepName,
        ))!.id!;

        await applicationApiHelper.createApplication(
          quickApp2Builder
            .withDisplayName(quickAppName)
            .addApp({ id: appToDeleteId, name: appToDeleteName })
            .addApp({ id: appToKeepId, name: appToKeepName })
            .addApp({ id: agentFirstVersionId, name: agentName })
            .addApp({ id: agentSecondVersionId, name: agentName })
            .addToolset(toolsetToDeleteId)
            .addToolset(toolsetToKeepId)
            .build(),
        );
      },
    );

    await dialTest.step(
      'Precondition: delete one app and one toolset so they become not available',
      async () => {
        await itemApiHelper.deleteEntity(appToDeleteId);
        await itemApiHelper.deleteEntity(toolsetToDeleteId);
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
      'Verify the deleted items stay as not-available (red) chips, the rest stay normal',
      async () => {
        for (const name of [
          appToDeleteName,
          toolsetToDeleteName,
          appToKeepName,
          toolsetToKeepName,
        ]) {
          await baseAssertion.assertElementState(
            quickApp2EditorViewForm.getChipByName(name),
            'visible',
          );
        }
        for (const name of [appToDeleteName, toolsetToDeleteName]) {
          await baseAssertion.assertElementClass(
            quickApp2EditorViewForm.getChipByName(name),
            /bg-error/,
          );
        }
      },
    );

    await dialTest.step(
      'Verify the multi-version agent shows two bars — one per version',
      async () => {
        await baseAssertion.assertElementsCount(
          quickApp2EditorViewForm.getChipByName(agentName),
          2,
        );
        for (const version of [firstVersion, secondVersion]) {
          await baseAssertion.assertElementState(
            quickApp2EditorViewForm.getChipByNameAndVersion(agentName, version),
            'visible',
          );
        }
      },
    );

    await dialTest.step(
      'Click each version bar and verify its own version is shown on the card',
      async () => {
        for (const version of [firstVersion, secondVersion]) {
          await quickApp2EditorViewForm
            .getChipByNameAndVersion(agentName, version)
            .click();
          await baseAssertion.assertElementState(entityDetailsModal, 'visible');
          await entityDetailsModalAssertion.assertEntityVersion(version);
          await entityDetailsModal.closeButton.click();
          await baseAssertion.assertElementState(entityDetailsModal, 'hidden');
        }
      },
    );

    await dialTest.step(
      'Remove every available chip via the "x" — the app, the toolset and both agent versions',
      async () => {
        await quickApp2EditorViewForm.removeChipByName(appToKeepName);
        await quickApp2EditorViewForm.removeChipByName(toolsetToKeepName);
        for (const version of [firstVersion, secondVersion]) {
          await quickApp2EditorViewForm.removeChipByNameAndVersion(
            agentName,
            version,
          );
        }
      },
    );

    await dialTest.step(
      'Verify only the not-available chips stay and every removed one is gone',
      async () => {
        for (const name of [appToDeleteName, toolsetToDeleteName]) {
          await baseAssertion.assertElementState(
            quickApp2EditorViewForm.getChipByName(name),
            'visible',
          );
        }
        for (const name of [appToKeepName, toolsetToKeepName, agentName]) {
          await baseAssertion.assertElementState(
            quickApp2EditorViewForm.getChipByName(name),
            'hidden',
          );
        }
      },
    );

    await dialTest.step('Add a new toolset via the select modal', async () => {
      await quickApp2EditorViewForm.addAgentsButton.click();
      await agentAndToolsetSelectModal.searchInput.fillInInput(newToolsetName);
      await agentAndToolsetSelectModal.selectEntityByName(newToolsetName);
      await agentAndToolsetSelectModal.confirmButton.click();
      await baseAssertion.assertElementState(
        agentAndToolsetSelectModal,
        'hidden',
      );
    });

    await dialTest.step(
      'Verify the not-available chips still stay after adding a new item',
      async () => {
        for (const name of [appToDeleteName, toolsetToDeleteName]) {
          await baseAssertion.assertElementState(
            quickApp2EditorViewForm.getChipByName(name),
            'visible',
          );
        }
        await baseAssertion.assertElementState(
          quickApp2EditorViewForm.getChipByName(newToolsetName),
          'visible',
        );
      },
    );
  },
);

dialAdminTest(
  "[Agents & Toolsets] In Published Quick App 2.0 '+Add' button is unavailable, specific tooltip is shown on hover over selected items", // EPMDIAL-4932
  async ({
    customApplicationBuilder,
    toolsetBuilder,
    quickApp2Builder,
    applicationApiHelper,
    toolsetApiHelper,
    modelApiHelper,
    publicationApiHelper,
    publishRequestBuilder,
    adminPublicationApiHelper,
    adminMarketplacePage,
    adminMarketplaceHeader,
    adminMarketplaceEntitiesSection,
    adminEntityDetailsModal,
    adminEntityEditorPage,
    adminQuickApp2EditorViewForm,
    adminTooltipPortalAssertion,
    baseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-4932');
    dialAdminTest.slow();
    const agentName = GeneratorUtil.randomApplicationName();
    const toolsetName = GeneratorUtil.randomToolsetName();
    const quickAppName = GeneratorUtil.randomApplicationName();
    let quickApp!: BackendEntity;

    await dialAdminTest.step(
      'Precondition: create an agent, a toolset and a Quick app 2.0 with both via API',
      async () => {
        await applicationApiHelper.createApplication(
          customApplicationBuilder.withDisplayName(agentName).build(),
        );
        await toolsetApiHelper.createToolset(
          toolsetBuilder.withDisplayName(toolsetName).build(),
        );
        const allEntities = await modelApiHelper.getModels();
        const agentId = (
          await modelApiHelper.getAgentByNameAndVersion(
            { name: agentName },
            allEntities,
          )
        ).id;
        const toolsetId = (await toolsetApiHelper.getToolset(toolsetName))!.id!;

        quickApp = await applicationApiHelper.createApplication(
          quickApp2Builder
            .withDisplayName(quickAppName)
            .addApp({ id: agentId, name: agentName })
            .addToolset(toolsetId)
            .build(),
        );
      },
    );

    await dialAdminTest.step(
      'Precondition: publish the Quick app 2.0 and approve it as admin',
      async () => {
        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withApplicationResource(quickApp, PublishActions.ADD)
          .build();
        const publication =
          await publicationApiHelper.createPublishRequest(publishRequest);
        await adminPublicationApiHelper.approveRequest(publication);
      },
    );

    await dialAdminTest.step(
      'Admin opens the Marketplace and finds the published Quick app 2.0 card',
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
        await baseAssertion.assertElementState(
          adminEntityDetailsModal,
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Open the app in view mode and verify the editor is read-only',
      async () => {
        await adminEntityDetailsModal.viewButton.click();
        await adminEntityEditorPage.waitForPageLoadedForEdit(
          EntityEditorAppTypes.QuickApp2,
        );
      },
    );

    await dialAdminTest.step(
      "Verify '+Add' is unavailable and shows the public-app tooltip on hover",
      async () => {
        await baseAssertion.assertElementActionabilityState(
          adminQuickApp2EditorViewForm.addAgentsButton,
          'disabled',
        );
        await adminQuickApp2EditorViewForm.addAgentsButton.hoverOver({
          force: true,
        });
        await adminTooltipPortalAssertion.assertTooltipContent(
          ExpectedConstants.readOnlyApplicationMessage,
        );
      },
    );

    await dialAdminTest.step(
      'Hover over the toolset and agent chips and verify the read-only tooltip',
      async () => {
        for (const { name, entityType } of [
          { name: toolsetName, entityType: 'toolset' },
          { name: agentName, entityType: 'agent' },
        ]) {
          await adminQuickApp2EditorViewForm.getChipByName(name).hoverOver();
          await adminTooltipPortalAssertion.assertTooltipContent(
            ExpectedConstants.notAvailableChipTooltip(
              entityType,
              name,
              ExpectedConstants.defaultEntityVersion,
            ),
          );
        }
      },
    );
  },
);

dialTest(
  '[Quick app 2.0]: Not available toolset/agent display\n' +
    '[Agents & Toolsets] Not available agent and toolset stay selected when user removes/adds new item\n' +
    "[Quick app 2.0]: Not available toolset/agent stays attached if open Editor and click 'Save and exit'", // EPMRTC-6998 + EPMRTC-6999 + EPMDIAL-7321
  async ({
    marketplacePage,
    marketplaceHeader,
    marketplaceEntitiesSection,
    entityEditorPage,
    entityEditorHeader,
    entityDetailsModal,
    quickApp2EditorViewForm,
    agentAndToolsetSelectModal,
    customApplicationBuilder,
    toolsetBuilder,
    quickApp2Builder,
    applicationApiHelper,
    toolsetApiHelper,
    itemApiHelper,
    modelApiHelper,
    tooltipPortal,
    baseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-4822', 'EPMDIAL-7329', 'EPMDIAL-7321');
    const notAvailableAgentName = GeneratorUtil.randomApplicationName();
    const notAvailableToolsetName = GeneratorUtil.randomToolsetName();
    const validAgentName = GeneratorUtil.randomApplicationName();
    const quickAppName = GeneratorUtil.randomApplicationName();
    const notAvailableNames = [notAvailableAgentName, notAvailableToolsetName];
    const errorChipClass = new RegExp(
      AddQuickApp2SettingsFormSelector.errorChipClass,
    );
    let notAvailableAgentId: string;
    let notAvailableToolsetId: string;
    let toolSupportingModelId: string;

    await dialTest.step(
      'Precondition: create an agent and a toolset (to be deleted) and a valid agent',
      async () => {
        await applicationApiHelper.createApplication(
          customApplicationBuilder
            .withDisplayName(notAvailableAgentName)
            .build(),
        );
        await applicationApiHelper.createApplication(
          customApplicationBuilder.withDisplayName(validAgentName).build(),
        );
        await toolsetApiHelper.createToolset(
          toolsetBuilder.withDisplayName(notAvailableToolsetName).build(),
        );
        const allEntities = await modelApiHelper.getModels();
        notAvailableAgentId = (
          await modelApiHelper.getAgentByNameAndVersion(
            { name: notAvailableAgentName },
            allEntities,
          )
        ).id;
        notAvailableToolsetId = (await toolsetApiHelper.getToolset(
          notAvailableToolsetName,
        ))!.id!;
        // The orchestrator model must support tools, otherwise the form is
        // invalid and Save & Exit opens the "save only valid data" dialog.
        toolSupportingModelId = (
          await modelApiHelper.getToolSupportingModel(allEntities)
        ).id;
      },
    );

    await dialTest.step(
      'Precondition: create a Quick app 2.0 with the agent and toolset added, then delete them so they become not available',
      async () => {
        await applicationApiHelper.createApplication(
          quickApp2Builder
            .withDisplayName(quickAppName)
            .withOrchestratorModel(toolSupportingModelId)
            .addApp({ id: notAvailableAgentId, name: notAvailableAgentName })
            .addToolset(notAvailableToolsetId)
            .build(),
        );
        await itemApiHelper.deleteEntity(notAvailableAgentId);
        await itemApiHelper.deleteEntity(notAvailableToolsetId);
      },
    );

    await dialTest.step(
      'Open the Quick app 2.0 in edit — the deleted agent and toolset are shown as red not-available chips with a tooltip',
      async () => {
        const quickApp = await modelApiHelper.getAgentByNameAndVersion({
          name: quickAppName,
        });
        await marketplacePage.openEditQuickApp2Page(quickApp.reference);
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorAppTypes.QuickApp2,
        );
        for (const { name, entityType } of [
          {
            name: notAvailableAgentName,
            entityType: AgentToolsetEntityType.Agent,
          },
          {
            name: notAvailableToolsetName,
            entityType: AgentToolsetEntityType.Toolset,
          },
        ]) {
          await baseAssertion.assertElementClass(
            quickApp2EditorViewForm.getChipByName(name),
            errorChipClass,
          );
          await quickApp2EditorViewForm.getChipByName(name).hoverOver();
          await baseAssertion.assertElementContainsText(
            tooltipPortal,
            ExpectedConstants.notAvailableEditableChipTooltip(entityType),
          );
        }
      },
    );

    await dialTest.step(
      'Add a valid agent — the not-available agent and toolset stay attached (still red)',
      async () => {
        await quickApp2EditorViewForm.addAgentsButton.click();
        await agentAndToolsetSelectModal.selectEntities([validAgentName]);
        await agentAndToolsetSelectModal.confirmButton.click();
        await baseAssertion.assertElementState(
          quickApp2EditorViewForm.getChipByName(validAgentName),
          'visible',
        );
        for (const name of notAvailableNames) {
          await baseAssertion.assertElementState(
            quickApp2EditorViewForm.getChipByName(name),
            'visible',
          );
          await baseAssertion.assertElementClass(
            quickApp2EditorViewForm.getChipByName(name),
            errorChipClass,
          );
        }
      },
    );

    await dialTest.step(
      'Save and exit, then reopen — the not-available agent and toolset are still attached and red',
      async () => {
        await entityEditorHeader.saveAndExitButton.click();
        await marketplacePage.waitForPageLoaded();
        await baseAssertion.assertElementState(entityDetailsModal, 'hidden');
        await marketplaceHeader
          .getSearch()
          .inputField.fillInInput(quickAppName);
        const savedApp =
          await marketplaceEntitiesSection.findEntityElement(quickAppName);
        await savedApp.click();
        await baseAssertion.assertElementState(entityDetailsModal, 'visible');
        await entityDetailsModal.editButton.click();
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorAppTypes.QuickApp2,
        );
        for (const name of notAvailableNames) {
          await baseAssertion.assertElementState(
            quickApp2EditorViewForm.getChipByName(name),
            'visible',
          );
          await baseAssertion.assertElementClass(
            quickApp2EditorViewForm.getChipByName(name),
            errorChipClass,
          );
        }
      },
    );
  },
);
