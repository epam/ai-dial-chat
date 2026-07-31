import { BackendEntity } from '@/chat/types/common';
import { DialAIEntityModel } from '@/chat/types/models';
import { Publication } from '@/chat/types/publication';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  AddAppMenuOptions,
  Attachment,
  EntityEditorAppTypes,
  EntityEditorGeneralFormFields,
  EntityEditorViewFormFields,
  EntityMenuActions,
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  MockedChatApiResponseBodies,
  UploadMenuOptions,
} from '@/src/testData';
import { ItemApiHelper } from '@/src/testData/api';
import { Cursors, StyleValues } from '@/src/ui/domData';
import { BaseElement, EntityEditSteps } from '@/src/ui/webElements';
import {
  DateUtil,
  GeneratorUtil,
  ItemUtil,
  SortingUtil,
  UserUtil,
  applicationNamePrefix,
  filenamePrefix,
} from '@/src/utils';
import { PublishActions } from '@epam/ai-dial-shared';

let appEntityForCleanup: BackendEntity | undefined;

dialTest(
  'Create custom app with required fields only.\n' + // EPMDIAL-4111
    'Edit option for custom app is available from card pop-up form.\n' + // EPMDIAL-4196
    'Custom app with permitted spec symbols in Name.\n' + // EPMDIAL-4112
    'Delete custom app from context menu\n' + // EPMDIAL-4114
    'Custom app: Description field displayed in New conversation , card view, app view\n' + // EPMDIAL-4117
    'App Editor open and Exit of first step - app is not saved\n' + // EPMDIAL-4131
    "Preview: current agent stays in Preview after user clicks on 'Save and exit' button when there is any empty required field\n" + // EPMDIAL-4157
    'Stepper icons change\n' + //EPMDIAL-4133
    'Add custom app: Name and version are predefined\n' + //EPMDIAL-4135
    'Side panel with widgets is not displayed for app editor\n' + // EPMDIAL-4141
    '[UI][AppEditor]: Logo should be in center of header', // EPMDIAL-4142
  async ({
    marketplacePage,
    marketplaceHeader,
    addAppDropdownMenu,
    entityEditorPage,
    entityEditorHeader,
    marketplaceEntitiesSection,
    marketplaceEntities,
    entityDetailsModal,
    setTestIds,
    baseAssertion,
    entityEditorHeaderAssertion,
    dialHomePage,
    chat,
    chatMessagesAssertion,
    confirmationDialog,
    localStorageManager,
    agentInfoAssertion,
    entityDetailsModalAssertion,
    marketplaceContainer,
    marketplace,
    customAppEditorAppSettingsPreview,
    customAppEditorAppSettingsPreviewBody,
    navigationPanel,
    entityEditorGeneralForm,
    entityEditorGeneralInfoPreviewCard,
    customAppEditorViewForm,
    customApplicationBuilder,
    applicationApiHelper,
    page,
  }) => {
    setTestIds(
      'EPMDIAL-4111',
      'EPMDIAL-4196',
      'EPMDIAL-4112',
      'EPMDIAL-4114',
      'EPMDIAL-4117',
      'EPMDIAL-4131',
      'EPMDIAL-4157',
      'EPMDIAL-4133',
      'EPMDIAL-4135',
      'EPMDIAL-4141',
      'EPMDIAL-4142',
    );
    const shortDescription = GeneratorUtil.randomShortDescription();
    const longDescription = GeneratorUtil.randomLongDescription();
    const appEntity = {
      name: `${GeneratorUtil.randomApplicationName()}${ExpectedConstants.allowedSpecialChars}`,
      version: GeneratorUtil.randomEntityVersion(),
      description: `${shortDescription}\n\n${longDescription}`,
    } as DialAIEntityModel;
    let agentElement: BaseElement;
    let generalInfoStep: BaseElement;
    let appSettingsStep: BaseElement;
    let searchInput: BaseElement;
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
          getStyles: true,
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
        await entityEditorPage.waitForPageLoaded(
          EntityEditorAppTypes.CustomApp,
        );

        await entityEditorHeaderAssertion.assertActionTitle(
          `${EntityMenuActions.addApp(AddAppMenuOptions.customApp)}`,
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
        await entityEditorHeader.logo.getElementBoundingBox();
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
        await entityEditorGeneralInfoPreviewCard.previewName
          .getElementLocatorByText(defaultAppNamePattern)
          .waitFor();

        await baseAssertion.assertInputValue(
          entityEditorGeneralForm.name,
          defaultAppNamePattern,
          ExpectedMessages.defaultEntityNameShouldBeFilled,
        );

        await baseAssertion.assertInputValue(
          entityEditorGeneralForm.version,
          ExpectedConstants.defaultEntityVersion,
          ExpectedMessages.defaultEntityVersionShouldBeFilled,
        );
      },
    );

    await dialTest.step(
      'App editor General Info step is opened, header features are valid, "General info" step in the header is selected',
      async () => {
        await baseAssertion.assertElementState(
          entityEditorGeneralForm,
          'visible',
        );
        generalInfoStep = entityEditorHeader.getGeneralInfoStep();
        appSettingsStep = entityEditorHeader.getAppSettingsStep();
        await entityEditorHeaderAssertion.assertStepState(
          generalInfoStep,
          'visible',
          Cursors.default,
        );
        await entityEditorHeaderAssertion.assertStepState(
          appSettingsStep,
          'visible',
          Cursors.default,
        );
        await entityEditorHeaderAssertion.assertStepIsSelected(
          generalInfoStep,
          true,
        );
        await entityEditorHeaderAssertion.assertActiveStepIconState(
          generalInfoStep,
          'visible',
        );
        await entityEditorHeaderAssertion.assertStepIsSelected(
          appSettingsStep,
          false,
        );
        await entityEditorHeaderAssertion.assertNotActiveStepIconState(
          appSettingsStep,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Input name, click Exit, verify no custom app is created and navigation panel is visible',
      async () => {
        await entityEditorGeneralForm.fillInEntityFields({
          name: appEntity.name,
          version: appEntity.version,
          description: appEntity.description,
        });
        await entityEditorHeader.exitButton.click();
        await baseAssertion.assertElementState(
          customAppEditorViewForm,
          'hidden',
        );
        await marketplacePage.waitForPageLoaded();
        searchInput = marketplaceHeader.getSearch().inputField;
        await searchInput.fillInInput(appEntity.name);
        await baseAssertion.assertElementText(
          marketplace.noResultsFound,
          ExpectedConstants.noResults,
        );
        const actualAgents = await marketplaceEntitiesSection.getAllEntities();
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
        await entityEditorPage.waitForPageLoaded(
          EntityEditorAppTypes.CustomApp,
        );

        await entityEditorHeaderAssertion.assertActionTitle(
          `${EntityMenuActions.addApp(AddAppMenuOptions.customApp)}`,
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
        await entityEditorHeaderAssertion.assertActionTitle(
          EntityMenuActions.addApp(AddAppMenuOptions.customApp),
        );

        await entityEditorHeaderAssertion.assertStepState(
          generalInfoStep,
          'visible',
          Cursors.default,
        );
        await entityEditorHeaderAssertion.assertStepState(
          appSettingsStep,
          'visible',
          Cursors.default,
        );
        await entityEditorHeaderAssertion.assertStepIsSelected(
          generalInfoStep,
          true,
        );
        await entityEditorHeaderAssertion.assertActiveStepIconState(
          generalInfoStep,
          'visible',
        );
        await entityEditorHeaderAssertion.assertStepIsSelected(
          appSettingsStep,
          false,
        );
        await entityEditorHeaderAssertion.assertNotActiveStepIconState(
          appSettingsStep,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Check that the required fields of General Info step form are marked with asterisks',
      async () => {
        const nameRequiredIndicator =
          entityEditorGeneralForm.getRequiredIndicator(
            EntityEditorGeneralFormFields.name,
          );
        await baseAssertion.assertElementState(
          nameRequiredIndicator,
          'visible',
          ExpectedMessages.entityFormFieldShouldHaveAsterisk,
        );

        const versionRequiredIndicator =
          entityEditorGeneralForm.getRequiredIndicator(
            EntityEditorGeneralFormFields.version,
          );
        await baseAssertion.assertElementState(
          versionRequiredIndicator,
          'visible',
          ExpectedMessages.entityFormFieldShouldHaveAsterisk,
        );
      },
    );

    await dialTest.step(
      'Fill in inputs of Name, Version and click Next, verify side/navigation panels are hidden',
      async () => {
        await entityEditorGeneralForm.fillInEntityFields({
          name: appEntity.name,
          version: appEntity.version,
          description: appEntity.description,
        });
        await entityEditorGeneralForm.goNext({
          hostsArray: [
            API.applicationCreateHost,
            API.installedDeploymentsHost(),
          ],
        });
        await baseAssertion.assertElementState(
          customAppEditorAppSettingsPreview,
          'visible',
        );
        await baseAssertion.assertElementState(
          customAppEditorAppSettingsPreviewBody.previewSpinner,
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
        await baseAssertion.assertElementState(
          customAppEditorViewForm,
          'visible',
        );
        await baseAssertion.assertElementActionabilityState(
          generalInfoStep,
          'enabled',
        );
        await baseAssertion.assertElementActionabilityState(
          appSettingsStep,
          'enabled',
        );

        await entityEditorHeaderAssertion.assertStepIsSelected(
          generalInfoStep,
          false,
        );
        await entityEditorHeaderAssertion.assertCompletedStepIconState(
          generalInfoStep,
          'visible',
        );
        await entityEditorHeaderAssertion.assertStepIsSelected(
          appSettingsStep,
          true,
        );
        await entityEditorHeaderAssertion.assertActiveStepIconState(
          appSettingsStep,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Verify app settings required fields are marked with asterisk',
      async () => {
        const chatCompletionUrlRequiredIndicator =
          customAppEditorViewForm.getRequiredIndicator(
            EntityEditorViewFormFields.chatCompletionUrl,
          );
        await baseAssertion.assertElementState(
          chatCompletionUrlRequiredIndicator,
          'visible',
          ExpectedMessages.entityFormFieldShouldHaveAsterisk,
        );
      },
    );

    await dialTest.step(
      'Attempt to save with empty Chat Completion URL and verify confirmation dialog appears. Cancel button works correctly',
      async () => {
        await entityEditorHeader.saveAndExitButton.click();
        await confirmationDialog.cancelDialog();

        await baseAssertion.assertElementState(
          customAppEditorAppSettingsPreview,
          'visible',
        );
        await agentInfoAssertion.assertAgentName(appEntity.name);
        await agentInfoAssertion.assertAgentIcon(API.defaultModelIconHost());
        await baseAssertion.assertElementState(
          customAppEditorViewForm,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Input Chat completion URL, click Save and Exit link, verify navigation panel is visible',
      async () => {
        await customAppEditorViewForm.fillInAppFields();
        await entityEditorHeader.focusOn();
        await entityEditorHeader.saveAndExitButton.click();
        await entityDetailsModal.closeButton.click();
        await baseAssertion.assertElementState(
          customAppEditorViewForm,
          'hidden',
        );
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
        await searchInput.fillInInput(appEntity.name);
        agentElement =
          await marketplaceEntitiesSection.findEntityElement(appEntity);
        await baseAssertion.assertElementState(agentElement, 'visible');
      },
    );

    await dialTest.step(
      'Click on the found card again to open details',
      async () => {
        await agentElement.click();
        await baseAssertion.assertElementState(entityDetailsModal, 'visible');
        await entityDetailsModalAssertion.assertDescription(
          appEntity.description!,
        );
      },
    );

    await dialTest.step(
      'Click "Use application" button and perform assertions',
      async () => {
        await entityDetailsModal.clickUseButton({
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
          updateInstalledToolsets: false,
        });
        await marketplacePage.waitForPageLoaded();
        await searchInput.fillInInput(appEntity.name);
        agentElement =
          await marketplaceEntitiesSection.findEntityElement(appEntity);

        const actualDescription =
          marketplaceEntities.getEntityDescription(agentElement);
        await baseAssertion.assertElementText(
          actualDescription,
          shortDescription,
          `Short description on card for "${appEntity.name}" should be correct`,
        );
        await agentElement.click();
        await baseAssertion.assertElementState(entityDetailsModal, 'visible');
      },
    );

    await dialTest.step(
      'On card detailed pop-up form click on Edit icon',
      async () => {
        await entityDetailsModal.clickEditButton({
          triggeredHttpMethod: 'GET',
        });
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorAppTypes.CustomApp,
        );
      },
    );

    await dialTest.step(
      'Verify App Editor page was opened, title "Edit custom app", two steps are displayed in the header',
      async () => {
        await entityEditorHeaderAssertion.assertActionTitle(
          `${EntityMenuActions.editApp(AddAppMenuOptions.customApp)}`,
        );
        await entityEditorHeaderAssertion.assertStepState(
          generalInfoStep,
          'visible',
          Cursors.pointer,
        );
        await entityEditorHeaderAssertion.assertStepState(
          appSettingsStep,
          'visible',
          Cursors.default,
        );
      },
    );

    await dialTest.step('Close the application edit mode', async () => {
      await entityEditorHeader.saveAndExitButton.click();
      await entityDetailsModal.closeButton.click();
    });

    await dialTest.step(
      'Delete an app, confirm and verify custom app card was deleted from My workspace',
      async () => {
        agentElement =
          await marketplaceEntitiesSection.findEntityElement(appEntity);
        await agentElement.hoverOver();
        await marketplaceEntities
          .getEntityElementDotsMenu(agentElement)
          .click();
        await marketplaceEntities
          .getEntityDropdownMenu()
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
        await searchInput.fillInInput(appEntity.name);
        const actualAgents = await marketplaceEntitiesSection.getAllEntities();
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
  'Edit custom application\n' + //EPMDIAL-4113
    'Edit version for custom app\n' + //EPMDIAL-4198
    'DIAL logo click on second step in AppEditor saves app ( decided on daily to leave for now)', // EPMDIAL-4132
  async ({
    marketplacePage,
    marketplaceEntitiesSection,
    marketplaceEntities,
    entityEditorGeneralForm,
    customAppEditorViewForm,
    entityEditorHeader,
    setTestIds,
    baseAssertion,
    entityEditorGeneralInfoPreviewCard,
    customApplicationBuilder,
    applicationApiHelper,
    entityEditorHeaderAssertion,
    navigationPanel,
    dialHomePage,
    toastAssertion,
    agentInfo,
    localStorageManager,
    entityEditorGeneralInfoPreview,
    entityEditorPage,
  }) => {
    setTestIds('EPMDIAL-4113', 'EPMDIAL-4198', 'EPMDIAL-4132');
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
        const agentElement = await marketplaceEntitiesSection.findEntityElement(
          {
            name: appEntity.name,
            version: appEntity.version,
          } as DialAIEntityModel,
        );
        await baseAssertion.assertElementState(agentElement, 'visible');
        await agentElement.hoverOver();
        await marketplaceEntities
          .getEntityElementDotsMenu(agentElement)
          .click();
        await marketplaceEntities
          .getEntityDropdownMenu()
          .selectMenuOption(MenuOptions.edit);
      },
    );

    await dialTest.step(
      'App Editor page was opened, title "Edit custom app", two available steps are displayed in the header:',
      async () => {
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorAppTypes.CustomApp,
        );
        await baseAssertion.assertElementState(customAppEditorViewForm);
        await baseAssertion.assertElementText(
          entityEditorHeader.actionAndEntityTypeTitle,
          `${EntityMenuActions.editApp(AddAppMenuOptions.customApp)}`,
          ExpectedMessages.headerTitleIsValid,
        );

        const generalInfoStep = entityEditorHeader.getGeneralInfoStep();
        const appSettingsStep = entityEditorHeader.getAppSettingsStep();

        await baseAssertion.assertElementState(generalInfoStep, 'visible');
        await baseAssertion.assertElementState(appSettingsStep, 'visible');
      },
    );

    await dialTest.step(
      'Update any field on step "Application settings" with a valid value',
      async () => {
        await baseAssertion.assertElementState(customAppEditorViewForm);
        await customAppEditorViewForm.fillInAppFields({
          chatCompletionUrl: updatedCompletionUrl,
        });
      },
    );

    await dialTest.step(
      'Update any field on step "General info", close the app editor by clicking on the header logo, then go back to the marketplace',
      async () => {
        await entityEditorHeader.goOnGeneralInfoStepWithHeaderStepper();
        await baseAssertion.assertElementState(
          entityEditorGeneralInfoPreview,
          'visible',
        );
        await baseAssertion.assertElementState(
          entityEditorGeneralInfoPreview.previewSpinner,
          'hidden',
        );
        await baseAssertion.assertElementState(entityEditorGeneralForm);
        await entityEditorHeaderAssertion.assertStepIsSelected(
          EntityEditSteps.appSettings,
          false,
        );
        await entityEditorHeaderAssertion.assertCompletedStepIconState(
          EntityEditSteps.appSettings,
          'visible',
        );
        await entityEditorHeaderAssertion.assertStepIsSelected(
          EntityEditSteps.generalInfo,
          true,
        );
        await entityEditorHeaderAssertion.assertActiveStepIconState(
          EntityEditSteps.generalInfo,
          'visible',
        );
        //need to explicitly click on the form to trigger autosave after fields update
        await entityEditorGeneralForm.version.click();
        appEntity.version = '2.2.2';
        appEntity.description = updatedDescription;
        await entityEditorGeneralForm.fillInEntityFields({
          version: appEntity.version,
          description: appEntity.description,
        });
        await entityEditorHeader.focusOn();
        await entityEditorHeader.logo.click();
        await dialHomePage.waitForPageLoaded();
        await baseAssertion.assertElementState(agentInfo, 'visible'); // Assert no validation error appeared
        await toastAssertion.assertToastIsHidden();
        await baseAssertion.assertElementState(
          entityEditorGeneralForm,
          'hidden',
        );
        await navigationPanel.goToMyWorkspace();
        await marketplacePage.waitForPageLoaded();
      },
    );

    await dialTest.step(
      'Hover over custom app card, click 3 dots and select Edit option again',
      async () => {
        const agentElement = await marketplaceEntitiesSection.findEntityElement(
          {
            name: appEntity.name,
            version: appEntity.version,
          } as DialAIEntityModel,
        );
        await baseAssertion.assertElementState(agentElement, 'visible');
        await baseAssertion.assertElementText(
          marketplaceEntities.getEntityVersion(agentElement),
          appEntity.version!,
        );
        await agentElement.hoverOver();
        await marketplaceEntities
          .getEntityElementDotsMenu(agentElement)
          .click();
        await marketplaceEntities
          .getEntityDropdownMenu()
          .selectMenuOption(MenuOptions.edit);
      },
    );

    await dialTest.step(
      'Check that updated field values are still displayed',
      async () => {
        await baseAssertion.assertElementState(customAppEditorViewForm);

        const chatCompletionUrlValue =
          await customAppEditorViewForm.chatCompletionUrl
            .getElementLocator()
            .inputValue();
        baseAssertion.assertValue(
          chatCompletionUrlValue,
          updatedCompletionUrl,
          ExpectedMessages.FormFieldShouldRetainUpdatedValue,
        );

        await entityEditorHeader.goOnGeneralInfoStepWithHeaderStepper({
          isHttpMethodTriggered: false,
        });
        await baseAssertion.assertElementState(
          entityEditorGeneralInfoPreview,
          'visible',
        );
        await baseAssertion.assertElementState(
          entityEditorGeneralInfoPreview.previewSpinner,
          'hidden',
        );
        await baseAssertion.assertElementState(entityEditorGeneralForm);
        const descriptionValue = await entityEditorGeneralForm.description
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
        const releaseDateElement =
          entityEditorGeneralInfoPreviewCard.releaseDate;
        await baseAssertion.assertElementState(releaseDateElement, 'visible');
        await baseAssertion.assertElementText(
          releaseDateElement,
          DateUtil.getCurrentLocalDate(),
          ExpectedMessages.releaseDateIsValid,
        );
      },
    );
  },
);

dialTest(
  'Delete custom app from "Select an agent for conversation" form\n' + // EPMDIAL-4323
    'Delete custom app from application card pop-up\n' + // EPMDIAL-4116
    '[Custom app]: Delete specific not published version' + // EPMDIAL-4119
    '[Custom app]: add 2 applications with the same name and different versions - not published applications grouped by name\n', //EPMDIAL-4122
  async ({
    marketplacePage,
    marketplaceEntitiesSection,
    entityDetailsModal,
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
    entityDetailsModalAssertion,
    marketplaceEntities,
    entityVersionsDropdownMenuAssertion,
  }) => {
    setTestIds('EPMDIAL-4323', 'EPMDIAL-4116', 'EPMDIAL-4119', 'EPMDIAL-4122');
    let agentElementInDialog: BaseElement;
    let agentElement1: BaseElement;
    let agentElement2: BaseElement;
    let searchInput: BaseElement;

    const appEntity1 = {
      name: GeneratorUtil.randomApplicationName(),
      version: GeneratorUtil.randomEntityVersion(),
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
        searchInput = marketplaceHeader.getSearch().inputField;
        await searchInput.fillInInput(appEntity1.name);
        agentElement1 =
          await marketplaceEntitiesSection.findEntityElement(appEntity1);
        await baseAssertion.assertElementState(agentElement1, 'visible');
      },
    );

    await dialTest.step('Click "Use application"', async () => {
      await agentElement1.click();
      await baseAssertion.assertElementState(entityDetailsModal, 'visible');
      await entityDetailsModal.useButton.click();
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
          .getEntityElementDotsMenu(agentElementInDialog)
          .click();
        await talkToAgents
          .getEntityDropdownMenu()
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
        await searchInput.fillInInput(appEntity1.name);
        const actualAgents = await marketplaceEntitiesSection.getAllEntities();
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
        await searchInput.fillInInput(appEntity2_v2.name);
        const allAgents = await marketplaceEntitiesSection.getAllEntities();
        const workspaceAgentsWithName = allAgents.filter(
          (agent) =>
            agent.isWorkspaceEntity && agent.name === appEntity2_v2.name,
        );
        baseAssertion.assertValue(
          workspaceAgentsWithName.length,
          1,
          ExpectedMessages.onlyOneEntityCardFoundInSearch('application'),
        );
        agentElement2 =
          await marketplaceEntitiesSection.findEntityElement(appEntity2_v2);
        await baseAssertion.assertElementState(agentElement2, 'visible');
        await baseAssertion.assertElementText(
          marketplaceEntities.getEntityVersion(agentElement2),
          appEntity2_v2.version!,
          ExpectedMessages.cardShouldDisplayTheLatestVersion,
        );
      },
    );

    await dialTest.step(
      'Click on App 2 card, verify versions, select older version',
      async () => {
        await agentElement2.click();
        await baseAssertion.assertElementState(entityDetailsModal, 'visible');
        await entityDetailsModalAssertion.assertEntityName(appEntity2_v2.name);
        await entityDetailsModalAssertion.assertEntityVersion(
          appEntity2_v2.version!,
        );
        await entityDetailsModal.versionMenuTrigger.click();
        const expectedVersionsInDropdown = SortingUtil.sortVersionsArray([
          appEntity2_v1.version!,
          appEntity2_v2.version!,
        ]);
        await entityVersionsDropdownMenuAssertion.assertMenuOptions(
          expectedVersionsInDropdown,
        );
        await entityDetailsModal
          .getVersionDropdownMenu()
          .selectMenuOption(appEntity2_v1.version!);
        await entityDetailsModalAssertion.assertEntityVersion(
          appEntity2_v1.version!,
        );
      },
    );

    await dialTest.step(
      'Click on Delete icon in the modal and confirm deletion',
      async () => {
        await entityDetailsModal.deleteButton.click();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        await entityDetailsModal.waitForState({ state: 'hidden' });
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
          marketplaceEntities.getEntityVersion(agentElement2),
          appEntity2_v2.version!,
        );
        await agentElement2.click();
        await baseAssertion.assertElementState(entityDetailsModal, 'visible');
        await entityDetailsModalAssertion.assertEntityVersion(
          appEntity2_v2.version!,
        );
      },
    );
  },
);

dialTest(
  'Custom app Topic dropdown select.\n' + // EPMDIAL-4118
    '[Custom app]: Hints on for fields\n' + // EPMDIAL-4121
    'Preview on step "General info"\n' + // EPMDIAL-4158
    'Preview on step "App settings"\n' + // EPMDIAL-4160
    'Chat created from preview form on step "App settings" is not available on DIAL home page\n' + // EPMDIAL-4162
    'Input on step "App settings" data saved when switch back to step "General info"\n' + // EPMDIAL-4136
    'Chat created from preview form on step "App settings" is not saved if switch to "General info" step and then back to "App settings".\n' + // EPMDIAL-4166
    'Input on step "General info" data saved when switch to step "App settings" using stepper (not Next button ).\n' + // EPMDIAL-4137
    'Custom app appears on the first screen (after the creation) if user types something in Preview', // EPMDIAL-4286
  async (
    {
      marketplacePage,
      entityEditorPage,
      entityEditorGeneralForm,
      listboxMenu,
      setTestIds,
      baseAssertion,
      entityEditorGeneralInfoPreviewCard,
      tooltipAssertion,
      customAppEditorViewForm,
      fileManagerModalGrid,
      fileManagerModal,
      entityEditorGeneralInfoPreview,
      fileApiHelper,
      entityEditorHeader,
      customAppEditorAppSettingsPreview,
      customAppEditorAppSettingsPreviewBody,
      customAppEditorAppSettingsPreviewChat,
      dialHomePage,
      chatMessagesAssertion,
      agentInfoAssertion,
      sendMessage,
      chatMessages,
      conversationAssertion,
      entityDetailsModal,
      navigationPanel,
      entityDetailsModalAssertion,
      localStorageManager,
    },
    testInfo,
  ) => {
    setTestIds(
      'EPMDIAL-4118',
      'EPMDIAL-4121',
      'EPMDIAL-4158',
      'EPMDIAL-4160',
      'EPMDIAL-4162',
      'EPMDIAL-4136',
      'EPMDIAL-4166',
      'EPMDIAL-4137',
      'EPMDIAL-4286',
    );
    let numberOfTopicsToSelect: number;
    let allTopics: string[] = [];
    let topicsToSelect: string[] = [];

    const shortAppDescription = GeneratorUtil.randomShortDescription();
    const longAppDescription = GeneratorUtil.randomLongDescription();
    const appEntity = {
      name: GeneratorUtil.randomApplicationName(),
      version: GeneratorUtil.randomEntityVersion(),
      description: `${shortAppDescription}\n\n${longAppDescription}`,
    } as DialAIEntityModel;
    const expectedIconUrl = `/api/${await fileApiHelper.putFile(
      Attachment.sunImageName,
    )}`;
    const previewChatMessage = 'Hello from preview';
    const attachmentTypeToSet = 'image/png';
    const updatedAppNameForStepperTest = `${appEntity.name}-stepper-update`; // New name for EPMDIAL-4137
    await localStorageManager.setShowSideBarPanels();
    await localStorageManager.setRecentModelsIdsAndUseLastModel();

    await dialTest.step('Open create a custom app page', async () => {
      await marketplacePage.openCreateCustomAppPage();
      await entityEditorPage.waitForPageLoaded(EntityEditorAppTypes.CustomApp);
    });

    await dialTest.step(
      'Hover over question icon for Description field and verify hint',
      async () => {
        await entityEditorGeneralForm.descriptionHintIcon.hoverOver();
        await tooltipAssertion.assertTooltipContent(
          ExpectedConstants.customApplicationDescriptionTooltip,
        );
      },
    );

    await dialTest.step(
      'Click on Topics drop down and verify the list is expanded',
      async () => {
        await entityEditorGeneralForm.topicsDropdownToggle.click();
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
        await entityEditorGeneralForm.topicsDropdownContainer.getElementBoundingBox();
      const initialHeight = topicsInputControlBox1!.height;

      for (let i = 0; i < numberOfTopicsToSelect; i++) {
        await listboxMenu.selectOption(topicsToSelect[i]);
      }
      const topicsInputControlBoxAll =
        await entityEditorGeneralForm.topicsDropdownContainer.getElementBoundingBox();
      const topicsHeightAfterSelection = topicsInputControlBoxAll!.height;

      // Assertions for selected topics
      const selectedTopics = await entityEditorGeneralForm.getSelectedTopics();
      await baseAssertion.assertElementsCount(
        entityEditorGeneralForm.selectedTopicPills,
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
        await entityEditorGeneralForm.deleteSelectedTopic(topicToDelete);

        const remainingTopics = topicsToSelect.filter(
          (t) => t !== topicToDelete,
        );
        // Get current selected topics again
        const currentSelectedTopics =
          await entityEditorGeneralForm.getSelectedTopics();

        await baseAssertion.assertElementsCount(
          entityEditorGeneralForm.selectedTopicPills,
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
        await entityEditorGeneralForm.clearAllTopics();
        // Assert selected topics count
        await baseAssertion.assertElementsCount(
          entityEditorGeneralForm.selectedTopicPills,
          0,
          ExpectedMessages.elementsCountIsValid,
        );
      },
    );

    await dialTest.step('Fill in the data for the App', async () => {
      await entityEditorGeneralForm.fillInEntityFields({
        name: appEntity.name,
        version: appEntity.version,
        description: appEntity.description,
      });
      await entityEditorGeneralForm.topicsDropdownToggle.click();
      topicsToSelect = allTopics
        .sort((a, b) => a.length - b.length)
        .slice(0, 2);
      for (const topic of topicsToSelect) {
        await listboxMenu.selectOption(topic);
      }
      await entityEditorGeneralForm.topicsDropdownToggle.click();
      await entityEditorGeneralForm.addIconButton.click();
      const attachmentCheckbox =
        await fileManagerModalGrid.gridCheckboxByNameCell(
          Attachment.sunImageName,
        );
      await attachmentCheckbox.click();
      await fileManagerModal.getSelectButton().click();
    });

    await dialTest.step(
      "Verify preview of app's pop-up form on right side of General Info screen",
      async () => {
        await baseAssertion.assertElementState(
          entityEditorGeneralInfoPreview,
          'visible',
        );

        await baseAssertion.assertElementText(
          entityEditorGeneralInfoPreviewCard.previewName,
          appEntity.name,
          ExpectedMessages.agentNameIsValid,
        );

        const actualShortDescElement =
          entityEditorGeneralInfoPreviewCard.getShortDescriptionDetailedViewElement();
        const actualLongDescElement =
          entityEditorGeneralInfoPreviewCard.getLongDescriptionDetailedViewElement();

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
          await entityEditorGeneralInfoPreviewCard.topicElements.getElementsInnerContent();
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
          entityEditorGeneralInfoPreviewCard.previewInformationSection,
          'visible',
        );
        await baseAssertion.assertElementState(
          entityEditorGeneralInfoPreviewCard.previewAuthorContainer,
          'visible',
        );

        const currentUsername = UserUtil.getE2EUsername(testInfo.parallelIndex);
        await baseAssertion.assertElementText(
          entityEditorGeneralInfoPreviewCard.previewAuthorValue,
          currentUsername,
          ExpectedMessages.authorIsValid,
        );

        const previewAppIcon = entityEditorGeneralInfoPreviewCard.previewIcon;
        await baseAssertion.assertEntityIcon(previewAppIcon, expectedIconUrl);
      },
    );

    await dialTest.step(
      'Turn off the detailed view and assert details on General Info screen',
      async () => {
        await entityEditorGeneralInfoPreview
          .getEntityEditorPreviewToggle()
          .detailedSwitch.click();
        await baseAssertion.assertElementText(
          entityEditorGeneralInfoPreviewCard.previewName,
          appEntity.name,
          ExpectedMessages.agentNameIsValid,
        );

        await baseAssertion.assertElementText(
          entityEditorGeneralInfoPreviewCard.version,
          appEntity.version!,
          ExpectedMessages.agentVersionIsValid,
        );

        const actualShortDescElement =
          entityEditorGeneralInfoPreviewCard.getShortDescriptionDetailedViewElement();

        await baseAssertion.assertElementText(
          actualShortDescElement,
          shortAppDescription,
          ExpectedMessages.agentDescriptionIsValid,
        );

        const displayedTopics =
          await entityEditorGeneralInfoPreviewCard.topicElements.getElementsInnerContent();
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
        const previewAppIcon = entityEditorGeneralInfoPreviewCard.previewIcon;
        await baseAssertion.assertEntityIcon(previewAppIcon, expectedIconUrl);
      },
    );

    await dialTest.step(
      'Click Next button to go to App Settings, hover over question icons for Features data and Attachment types and verify hints',
      async () => {
        await entityEditorGeneralForm.goNext();
        await baseAssertion.assertElementState(
          customAppEditorViewForm,
          'visible',
        );
        await baseAssertion.assertElementState(
          customAppEditorAppSettingsPreview,
          'visible',
        );
        await baseAssertion.assertElementState(
          entityEditorGeneralInfoPreview.previewSpinner,
          'hidden',
        );
        await customAppEditorViewForm.featuresDataHintIcon.hoverOver();
        await tooltipAssertion.assertTooltipContent(
          ExpectedConstants.customApplicationFeaturesTooltip,
        );
        await customAppEditorViewForm.attachmentTypesHintIcon.hoverOver();
        await tooltipAssertion.assertTooltipContent(
          ExpectedConstants.customApplicationAttachmentsTypesTooltip,
        );
      },
    );

    await dialTest.step(
      'Input Chat completion URL on App Settings step',
      async () => {
        await customAppEditorViewForm.fillInAppFields({
          chatCompletionUrl: 'http://testurl.com',
        });
      },
    );

    await dialTest.step(
      'Verify preview area on App Settings step shows a new conversation screen and message box is enabled',
      async () => {
        await baseAssertion.assertElementState(
          customAppEditorAppSettingsPreview,
          'visible',
        );
        await baseAssertion.assertElementState(
          customAppEditorAppSettingsPreviewChat,
          'visible',
        );
        await baseAssertion.assertElementState(
          customAppEditorAppSettingsPreviewChat.agentInfoContainer,
          'visible',
        );
        const previewChatInput = sendMessage.messageInput;
        await baseAssertion.assertElementState(previewChatInput, 'visible');
        await baseAssertion.assertElementActionabilityState(
          previewChatInput,
          'enabled',
        );
        const previewChatIcon =
          customAppEditorAppSettingsPreviewChat.previewChatIcon;
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
      await customAppEditorViewForm.fillInAppFields({
        attachmentTypes: [attachmentTypeToSet],
      });
    });

    await dialTest.step(
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
      await entityEditorHeader.goOnGeneralInfoStepWithHeaderStepper({
        isHttpMethodTriggered: false,
      });
      await baseAssertion.assertElementState(
        entityEditorGeneralForm,
        'visible',
      );
      await baseAssertion.assertElementState(
        customAppEditorAppSettingsPreview,
        'visible',
      );
      await baseAssertion.assertElementState(
        customAppEditorAppSettingsPreviewBody.previewSpinner,
        'hidden',
      );
    });

    await dialTest.step('Navigate forward to App Settings step', async () => {
      await entityEditorGeneralForm.goNext();
      await baseAssertion.assertElementState(
        customAppEditorViewForm,
        'visible',
      );
      await baseAssertion.assertElementState(
        customAppEditorAppSettingsPreview,
        'visible',
      );
      await baseAssertion.assertElementState(
        customAppEditorAppSettingsPreviewBody.previewSpinner,
        'hidden',
      );
    });

    await dialTest.step(
      'Verify attachment types are preserved, preview chat is not saved',
      async () => {
        const actualAttachmentTypes =
          await customAppEditorViewForm.attachmentTypes.getSelectedPillValues(
            true,
          );
        baseAssertion.assertArrayIncludesAll(
          actualAttachmentTypes,
          [attachmentTypeToSet],
          ExpectedMessages.fieldValueIsValid,
        );

        await chatMessagesAssertion.assertElementState(chatMessages, 'hidden');
        await baseAssertion.assertElementState(
          customAppEditorAppSettingsPreview,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Navigate back to General Info step using header stepper',
      async () => {
        await entityEditorHeader.goOnGeneralInfoStepWithHeaderStepper({
          isHttpMethodTriggered: false,
        });
        await baseAssertion.assertElementState(
          entityEditorGeneralForm,
          'visible',
        );
        await baseAssertion.assertElementState(
          customAppEditorAppSettingsPreview,
          'visible',
        );
        await baseAssertion.assertElementState(
          customAppEditorAppSettingsPreviewBody.previewSpinner,
          'hidden',
        );
      },
    );

    await dialTest.step('Input new app name', async () => {
      await entityEditorGeneralForm.fillInEntityFields({
        name: updatedAppNameForStepperTest,
      });
    });

    await dialTest.step(
      'Navigate to App Settings step using header stepper',
      async () => {
        await entityEditorHeader.goToEntitySettingsStepWithHeaderStepper();
        await baseAssertion.assertElementState(
          customAppEditorViewForm,
          'visible',
        );
        await baseAssertion.assertElementState(
          customAppEditorAppSettingsPreview,
          'visible',
        );
        await baseAssertion.assertElementState(
          customAppEditorAppSettingsPreviewBody.previewSpinner,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Navigate back to General Info step using header stepper',
      async () => {
        await entityEditorHeader.goOnGeneralInfoStepWithHeaderStepper({
          isHttpMethodTriggered: false,
        });
        await baseAssertion.assertElementState(
          entityEditorGeneralForm,
          'visible',
        );
        await baseAssertion.assertElementState(
          entityEditorGeneralInfoPreview,
          'visible',
        );
        await baseAssertion.assertElementState(
          entityEditorGeneralInfoPreview.previewSpinner,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Verify the new name is preserved on General Info step',
      async () => {
        await baseAssertion.assertInputValue(
          entityEditorGeneralForm.name,
          updatedAppNameForStepperTest,
          ExpectedMessages.fieldValueIsValid,
        );
      },
    );

    await dialTest.step(
      'Navigate to App Settings step and create a preview chat',
      async () => {
        await entityEditorHeader.goToEntitySettingsStepWithHeaderStepper({
          isHttpMethodTriggered: false,
        });
        await baseAssertion.assertElementState(
          customAppEditorViewForm,
          'visible',
        );
        await baseAssertion.assertElementState(
          customAppEditorAppSettingsPreview,
          'visible',
        );
        await sendMessage.messageInput.fillInInput(previewChatMessage);
        await sendMessage.sendMessageButton.click();
        await chatMessages.getChatMessage(2).waitFor();
      },
    );

    await dialTest.step('Click Save and Exit link', async () => {
      await entityEditorHeader.saveAndExitButton.click();
      await baseAssertion.assertElementState(entityDetailsModal, 'visible');
      await entityDetailsModalAssertion.assertEntityName(
        updatedAppNameForStepperTest,
      );
      await entityDetailsModalAssertion.assertEntityVersion(appEntity.version!);
      await entityDetailsModal.closeButton.click();
    });

    await dialTest.step(
      'Click back to chat - created on preview form chat is not visible on DIAL main screen, created app is applied on a new conversation',
      async () => {
        await navigationPanel.backToChat();
        await dialHomePage.waitForPageLoaded();
        await conversationAssertion.assertEntityState(
          { name: previewChatMessage },
          'hidden',
        );
        await chatMessagesAssertion.assertElementState(chatMessages, 'hidden');
        await agentInfoAssertion.assertAgentName(updatedAppNameForStepperTest);
        await agentInfoAssertion.assertAgentVersion(appEntity.version);
        await agentInfoAssertion.assertShortDescription(shortAppDescription);
      },
    );
  },
);

dialTest(
  'Edit Custom app: Update icon of custom app\n' + //EPMDIAL-4197
    '[Custom app]: Icon is shown on the custom application card if the svg contains some special chars\n' + // EPMDIAL-4128
    '[App editor]: Release date displayed on detailed preview on "General info" step when edit custom app', //EPMDIAL-4164
  async ({
    marketplacePage,
    marketplaceEntitiesSection,
    entityDetailsModal,
    entityEditorPage,
    fileManagerModal,
    fileManagerModalGrid,
    entityEditorHeader,
    entityEditorGeneralForm,
    entityEditorGeneralInfoPreview,
    entityEditorGeneralInfoPreviewCard,
    customAppEditorAppSettingsPreview,
    customAppEditorAppSettingsPreviewBody,
    customAppEditorAppSettingsPreviewChat,
    customApplicationBuilder,
    applicationApiHelper,
    baseAssertion,
    setTestIds,
    fileApiHelper,
  }) => {
    setTestIds('EPMDIAL-4197', 'EPMDIAL-4128', 'EPMDIAL-4164');
    const appEntity = {
      name: GeneratorUtil.randomApplicationName(),
      version: GeneratorUtil.randomEntityVersion(),
    } as DialAIEntityModel;
    const newIconFileName = `${filenamePrefix}${ExpectedConstants.allowedSpecialChars}.svg`;
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
          await marketplaceEntitiesSection.findEntityElement(appEntity);
        await agentElement.click();
        await entityDetailsModal.waitForState();
        await entityDetailsModal.clickEditButton({
          triggeredHttpMethod: 'GET',
        });
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorAppTypes.CustomApp,
        );
      },
    );

    await dialTest.step(
      'Navigate to "General info" step and upload a new icon file',
      async () => {
        await entityEditorHeader.goOnGeneralInfoStepWithHeaderStepper({
          isHttpMethodTriggered: false,
        });
        await baseAssertion.assertElementState(
          entityEditorGeneralForm,
          'visible',
        );
        await baseAssertion.assertElementState(
          entityEditorGeneralInfoPreview,
          'visible',
        );
        await baseAssertion.assertElementState(
          entityEditorGeneralInfoPreview.previewSpinner,
          'hidden',
        );
        await entityEditorGeneralForm.addIconButton.click();
        const iconCheckbox =
          await fileManagerModalGrid.gridCheckboxByNameCell(newIconFileName);
        await iconCheckbox.click();
        await fileManagerModal.getSelectButton().click();
      },
    );

    await dialTest.step(
      'Verify the updated icon is displayed in the preview on the "General info" step',
      async () => {
        const previewIcon =
          entityEditorGeneralInfoPreview.getEntityEditorPreviewCard()
            .previewIcon;
        await baseAssertion.assertEntityIcon(
          previewIcon,
          expectedEncodedIconUrl,
        );
      },
    );

    await dialTest.step(
      'Verify there is Release date field on the detailed view section',
      async () => {
        const releaseDate = entityEditorGeneralInfoPreviewCard.releaseDate;
        await baseAssertion.assertElementState(releaseDate, 'visible');
        await baseAssertion.assertElementText(releaseDate, currentDate);
      },
    );

    await dialTest.step(
      'Navigate to "App settings" step and verify the updated icon in the chat preview',
      async () => {
        await entityEditorGeneralForm.goNext();
        await baseAssertion.assertElementState(
          customAppEditorAppSettingsPreview,
          'visible',
        );
        await baseAssertion.assertElementState(
          customAppEditorAppSettingsPreviewBody.previewSpinner,
          'hidden',
        );
        const previewChatIconAppSettings =
          customAppEditorAppSettingsPreviewChat.previewChatIcon;
        await baseAssertion.assertEntityIcon(
          previewChatIconAppSettings,
          expectedEncodedIconUrl,
        );
      },
    );

    await dialTest.step('Click "Save and exit"', async () => {
      await entityEditorHeader.saveAndExitButton.click();
      await marketplacePage.waitForPageLoaded();
    });

    await dialTest.step(
      'Verify the updated icon is displayed on the app card in My workspace',
      async () => {
        await entityDetailsModal.closeButton.click();
        agentElement =
          await marketplaceEntitiesSection.findEntityElement(appEntity);
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
        await entityDetailsModal.waitForState();
        await baseAssertion.assertEntityIcon(
          entityDetailsModal.icon,
          expectedEncodedIconUrl,
        );
      },
    );
  },
);

dialTest(
  '[Custom app]: Attachments type not empty and Max attachments empty then Max Attachments field treated as without limits.\n' + // EPMDIAL-4120
    '[Custom app + Marketplace]: tooltips for icons on application modal window', // EPMDIAL-4124
  async ({
    marketplacePage,
    marketplaceHeader,
    entityEditorPage,
    entityEditorGeneralForm,
    customAppEditorViewForm,
    entityEditorHeader,
    marketplaceEntitiesSection,
    entityDetailsModal,
    setTestIds,
    baseAssertion,
    dialHomePage,
    localStorageManager,
    agentInfoAssertion,
    sendMessage,
    attachmentDropdownMenu,
    fileManagerModal,
    fileManagerModalGrid,
    fileApiHelper,
    sendMessageInputAttachmentsAssertions,
    tooltipAssertion,
    customAppEditorAppSettingsPreview,
    customAppEditorAppSettingsPreviewBody,
    fileManagerToolbar,
  }) => {
    setTestIds('EPMDIAL-4120', 'EPMDIAL-4124');
    const appName = GeneratorUtil.randomApplicationName();
    const appVersion = GeneratorUtil.randomEntityVersion();
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
      await entityEditorPage.waitForPageLoaded(EntityEditorAppTypes.CustomApp);
    });

    await dialTest.step(
      'Input all required fields on General Info step',
      async () => {
        await entityEditorGeneralForm.fillInEntityFields({
          name: appEntity.name,
          version: appEntity.version,
        });
        await entityEditorGeneralForm.goNext();
        await baseAssertion.assertElementState(
          customAppEditorAppSettingsPreview,
          'visible',
        );
        await baseAssertion.assertElementState(
          customAppEditorAppSettingsPreviewBody.previewSpinner,
          'hidden',
        );
        await baseAssertion.assertElementState(
          customAppEditorViewForm,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Input Attachment type, leave Max Attachments empty, and save app',
      async () => {
        await customAppEditorViewForm.fillInAppFields({
          chatCompletionUrl: completionUrl,
        });
        await customAppEditorViewForm.attachmentTypes.comboboxInput.fillInInput(
          attachmentType,
        );
        await customAppEditorViewForm.maxAttachmentsInput.typeInInput('');
        await entityEditorHeader.focusOn({
          triggeredHost: API.applicationCreateHost,
        });
        await entityEditorHeader.saveAndExitButton.click();
        await marketplacePage.waitForPageLoaded();
        await entityDetailsModal.closeButton.click();
      },
    );

    await dialTest.step(
      'Find the created application and verify tooltips',
      async () => {
        await marketplaceHeader
          .getSearch()
          .inputField.fillInInput(appEntity.name);
        const agentElement =
          await marketplaceEntitiesSection.findEntityElement(appEntity);
        await agentElement.click();

        await entityDetailsModal.deleteButton.hoverOver();
        await tooltipAssertion.assertTooltipContent(MenuOptions.delete);

        await entityDetailsModal.editButton.hoverOver();
        await tooltipAssertion.assertTooltipContent(MenuOptions.edit);

        await entityDetailsModal.publishButton.hoverOver();
        await tooltipAssertion.assertTooltipContent(MenuOptions.publish);
      },
    );

    await dialTest.step('Use the created application', async () => {
      await entityDetailsModal.clickUseButton({
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
        const modalHeaderText = await fileManagerModal
          .getHeader()
          .getSupportedTypes();
        baseAssertion.assertStringIncludes(
          modalHeaderText!,
          attachmentType.substring(attachmentType.lastIndexOf('/') + 1),
          ExpectedMessages.headerShouldContainDefinedAttachmentTypes,
        );
        baseAssertion.assertStringNotIncludes(
          modalHeaderText!,
          'Up to ',
          ExpectedMessages.headerMaxNumberOfAttacmentsNotMentioned,
        );
      },
    );

    await dialTest.step(
      'Select several files with correct type and click attach',
      async () => {
        for (const pdfFile of pdfFilesToUpload) {
          const attachmentCheckbox =
            await fileManagerModalGrid.gridCheckboxByNameCell(pdfFile);
          await attachmentCheckbox.click();
        }
        const selectedFilesCounter = fileManagerToolbar.getSelectedIconsButton(
          pdfFilesToUpload.length,
        );

        await baseAssertion.assertElementState(selectedFilesCounter, 'visible');

        await fileManagerModal.getAttachButton().click();
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
  'Check icons of chats with published custom app.\n' + //EPMDIAL-4125
    'Check icons of chats with published custom app. icon has special symbols in name.\n' + //EPMDIAL-4144
    'Icon for custom app is displayed in publish request if file name for icon contain special symbols', //EPMDIAL-4129
  async ({
    dialHomePage,
    adminDialHomePage,
    adminPublishingApprovalModal,
    marketplacePage,
    marketplaceHeader,
    marketplaceEntitiesSection,
    entityDetailsModal,
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
    setTestIds('EPMDIAL-4125', 'EPMDIAL-4144', 'EPMDIAL-4129');
    const appName = GeneratorUtil.randomApplicationName();
    const appVersion = GeneratorUtil.randomEntityVersion();
    let appEntity: DialAIEntityModel;
    let agentElement: BaseElement;
    let createdAppBackendEntity: BackendEntity;
    let appPublication: Publication;
    let reviewIconUrl: string;
    let targetIconUrl: string;

    const filename = `${filenamePrefix}${ExpectedConstants.allowedSpecialChars}.svg`;
    const expectedNewIconUrl = await fileApiHelper.putFileWithCustomName(
      filename,
      Attachment.appIconSvg,
    );
    const encodedFileUrl =
      expectedNewIconUrl.substring(0, expectedNewIconUrl.lastIndexOf('/') + 1) +
      encodeURIComponent(filename);

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
          .withFileResource(expectedNewIconUrl, PublishActions.ADD_IF_ABSENT)
          .build();

        appPublication =
          await publicationApiHelper.createPublishRequest(publishRequest);

        const fileResource = appPublication.resources.find((r) =>
          r.sourceUrl?.startsWith(API.filesHostSegment),
        )!;
        reviewIconUrl = `${API.api}/${fileResource.reviewUrl}`;
        targetIconUrl = `${API.api}/${fileResource.targetUrl}`;

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
          adminPublishedApplicationReviewModal.getEntityIcon(),
          reviewIconUrl,
        );

        await adminPublishedApplicationReviewModal
          .getPublicationReviewControl()
          .backToPublicationRequest();
        await adminPublishingApprovalModal.approveButton.click();
        await itemApiHelper.deleteBackendItem(createdAppBackendEntity); //delete the original app
      },
    );

    await dialTest.step(
      'Open DIAL Marketplace and find custom app',
      async () => {
        await marketplacePage.openMarketplacePage();
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.getSearch().inputField.fillInInput(appName);
        agentElement =
          await marketplaceEntitiesSection.findEntityElement(appEntity);
        await baseAssertion.assertElementState(agentElement, 'visible');
      },
    );

    await dialTest.step("Click on app's card", async () => {
      await agentElement.click();
      await baseAssertion.assertElementState(entityDetailsModal, 'visible');
    });

    await dialTest.step(
      'Click "Use application" button - New conversation screen with custom app is displayed',
      async () => {
        await entityDetailsModal.clickUseButton({
          isInstalledDeploymentsUpdated: false,
        });
        await dialHomePage.waitForPageLoaded();
        await agentInfoAssertion.assertAgentIcon(targetIconUrl);
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
          targetIconUrl,
        );
        await chatHeaderAssertion.assertHeaderIcon(targetIconUrl);
      },
    );
  },
);

dialTest(
  'Long names of apps without spaces displayed in several lines on preview screen of Add editor and on start screen of new conversation\n' + // EPMDIAL-4165
    'Create two custom apps consecutively.\n' + // EPMDIAL-4143
    '[Select an agent for conversation] Tooltip appears on long name only',
  async ({
    marketplacePage,
    entityEditorPage,
    entityEditorGeneralForm,
    entityEditorHeader,
    customAppEditorViewForm,
    entityEditorGeneralInfoPreview,
    customAppEditorAppSettingsPreview,
    customAppEditorAppSettingsPreviewBody,
    customAppEditorAppSettingsPreviewChat,
    setTestIds,
    baseAssertion,
    entityEditorGeneralInfoPreviewCard,
    entityEditorHeaderAssertion,
    marketplaceHeader,
    marketplaceEntitiesSection,
    entityDetailsModal,
    dialHomePage,
    agentInfo,
    agentInfoAssertion,
    addAppDropdownMenu,
    toastAssertion,
    chat,
    talkToAgentDialog,
    talkToAgents,
    tooltip,
    tooltipAssertion,
  }) => {
    setTestIds('EPMDIAL-4165', 'EPMDIAL-4143', 'EPMDIAL-5849');
    const version = GeneratorUtil.randomEntityVersion();
    const maxRandomNameLength =
      ExpectedConstants.maxEntityNameLength -
      ItemUtil.getUtf8ByteLength(`${ItemUtil.entityIdSeparator}${version}`) -
      ItemUtil.getUtf8ByteLength(applicationNamePrefix);
    const appEntity = {
      name: `${applicationNamePrefix}${GeneratorUtil.randomString(
        Math.max(maxRandomNameLength, 1),
      )}`,
      version,
    } as DialAIEntityModel;

    await dialTest.step('Open create a custom app page', async () => {
      await marketplacePage.openCreateCustomAppPage();
      await entityEditorPage.waitForPageLoaded(EntityEditorAppTypes.CustomApp);
      await entityEditorHeaderAssertion.assertActionTitle(
        EntityMenuActions.addApp(AddAppMenuOptions.customApp),
      );
    });

    await dialTest.step(
      "Input app's name (max UTF-8 bytes without spaces, accounting for version) and version on General Info step",
      async () => {
        await entityEditorGeneralForm.fillInEntityFields({
          name: appEntity.name,
          version: appEntity.version,
        });
      },
    );

    await dialTest.step(
      'Check how name displayed on preview screen on General Info step',
      async () => {
        await baseAssertion.assertElementState(
          entityEditorGeneralInfoPreview,
          'visible',
        );
        // Verify name is truncated with ellipsis on the card preview
        await baseAssertion.assertElementTextIsTruncated(
          entityEditorGeneralInfoPreviewCard.previewName,
          ExpectedMessages.entityNameIsTruncated,
        );
      },
    );

    await dialTest.step(
      'Click Next to go to the App Settings step',
      async () => {
        await entityEditorGeneralForm.goNext();
        await baseAssertion.assertElementState(
          customAppEditorViewForm,
          'visible',
        );
        await baseAssertion.assertElementState(
          customAppEditorAppSettingsPreview,
          'visible',
        );
        await baseAssertion.assertElementState(
          customAppEditorAppSettingsPreviewBody.previewSpinner,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Check how name displayed on preview for New conversation on App Settings step',
      async () => {
        await baseAssertion.assertElementState(
          customAppEditorAppSettingsPreview,
          'visible',
        );
        const previewAgentNameElement =
          customAppEditorAppSettingsPreviewChat.agentName;
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
        await customAppEditorViewForm.fillInAppFields({
          chatCompletionUrl: 'http://testurl.com',
        });
        await entityEditorHeader.focusOn({
          triggeredHost: API.applicationCreateHost,
        });
        await entityEditorHeader.saveAndExitButton.click();
        await marketplacePage.waitForPageLoaded();
        await entityDetailsModal.closeButton.click();
      },
    );

    await dialTest.step(
      'Click Add app/Custom app to start creation of the second app and verify no error toast',
      async () => {
        await marketplaceHeader.addAppButton.click();
        await addAppDropdownMenu.selectMenuOption(AddAppMenuOptions.customApp);
        await entityEditorPage.waitForPageLoaded(
          EntityEditorAppTypes.CustomApp,
        );
        await toastAssertion.assertToastIsHidden();
        await entityEditorHeaderAssertion.assertActionTitle(
          EntityMenuActions.addApp(AddAppMenuOptions.customApp),
        );
        await entityEditorHeader.exitButton.click();
      },
    );

    await dialTest.step(
      `On My Workspace page, click on app's card and then "Use application" button`,
      async () => {
        await marketplaceHeader
          .getSearch()
          .inputField.fillInInput(appEntity.name);
        const agentElement =
          await marketplaceEntitiesSection.findEntityElement(appEntity);
        await agentElement.click();
        await entityDetailsModal.clickUseButton({
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

    await dialTest.step(
      'Click on "Change agent" and verify tooltip appears only on hover over the agent name',
      async () => {
        await chat.changeAgentButton.click();
        await baseAssertion.assertElementState(talkToAgentDialog, 'visible');
        const agentElement = talkToAgents.getEntity(appEntity);
        const agentIcon = await talkToAgents.getEntityIcon(agentElement);
        const agentNameElement = talkToAgents.getEntityName(agentElement);
        await agentIcon.hover();
        await tooltipAssertion.assertElementState(tooltip, 'hidden');
        await agentNameElement.hoverOver();
        await tooltipAssertion.assertTooltipContent(appEntity.name);
      },
    );
  },
);

dialTest(
  "Tooltip for long app's name displayed in several lines\n" + // EPMDIAL-4134
    '[App editor]: Changes are saved if set focus to field and then move cursor to Save and exit or to step in header', // EPMDIAL-4140
  async ({
    customApplicationBuilder,
    applicationApiHelper,
    marketplacePage,
    marketplaceHeader,
    marketplaceEntitiesSection,
    marketplaceEntities,
    setTestIds,
    baseAssertion,
    tooltipAssertion,
    tooltip,
    entityDetailsModal,
    entityEditorPage,
    entityEditorGeneralForm,
    entityEditorHeader,
    page,
    customAppEditorViewForm,
    customAppEditorAppSettingsPreview,
    customAppEditorAppSettingsPreviewBody,
    entityEditorGeneralInfoPreview,
  }) => {
    setTestIds('EPMDIAL-4134', 'EPMDIAL-4140');
    const appNameWithSpaces = `${applicationNamePrefix}${GeneratorUtil.randomString(70)} ${GeneratorUtil.randomString(70)} ${GeneratorUtil.randomString(ExpectedConstants.maxEntityNameLength - 140 - 2 - 6)}`; // Ensure total length is 160 with spaces
    const appVersion = GeneratorUtil.randomEntityVersion();
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
      await marketplaceHeader
        .getSearch()
        .inputField.fillInInput(appEntity.name);
      reusableAgentElement =
        await marketplaceEntitiesSection.findEntityElement(appEntity);
      await baseAssertion.assertElementState(
        reusableAgentElement,
        'visible',
        ExpectedMessages.agentIsVisible,
      );
    });

    await dialTest.step(
      "Hover over app's icon - tooltip is not displayed",
      async () => {
        const agentIcon =
          await marketplaceEntities.getEntityIcon(reusableAgentElement);
        await agentIcon.hover();
        await tooltipAssertion.assertElementState(tooltip, 'hidden');
      },
    );

    await dialTest.step("Click on app's card", async () => {
      const agentElement =
        await marketplaceEntitiesSection.findEntityElement(appEntity);
      await agentElement.click();
      await baseAssertion.assertElementState(entityDetailsModal, 'visible');
    });

    await dialTest.step('Click Edit icon', async () => {
      await entityDetailsModal.editButton.click();
      await entityEditorPage.waitForPageLoadedForEdit(
        EntityEditorAppTypes.CustomApp,
      );
    });

    await dialTest.step(
      'Switch to General info step in App Editor',
      async () => {
        await entityEditorHeader.goOnGeneralInfoStepWithHeaderStepper({
          isHttpMethodTriggered: false,
        });
        await baseAssertion.assertElementState(
          entityEditorGeneralForm,
          'visible',
        );
        await baseAssertion.assertElementState(
          entityEditorGeneralInfoPreview,
          'visible',
        );
        await baseAssertion.assertElementState(
          entityEditorGeneralInfoPreview.previewSpinner,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Click on Description field, move cursor to App settings step (without clicking) and type any text into the Description field',
      async () => {
        await entityEditorGeneralForm.description.click();
        await entityEditorHeader.getAppSettingsStep().hoverOver();
        await page.keyboard.type(descriptionTextToType);
      },
    );

    await dialTest.step('Click on "App settings" link in header', async () => {
      await entityEditorHeader.goToEntitySettingsStepWithHeaderStepper();
      await baseAssertion.assertElementState(
        customAppEditorViewForm,
        'visible',
      );
      await baseAssertion.assertElementState(
        customAppEditorAppSettingsPreview,
        'visible',
      );
      await baseAssertion.assertElementState(
        customAppEditorAppSettingsPreviewBody.previewSpinner,
        'hidden',
      );
    });

    await dialTest.step(
      'Click back on "General info" link in the header',
      async () => {
        await entityEditorHeader.goOnGeneralInfoStepWithHeaderStepper({
          isHttpMethodTriggered: false,
        });
        await baseAssertion.assertElementState(
          entityEditorGeneralForm,
          'visible',
        );
        await baseAssertion.assertElementState(
          entityEditorGeneralInfoPreview,
          'visible',
        );
        await baseAssertion.assertElementState(
          entityEditorGeneralInfoPreview.previewSpinner,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Check description field - The updated description is displayed',
      async () => {
        await baseAssertion.assertInputValue(
          entityEditorGeneralForm.description,
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
