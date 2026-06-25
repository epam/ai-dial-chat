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
        await agentAndToolsetSelectModal.selectEntities([agentName, toolsetName]);
        await agentAndToolsetSelectModalAssertion.assertSelected(
          [agentName, toolsetName],
        );
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
        await agentAndToolsetSelectModal.selectEntities([agentName, toolsetName]);
        await agentAndToolsetSelectModalAssertion.assertSelected(
          [agentName, toolsetName],
        );
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
