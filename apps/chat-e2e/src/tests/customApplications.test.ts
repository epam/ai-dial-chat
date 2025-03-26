import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  AddAppMenuOptions,
  AppEditorGeneralFormFields,
  AppEditorViewFormFields,
  AppMenuActions,
  ExpectedMessages,
  MenuOptions,
} from '@/src/testData';
import { Attributes } from '@/src/ui/domData';
import { AppEditSteps } from '@/src/ui/webElements';
import { GeneratorUtil } from '@/src/utils';

dialTest(
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

dialTest.only(
  'Edit custom application',
  async ({
    marketplacePage,
    marketplaceAgentsSection,
    marketplaceAgents,
    appEditorGeneralForm,
    appEditorViewForm,
    appEditorHeader,
    setTestIds,
    baseAssertion,
    customApplicationBuilder,
    applicationApiHelper,
    appEditorHeaderAssertion,
  }) => {
    setTestIds('EPMRTC-5131');
    const updatedDescription = GeneratorUtil.randomString(25);
    const updatedCompletionUrl = `http://updated-${GeneratorUtil.randomString(6)}.com`;
    const appCreds = {
      name: GeneratorUtil.randomApplicationName(),
      version: GeneratorUtil.randomApplicationVersion(),
      description: GeneratorUtil.randomString(20),
    } as DialAIEntityModel;

    await dialTest.step(
      'Precondition: Create custom application via API',
      async () => {
        const applicationModel = customApplicationBuilder
          .withDisplayName(appCreds.name)
          .withDisplayVersion(appCreds.version!)
          .withDescriptionKeywords(appCreds.description!)
          .build();
        const backendEntity =
          await applicationApiHelper.createApplication(applicationModel);
      },
    );

    await dialTest.step('Open My workspace page', async () => {
      await marketplacePage.openMyWorkspacePage({
        isInstalledDeploymentsUpdated: false,
      });
    });

    await dialTest.step(
      'Hover over custom app card, click 3 dots and select Edit option',
      async () => {
        const agentElement = await marketplaceAgentsSection.findAgentElement({
          name: appCreds.name,
          version: appCreds.version,
        } as DialAIEntityModel);
        await baseAssertion.assertElementState(agentElement, 'visible');
        await agentElement.hoverOver();
        await marketplaceAgents.getAgentElementDotsMenu(agentElement).click();
        await marketplaceAgents
          .getAgentDropdownMenu()
          .selectMenuOption(MenuOptions.edit);
      },
    );

    await dialTest.step(
      'App Editor page was opened, title "Edit custom app", two available steps are displayed in the header:',
      async () => {
        await appEditorViewForm.waitForState();
        await baseAssertion.assertElementText(
          appEditorHeader.actionAndApplicationTypeTitle,
          `${AppMenuActions.edit} custom app`, // Assuming title format
          ExpectedMessages.headerTitleIsValid,
        );

        const generalInfoStep = appEditorHeader.getGeneralInfoStep();
        const appSettingsStep = appEditorHeader.getAppSettingsStep();

        await baseAssertion.assertElementState(generalInfoStep, 'visible');
        await baseAssertion.assertElementState(appSettingsStep, 'visible');

        await appEditorHeaderAssertion.assertStepIsSelected(
          AppEditSteps.generalInfo,
          true,
        );
        await appEditorHeaderAssertion.assertStepIsSelected(
          AppEditSteps.appSettings,
          false,
        );
      },
    );

    await dialTest.step(
      'Update any field on step "Application settings" with a valid value',
      async () => {
        await appEditorHeaderAssertion.assertStepIsSelected(
          AppEditSteps.appSettings,
          true,
        ); //step is not selected, it is completed
        await appEditorViewForm.waitForState();
        await appEditorViewForm.fillInAppFields({
          chatCompletionUrl: updatedCompletionUrl,
        });
      },
    );

    await dialTest.step(
      'Update any field on step "General info" and click Save and exit link',
      async () => {
        const generalInfoStep = appEditorHeader.getGeneralInfoStep();
        await generalInfoStep.click();
        await appEditorGeneralForm.waitForState();
        await appEditorHeaderAssertion.assertStepIsSelected(
          AppEditSteps.generalInfo,
          true,
        );
        await appEditorGeneralForm.fillInAppFields({
          description: updatedDescription,
        });
        await appEditorHeader.saveAppAndExit();
        await baseAssertion.assertElementState(appEditorGeneralForm, 'hidden'); // Verify editor closed
        await marketplacePage.waitForPageLoaded();
      },
    );

    await dialTest.step(
      'Hover over custom app card, click 3 dots and select Edit option again',
      async () => {
        const agentElement = await marketplaceAgentsSection.findAgentElement({
          name: appCreds.name,
          version: appCreds.version,
        } as DialAIEntityModel);
        await baseAssertion.assertElementState(agentElement, 'visible');
        await agentElement.hoverOver();
        await marketplaceAgents.getAgentElementDotsMenu(agentElement).click();
        await marketplaceAgents
          .getAgentDropdownMenu()
          .selectMenuOption(MenuOptions.edit);
      },
    );

    await dialTest.step(
      'Check that updated field values from steps 4, 5 are still displayed',
      async () => {
        await appEditorViewForm.waitForState();
        await baseAssertion.assertInputValue(
          appEditorViewForm.chatCompletionUrl,
          updatedCompletionUrl,
          'Chat Completion URL should retain updated value',
        );
        await baseAssertion.assertElementAttribute(
          appEditorViewForm.chatCompletionUrl,
          Attributes.value,
          updatedCompletionUrl,
          'Chat Completion URL should retain updated value',
        );
        await baseAssertion.assertElementText(
          appEditorViewForm.chatCompletionUrl,
          updatedCompletionUrl,
          'Description should retain updated value',
        );

        const generalInfoStep = appEditorHeader.getGeneralInfoStep();
        await generalInfoStep.click();
        await appEditorGeneralForm.waitForState();
        await baseAssertion.assertElementText(
          appEditorGeneralForm.description,
          updatedDescription,
          'Description should retain updated value',
        );
      },
    );
  },
);
