import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  AddAppMenuOptions,
  AppEditorGeneralFormFields,
  AppEditorViewFormFields,
  AppMenuActions,
  ExpectedMessages,
} from '@/src/testData';
import { GeneratorUtil } from '@/src/utils';

dialTest.only(
  'Create custom app with required fields only',
  async ({
    marketplacePage,
    marketplaceHeader,
    addAppDropdownMenu,
    appEditorPage,
    appEditorGeneralForm,
    appEditorViewForm,
    appEditorHeader,
    marketplaceAgentsSection,
    setTestIds,
    baseAssertion,
  }) => {
    setTestIds('EPMRTC-5130');
    const appName = GeneratorUtil.randomApplicationName();
    const appVersion = GeneratorUtil.randomApplicationVersion();

    await dialTest.step('Open My workspace directly', async () => {
      await marketplacePage.openMyWorkspacePage();
    });

    await dialTest.step(
      'Click Add app and select Custom app in drop down',
      async () => {
        await marketplaceHeader.addAppButton.click();
        await addAppDropdownMenu.selectMenuOption(AddAppMenuOptions.customApp);
        await appEditorPage.waitForPageLoaded();

        await baseAssertion.assertElementText(
          appEditorPage.getAppEditorContainer().getHeader()
            .actionAndApplicationTypeTitle,
          // `${AppMenuActions.add} ${AddAppMenuOptions.customApp}`,
          `${AppMenuActions.add} custom app`,
        );
        const generalInfoStep = await appEditorHeader.getGeneralInfoStep();
        await baseAssertion.assertElementState(generalInfoStep, 'visible');
        await baseAssertion.assertElementActionabilityState(
          generalInfoStep,
          'enabled',
        );
        await baseAssertion.assertElementState(appEditorGeneralForm, 'visible');

        const nameRequiredIndicator = appEditorGeneralForm.getRequiredIndicator(
          AppEditorGeneralFormFields.name,
        );
        await baseAssertion.assertElementState(
          nameRequiredIndicator,
          'visible',
          ExpectedMessages.applicationFormFieldShouldHaveAsterisk,
        );

        const versionRequiredIndicator =
          appEditorGeneralForm.getRequiredIndicator(
            AppEditorGeneralFormFields.version,
          );
        await baseAssertion.assertElementState(
          versionRequiredIndicator,
          'visible',
          ExpectedMessages.applicationFormFieldShouldHaveAsterisk,
        );
      },
    );

    await dialTest.step(
      'Fill in inputs of Name, Version and click Next',
      async () => {
        await appEditorGeneralForm.fillInAppFields({
          name: appName,
          version: appVersion,
        });
        await appEditorGeneralForm.goNext();
      },
    );

    await dialTest.step(
      'Open view form and verify chat completion url is required',
      async () => {
        await appEditorViewForm.waitForState();
        await baseAssertion.assertElementState(appEditorViewForm, 'visible');
        const chatCompletionUrlRequiredIndicator =
          appEditorViewForm.getRequiredIndicator(
            AppEditorViewFormFields.chatCompletionUrl,
          );
        await baseAssertion.assertElementState(
          chatCompletionUrlRequiredIndicator,
          'visible',
          ExpectedMessages.applicationFormFieldShouldHaveAsterisk,
        );
      },
    );

    await dialTest.step(
      'Input Chat completion URL, click Save and Exit link',
      async () => {
        await appEditorViewForm.fillInAppFields();
        await appEditorHeader.saveAppAndExit();
        await baseAssertion.assertElementState(appEditorViewForm, 'hidden');
        await marketplacePage.waitForPageLoaded();
      },
    );

    await dialTest.step(
      'Find card of created custom app on My workspace page',
      async () => {
        const agent = await marketplaceAgentsSection.findAgentElement({
          name: appName,
          version: appVersion,
        } as DialAIEntityModel);
        await baseAssertion.assertElementState(agent, 'visible');
      },
    );
  },
);
