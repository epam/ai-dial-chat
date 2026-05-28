import dialTest from '@/src/core/dialFixtures';
import { isApiStorageType } from '@/src/hooks/global-setup';
import {
  AddAppMenuOptions,
  EntityEditorAppTypes,
  EntityEditorToolsetTypes,
} from '@/src/testData';
import { OAuthMockHelper } from '@/src/testData/toolsets/oauthMockHelper';
import { keys } from '@/src/ui/keyboard';
import { ConfirmationDialogSelectors } from '@/src/ui/selectors/dialogSelectors';
import { ToolsetLoginModal } from '@/src/ui/webElements';
import { GeneratorUtil } from '@/src/utils';
import { Locator, Page } from '@playwright/test';
import { Response } from 'playwright-core';

dialTest(
  '[Agents & Toolsets] Default view when nothing is added\n' +
    '[Quick app 2.0]: Select Agents & Toolsets form is NOT open when user switch between steps after adding any item to this field\n' +
    '[Agents & Toolsets] Sorting: the mix of agents and toolsets sorted according to ASCII sorting order\n' +
    '[Quick app 2.0][UI] the page stays user-friendly while scrolling when Agents&Toolsets field has lots of items', // EPMRTC-7359 + EPMRTC-7398 + EPMRTC-7369 + EPMRTC-7284
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
    setTestIds('EPMRTC-7359', 'EPMRTC-7398', 'EPMRTC-7369', 'EPMRTC-7284');
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

dialTest.only(
  '[Quick app 2.0]: Select Agents & Toolsets form is NOT open when login to selected toolset from card detailed view', // EPMRTC-7326
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
    marketplaceEntityDetailsModal,
    entityDetailsModal,
    toolsetEditorViewForm,
    confirmationDialog,
    toolsetBuilder,
    toolsetApiHelper,
    baseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-7326');
    const appName = GeneratorUtil.randomApplicationName();
    const toolsetName = GeneratorUtil.randomToolsetName();
    const toolsetEndpoint = GeneratorUtil.randomUrl();
    let oauthMockHelper!: OAuthMockHelper;
    let loginPopup!: Page;

    //TODO
    // BUG-WORKAROUND: two ToolsetLoginDialog instances render the confirmation dialog
    // (one in AgentAndToolsetSelector inside the QA2 form, another in the global ToolsetDialogs),
    // so confirmationDialog.confirm() fails. replace the call with confirmationDialog.confirm({...}).
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
        // 1) Create the base toolset via API
        await toolsetApiHelper.createToolset(
          toolsetBuilder.withDisplayName(toolsetName).build(),
        );
        const initialToolset =
          (await toolsetApiHelper.getToolset(toolsetName))!;

        // 2) Open the toolset edit page, fill endpoint and switch authentication to OAuth
        await marketplacePage.openEditToolsetPage(initialToolset.id!);
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorToolsetTypes.Toolset,
        );
        await toolsetEditorViewForm.endpoint.fillInInput(toolsetEndpoint);
        await toolsetEditorViewForm.oauthContainer.click();

        // 3) Setup OAuth mocks
        oauthMockHelper = new OAuthMockHelper(
          page,
          initialToolset,
          toolsetEndpoint,
        );
        await oauthMockHelper.setupMocks();

        // 4) Click Login — opens popup to the (mocked) authorization endpoint
        oauthMockHelper.enableMocking();
        loginPopup = (await toolsetEditorViewForm.clickLoginButton(
          oauthMockHelper.getMockConfig().authorization_endpoint,
        ))!;

        // 5) Navigate the popup to the OAuth callback to complete sign-in
        await oauthMockHelper.navigateToCallback(loginPopup);
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorToolsetTypes.Toolset,
        );

        // 6) Save & Exit back to marketplace — toolset is now persisted as OAuth with global creds
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

    //TODO workaround for the 6530 issue
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
        await baseAssertion.assertElementState(
          marketplaceEntityDetailsModal,
          'visible',
        );
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
        // BUG-WORKAROUND: same duplicate-dialog bug as above — two marketplace-toolset-signin
        // modals render simultaneously; instantiate a scoped ToolsetLoginModal pointing to the
        // second instance (the interactive one).
        const signinModal = new ToolsetLoginModal(page);
        signinModal.setElementLocator(signinModal.getElementLocator().nth(1));
        await baseAssertion.assertElementState(signinModal, 'visible');
        const popupPromise = page.waitForEvent('popup');
        await signinModal.loginButton.click();
        loginPopup = await popupPromise;
        try {
          await loginPopup.waitForLoadState('domcontentloaded');
        } catch {
          // popup may close before DOM loads if OAuth flow finishes fast
        }
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
      },
    );
  },
);

dialTest(
  "[Quick app 2.0]: Toolset's version is displayed on card on click on toolset's bar in Agents&toolsets field", // EPMRTC-7945
  async ({
    marketplacePage,
    entityEditorPage,
    entityEditorGeneralForm,
    quickApp2EditorViewForm,
    agentAndToolsetSelectModal,
    marketplaceEntityDetailsModal,
    toolsetBuilder,
    toolsetApiHelper,
    baseAssertion,
    setTestIds,
    setIssueIds,
  }) => {
    setTestIds('EPMRTC-7945');
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
        await baseAssertion.assertElementState(
          marketplaceEntityDetailsModal,
          'visible',
        );
        await baseAssertion.assertElementState(
          marketplaceEntityDetailsModal.version,
          'visible',
        );
      },
    );
  },
);
