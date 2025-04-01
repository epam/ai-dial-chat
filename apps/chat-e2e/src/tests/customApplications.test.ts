import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  AddAppMenuOptions,
  AppEditorGeneralFormFields,
  AppEditorViewFormFields,
  AppMenuActions,
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  MockedChatApiResponseBodies,
} from '@/src/testData';
import { AppEditSteps, BaseElement } from '@/src/ui/webElements';
import { GeneratorUtil } from '@/src/utils';

dialTest.only(
  'Create custom app with required fields only.\n' + // EPMRTC-5130
    'Edit option for custom app is available from card pop-up form.\n' + // EPMRTC-5939
    'Custom app with permitted spec symbols in Name', // EPMRTC-4838
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
    agentDetailsModal,
    appEditorHeaderAssertion,
    dialHomePage,
    localStorageManager,
    chat,
    chatMessagesAssertion,
  }) => {
    setTestIds('EPMRTC-5130', 'EPMRTC-5939', 'EPMRTC-4838');
    let appEntity = {
      name: `${GeneratorUtil.randomApplicationName()}${ExpectedConstants.allowedSpecialChars}`,
      version: GeneratorUtil.randomApplicationVersion(),
    } as DialAIEntityModel;
    let agentElement: BaseElement;
    await localStorageManager.setShowSideBarPanels();

    await dialTest.step('Open My workspace directly', async () => {
      await marketplacePage.openMyWorkspacePage();
      await marketplacePage.waitForPageLoaded();
    });

    await dialTest.step(
      'Click Add app and select Custom app in drop down',
      async () => {
        await marketplaceHeader.addAppButton.click();
        await addAppDropdownMenu.selectMenuOption(AddAppMenuOptions.customApp);
        await appEditorPage.waitForPageLoaded();

        await appEditorHeaderAssertion.assertActionTitle(
          `${AppMenuActions.add(AddAppMenuOptions.customApp)}`,
        );
      },
    );

    await dialTest.step(
      'App editor General Info step is opened, header features are valid, step titles in the header marked as not completed',
      async () => {
        await baseAssertion.assertElementState(appEditorGeneralForm, 'visible');

        const generalInfoStep = appEditorHeader.getGeneralInfoStep();
        const appSettingsStep = appEditorHeader.getAppSettingsStep();
        await baseAssertion.assertElementState(generalInfoStep);
        await baseAssertion.assertElementState(appSettingsStep);
        await baseAssertion.assertElementActionabilityState(
          generalInfoStep,
          'enabled',
        );
        await baseAssertion.assertElementActionabilityState(
          appSettingsStep,
          'disabled',
        );

        await appEditorHeaderAssertion.assertStepIsCompleted(
          generalInfoStep,
          false,
        );
        await appEditorHeaderAssertion.assertStepIsCompleted(
          appSettingsStep,
          false,
        );
      },
    );

    await dialTest.step(
      'Check that the required fields of General Info step form are marked with asterisks',
      async () => {
        const nameRequiredIndicator =
          await appEditorGeneralForm.getRequiredIndicator(
            AppEditorGeneralFormFields.name,
          );
        await baseAssertion.assertElementState(
          nameRequiredIndicator,
          'visible',
          ExpectedMessages.applicationFormFieldShouldHaveAsterisk,
        );

        const versionRequiredIndicator =
          await appEditorGeneralForm.getRequiredIndicator(
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
          name: appEntity.name,
          version: appEntity.version,
        });
        await appEditorGeneralForm.goNext();
      },
    );

    await dialTest.step(
      'Wait for app settings step form to load and check the header changes',
      async () => {
        await baseAssertion.assertElementState(appEditorViewForm, 'visible');

        const generalInfoStep = appEditorHeader.getGeneralInfoStep();
        const appSettingsStep = appEditorHeader.getAppSettingsStep();

        await baseAssertion.assertElementActionabilityState(
          generalInfoStep,
          'enabled',
        );
        await baseAssertion.assertElementActionabilityState(
          appSettingsStep,
          'enabled',
        );

        await appEditorHeaderAssertion.assertStepIsCompleted(
          generalInfoStep,
          true,
        );
        await appEditorHeaderAssertion.assertStepIsCompleted(
          appSettingsStep,
          false,
        );
      },
    );

    await dialTest.step(
      'Verify app settings required fields are marked with asterisk',
      async () => {
        const chatCompletionUrlRequiredIndicator =
          await appEditorViewForm.getRequiredIndicator(
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
        agentElement =
          await marketplaceAgentsSection.findAgentElement(appEntity);
        await baseAssertion.assertElementState(agentElement, 'visible');
      },
    );

    await dialTest.step(
      'Click on the found card again to open details',
      async () => {
        await agentElement.click();
        await baseAssertion.assertElementState(agentDetailsModal, 'visible');
      },
    );

    await dialTest.step(
      'Click "Use application" button, Input a request message, send it and verify response was successfully generated',
      async () => {
        await agentDetailsModal.useButton.click();
        await dialHomePage.waitForPageLoaded();
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequestWithButton(GeneratorUtil.randomString(10));
        await chatMessagesAssertion.assertLastMessageContent('response'); // Check for the mocked response
      },
    );

    await dialTest.step(
      'Go back to the marketplace and click on the found card',
      async () => {
        await marketplacePage.openMyWorkspacePage({
          isInstalledDeploymentsUpdated: false,
        });
        await marketplacePage.waitForPageLoaded();
        agentElement =
          await marketplaceAgentsSection.findAgentElement(appEntity);
        await agentElement.click();
        await baseAssertion.assertElementState(agentDetailsModal, 'visible');
      },
    );

    await dialTest.step(
      'On card detailed pop-up form click on Edit icon',
      async () => {
        await agentDetailsModal.editButton.click();
        await appEditorPage.waitForPageLoadedForEdit();
      },
    );

    await dialTest.step(
      'Verify App Editor page was opened, title "Edit custom app", two steps are displayed in the header',
      async () => {
        await appEditorHeaderAssertion.assertActionTitle(
          `${AppMenuActions.edit(AddAppMenuOptions.customApp)}`,
        );

        await appEditorHeaderAssertion.assertStepState(
          appEditorHeader.getGeneralInfoStep(),
          'visible',
        );
        await appEditorHeaderAssertion.assertStepState(
          appEditorHeader.getAppSettingsStep(),
          'visible',
        );
      },
    );
  },
);

dialTest(
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
        await baseAssertion.assertElementState(appEditorViewForm);
        await baseAssertion.assertElementText(
          appEditorHeader.actionAndApplicationTypeTitle,
          `${AppMenuActions.edit} custom app`, // Assuming title format
          ExpectedMessages.headerTitleIsValid,
        );

        const generalInfoStep = appEditorHeader.getGeneralInfoStep();
        const appSettingsStep = appEditorHeader.getAppSettingsStep();

        await baseAssertion.assertElementState(generalInfoStep, 'visible');
        await baseAssertion.assertElementState(appSettingsStep, 'visible');
      },
    );

    await dialTest.step(
      'Update any field on step "Application settings" with a valid value',
      async () => {
        await baseAssertion.assertElementState(appEditorViewForm);
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
        await baseAssertion.assertElementState(appEditorGeneralForm);
        await appEditorHeaderAssertion.assertStepIsCompleted(
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
        await baseAssertion.assertElementState(appEditorViewForm);

        const chatCompletionUrlValue = await appEditorViewForm.chatCompletionUrl
          .getElementLocator()
          .inputValue();
        baseAssertion.assertValue(
          chatCompletionUrlValue,
          updatedCompletionUrl,
          'Chat Completion URL should retain updated value',
        );

        const generalInfoStep = appEditorHeader.getGeneralInfoStep();
        await generalInfoStep.click();
        await baseAssertion.assertElementState(appEditorGeneralForm);
        const descriptionValue = await appEditorGeneralForm.description
          .getElementLocator()
          .inputValue();
        baseAssertion.assertValue(
          descriptionValue,
          updatedDescription,
          'Description should retain updated value',
        );
      },
    );
  },
);
