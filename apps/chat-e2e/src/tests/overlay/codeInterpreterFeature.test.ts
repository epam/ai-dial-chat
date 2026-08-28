import { DialAIEntityModel } from '@/chat/types/models';
import dialOverlayTest from '@/src/core/dialOverlayFixtures';
import {
  ExpectedConstants,
  MenuOptions,
  OverlaySandboxUrls,
  ToggleState,
} from '@/src/testData';
import { GeneratorUtil } from '@/src/utils';

dialOverlayTest(
  '[Overlay] enable/disable Feature.CodeInterpreter',
  async ({
    overlayHomePage,
    overlayNavigationPanel,
    overlayMarketplacePage,
    overlayMarketplaceEntitiesSection,
    overlayMarketplaceEntities,
    overlayAgentDropdownMenu,
    overlayEntityEditorHeader,
    overlayQuickApp2EditorViewForm,
    overlayTooltipPortalAssertion,
    overlayBaseAssertion,
    overlayApplicationApiHelper,
    overlayLocalStorageManager,
    overlayModelApiHelper,
    quickApp2Builder,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-2299');
    const appName = GeneratorUtil.randomApplicationName();

    const openAppInEditMode = async () => {
      await overlayNavigationPanel.myWorkspaceButton.click();
      await overlayMarketplacePage.waitForPageLoaded();
      const agentElement =
        await overlayMarketplaceEntitiesSection.findEntityElement(appName);
      await agentElement.hoverOver();
      await overlayMarketplaceEntities
        .getEntityElementDotsMenu(agentElement)
        .click();
      await overlayAgentDropdownMenu.selectMenuOption(MenuOptions.edit);
      await overlayQuickApp2EditorViewForm.waitForState();
    };

    await dialOverlayTest.step(
      'Create a Quick app 2.0 via API with a tool-supporting orchestrator model',
      async () => {
        const toolSupportingModel: DialAIEntityModel =
          await overlayModelApiHelper.getToolSupportingModel();
        await overlayApplicationApiHelper.createApplication(
          quickApp2Builder
            .withDisplayName(appName)
            .withOrchestratorModel(toolSupportingModel.id)
            .build(),
        );
        await overlayLocalStorageManager.setRecentModelsIdsAndUseLastModel(
          appName,
        );
      },
    );

    await dialOverlayTest.step(
      'Open the sandbox with Feature.CodeInterpreter enabled, open the app in edit mode and verify the Code Interpreter field is available',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.enableCodeInterpreterUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        await openAppInEditMode();
        await overlayBaseAssertion.assertElementState(
          overlayQuickApp2EditorViewForm.codeInterpreterField,
          'visible',
        );
        await overlayBaseAssertion.assertElementText(
          overlayQuickApp2EditorViewForm.codeInterpreterLabel,
          ExpectedConstants.codeInterpreterFieldLabel,
        );
        await overlayBaseAssertion.assertElementContainsText(
          overlayQuickApp2EditorViewForm.codeInterpreterField,
          ExpectedConstants.codeInterpreterAdditionalText,
        );
        await overlayBaseAssertion.assertElementText(
          overlayQuickApp2EditorViewForm.codeInterpreterToggle,
          ToggleState.off,
        );
        await overlayQuickApp2EditorViewForm.codeInterpreterInfoIcon.hoverOver();
        await overlayTooltipPortalAssertion.assertTooltipContent(
          ExpectedConstants.codeInterpreterInfoTooltip,
        );
      },
    );

    await dialOverlayTest.step(
      'Leave the editor without saving changes',
      async () => {
        await overlayEntityEditorHeader.saveAndExitButton.click();
      },
    );

    await dialOverlayTest.step(
      'Open the sandbox with Feature.CodeInterpreter disabled, reopen the app in edit mode and verify there are no Code Interpreter fields',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.disableCodeInterpreterUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        await openAppInEditMode();
        await overlayBaseAssertion.assertElementState(
          overlayQuickApp2EditorViewForm.codeInterpreterField,
          'hidden',
        );
      },
    );
  },
);
