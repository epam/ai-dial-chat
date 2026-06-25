import dialTest from '@/src/core/dialFixtures';
import { AddAppMenuOptions, EntityEditorAppTypes } from '@/src/testData';
import { GeneratorUtil } from '@/src/utils';

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

    // Pick the agent and toolset in the open modal.
    const selectAgentAndToolset = async () => {
      await agentAndToolsetSelectModal.searchInput.fillInInput(agentName);
      await agentAndToolsetSelectModal.selectEntityByName(agentName);
      await agentAndToolsetSelectModal.searchInput.fillInInput(toolsetName);
      await agentAndToolsetSelectModal.selectEntityByName(toolsetName);
      await baseAssertion.assertElementState(
        agentAndToolsetSelectModal.getSelectedChipByName(agentName),
        'visible',
      );
      await baseAssertion.assertElementState(
        agentAndToolsetSelectModal.getSelectedChipByName(toolsetName),
        'visible',
      );
    };

    // Field stays empty: placeholder shown, no chips.
    const assertFieldStaysEmpty = async () => {
      await baseAssertion.assertElementState(
        quickApp2EditorViewForm.getChipByName(agentName),
        'hidden',
      );
      await baseAssertion.assertElementState(
        quickApp2EditorViewForm.getChipByName(toolsetName),
        'hidden',
      );
      await baseAssertion.assertElementState(
        quickApp2EditorViewForm.noAgentsAndToolsetsPlaceholder,
        'visible',
      );
    };

    await dialTest.step(
      'Select an agent and a toolset, then close the modal on Cancel — nothing is added to the field',
      async () => {
        await quickApp2EditorViewForm.addAgentsButton.click();
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal,
          'visible',
        );
        await selectAgentAndToolset();
        await agentAndToolsetSelectModal.getCancelButton().click();
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal,
          'hidden',
        );
        await assertFieldStaysEmpty();
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
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal.selectedChips,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Select an agent and a toolset, then close the modal on X — nothing is added to the field',
      async () => {
        await selectAgentAndToolset();
        await agentAndToolsetSelectModal.getCloseButton().click();
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal,
          'hidden',
        );
        await assertFieldStaysEmpty();
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
        await baseAssertion.assertElementState(
          agentAndToolsetSelectModal.selectedChips,
          'hidden',
        );
      },
    );
  },
);
