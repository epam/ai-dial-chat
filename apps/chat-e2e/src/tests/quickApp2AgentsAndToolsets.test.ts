import dialTest from '@/src/core/dialFixtures';
import { AddAppMenuOptions, EntityEditorAppTypes } from '@/src/testData';
import { GeneratorUtil } from '@/src/utils';

dialTest.only(
  '[Quick app 2.0]: Default view when nothing is added to Agents & Toolsets field', // EPMRTC-7359
  async ({
    marketplacePage,
    marketplaceHeader,
    addAppDropdownMenu,
    entityEditorPage,
    entityEditorGeneralForm,
    quickApp2EditorViewForm,
    baseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-7359');
    const appName = GeneratorUtil.randomApplicationName();

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
      'Verify Agents & Toolsets field shows default empty state: section visible, placeholder text and Add button present',
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
  },
);
