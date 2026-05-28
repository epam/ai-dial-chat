import dialTest from '@/src/core/dialFixtures';
import { AddAppMenuOptions, EntityEditorAppTypes } from '@/src/testData';
import { keys } from '@/src/ui/keyboard';
import { GeneratorUtil } from '@/src/utils';

dialTest.only(
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
