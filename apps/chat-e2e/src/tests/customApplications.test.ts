import { BackendEntity } from '@/chat/types/common';
import { DialAIEntityModel } from '@/chat/types/models';
import { Publication } from '@/chat/types/publication';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  AddAppMenuOptions,
  AppEditorGeneralFormFields,
  AppEditorViewFormFields,
  AppMenuActions,
  Attachment,
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  MockedChatApiResponseBodies,
  UploadMenuOptions,
} from '@/src/testData';
import { ItemApiHelper } from '@/src/testData/api';
import { StyleValues } from '@/src/ui/domData';
import { Styles } from '@/src/ui/domData/styles';
import {
  AppEditSteps,
  BaseElement,
  FileModalSection,
} from '@/src/ui/webElements';
import {
  DateUtil,
  GeneratorUtil,
  SortingUtil,
  UserUtil,
  applicationNamePrefix,
} from '@/src/utils';
import { PublishActions } from '@epam/ai-dial-shared';

let appEntityForCleanup: BackendEntity | undefined;

dialTest(
  'Create custom app with required fields only.\n' + // EPMRTC-5130
    'Edit option for custom app is available from card pop-up form.\n' + // EPMRTC-5939
    'Custom app with permitted spec symbols in Name.\n' + // EPMRTC-4838
    'Delete custom app from context menu\n' + // EPMRTC-4094
    'Custom app: Description field displayed in New conversation , card view, app view\n' + // EPMRTC-4099
    'App Editor open and Exit of first step - app is not saved\n' + // EPMRTC-5746
    "Preview: current agent stays in Preview after user clicks on 'Save and exit' button when there is any empty required field\n" + // EPMRTC-6452
    'Stepper icons change\n' + //EPMRTC-5757
    'Add custom app: Name and version are predefined\n' + //EPMRTC-5759
    'Side panel with widgets is not displayed for app editor\n' + // EPMRTC-6049
    '[UI][AppEditor]: Logo should be in center of header', // EPMRTC-6262
  async ({
    marketplacePage,
    marketplaceHeader,
    addAppDropdownMenu,
    appEditorPage,
    appEditorGeneralForm,
    appEditorViewForm,
    appEditorHeader,
    marketplaceAgentsSection,
    marketplaceAgents,
    agentDetailsModal,
    setTestIds,
    baseAssertion,
    appEditorHeaderAssertion,
    dialHomePage,
    chat,
    chatMessagesAssertion,
    confirmationDialog,
    localStorageManager,
    agentInfoAssertion,
    agentDetailsModalAssertion,
    marketplaceContainer,
    marketplace,
    toastAssertion,
    toast,
    appEditorAppSettingsAgentPreview,
    navigationPanel,
    appEditorGeneralInfoAgentPreview,
    customApplicationBuilder,
    applicationApiHelper,
    page,
  }) => {
    setTestIds(
      'EPMRTC-5130',
      'EPMRTC-5939',
      'EPMRTC-4838',
      'EPMRTC-4094',
      'EPMRTC-4099',
      'EPMRTC-5746',
      'EPMRTC-6452',
      'EPMRTC-5757',
      'EPMRTC-5759',
      'EPMRTC-6049',
      'EPMRTC-6262',
    );
    const shortDescription = GeneratorUtil.randomShortDescription();
    const longDescription = GeneratorUtil.randomLongDescription();
    const appEntity = {
      name: `${GeneratorUtil.randomApplicationName()}${ExpectedConstants.allowedSpecialChars}`,
      version: GeneratorUtil.randomApplicationVersion(),
      description: `${shortDescription}\n\n${longDescription}`,
    } as DialAIEntityModel;
    let agentElement: BaseElement;
    await localStorageManager.setShowSideBarPanels();

    await dialTest.step(
      'Precondition: Create custom application via API to avoid inconsistent app naming. Issue 4236',
      async () => {
        const applicationModel = customApplicationBuilder
          .withDisplayName(ExpectedConstants.defaultAppName)
          .withDisplayVersion(appEntity.version!)
          .withDescriptionKeywords(appEntity.description!)
          .build();
        appEntityForCleanup =
          await applicationApiHelper.createApplication(applicationModel);
      },
    );

    await dialTest.step(
      'Open My workspace directly and verify navigation panel is displayed',
      async () => {
        await marketplacePage.openMyWorkspacePage({
          updateInstalledDeployments: false,
        });
        await marketplacePage.waitForPageLoaded();
        await baseAssertion.assertElementState(
          navigationPanel,
          'visible',
          ExpectedMessages.navigationPanelShouldBeVisible,
        );
      },
    );

    await dialTest.step(
      'Click Add app and select Custom app in drop down, verify side/navigation panels are hidden and App Editor logo is centered',
      async () => {
        await marketplaceHeader.addAppButton.click();
        await addAppDropdownMenu.selectMenuOption(AddAppMenuOptions.customApp);
        await appEditorPage.waitForPageLoaded();

        await appEditorHeaderAssertion.assertActionTitle(
          `${AppMenuActions.add(AddAppMenuOptions.customApp)}`,
        );
        await baseAssertion.assertElementState(
          navigationPanel,
          'hidden',
          ExpectedMessages.navigationPanelShouldNotBeVisible,
        );
      },
    );

    // TODO blocked by the issue 4196
    await dialTest.step.skip('logo is centered in the App Editor', async () => {
      const logoBoundingBox =
        await appEditorHeader.logo.getElementBoundingBox();
      const viewportWidth = page.viewportSize()!.width;
      const expectedLogoCenterX = viewportWidth / 2;
      const actualLogoCenterX = logoBoundingBox!.x + logoBoundingBox!.width / 2;
      const logoPositionTolerance = 5;
      baseAssertion.assertBooleanCondition(
        Math.abs(actualLogoCenterX - expectedLogoCenterX) <
          logoPositionTolerance,
        true,
        ExpectedMessages.LogoShouldBeCentered(
          expectedLogoCenterX,
          actualLogoCenterX,
        ),
      );
    });

    await dialTest.step(
      'Verify default Name and Version are pre-filled in the form and preview',
      async () => {
        const defaultAppNamePattern = new RegExp(
          `${ExpectedConstants.defaultAppName} \\d+`,
        );

        // First, wait for the preview panel to render the correct, indexed name.
        // This acts as a reliable synchronization point.
        await appEditorGeneralInfoAgentPreview.previewName
          .getElementLocatorByText(defaultAppNamePattern)
          .waitFor();

        await baseAssertion.assertInputValue(
          appEditorGeneralForm.name,
          defaultAppNamePattern,
          ExpectedMessages.defaultAppNameShouldBeFilled,
        );

        await baseAssertion.assertInputValue(
          appEditorGeneralForm.version,
          ExpectedConstants.defaultAppVersion,
          ExpectedMessages.defaultAppVersionShouldBeFilled,
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
      'Input name, click Exit, verify no custom app is created and navigation panel is visible',
      async () => {
        await appEditorGeneralForm.fillInAppFields({
          name: appEntity.name,
          version: appEntity.version,
          description: appEntity.description,
        });
        await appEditorHeader.exitLink.click();
        await baseAssertion.assertElementState(appEditorViewForm, 'hidden');
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.searchInput.fillInInput(appEntity.name);
        await baseAssertion.assertElementText(
          marketplace.noResultsFound,
          ExpectedConstants.noResults,
        );
        const actualAgents = await marketplaceAgentsSection.getAllAgents();
        baseAssertion.assertValue(
          actualAgents.length,
          0,
          ExpectedMessages.elementsCountIsValid,
        );
        await baseAssertion.assertElementState(
          navigationPanel,
          'visible',
          ExpectedMessages.navigationPanelShouldBeVisible,
        );
      },
    );

    await dialTest.step(
      'Click Add app and select Custom app in drop down again, verify side/navigation panels are hidden',
      async () => {
        await marketplaceHeader.addAppButton.click();
        await addAppDropdownMenu.selectMenuOption(AddAppMenuOptions.customApp);
        await appEditorPage.waitForPageLoaded();

        await appEditorHeaderAssertion.assertActionTitle(
          `${AppMenuActions.add(AddAppMenuOptions.customApp)}`,
        );
        await baseAssertion.assertElementState(
          navigationPanel,
          'hidden',
          ExpectedMessages.navigationPanelShouldNotBeVisible,
        );
      },
    );

    await dialTest.step(
      'Verify App Editor page was opened, title "Add custom app", general info step is active',
      async () => {
        await appEditorHeaderAssertion.assertActionTitle(
          AppMenuActions.add(AddAppMenuOptions.customApp),
        );

        await appEditorHeaderAssertion.assertStepState(
          appEditorHeader.getGeneralInfoStep(),
          'visible',
        );
        await appEditorHeaderAssertion.assertStepState(
          appEditorHeader.getAppSettingsStep(),
          'visible',
          'disabled',
        );
        await appEditorHeaderAssertion.assertStepIsCompleted(
          appEditorHeader.getGeneralInfoStep(),
          false,
        );
        await appEditorHeaderAssertion.assertStepIsCompleted(
          appEditorHeader.getAppSettingsStep(),
          false,
        );
      },
    );

    await dialTest.step(
      'Check that the required fields of General Info step form are marked with asterisks',
      async () => {
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
      'Fill in inputs of Name, Version and click Next, verify side/navigation panels are hidden',
      async () => {
        await appEditorGeneralForm.fillInAppFields({
          name: appEntity.name,
          version: appEntity.version,
          description: appEntity.description,
        });
        await appEditorGeneralForm.goNext();
        await baseAssertion.assertElementState(
          appEditorAppSettingsAgentPreview,
          'visible',
        );
        await baseAssertion.assertElementState(
          appEditorAppSettingsAgentPreview.previewSpinner,
          'hidden',
        );
        await baseAssertion.assertElementState(
          navigationPanel,
          'hidden',
          ExpectedMessages.navigationPanelShouldNotBeVisible,
        );
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
      'Attempt to save with empty Chat Completion URL and verify error and preview persistence',
      async () => {
        await appEditorHeader.saveAndExitButton.click();
        await toastAssertion.assertToastMessage(
          ExpectedConstants.pleaseFillInAllMandatoryFields,
        );
        await toast.closeToast();

        await baseAssertion.assertElementState(
          appEditorAppSettingsAgentPreview,
          'visible',
        );
        await agentInfoAssertion.assertAgentName(appEntity.name);
        await agentInfoAssertion.assertAgentIcon(API.defaultModelIconHost());
        await baseAssertion.assertElementState(appEditorViewForm, 'visible');
      },
    );

    await dialTest.step(
      'Input Chat completion URL, click Save and Exit link, verify navigation panel is visible',
      async () => {
        await appEditorViewForm.fillInAppFields();
        await appEditorHeader.focusOn({ isHttpMethodTriggered: false });
        await appEditorHeader.saveAndExitButton.click();
        await baseAssertion.assertElementState(appEditorViewForm, 'hidden');
        await marketplacePage.waitForPageLoaded();
        await baseAssertion.assertElementState(
          navigationPanel,
          'visible',
          ExpectedMessages.navigationPanelShouldBeVisible,
        );
      },
    );

    await dialTest.step(
      'Find card of created custom app on My workspace page',
      async () => {
        await marketplaceHeader.searchInput.fillInInput(appEntity.name);
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
        await agentDetailsModalAssertion.assertDescription(
          appEntity.description!,
        );
      },
    );

    await dialTest.step(
      'Click "Use application" button and perform assertions',
      async () => {
        await agentDetailsModal.clickUseButton({
          isInstalledDeploymentsUpdated: false,
        });
        await dialHomePage.waitForPageLoaded();
        await agentInfoAssertion.assertShortDescription(appEntity);
      },
    );

    await dialTest.step(
      'Input a request message, send it and verify response was successfully generated',
      async () => {
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequestWithButton(GeneratorUtil.randomString(10));
        await chatMessagesAssertion.assertLastMessageContent('response');
      },
    );

    await dialTest.step(
      'Go back to the marketplace and click on the found card',
      async () => {
        await marketplacePage.openMyWorkspacePage({
          updateInstalledDeployments: false,
        });
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.searchInput.fillInInput(appEntity.name);
        agentElement =
          await marketplaceAgentsSection.findAgentElement(appEntity);

        const actualDescription =
          marketplaceAgents.getAgentDescription(agentElement);
        await baseAssertion.assertElementText(
          actualDescription,
          shortDescription,
          `Short description on card for "${appEntity.name}" should be correct`,
        );
        await agentElement.click();
        await baseAssertion.assertElementState(agentDetailsModal, 'visible');
      },
    );

    await dialTest.step(
      'On card detailed pop-up form click on Edit icon',
      async () => {
        await agentDetailsModal.clickEditButton({ triggeredHttpMethod: 'GET' });
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

    await dialTest.step('Close the application edit mode', async () => {
      await appEditorHeader.saveAndExitButton.click();
    });

    await dialTest.step(
      'Delete an app, confirm and verify custom app card was deleted from My workspace',
      async () => {
        agentElement =
          await marketplaceAgentsSection.findAgentElement(appEntity);
        await agentElement.hoverOver();
        await marketplaceAgents.getAgentElementDotsMenu(agentElement).click();
        await marketplaceAgents
          .getAgentDropdownMenu()
          .selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        await baseAssertion.assertElementState(
          agentElement,
          'hidden',
          `App "${appEntity.name}" should be deleted from My Workspace`,
        );
      },
    );

    await dialTest.step(
      'Navigate to DIAL Marketplace and verify custom app card was deleted',
      async () => {
        await marketplaceContainer.getNavigationPanel().goToMarketplaceHome();
        await marketplaceHeader.searchInput.fillInInput(appEntity.name);
        const actualAgents = await marketplaceAgentsSection.getAllAgents();
        baseAssertion.assertValue(
          actualAgents.length,
          0,
          ExpectedMessages.elementsCountIsValid,
        );
        await baseAssertion.assertElementState(
          agentElement,
          'hidden',
          `App "${appEntity.name}" should be deleted from Marketplace`,
        );
      },
    );
  },
);

dialTest(
  'Edit custom application\n' + //EPMRTC-5131
    'Edit version for custom app\n' + //EPMRTC-4305
    'DIAL logo click on second step in AppEditor saves app ( decided on daily to leave for now)', // EPMRTC-5747
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
    navigationPanel,
    dialHomePage,
    toastAssertion,
    agentInfo,
    localStorageManager,
    appEditorGeneralInfoAgentPreview,
  }) => {
    setTestIds('EPMRTC-5131', 'EPMRTC-4305', 'EPMRTC-5747');
    const updatedDescription = GeneratorUtil.randomString(25);
    const updatedCompletionUrl = `http://updated-${GeneratorUtil.randomString(6)}.com`;
    const appEntity = {
      name: GeneratorUtil.randomApplicationName(),
      version: '1.1.1',
      description: GeneratorUtil.randomString(20),
    } as DialAIEntityModel;
    await localStorageManager.setShowSideBarPanels();

    await dialTest.step(
      'Precondition: Create custom application via API',
      async () => {
        const applicationModel = customApplicationBuilder
          .withDisplayName(appEntity.name)
          .withDisplayVersion(appEntity.version!)
          .withDescriptionKeywords(appEntity.description!)
          .build();
        await applicationApiHelper.createApplication(applicationModel);
      },
    );

    await dialTest.step('Open My workspace page', async () => {
      await marketplacePage.openMyWorkspacePage({
        updateInstalledDeployments: false,
      });
      await marketplacePage.waitForPageLoaded();
    });

    await dialTest.step(
      'Hover over custom app card, click 3 dots and select Edit option',
      async () => {
        const agentElement = await marketplaceAgentsSection.findAgentElement({
          name: appEntity.name,
          version: appEntity.version,
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
          `${AppMenuActions.edit(AddAppMenuOptions.customApp)}`,
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
      'Update any field on step "General info", close the app editor by clicking on the header logo, then go back to the marketplace',
      async () => {
        await appEditorHeader.goOnGeneralInfoStepWithHeaderStepper();
        await baseAssertion.assertElementState(
          appEditorGeneralInfoAgentPreview,
          'visible',
        );
        await baseAssertion.assertElementState(
          appEditorGeneralInfoAgentPreview.previewSpinner,
          'hidden',
        );
        await baseAssertion.assertElementState(appEditorGeneralForm);
        await appEditorHeaderAssertion.assertStepIsCompleted(
          AppEditSteps.appSettings,
          true,
        );
        await appEditorHeaderAssertion.assertStepIsCompleted(
          AppEditSteps.generalInfo,
          false,
        );
        //need to explicitly click on the form to trigger autosave after fields update
        await appEditorGeneralForm.version.click();
        appEntity.version = '2.2.2';
        appEntity.description = updatedDescription;
        await appEditorGeneralForm.fillInAppFields({
          version: appEntity.version,
          description: appEntity.description,
        });
        await appEditorHeader.focusOn();
        await appEditorHeader.logo.click();
        await dialHomePage.waitForPageLoaded();
        await baseAssertion.assertElementState(agentInfo, 'visible'); // Assert no validation error appeared
        await toastAssertion.assertToastIsHidden();
        await baseAssertion.assertElementState(appEditorGeneralForm, 'hidden');
        await navigationPanel.goToMyWorkspace();
        await marketplacePage.waitForPageLoaded();
      },
    );

    await dialTest.step(
      'Hover over custom app card, click 3 dots and select Edit option again',
      async () => {
        const agentElement = await marketplaceAgentsSection.findAgentElement({
          name: appEntity.name,
          version: appEntity.version,
        } as DialAIEntityModel);
        await baseAssertion.assertElementState(agentElement, 'visible');
        await baseAssertion.assertElementText(
          marketplaceAgents.getAgentVersion(agentElement),
          appEntity.version!,
        );
        await agentElement.hoverOver();
        await marketplaceAgents.getAgentElementDotsMenu(agentElement).click();
        await marketplaceAgents
          .getAgentDropdownMenu()
          .selectMenuOption(MenuOptions.edit);
      },
    );

    await dialTest.step(
      'Check that updated field values are still displayed',
      async () => {
        await baseAssertion.assertElementState(appEditorViewForm);

        const chatCompletionUrlValue = await appEditorViewForm.chatCompletionUrl
          .getElementLocator()
          .inputValue();
        baseAssertion.assertValue(
          chatCompletionUrlValue,
          updatedCompletionUrl,
          ExpectedMessages.FormFieldShouldRetainUpdatedValue,
        );

        await appEditorHeader.goOnGeneralInfoStepWithHeaderStepper({
          isHttpMethodTriggered: false,
        });
        await baseAssertion.assertElementState(
          appEditorGeneralInfoAgentPreview,
          'visible',
        );
        await baseAssertion.assertElementState(
          appEditorGeneralInfoAgentPreview.previewSpinner,
          'hidden',
        );
        await baseAssertion.assertElementState(appEditorGeneralForm);
        const descriptionValue = await appEditorGeneralForm.description
          .getElementLocator()
          .inputValue();
        baseAssertion.assertValue(
          descriptionValue,
          updatedDescription,
          ExpectedMessages.FormFieldShouldRetainUpdatedValue,
        );
      },
    );

    await dialTest.step(
      'On detailed view in section Information there is Release date field',
      async () => {
        const releaseDateElement = appEditorGeneralInfoAgentPreview.releaseDate;
        await baseAssertion.assertElementState(releaseDateElement, 'visible');
        await baseAssertion.assertElementText(
          releaseDateElement,
          DateUtil.getCurrentLocalDate(),
          ExpectedMessages.releaseDateShouldBeValid,
        );
      },
    );
  },
);

dialTest(
  'Delete custom app from "Select an agent for conversation" form\n' + // EPMRTC-4105
    'Delete custom app from application card pop-up\n' + // EPMRTC-4103
    '[Custom app]: Delete specific not published version' + // EPMRTC-4285
    '[Custom app]: add 2 applications with the same name and different versions - not published applications grouped by name\n', //EPMRTC-4279
  async ({
    marketplacePage,
    marketplaceAgentsSection,
    agentDetailsModal,
    dialHomePage,
    chat,
    talkToAgentDialog,
    talkToAgents,
    confirmationDialog,
    setTestIds,
    baseAssertion,
    customApplicationBuilder,
    applicationApiHelper,
    localStorageManager,
    marketplaceHeader,
    marketplaceContainer,
    agentDetailsModalAssertion,
    marketplaceAgents,
    agentVersionsDropdownMenuAssertion,
  }) => {
    setTestIds('EPMRTC-4105', 'EPMRTC-4103', 'EPMRTC-4285', 'EPMRTC-4279');
    let agentElementInDialog: BaseElement;
    let agentElement1: BaseElement;
    let agentElement2: BaseElement;

    const appEntity1 = {
      name: GeneratorUtil.randomApplicationName(),
      version: GeneratorUtil.randomApplicationVersion(),
      description: GeneratorUtil.randomString(20),
    } as DialAIEntityModel;

    const appEntity2_v1 = {
      name: GeneratorUtil.randomApplicationName(),
      version: '0.0.1',
      description: GeneratorUtil.randomString(20),
    } as DialAIEntityModel;

    const appEntity2_v2 = {
      name: appEntity2_v1.name,
      version: '0.0.2',
      description: GeneratorUtil.randomString(20),
    } as DialAIEntityModel;

    await dialTest.step(
      'Precondition: Create custom application via API',
      async () => {
        const applicationModel = customApplicationBuilder
          .withDisplayName(appEntity1.name)
          .withDisplayVersion(appEntity1.version!)
          .withDescriptionKeywords(appEntity1.description!)
          .build();
        await applicationApiHelper.createApplication(applicationModel);

        const applicationModel2_v1 = customApplicationBuilder
          .withDisplayName(appEntity2_v1.name)
          .withDisplayVersion(appEntity2_v1.version!)
          .withDescriptionKeywords(appEntity2_v1.description!)
          .build();
        await applicationApiHelper.createApplication(applicationModel2_v1);

        const applicationModel2_v2 = customApplicationBuilder
          .withDisplayName(appEntity2_v2.name)
          .withDisplayVersion(appEntity2_v2.version!)
          .withDescriptionKeywords(appEntity2_v2.description!)
          .build();
        await applicationApiHelper.createApplication(applicationModel2_v2);

        await localStorageManager.setRecentModelsIdsOnceWithPermanentLastUsedModel(
          appEntity1,
          appEntity2_v2,
        );
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Open DIAL Marketplace and find this custom app',
      async () => {
        await marketplacePage.openMarketplacePage();
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.searchInput.fillInInput(appEntity1.name);
        agentElement1 =
          await marketplaceAgentsSection.findAgentElement(appEntity1);
        await baseAssertion.assertElementState(agentElement1, 'visible');
      },
    );

    await dialTest.step('Click "Use application"', async () => {
      await agentElement1.click();
      await baseAssertion.assertElementState(agentDetailsModal, 'visible');
      await agentDetailsModal.useButton.click();
      await dialHomePage.waitForPageLoaded();
    });

    await dialTest.step('Click on "Change agent" link', async () => {
      await chat.changeAgentButton.click();
      await talkToAgentDialog.waitForState();
    });

    await dialTest.step(
      'Hover over app card, click on 3 dots, select Delete option and confirm',
      async () => {
        agentElementInDialog = talkToAgentDialog.getTalkToAgent(appEntity1);
        await agentElementInDialog.hoverOver();
        await talkToAgents
          .getAgentElementDotsMenu(agentElementInDialog)
          .click();
        await talkToAgents
          .getAgentDropdownMenu()
          .selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
      },
    );

    await dialTest.step(
      'Navigate to My workspace and verify custom app card was deleted',
      async () => {
        await talkToAgentDialog.goToMyWorkspace();
        await marketplacePage.waitForPageLoaded();

        await baseAssertion.assertElementState(
          agentElementInDialog,
          'hidden',
          `App "${appEntity1.name}" should be deleted from My Workspace`,
        );
      },
    );

    await dialTest.step(
      'Navigate to DIAL Marketplace and verify custom app card was deleted',
      async () => {
        await marketplaceContainer.getNavigationPanel().goToMarketplaceHome();
        await marketplaceHeader.searchInput.fillInInput(appEntity1.name);
        const actualAgents = await marketplaceAgentsSection.getAllAgents();
        baseAssertion.assertValue(
          actualAgents.length,
          0,
          ExpectedMessages.elementsCountIsValid,
        );
        await marketplacePage.waitForPageLoaded();
        await baseAssertion.assertElementState(
          agentElement1,
          'hidden',
          `App "${appEntity1.name}" should be deleted from Marketplace`,
        );
      },
    );

    await dialTest.step(
      'Open "My workspace", verify that the only one card for App2 is found, find App 2 and click on the second app card',
      async () => {
        await marketplaceContainer.getNavigationPanel().goToMyWorkspace();
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.searchInput.fillInInput(appEntity2_v2.name);
        const allAgents = await marketplaceAgentsSection.getAllAgents();
        const workspaceAgentsWithName = allAgents.filter(
          (agent) =>
            agent.isWorkspaceAgent && agent.name === appEntity2_v2.name,
        );
        baseAssertion.assertValue(
          workspaceAgentsWithName.length,
          1,
          ExpectedMessages.onlyOneEntityCardFoundInSearch('application'),
        );
        agentElement2 =
          await marketplaceAgentsSection.findAgentElement(appEntity2_v2);
        await baseAssertion.assertElementState(agentElement2, 'visible');
        await baseAssertion.assertElementText(
          marketplaceAgents.getAgentVersion(agentElement2),
          appEntity2_v2.version!,
          ExpectedMessages.cardShouldDisplayTheLatestVersion,
        );
      },
    );

    await dialTest.step(
      'Click on App 2 card, verify versions, select older version',
      async () => {
        await agentElement2.click();
        await baseAssertion.assertElementState(agentDetailsModal, 'visible');
        await agentDetailsModalAssertion.assertApplicationName(
          appEntity2_v2.name,
        );
        await agentDetailsModalAssertion.assertApplicationVersion(
          appEntity2_v2.version!,
        );
        await agentDetailsModal.versionMenuTrigger.click();
        const expectedVersionsInDropdown = SortingUtil.sortVersionsArray([
          appEntity2_v1.version!,
          appEntity2_v2.version!,
        ]);
        await agentVersionsDropdownMenuAssertion.assertMenuOptions(
          expectedVersionsInDropdown,
        );
        await agentDetailsModal
          .getVersionDropdownMenu()
          .selectMenuOption(appEntity2_v1.version!);
        await agentDetailsModalAssertion.assertApplicationVersion(
          appEntity2_v1.version!,
        );
      },
    );

    await dialTest.step(
      'Click on Delete icon in the modal and confirm deletion',
      async () => {
        await agentDetailsModal.deleteButton.click();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        await agentDetailsModal.waitForState({ state: 'hidden' });
      },
    );

    await dialTest.step(
      'Verify second custom app version is 0.0.2',
      async () => {
        await baseAssertion.assertElementState(agentElement2, 'visible');
      },
    );

    await dialTest.step(
      'Navigate to DIAL Marketplace and verify second custom app card was deleted',
      async () => {
        await marketplaceContainer.getNavigationPanel().goToMarketplaceHome();
        await marketplacePage.waitForPageLoaded();
        await baseAssertion.assertElementState(agentElement2, 'visible');
        await baseAssertion.assertElementText(
          marketplaceAgents.getAgentVersion(agentElement2),
          appEntity2_v2.version!,
        );
        await agentElement2.click();
        await baseAssertion.assertElementState(agentDetailsModal, 'visible');
        await agentDetailsModalAssertion.assertApplicationVersion(
          appEntity2_v2.version!,
        );
      },
    );
  },
);

dialTest(
  'Custom app Topic dropdown select.\n' + // EPMRTC-4374
    '[Custom app]: Hints on for fields\n' + // EPMRTC-4278
    'Preview on step "General info"\n' + // EPMRTC-5749
    'Preview on step "App settings"\n' + // EPMRTC-5750
    'Chat created from preview form on step "App settings" is not available on DIAL home page\n' + // EPMRTC-5762
    'Input on step "App settings" data saved when switch back to step "General info"\n' + // EPMRTC-5765
    'Input on step "General info" data saved when switch to step "App settings" using stepper (not Next button )', // EPMRTC-5928
  async (
    {
      marketplacePage,
      appEditorPage,
      appEditorGeneralForm,
      listboxMenu,
      setTestIds,
      baseAssertion,
      tooltipAssertion,
      appEditorViewForm,
      attachFilesModal,
      appEditorGeneralInfoAgentPreview,
      fileApiHelper,
      appEditorHeader,
      appEditorAppSettingsAgentPreview,
      dialHomePage,
      chatMessagesAssertion,
      sendMessage,
      chatMessages,
      conversationAssertion,
    },
    testInfo,
  ) => {
    setTestIds(
      'EPMRTC-4374',
      'EPMRTC-4278',
      'EPMRTC-5749',
      'EPMRTC-5750',
      'EPMRTC-5762',
      'EPMRTC-5765',
      'EPMRTC-5928',
    );
    let numberOfTopicsToSelect: number;
    let allTopics: string[] = [];
    let topicsToSelect: string[] = [];

    const shortAppDescription = GeneratorUtil.randomShortDescription();
    const longAppDescription = GeneratorUtil.randomLongDescription();
    const appEntity = {
      name: GeneratorUtil.randomApplicationName(),
      version: GeneratorUtil.randomApplicationVersion(),
      description: `${shortAppDescription}\n\n${longAppDescription}`,
    } as DialAIEntityModel;
    const expectedIconUrl = `/api/${await fileApiHelper.putFile(
      Attachment.sunImageName,
    )}`;
    const previewChatMessage = 'Hello from preview';
    const attachmentTypeToSet = 'image/png';
    const updatedAppNameForStepperTest = `${appEntity.name}-stepper-update`; // New name for EPMRTC-5928

    await dialTest.step('Open create a custom app page', async () => {
      await marketplacePage.openCreateCustomAppPage();
      await appEditorPage.waitForPageLoaded();
    });

    await dialTest.step(
      'Hover over question icon for Description field and verify hint',
      async () => {
        await appEditorGeneralForm.descriptionHintIcon.hoverOver();
        await tooltipAssertion.assertTooltipContent(
          ExpectedConstants.customApplicationDescriptionTooltip,
        );
      },
    );

    await dialTest.step(
      'Click on Topics drop down and verify the list is expanded',
      async () => {
        await appEditorGeneralForm.topicsDropdownToggle.click();
        await baseAssertion.assertElementState(
          listboxMenu,
          'visible',
          ExpectedMessages.listboxMenuIsVisible,
        );
        allTopics = await listboxMenu.getAllOptions();
        numberOfTopicsToSelect = allTopics.length - 1;
        baseAssertion.assertNumberIsGreaterThan(allTopics.length, 0);
      },
    );

    await dialTest.step(`Select topics and verify height changes`, async () => {
      topicsToSelect = allTopics
        .sort((a, b) => b.length - a.length)
        .slice(0, numberOfTopicsToSelect);

      const topicsInputControlBox1 =
        await appEditorGeneralForm.topicsDropdownContainer.getElementBoundingBox();
      const initialHeight = topicsInputControlBox1!.height;

      for (let i = 0; i < numberOfTopicsToSelect; i++) {
        await listboxMenu.selectOption(topicsToSelect[i]);
      }
      const topicsInputControlBoxAll =
        await appEditorGeneralForm.topicsDropdownContainer.getElementBoundingBox();
      const topicsHeightAfterSelection = topicsInputControlBoxAll!.height;

      // Assertions for selected topics
      const selectedTopics = await appEditorGeneralForm.getSelectedTopics();
      await baseAssertion.assertElementsCount(
        appEditorGeneralForm.selectedTopicPills,
        topicsToSelect.length,
        ExpectedMessages.elementsCountIsValid,
      );
      baseAssertion.assertArrayIncludesAll(
        selectedTopics,
        topicsToSelect,
        ExpectedMessages.fieldValueIsValid,
      );

      // Height assertion (only if more than one topic was selected to make the comparison meaningful)
      baseAssertion.assertNumberIsGreaterThan(
        topicsHeightAfterSelection,
        initialHeight * 2,
        `Height after selecting ${topicsToSelect.length} topics should be greater`,
      );
    });

    await dialTest.step(
      'Delete any single Topic using the X icon on the pill',
      async () => {
        // Delete random specific topic
        const topicToDelete = GeneratorUtil.randomArrayElement(topicsToSelect);
        await appEditorGeneralForm.deleteSelectedTopic(topicToDelete);

        const remainingTopics = topicsToSelect.filter(
          (t) => t !== topicToDelete,
        );
        // Get current selected topics again
        const currentSelectedTopics =
          await appEditorGeneralForm.getSelectedTopics();

        await baseAssertion.assertElementsCount(
          appEditorGeneralForm.selectedTopicPills,
          numberOfTopicsToSelect - 1,
          ExpectedMessages.elementsCountIsValid,
        );
        // Verify remaining topics
        baseAssertion.assertArrayIncludesAll(
          currentSelectedTopics,
          remainingTopics,
          ExpectedMessages.fieldValueIsValid,
        );
        // Verify deleted topic is absent
        baseAssertion.assertArrayExcludesAll(
          currentSelectedTopics,
          [topicToDelete],
          ExpectedMessages.fieldValueIsValid,
        );
      },
    );

    await dialTest.step(
      'Click on the main X icon in the Topics row to clear all selections',
      async () => {
        await appEditorGeneralForm.clearAllTopics();
        // Assert selected topics count
        await baseAssertion.assertElementsCount(
          appEditorGeneralForm.selectedTopicPills,
          0,
          ExpectedMessages.elementsCountIsValid,
        );
      },
    );

    await dialTest.step('Fill in the data for the App', async () => {
      await appEditorGeneralForm.fillInAppFields({
        name: appEntity.name,
        version: appEntity.version,
        description: appEntity.description,
      });
      await appEditorGeneralForm.topicsDropdownToggle.click();
      topicsToSelect = allTopics
        .sort((a, b) => a.length - b.length)
        .slice(0, 2);
      for (const topic of topicsToSelect) {
        await listboxMenu.selectOption(topic);
      }
      await appEditorGeneralForm.topicsDropdownToggle.click();
      await appEditorGeneralForm.addIconButton.click();
      await attachFilesModal.checkAttachedFile(
        Attachment.sunImageName,
        FileModalSection.AllFiles,
      );
      await attachFilesModal.attachFiles();
    });

    await dialTest.step(
      "Verify preview of app's pop-up form on right side of General Info screen",
      async () => {
        await baseAssertion.assertElementState(
          appEditorGeneralInfoAgentPreview,
          'visible',
        );

        await baseAssertion.assertElementText(
          appEditorGeneralInfoAgentPreview.previewName,
          appEntity.name,
          ExpectedMessages.agentNameIsValid,
        );

        const actualShortDescElement =
          appEditorGeneralInfoAgentPreview.getShortDescriptionDetailedViewElement();
        const actualLongDescElement =
          appEditorGeneralInfoAgentPreview.getLongDescriptionDetailedViewElement();

        await baseAssertion.assertElementText(
          actualShortDescElement,
          shortAppDescription,
          ExpectedMessages.agentDescriptionIsValid,
        );
        await baseAssertion.assertElementText(
          actualLongDescElement,
          longAppDescription,
          ExpectedMessages.agentDescriptionIsValid,
        );

        const displayedTopics =
          await appEditorGeneralInfoAgentPreview.topicElements.getElementsInnerContent();
        baseAssertion.assertArrayIncludesAll(
          displayedTopics,
          topicsToSelect,
          ExpectedMessages.selectedTopicsAreValid,
        );
        baseAssertion.assertValue(
          displayedTopics.length,
          topicsToSelect.length,
          ExpectedMessages.numberOfTopicsIsCorrect,
        );

        await baseAssertion.assertElementState(
          appEditorGeneralInfoAgentPreview.previewInformationSection,
          'visible',
        );
        await baseAssertion.assertElementState(
          appEditorGeneralInfoAgentPreview.previewAuthorContainer,
          'visible',
        );

        const currentUsername = UserUtil.getE2EUsername(testInfo.parallelIndex);
        await baseAssertion.assertElementText(
          appEditorGeneralInfoAgentPreview.previewAuthorValue,
          currentUsername,
          ExpectedMessages.authorIsValid,
        );

        const previewAppIcon = appEditorGeneralInfoAgentPreview.previewIcon;
        await baseAssertion.assertEntityIcon(previewAppIcon, expectedIconUrl);
      },
    );

    await dialTest.step(
      'Turn off the detailed view and assert details on General Info screen',
      async () => {
        await appEditorGeneralInfoAgentPreview.detailedSwitch.click();
        await baseAssertion.assertElementText(
          appEditorGeneralInfoAgentPreview.previewName,
          appEntity.name,
          ExpectedMessages.agentNameIsValid,
        );

        await baseAssertion.assertElementText(
          appEditorGeneralInfoAgentPreview.version,
          appEntity.version!,
          ExpectedMessages.agentVersionIsValid,
        );

        const actualShortDescElement =
          appEditorGeneralInfoAgentPreview.getShortDescriptionDetailedViewElement();

        await baseAssertion.assertElementText(
          actualShortDescElement,
          shortAppDescription,
          ExpectedMessages.agentDescriptionIsValid,
        );

        const displayedTopics =
          await appEditorGeneralInfoAgentPreview.topicElements.getElementsInnerContent();
        baseAssertion.assertArrayIncludesAll(
          displayedTopics,
          topicsToSelect,
          ExpectedMessages.selectedTopicsAreValid,
        );
        baseAssertion.assertValue(
          displayedTopics.length,
          topicsToSelect.length,
          ExpectedMessages.numberOfTopicsIsCorrect,
        );
        const previewAppIcon = appEditorGeneralInfoAgentPreview.previewIcon;
        await baseAssertion.assertEntityIcon(previewAppIcon, expectedIconUrl);
      },
    );

    await dialTest.step(
      'Click Next button to go to App Settings, hover over question icons for Features data and Attachment types and verify hints',
      async () => {
        await appEditorGeneralForm.goNext({ waitForResponses: false });
        await baseAssertion.assertElementState(appEditorViewForm, 'visible');
        await baseAssertion.assertElementState(
          appEditorAppSettingsAgentPreview,
          'visible',
        );
        await baseAssertion.assertElementState(
          appEditorAppSettingsAgentPreview.previewSpinner,
          'hidden',
        );
        await appEditorViewForm.featuresDataHintIcon.hoverOver();
        await tooltipAssertion.assertTooltipContent(
          ExpectedConstants.customApplicationFeaturesTooltip,
        );
        await appEditorViewForm.attachmentTypesHintIcon.hoverOver();
        await tooltipAssertion.assertTooltipContent(
          ExpectedConstants.customApplicationAttachmentsTypesTooltip,
        );
      },
    );

    await dialTest.step(
      'Input Chat completion URL on App Settings step',
      async () => {
        await appEditorViewForm.fillInAppFields({
          chatCompletionUrl: 'http://testurl.com',
        });
      },
    );

    await dialTest.step(
      'Verify preview area on App Settings step shows a new conversation screen and message box is enabled',
      async () => {
        await baseAssertion.assertElementState(
          appEditorAppSettingsAgentPreview,
          'visible',
        );
        await baseAssertion.assertElementState(
          appEditorAppSettingsAgentPreview.appSettingsChatMode,
          'visible',
        );
        await baseAssertion.assertElementState(
          appEditorAppSettingsAgentPreview.agentInfoContainer,
          'visible',
        );
        const previewChatInput = sendMessage.messageInput;
        await baseAssertion.assertElementState(previewChatInput, 'visible');
        await baseAssertion.assertElementActionabilityState(
          previewChatInput,
          'enabled',
        );
        const previewChatIcon =
          appEditorAppSettingsAgentPreview.previewChatIcon;
        await baseAssertion.assertEntityIcon(previewChatIcon, expectedIconUrl);
      },
    );

    await dialTest.step(
      'Input a message in preview chat, send it, and verify message and response appear',
      async () => {
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await sendMessage.messageInput.fillInInput(previewChatMessage);
        await sendMessage.sendMessageButton.click();
        await chatMessages.getChatMessage(2).waitFor();

        await chatMessagesAssertion.assertMessageContent(1, previewChatMessage);
        await chatMessagesAssertion.assertMessageContent(2, 'Response');
      },
    );

    await dialTest.step('Add attachment type (e.g., image/png)', async () => {
      await appEditorViewForm.fillInAppFields({
        attachmentTypes: [attachmentTypeToSet],
      });
    });

    //TODO blocked by the issue 4225
    await dialTest.step.skip(
      'Verify clip icon appears in preview chat message box',
      async () => {
        await sendMessage.click();
        const previewChatAttachmentButton = sendMessage.attachmentMenuTrigger;
        await baseAssertion.assertElementState(
          previewChatAttachmentButton,
          'visible',
          ExpectedMessages.attachmentClipIconShouldAppear,
        );
      },
    );

    await dialTest.step('Navigate back to General Info step', async () => {
      await appEditorHeader.goOnGeneralInfoStepWithHeaderStepper({
        isHttpMethodTriggered: false,
      });
      await baseAssertion.assertElementState(appEditorGeneralForm, 'visible');
      await baseAssertion.assertElementState(
        appEditorGeneralInfoAgentPreview,
        'visible',
      );
      await baseAssertion.assertElementState(
        appEditorGeneralInfoAgentPreview.previewSpinner,
        'hidden',
      );
    });

    await dialTest.step('Navigate forward to App Settings step', async () => {
      await appEditorGeneralForm.goNext({ waitForResponses: false });
      await baseAssertion.assertElementState(appEditorViewForm, 'visible');
      await baseAssertion.assertElementState(
        appEditorAppSettingsAgentPreview,
        'visible',
      );
      await baseAssertion.assertElementState(
        appEditorAppSettingsAgentPreview.previewSpinner,
        'hidden',
      );
    });

    await dialTest.step('Verify attachment types are preserved', async () => {
      const actualAttachmentTypes =
        await appEditorViewForm.getSelectedAttachmentTypes(true);
      baseAssertion.assertArrayIncludesAll(
        actualAttachmentTypes,
        [attachmentTypeToSet],
        ExpectedMessages.fieldValueIsValid,
      );
    });

    await dialTest.step(
      'Navigate back to General Info step using header stepper',
      async () => {
        await appEditorHeader.goOnGeneralInfoStepWithHeaderStepper({
          isHttpMethodTriggered: false,
        });
        await baseAssertion.assertElementState(appEditorGeneralForm, 'visible');
        await baseAssertion.assertElementState(
          appEditorGeneralInfoAgentPreview,
          'visible',
        );
        await baseAssertion.assertElementState(
          appEditorGeneralInfoAgentPreview.previewSpinner,
          'hidden',
        );
      },
    );

    await dialTest.step('Input new app name', async () => {
      await appEditorGeneralForm.fillInAppFields({
        name: updatedAppNameForStepperTest,
      });
    });

    await dialTest.step(
      'Navigate to App Settings step using header stepper',
      async () => {
        await appEditorHeader.goToAppSettingsStepWithHeaderStepper();
        await baseAssertion.assertElementState(appEditorViewForm, 'visible');
        await baseAssertion.assertElementState(
          appEditorAppSettingsAgentPreview,
          'visible',
        );
        await baseAssertion.assertElementState(
          appEditorAppSettingsAgentPreview.previewSpinner,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Navigate back to General Info step using header stepper',
      async () => {
        await appEditorHeader.goOnGeneralInfoStepWithHeaderStepper({
          isHttpMethodTriggered: false,
        });
        await baseAssertion.assertElementState(appEditorGeneralForm, 'visible');
        await baseAssertion.assertElementState(
          appEditorGeneralInfoAgentPreview,
          'visible',
        );
        await baseAssertion.assertElementState(
          appEditorGeneralInfoAgentPreview.previewSpinner,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Verify the new name is preserved on General Info step',
      async () => {
        await baseAssertion.assertInputValue(
          appEditorGeneralForm.name,
          updatedAppNameForStepperTest,
          ExpectedMessages.fieldValueIsValid,
        );
      },
    );

    await dialTest.step('Click Save and Exit link', async () => {
      await appEditorHeader.saveAndExitButton.click();
      await marketplacePage.waitForPageLoaded();
    });

    await dialTest.step(
      'Click back to chat - created on preview form chat is not visible on DIAL main screen',
      async () => {
        await marketplacePage
          .getMarketplaceContainer()
          .getNavigationPanel()
          .backToChatButton.click();
        await dialHomePage.waitForPageLoaded({ skipSidebars: true });
        await conversationAssertion.assertEntityState(
          { name: previewChatMessage },
          'hidden',
        );
      },
    );
  },
);

dialTest(
  'Edit Custom app: Update icon of custom app\n' + //EPMRTC-4109
    '[Custom app]: Icon is shown on the custom application card if the svg contains some special chars\n' + // EPMRTC-5538
    '[App editor]: Release date displayed on detailed preview on "General info" step when edit custom app', //EPMRTC-5831
  async ({
    marketplacePage,
    marketplaceAgentsSection,
    agentDetailsModal,
    appEditorPage,
    attachFilesModal,
    appEditorHeader,
    appEditorGeneralForm,
    appEditorGeneralInfoAgentPreview,
    appEditorAppSettingsAgentPreview,
    customApplicationBuilder,
    applicationApiHelper,
    baseAssertion,
    setTestIds,
    fileApiHelper,
  }) => {
    setTestIds('EPMRTC-4109', 'EPMRTC-5538', 'EPMRTC-5831');
    const appEntity = {
      name: GeneratorUtil.randomApplicationName(),
      version: GeneratorUtil.randomApplicationVersion(),
    } as DialAIEntityModel;
    const newIconFileName = `${ExpectedConstants.allowedSpecialChars}.svg`;
    let agentElement: BaseElement;
    let expectedNewIconUrl = await fileApiHelper.putFileWithCustomName(
      newIconFileName,
      Attachment.appIconSvg,
    );
    const uploadedIconFilePath = `/api/${expectedNewIconUrl.substring(
      0,
      expectedNewIconUrl.lastIndexOf('/') + 1,
    )}`;
    const expectedEncodedIconUrl =
      uploadedIconFilePath + encodeURIComponent(newIconFileName);

    const currentDate = DateUtil.getCurrentLocalDate();

    await dialTest.step(
      'Precondition: Create custom application via API',
      async () => {
        const applicationModel = customApplicationBuilder
          .withDisplayName(appEntity.name)
          .withDisplayVersion(appEntity.version!)
          .build();
        const createdApp =
          await applicationApiHelper.createApplication(applicationModel);
        expectedNewIconUrl = `${API.fileHost()}/${createdApp.bucket}/${newIconFileName}`;
      },
    );

    await dialTest.step('Open My workspace', async () => {
      await marketplacePage.openMyWorkspacePage();
      await marketplacePage.waitForPageLoaded();
    });

    await dialTest.step(
      'Find the created app, click on its card, then click Edit',
      async () => {
        agentElement =
          await marketplaceAgentsSection.findAgentElement(appEntity);
        await agentElement.click();
        await agentDetailsModal.waitForState();
        await agentDetailsModal.clickEditButton({ triggeredHttpMethod: 'GET' });
        await appEditorPage.waitForPageLoadedForEdit();
      },
    );

    await dialTest.step(
      'Navigate to "General info" step and upload a new icon file',
      async () => {
        await appEditorHeader.goOnGeneralInfoStepWithHeaderStepper({
          isHttpMethodTriggered: false,
        });
        await baseAssertion.assertElementState(appEditorGeneralForm, 'visible');
        await baseAssertion.assertElementState(
          appEditorGeneralInfoAgentPreview,
          'visible',
        );
        await baseAssertion.assertElementState(
          appEditorGeneralInfoAgentPreview.previewSpinner,
          'hidden',
        );
        await appEditorGeneralForm.addIconButton.click();
        await attachFilesModal.checkAttachedFile(
          newIconFileName,
          FileModalSection.AllFiles,
        );
        await attachFilesModal.attachFiles();
      },
    );

    await dialTest.step(
      'Verify the updated icon is displayed in the preview on the "General info" step',
      async () => {
        const previewIcon = appEditorGeneralInfoAgentPreview.previewIcon;
        await baseAssertion.assertEntityIcon(
          previewIcon,
          expectedEncodedIconUrl,
        );
      },
    );

    await dialTest.step(
      'Verify there is Release date field on the detailed view section',
      async () => {
        const releaseDate = appEditorGeneralInfoAgentPreview.releaseDate;
        await baseAssertion.assertElementState(releaseDate, 'visible');
        await baseAssertion.assertElementText(releaseDate, currentDate);
      },
    );

    await dialTest.step(
      'Navigate to "App settings" step and verify the updated icon in the chat preview',
      async () => {
        await appEditorGeneralForm.goNext({ waitForResponses: false });
        await baseAssertion.assertElementState(
          appEditorAppSettingsAgentPreview,
          'visible',
        );
        await baseAssertion.assertElementState(
          appEditorAppSettingsAgentPreview.previewSpinner,
          'hidden',
        );
        const previewChatIconAppSettings =
          appEditorAppSettingsAgentPreview.previewChatIcon;
        await baseAssertion.assertEntityIcon(
          previewChatIconAppSettings,
          expectedEncodedIconUrl,
        );
      },
    );

    await dialTest.step('Click "Save and exit"', async () => {
      await appEditorHeader.saveAndExitButton.click();
      await marketplacePage.waitForPageLoaded();
    });

    await dialTest.step(
      'Verify the updated icon is displayed on the app card in My workspace',
      async () => {
        agentElement =
          await marketplaceAgentsSection.findAgentElement(appEntity);
        const cardIconElement = agentElement.getElementIcon(
          agentElement.getElementLocator(),
        );
        await baseAssertion.assertEntityIcon(
          cardIconElement,
          expectedEncodedIconUrl,
        );
      },
    );

    await dialTest.step(
      'Click on the app card and verify the updated icon in the opened pop-up',
      async () => {
        await agentElement.click();
        await agentDetailsModal.waitForState();
        await baseAssertion.assertEntityIcon(
          agentDetailsModal.icon,
          expectedEncodedIconUrl,
        );
      },
    );
  },
);

dialTest(
  '[Custom app]: Attachments type not empty and Max attachments empty then Max Attachments field treated as without limits.\n' + // EPMRTC-4131
    '[Custom app + Marketplace]: tooltips for icons on application modal window', // EPMRTC-4290
  async ({
    marketplacePage,
    marketplaceHeader,
    appEditorPage,
    appEditorGeneralForm,
    appEditorViewForm,
    appEditorHeader,
    marketplaceAgentsSection,
    agentDetailsModal,
    setTestIds,
    baseAssertion,
    dialHomePage,
    localStorageManager,
    agentInfoAssertion,
    sendMessage,
    attachmentDropdownMenu,
    attachFilesModal,
    fileApiHelper,
    sendMessageInputAttachmentsAssertions,
    tooltipAssertion,
    appEditorAppSettingsAgentPreview,
  }) => {
    setTestIds('EPMRTC-4131', 'EPMRTC-4290');
    const appName = GeneratorUtil.randomApplicationName();
    const appVersion = GeneratorUtil.randomApplicationVersion();
    const completionUrl = `http://${GeneratorUtil.randomString(6)}.com`;
    const appEntity = {
      name: appName,
      version: appVersion,
      description: GeneratorUtil.randomShortDescription(),
    } as DialAIEntityModel;
    const attachmentType = 'application/pdf';
    const pdfFilesToUpload = [
      `${GeneratorUtil.randomString(5)}_${Attachment.pdfName}`,
      `${GeneratorUtil.randomString(5)}_${Attachment.pdfName}`,
      `${GeneratorUtil.randomString(5)}_${Attachment.pdfName}`,
    ];
    await localStorageManager.setShowSideBarPanels();

    await dialTest.step(
      'Upload dummy PDF files to be available for selection',
      async () => {
        for (const pdfFile of pdfFilesToUpload) {
          await fileApiHelper.putStringAsFile(
            pdfFile,
            `Dummy PDF content for ${pdfFile}`,
          );
        }
      },
    );

    await dialTest.step('Open create custom app page', async () => {
      await marketplacePage.openCreateCustomAppPage();
      await appEditorPage.waitForPageLoaded();
    });

    await dialTest.step(
      'Input all required fields on General Info step',
      async () => {
        await appEditorGeneralForm.fillInAppFields({
          name: appEntity.name,
          version: appEntity.version,
        });
        await appEditorGeneralForm.goNext();
        await baseAssertion.assertElementState(
          appEditorAppSettingsAgentPreview,
          'visible',
        );
        await baseAssertion.assertElementState(
          appEditorAppSettingsAgentPreview.previewSpinner,
          'hidden',
        );
        await baseAssertion.assertElementState(appEditorViewForm, 'visible');
      },
    );

    await dialTest.step(
      'Input Attachment type, leave Max Attachments empty, and save app',
      async () => {
        await appEditorViewForm.fillInAppFields({
          chatCompletionUrl: completionUrl,
        });
        await appEditorViewForm.attachmentTypesInput.fillInInput(
          attachmentType,
        );
        await appEditorViewForm.maxAttachmentsInput.typeInInput('');
        await appEditorHeader.saveAndExitButton.click();
        await marketplacePage.waitForPageLoaded();
      },
    );

    await dialTest.step(
      'Find the created application and verify tooltips',
      async () => {
        await marketplaceHeader.searchInput.fillInInput(appEntity.name);
        const agentElement =
          await marketplaceAgentsSection.findAgentElement(appEntity);
        await agentElement.click();

        await agentDetailsModal.deleteButton.hoverOver();
        await tooltipAssertion.assertTooltipContent(MenuOptions.delete);

        await agentDetailsModal.editButton.hoverOver();
        await tooltipAssertion.assertTooltipContent(MenuOptions.edit);

        await agentDetailsModal.publishButton.hoverOver();
        await tooltipAssertion.assertTooltipContent(MenuOptions.publish);
      },
    );

    await dialTest.step('Use the created application', async () => {
      await agentDetailsModal.clickUseButton({
        isInstalledDeploymentsUpdated: false,
      });
      await dialHomePage.waitForPageLoaded();
      await agentInfoAssertion.assertAgentName(appEntity.name);
      await baseAssertion.assertElementState(
        sendMessage.attachmentMenuTrigger,
        'visible',
      );
    });

    await dialTest.step(
      'Click on clip icon and review file restrictions in header',
      async () => {
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
        );
        const modalHeaderText = await attachFilesModal
          .getModalHeader()
          .getElementInnerContent();
        baseAssertion.assertStringIncludes(
          modalHeaderText,
          attachmentType.substring(attachmentType.lastIndexOf('/') + 1),
          ExpectedMessages.headerShouldContainDefinedAttachmentTypes,
        );
        baseAssertion.assertStringNotIncludes(
          modalHeaderText,
          'Up to ',
          ExpectedMessages.headerMaxNumberOfAttacmentsNotMentioned,
        );
      },
    );

    await dialTest.step(
      'Select several files with correct type and click attach',
      async () => {
        for (const pdfFile of pdfFilesToUpload) {
          await attachFilesModal.checkAttachedFile(
            pdfFile,
            FileModalSection.AllFiles,
          );
        }
        await attachFilesModal.attachFiles();
        for (const pdfFile of pdfFilesToUpload) {
          await sendMessageInputAttachmentsAssertions.assertAttachedFileState(
            pdfFile,
            'visible',
          );
        }
        const attachedCount = await sendMessage
          .getInputAttachments()
          .inputAttachments.getElementsCount();
        baseAssertion.assertValue(
          attachedCount,
          pdfFilesToUpload.length,
          ExpectedMessages.allowedNumberOfAttachedFiles,
        );
      },
    );
  },
);

dialAdminTest(
  'Check icons of chats with published custom app.\n' + //EPMRTC-4303
    'Check icons of chats with published custom app. icon has special symbols in name.\n' + //EPMRTC-6345
    'Icon for custom app is displayed in publish request if file name for icon contain special symbols', //EPMRTC-4302
  async ({
    dialHomePage,
    adminDialHomePage,
    adminPublishingApprovalModal,
    marketplacePage,
    marketplaceHeader,
    marketplaceAgentsSection,
    agentDetailsModal,
    chat,
    chatHeaderAssertion,
    conversationAssertion,
    customApplicationBuilder,
    applicationApiHelper,
    fileApiHelper,
    publishRequestBuilder,
    publicationApiHelper,
    localStorageManager,
    setTestIds,
    itemApiHelper,
    baseAssertion,
    agentInfoAssertion,
    adminLocalStorageManager,
    adminApproveRequiredPrompts,
    adminPublishedApplicationReviewModal,
  }) => {
    setTestIds('EPMRTC-4303', 'EPMRTC-6345', 'EPMRTC-4302');
    const appName = GeneratorUtil.randomApplicationName();
    const appVersion = GeneratorUtil.randomApplicationVersion();
    let appEntity: DialAIEntityModel;
    let agentElement: BaseElement;
    let createdAppBackendEntity: BackendEntity;
    let appPublication: Publication;

    const filename = `${ExpectedConstants.allowedSpecialChars}.svg`;
    const expectedNewIconUrl = await fileApiHelper.putFileWithCustomName(
      filename,
      Attachment.appIconSvg,
    );
    const encodedFileUrl =
      expectedNewIconUrl.substring(0, expectedNewIconUrl.lastIndexOf('/') + 1) +
      encodeURIComponent(filename);
    const encodedIconUrl = `/api/${encodedFileUrl}`;

    await dialTest.step(
      'Precondition: Create a custom application with an icon, create a publish request for it, and delete the original app',
      async () => {
        const applicationModel = customApplicationBuilder
          .withDisplayName(appName)
          .withDisplayVersion(appVersion)
          .withIconUrl(encodedFileUrl)
          .build();

        createdAppBackendEntity =
          await applicationApiHelper.createApplication(applicationModel);

        appEntity = {
          name: appName,
          version: appVersion,
          iconUrl: encodedFileUrl,
        } as DialAIEntityModel;

        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withApplicationResource(createdAppBackendEntity, PublishActions.ADD)
          .build();

        appPublication =
          await publicationApiHelper.createPublishRequest(publishRequest);
        await localStorageManager.setShowSideBarPanels();
        await adminLocalStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Admin navigates to publication requests, selects the app request, and verifies icon in the modal list',
      async () => {
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredPrompts.selectFolder(appPublication.name!);
        await adminPublishingApprovalModal.waitForState();
      },
    );

    await dialTest.step(
      'Admin clicks "Go to a review", checks icon in the detailed view, then approves the request',
      async () => {
        await adminPublishingApprovalModal.goToEntityReview({
          isHttpMethodTriggered: false,
        });
        await baseAssertion.assertEntityIcon(
          adminPublishedApplicationReviewModal.getApplicationIcon(),
          encodedIconUrl,
        );

        await adminPublishedApplicationReviewModal
          .getPublicationReviewControl()
          .click();
        await adminPublishingApprovalModal.approveButton.click();
        await itemApiHelper.deleteBackendItem(createdAppBackendEntity); //delete the original app
      },
    );

    await dialTest.step(
      'Open DIAL Marketplace and find custom app',
      async () => {
        await marketplacePage.openMarketplacePage();
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.searchInput.fillInInput(appName);
        agentElement =
          await marketplaceAgentsSection.findAgentElement(appEntity);
        await baseAssertion.assertElementState(agentElement, 'visible');
      },
    );

    await dialTest.step("Click on app's card", async () => {
      await agentElement.click();
      await baseAssertion.assertElementState(agentDetailsModal, 'visible');
    });

    await dialTest.step(
      'Click "Use application" button - New conversation screen with custom app is displayed',
      async () => {
        await agentDetailsModal.clickUseButton({
          isInstalledDeploymentsUpdated: false,
        });
        await dialHomePage.waitForPageLoaded();
        await agentInfoAssertion.assertAgentIcon(encodedIconUrl);
      },
    );

    await dialTest.step(
      'Send any message and get response, correct icons are displayed',
      async () => {
        const message = 'Hello';
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequestWithButton(message);
        await conversationAssertion.assertTreeEntityIcon(
          { name: message },
          encodedIconUrl,
        );
        await chatHeaderAssertion.assertHeaderIcon(encodedIconUrl);
      },
    );
  },
);

dialTest(
  'Long names of apps without spaces displayed in several lines on preview screen of Add editor and on start screen of new conversation\n' + // EPMRTC-5945
    'Create two custom apps consecutively', // EPMRTC-6263
  async ({
    marketplacePage,
    appEditorPage,
    appEditorGeneralForm,
    appEditorHeader,
    appEditorViewForm,
    appEditorGeneralInfoAgentPreview,
    appEditorAppSettingsAgentPreview,
    setTestIds,
    baseAssertion,
    appEditorHeaderAssertion,
    marketplaceHeader,
    marketplaceAgentsSection,
    agentDetailsModal,
    dialHomePage,
    agentInfo,
    agentInfoAssertion,
    addAppDropdownMenu,
    toastAssertion,
  }) => {
    setTestIds('EPMRTC-5945', 'EPMRTC-6263');
    const appEntity = {
      name: `${applicationNamePrefix}${GeneratorUtil.randomString(
        ExpectedConstants.maxEntityNameLength - 7,
      )}`,
      version: GeneratorUtil.randomApplicationVersion(),
    } as DialAIEntityModel;

    await dialTest.step('Open create a custom app page', async () => {
      await marketplacePage.openCreateCustomAppPage();
      await appEditorPage.waitForPageLoaded();
      await appEditorHeaderAssertion.assertActionTitle(
        AppMenuActions.add(AddAppMenuOptions.customApp),
      );
    });

    await dialTest.step(
      "Input app's name (159 symbols, no spaces) and version on General Info step",
      async () => {
        await appEditorGeneralForm.fillInAppFields({
          name: appEntity.name,
          version: appEntity.version,
        });
      },
    );

    await dialTest.step(
      'Check how name displayed on preview screen on General Info step',
      async () => {
        await baseAssertion.assertElementState(
          appEditorGeneralInfoAgentPreview,
          'visible',
        );
        // Verify name is truncated with ellipsis on the card preview
        await baseAssertion.assertElementTextIsTruncated(
          appEditorGeneralInfoAgentPreview.previewName,
          ExpectedMessages.entityNameIsTruncated,
        );
      },
    );

    await dialTest.step(
      'Click Next to go to the App Settings step',
      async () => {
        await appEditorGeneralForm.goNext({ waitForResponses: true });
        await baseAssertion.assertElementState(appEditorViewForm, 'visible');
        await baseAssertion.assertElementState(
          appEditorAppSettingsAgentPreview,
          'visible',
        );
        await baseAssertion.assertElementState(
          appEditorAppSettingsAgentPreview.previewSpinner,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Check how name displayed on preview for New conversation on App Settings step',
      async () => {
        await baseAssertion.assertElementState(
          appEditorAppSettingsAgentPreview,
          'visible',
        );
        const previewAgentNameElement =
          appEditorAppSettingsAgentPreview.agentName;
        await baseAssertion.assertElementText(
          previewAgentNameElement,
          appEntity.name,
          ExpectedMessages.agentNameIsValid,
        );
        // Verify name is wrapped (not truncated with ellipsis) on the new conversation preview
        await baseAssertion.assertElementTextWrap(
          previewAgentNameElement,
          StyleValues.breakWord,
        );
      },
    );

    await dialTest.step(
      'Input Chat completion URL and click "Save and exit"',
      async () => {
        await appEditorViewForm.fillInAppFields({
          chatCompletionUrl: 'http://testurl.com',
        });
        await appEditorHeader.saveAndExitButton.click();
        await marketplacePage.waitForPageLoaded();
      },
    );

    await dialTest.step(
      'Click Add app/Custom app to start creation of the second app and verify no error toast',
      async () => {
        await marketplaceHeader.addAppButton.click();
        await addAppDropdownMenu.selectMenuOption(AddAppMenuOptions.customApp);
        await appEditorPage.waitForPageLoaded();
        await toastAssertion.assertToastIsHidden();
        await appEditorHeaderAssertion.assertActionTitle(
          AppMenuActions.add(AddAppMenuOptions.customApp),
        );
        await appEditorHeader.exitLink.click();
      },
    );

    await dialTest.step(
      `On My Workspace page, click on app's card and then "Use application" button`,
      async () => {
        await marketplaceHeader.searchInput.fillInInput(appEntity.name);
        const agentElement =
          await marketplaceAgentsSection.findAgentElement(appEntity);
        await agentElement.click();
        await agentDetailsModal.clickUseButton({
          isInstalledDeploymentsUpdated: false,
        });
        await dialHomePage.waitForPageLoaded({ skipSidebars: true });
      },
    );

    await dialTest.step(
      'Verify how name displayed on New conversation start screen',
      async () => {
        await agentInfoAssertion.assertAgentName(appEntity.name);
        // Verify name is wrapped (not truncated with ellipsis) on the new conversation start screen
        await baseAssertion.assertElementTextWrap(
          agentInfo.agentName,
          StyleValues.breakWord,
        );
      },
    );
  },
);

dialTest(
  "Tooltip for long app's name displayed in several lines\n" + // EPMRTC-5946
    '[App editor]: Changes are saved if set focus to field and then move cursor to Save and exit or to step in header', // EPMRTC-6046
  async ({
    customApplicationBuilder,
    applicationApiHelper,
    marketplacePage,
    marketplaceHeader,
    marketplaceAgentsSection,
    marketplaceAgents,
    setTestIds,
    baseAssertion,
    tooltipAssertion,
    agentDetailsModal,
    appEditorPage,
    appEditorGeneralForm,
    appEditorHeader,
    page,
    appEditorViewForm,
    appEditorAppSettingsAgentPreview,
    appEditorGeneralInfoAgentPreview,
  }) => {
    setTestIds('EPMRTC-5946', 'EPMRTC-6046');
    const appNameWithSpaces = `${applicationNamePrefix}${GeneratorUtil.randomString(70)} ${GeneratorUtil.randomString(70)} ${GeneratorUtil.randomString(ExpectedConstants.maxEntityNameLength - 140 - 2 - 6)}`; // Ensure total length is 160 with spaces
    const appVersion = GeneratorUtil.randomApplicationVersion();
    const appEntity = {
      name: appNameWithSpaces,
      version: appVersion,
    } as DialAIEntityModel;
    const descriptionTextToType = 'This is a test description update.';
    let reusableAgentElement: BaseElement;

    await dialTest.step(
      'Create a custom app via API with a name of 160 symbols containing spaces',
      async () => {
        const applicationModel = customApplicationBuilder
          .withDisplayName(appEntity.name)
          .withDisplayVersion(appEntity.version!)
          .build();
        await applicationApiHelper.createApplication(applicationModel);
      },
    );

    await dialTest.step('Open DIAL Marketplace', async () => {
      await marketplacePage.openMarketplacePage({
        updateInstalledDeployments: false,
      });
      await marketplacePage.waitForPageLoaded();
    });

    await dialTest.step("Find app's card", async () => {
      await marketplaceHeader.searchInput.fillInInput(appEntity.name);
      reusableAgentElement =
        await marketplaceAgentsSection.findAgentElement(appEntity);
      await baseAssertion.assertElementState(
        reusableAgentElement,
        'visible',
        ExpectedMessages.agentIsVisible,
      );
    });

    await dialTest.step(
      "Hover over app's icon - tooltip is displayed in several lines",
      async () => {
        const agentIcon =
          await marketplaceAgents.getAgentIcon(reusableAgentElement);
        await agentIcon.hover();
        await tooltipAssertion.assertTooltipContent(
          ExpectedConstants.agentIconTooltip(
            appEntity.name,
            appEntity.version!,
          ),
        );
        await tooltipAssertion.assertTooltipStyle(
          Styles.wordBreak,
          StyleValues.breakWord,
        );
        await tooltipAssertion.assertTooltipStyle(
          Styles.textWrapMode,
          StyleValues.wrap,
        );
      },
    );

    await dialTest.step("Click on app's card", async () => {
      const agentElement =
        await marketplaceAgentsSection.findAgentElement(appEntity);
      await agentElement.click();
      await baseAssertion.assertElementState(agentDetailsModal, 'visible');
    });

    await dialTest.step('Click Edit icon', async () => {
      await agentDetailsModal.editButton.click();
      await appEditorPage.waitForPageLoadedForEdit();
    });

    await dialTest.step(
      'Switch to General info step in App Editor',
      async () => {
        await appEditorHeader.goOnGeneralInfoStepWithHeaderStepper({
          isHttpMethodTriggered: false,
        });
        await baseAssertion.assertElementState(appEditorGeneralForm, 'visible');
        await baseAssertion.assertElementState(
          appEditorGeneralInfoAgentPreview,
          'visible',
        );
        await baseAssertion.assertElementState(
          appEditorGeneralInfoAgentPreview.previewSpinner,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Click on Description field, move cursor to App settings step (without clicking) and type any text into the Description field',
      async () => {
        await appEditorGeneralForm.description.click();
        await appEditorHeader.getAppSettingsStep().hoverOver();
        await page.keyboard.type(descriptionTextToType);
      },
    );

    await dialTest.step('Click on "App settings" link in header', async () => {
      await appEditorHeader.goToAppSettingsStepWithHeaderStepper();
      await baseAssertion.assertElementState(appEditorViewForm, 'visible');
      await baseAssertion.assertElementState(
        appEditorAppSettingsAgentPreview,
        'visible',
      );
      await baseAssertion.assertElementState(
        appEditorAppSettingsAgentPreview.previewSpinner,
        'hidden',
      );
    });

    await dialTest.step(
      'Click back on "General info" link in the header',
      async () => {
        await appEditorHeader.goOnGeneralInfoStepWithHeaderStepper({
          isHttpMethodTriggered: false,
        });
        await baseAssertion.assertElementState(appEditorGeneralForm, 'visible');
        await baseAssertion.assertElementState(
          appEditorGeneralInfoAgentPreview,
          'visible',
        );
        await baseAssertion.assertElementState(
          appEditorGeneralInfoAgentPreview.previewSpinner,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Check description field - The updated description is displayed',
      async () => {
        await baseAssertion.assertInputValue(
          appEditorGeneralForm.description,
          descriptionTextToType,
          ExpectedMessages.agentDescriptionIsValid,
        );
      },
    );
  },
);

dialTest.afterEach(
  'Teardown: Delete created application via API',
  async ({ itemApiHelper }: { itemApiHelper: ItemApiHelper }) => {
    if (appEntityForCleanup) {
      await itemApiHelper.deleteBackendItem(appEntityForCleanup);
      appEntityForCleanup = undefined;
    }
  },
);
