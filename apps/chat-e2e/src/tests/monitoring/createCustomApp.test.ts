import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  AddAppMenuOptions,
  AppMenuActions,
  ExpectedConstants,
  ExpectedMessages,
  MockedChatApiResponseBodies,
} from '@/src/testData';
import { BaseElement } from '@/src/ui/webElements';
import { GeneratorUtil } from '@/src/utils';

dialTest(
  'Create custom app with required fields', // EPMRTC-6262
  async ({
    marketplacePage,
    marketplaceHeader,
    addAppDropdownMenu,
    appEditorPage,
    appEditorGeneralForm,
    appEditorViewForm,
    appEditorHeader,
    marketplaceAgentsSection,
    agentDetailsModal,
    baseAssertion,
    appEditorHeaderAssertion,
    dialHomePage,
    chat,
    chatMessagesAssertion,
    localStorageManager,
    agentInfoAssertion,
    agentDetailsModalAssertion,
    appEditorAppSettingsAgentPreview,
    navigationPanel,
  }) => {
    const shortDescription = GeneratorUtil.randomShortDescription();
    const longDescription = GeneratorUtil.randomLongDescription();
    const appEntity = {
      name: `${GeneratorUtil.randomApplicationName()}${ExpectedConstants.allowedSpecialChars}`,
      version: GeneratorUtil.randomApplicationVersion(),
      description: `${shortDescription}\n\n${longDescription}`,
    } as DialAIEntityModel;
    let agentElement: BaseElement;

    await dialTest.step(
      'Open My workspace directly and verify navigation panel is displayed',
      async () => {
        await localStorageManager.setShowSideBarPanels();
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
      'Click Add app and select Custom app in drop down, verify side/navigation panels are hidden',
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
  },
);
