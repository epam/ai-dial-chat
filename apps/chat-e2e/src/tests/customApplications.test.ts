import { DialAIEntityModel } from '@/chat/types/models';
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
} from '@/src/testData';
import { AppEditSteps, BaseElement } from '@/src/ui/webElements';
import { GeneratorUtil } from '@/src/utils';

dialTest(
  'Create custom app with required fields only.\n' + // EPMRTC-5130
    'Edit option for custom app is available from card pop-up form.\n' + // EPMRTC-5939
    'Custom app with permitted spec symbols in Name.\n' + // EPMRTC-4838
    'Delete custom app from context menu\n' + // EPMRTC-4094
    'Custom app: Description field displayed in New conversation , card view, app view', //EPMRTC-4099
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
  }) => {
    setTestIds(
      'EPMRTC-5130',
      'EPMRTC-5939',
      'EPMRTC-4838',
      'EPMRTC-4094',
      'EPMRTC-4099',
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

    await dialTest.step('Open My workspace directly', async () => {
      await marketplacePage.openMyWorkspacePage({
        updateInstalledDeployments: false,
      });
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
          name: appEntity.name,
          version: appEntity.version,
          description: appEntity.description,
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
        await appEditorHeader.focusOn();
        await appEditorHeader.saveAndExitButton.click();
        await baseAssertion.assertElementState(appEditorViewForm, 'hidden');
        await marketplacePage.waitForPageLoaded();
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
    'Edit version for custom app', //EPMRTC-4305
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
    setTestIds('EPMRTC-5131', 'EPMRTC-4305');
    const updatedDescription = GeneratorUtil.randomString(25);
    const updatedCompletionUrl = `http://updated-${GeneratorUtil.randomString(6)}.com`;
    const appEntity = {
      name: GeneratorUtil.randomApplicationName(),
      version: '1.1.1',
      description: GeneratorUtil.randomString(20),
    } as DialAIEntityModel;

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
      'Update any field on step "General info" and click Save and exit link',
      async () => {
        await appEditorHeader.goOnGeneralInfoStep();
        await baseAssertion.assertElementState(appEditorGeneralForm);
        await appEditorHeaderAssertion.assertStepIsCompleted(
          AppEditSteps.generalInfo,
          true,
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
        await appEditorHeader.saveAndExitButton.click();
        await baseAssertion.assertElementState(appEditorGeneralForm, 'hidden');
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
      'Check that updated field values from steps 4, 5 are still displayed',
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

        await appEditorHeader.goOnGeneralInfoStep({
          isHttpMethodTriggered: false,
        });
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
  },
);

dialTest(
  'Delete custom app from "Select an agent for conversation" form\n' + // EPMRTC-4105
    'Delete custom app from application card pop-up\n' + // EPMRTC-4103
    '[Custom app]: Delete specific not published version', // EPMRTC-4285
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
  }) => {
    setTestIds('EPMRTC-4105', 'EPMRTC-4103', 'EPMRTC-4285');
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

        await localStorageManager.setRecentModelsIdsOnce(
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
      'Open "My workspace", find App 2 and click on the second app card',
      async () => {
        await marketplaceContainer.getNavigationPanel().goToMyWorkspace();
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.searchInput.fillInInput(appEntity2_v2.name);
        agentElement2 =
          await marketplaceAgentsSection.findAgentElement(appEntity2_v2);
        await baseAssertion.assertElementState(agentElement2, 'visible');
        await baseAssertion.assertElementText(
          marketplaceAgents.getAgentVersion(agentElement2),
          appEntity2_v2.version!,
        );
      },
    );

    await dialTest.step(
      'Click on App 2 card, verify versions, select older version',
      async () => {
        await agentElement2.click();
        await baseAssertion.assertElementState(agentDetailsModal, 'visible');
        await agentDetailsModalAssertion.assertApplicationVersion(
          appEntity2_v2.version!,
        );
        await agentDetailsModal.versionMenuTrigger.click();
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
  'Custom app Topic dropdown select. +\n' + '[Custom app]: Hints on for fields',
  async ({
    marketplacePage,
    appEditorPage,
    appEditorGeneralForm,
    setTestIds,
    baseAssertion,
    tooltipAssertion,
    appEditorViewForm,
  }) => {
    setTestIds('EPMRTC-4374', 'EPMRTC-4278');
    let numberOfTopicsToSelect: number;
    let allTopics: string[] = [];
    let topicsToSelect: string[] = [];

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
          appEditorGeneralForm.topicsDropdownMenuElement,
          'visible',
          ExpectedMessages.dropdownMenuIsVisible,
        );
        allTopics = await appEditorGeneralForm.getAllTopicsOptions();
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
        await appEditorGeneralForm.selectTopicOption(topicsToSelect[i]);
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

    await dialTest.step('Click Next button to go to App Settings', async () => {
      await appEditorGeneralForm.fillInAppFields({
        name: GeneratorUtil.randomApplicationName(),
        version: GeneratorUtil.randomApplicationVersion(),
      });
      await appEditorGeneralForm.goNext({ waitForResponses: false });
      await baseAssertion.assertElementState(appEditorViewForm, 'visible');
    });

    await dialTest.step(
      'Hover over question icons for Features data and Attachment types and verify hints',
      async () => {
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
  },
);

dialTest(
  'Edit Custom app: Update icon of custom app',
  async ({
    marketplacePage,
    marketplaceAgentsSection,
    agentDetailsModal,
    appEditorPage,
    attachFilesModal,
    appEditorHeader,
    appEditorGeneralForm,
    appEditorPreview,
    customApplicationBuilder,
    applicationApiHelper,
    uploadFromDeviceModal,
    baseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-4109');
    const appEntity = {
      name: GeneratorUtil.randomApplicationName(),
      version: GeneratorUtil.randomApplicationVersion(),
    } as DialAIEntityModel;
    const newIconFileName = Attachment.sunImageName;
    let agentElement: BaseElement;
    let expectedNewIconUrl: string;

    await dialTest.step(
      'Precondition: Create custom application via API',
      async () => {
        const applicationModel = customApplicationBuilder
          .withDisplayName(appEntity.name)
          .withDisplayVersion(appEntity.version!)
          .build();
        const createdApp =
          await applicationApiHelper.createApplication(applicationModel);

        expectedNewIconUrl = `${API.fileHost}/${createdApp.bucket}/${newIconFileName}`;
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
        await appEditorHeader.goOnGeneralInfoStep({
          isHttpMethodTriggered: false,
        }); // Navigate back if needed
        await baseAssertion.assertElementState(appEditorGeneralForm, 'visible');
        await appEditorGeneralForm.addIconButton.click();
        await attachFilesModal.uploadFromDevice();
        await uploadFromDeviceModal.addMoreFilesToUpload(newIconFileName);
        await uploadFromDeviceModal.uploadFiles();
        await attachFilesModal.attachFiles();
      },
    );

    await dialTest.step(
      'Verify the updated icon is displayed in the preview on the "General info" step',
      async () => {
        const previewIcon = appEditorPreview.previewIcon;
        await baseAssertion.assertEntityIcon(previewIcon, expectedNewIconUrl);
      },
    );

    await dialTest.step(
      'Navigate to "App settings" step and verify the updated icon in the preview',
      async () => {
        await appEditorGeneralForm.goNext({ waitForResponses: false });
        const previewIconAppSettings = appEditorPreview.previewIcon;
        await baseAssertion.assertEntityIcon(
          previewIconAppSettings,
          expectedNewIconUrl,
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
          expectedNewIconUrl,
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
          expectedNewIconUrl,
        );
      },
    );
  },
);
