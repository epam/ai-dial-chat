import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  AddAppMenuOptions,
  AppEditorAppTypes,
  AppEditorGeneralFormFields,
  AppEditorViewFormFields,
  AppMenuActions,
  ExpectedConstants,
  ExpectedMessages,
  MarketplaceFilterTypes,
  SourcesFilterOptions,
} from '@/src/testData';
import { Attributes, StyleValues } from '@/src/ui/domData';
import { BaseElement } from '@/src/ui/webElements';
import { GeneratorUtil, UserUtil } from '@/src/utils';

dialTest(
  '[External app] By owner create.\n' +
    '[External app] Long description without spaces and long URL (the card on preview and the card from approve required).\n' +
    "[External app] By owner use 'My External apps' filter.\n" +
    '[External app] By owner open the link though the button.\n' +
    '[External app] By owner check the icon and tooltip.\n' +
    "[External app] External app doesn't appear on the first screen (after the creation).\n" +
    "[External app] External app doesn't appear on the first screen (after the creation)",
  async (
    {
      marketplacePage,
      marketplaceHeader,
      marketplaceFilter,
      addAppDropdownMenu,
      appEditorPage,
      appEditorGeneralForm,
      externalAppEditorViewForm,
      appEditorHeader,
      marketplaceAgentsSection,
      marketplaceAgentsAssertion,
      marketplaceAgents,
      agentDetailsModal,
      setTestIds,
      baseAssertion,
      appEditorHeaderAssertion,
      dialHomePage,
      localStorageManager,
      chat,
      talkToAgentDialog,
      talkToAgentDialogAssertion,
      agentDetailsModalAssertion,
      appEditorPreviewCard,
      navigationPanel,
      externalAppEditorAppSettingsPreviewCard,
      page,
      tooltip,
      tooltipAssertion,
    },
    testInfo,
  ) => {
    setTestIds(
      'EPMRTC-6579',
      'EPMRTC-6701',
      'EPMRTC-6581',
      'EPMRTC-6580',
      'EPMRTC-6582',
      'EPMRTC-6591',
      'EPMRTC-6590',
    );
    const appEntity = {
      name: GeneratorUtil.randomApplicationName(),
      version: GeneratorUtil.randomApplicationVersion(),
      description: GeneratorUtil.randomShortDescription(),
    } as DialAIEntityModel;
    let agentElement: BaseElement;
    let externalIcon: BaseElement;
    let generalInfoStep: BaseElement;
    let appSettingsStep: BaseElement;
    const currentUsername = UserUtil.getE2EUsername(testInfo.parallelIndex);
    const externalUrl = `http://${GeneratorUtil.randomString(6)}.com`;

    await dialTest.step(
      'Set user settings to start with last used agent',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await localStorageManager.setRecentModelsIdsAndUseLastModel();
      },
    );

    await dialTest.step(
      'Open My workspace directly, click Add app, select External app in dropdown menu and verify the header',
      async () => {
        await marketplacePage.openMyWorkspacePage({
          updateInstalledDeployments: false,
          getStyles: true,
        });
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.addAppButton.click();
        await addAppDropdownMenu.selectMenuOption(
          AddAppMenuOptions.externalApp,
        );
        await appEditorPage.waitForPageLoaded(AppEditorAppTypes.ExternalApp);
        await baseAssertion.assertElementState(appEditorGeneralForm, 'visible');
        await appEditorHeaderAssertion.assertActionTitle(
          AppMenuActions.add(AddAppMenuOptions.externalApp),
        );
        generalInfoStep = appEditorHeader.getGeneralInfoStep();
        await appEditorHeaderAssertion.assertStepIsSelected(
          generalInfoStep,
          true,
        );
        await appEditorHeaderAssertion.assertActiveStepIconState(
          generalInfoStep,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Check that the required fields of General Info step form are marked with asterisks, optional fields are displayed',
      async () => {
        for (const field of [
          AppEditorGeneralFormFields.name,
          AppEditorGeneralFormFields.version,
        ]) {
          await baseAssertion.assertElementState(
            appEditorGeneralForm.getRequiredIndicator(field),
            'visible',
            ExpectedMessages.applicationFormFieldShouldHaveAsterisk,
          );
        }
        for (const field of [
          appEditorGeneralForm.iconField,
          appEditorGeneralForm.description,
          appEditorGeneralForm.topicsDropdownContainer,
        ]) {
          await baseAssertion.assertElementState(field, 'visible');
        }
      },
    );

    await dialTest.step(
      `Fill required fields and verify app preview form on the right side of General Info screen`,
      async () => {
        await appEditorGeneralForm.fillInAppFields({
          name: appEntity.name,
          version: appEntity.version,
          description: appEntity.description,
        });
        await baseAssertion.assertElementState(appEditorPreviewCard, 'visible');
        await baseAssertion.assertElementText(
          appEditorPreviewCard.previewName,
          appEntity.name,
          ExpectedMessages.agentNameIsValid,
        );
        await baseAssertion.assertElementState(
          appEditorPreviewCard.previewInformationSection,
          'visible',
        );
        await baseAssertion.assertElementText(
          appEditorPreviewCard.previewAuthorValue,
          currentUsername,
          ExpectedMessages.authorIsValid,
        );
        await baseAssertion.assertEntityIcon(appEditorPreviewCard.previewIcon);
        await baseAssertion.assertElementState(
          appEditorPreviewCard.externalAppIcon,
          'visible',
        );
        await baseAssertion.assertElementDisplayStyle(
          appEditorPreviewCard.descriptionParagraphs,
          StyleValues.block,
        );
      },
    );

    await dialTest.step('Click Next and verify the header', async () => {
      await appEditorGeneralForm.goNext();
      await baseAssertion.assertElementState(
        externalAppEditorViewForm,
        'visible',
      );
      appSettingsStep = appEditorHeader.getAppSettingsStep();
      await appEditorHeaderAssertion.assertStepIsSelected(
        appSettingsStep,
        true,
      );
      await appEditorHeaderAssertion.assertActiveStepIconState(
        appSettingsStep,
        'visible',
      );
    });

    await dialTest.step(
      'Check that the required field of App Settings step form is marked with asterisks, app preview form on the right side is the same as on General Info screen',
      async () => {
        await baseAssertion.assertElementState(
          externalAppEditorViewForm.getRequiredIndicator(
            AppEditorViewFormFields.externalUrl,
          ),
          'visible',
          ExpectedMessages.applicationFormFieldShouldHaveAsterisk,
        );
        await baseAssertion.assertElementState(
          externalAppEditorAppSettingsPreviewCard,
          'visible',
        );
        await baseAssertion.assertElementText(
          externalAppEditorAppSettingsPreviewCard.previewName,
          appEntity.name,
          ExpectedMessages.agentNameIsValid,
        );
        await baseAssertion.assertElementState(
          externalAppEditorAppSettingsPreviewCard.previewInformationSection,
          'visible',
        );
        await baseAssertion.assertElementText(
          externalAppEditorAppSettingsPreviewCard.previewAuthorValue,
          currentUsername,
          ExpectedMessages.authorIsValid,
        );
        await baseAssertion.assertEntityIcon(
          externalAppEditorAppSettingsPreviewCard.previewIcon,
        );
        await baseAssertion.assertElementState(
          externalAppEditorAppSettingsPreviewCard.externalAppIcon,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Set External URL, click Save and Exit link and verify user is redirected on My workspace page',
      async () => {
        await externalAppEditorViewForm.externalUrl.fillInInput(externalUrl);
        await appEditorHeader.focusOn();
        await appEditorHeader.saveAndExitButton.click();
        await baseAssertion.assertElementState(
          externalAppEditorViewForm,
          'hidden',
        );
        await agentDetailsModalAssertion.assertElementState(
          agentDetailsModal,
          'visible',
        );
        await agentDetailsModal.closeButton.click();
      },
    );

    await dialTest.step(
      'Check "My External apps" on the left panel in the "Sources" filter and verify created app is displayed',
      async () => {
        await marketplaceFilter
          .filterByPropertyOptionInput(
            MarketplaceFilterTypes.sources,
            SourcesFilterOptions.myExternalApps,
          )
          .click();
        agentElement =
          await marketplaceAgentsSection.findAgentElement(appEntity);
        await baseAssertion.assertElementState(agentElement, 'visible');
        await marketplaceAgentsAssertion.assertElementText(
          marketplaceAgents.getAgentName(agentElement),
          appEntity.name,
        );
        await marketplaceAgentsAssertion.assertElementText(
          marketplaceAgents.getAgentVersion(agentElement),
          appEntity.version!,
        );
        await marketplaceAgentsAssertion.assertEntityIcon(
          await marketplaceAgents.getAgentIcon(agentElement),
        );
        externalIcon = marketplaceAgents.getAgentExternalIcon(agentElement);
        await marketplaceAgentsAssertion.assertElementState(
          externalIcon,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Hover over external icon and verify tooltip is displayed',
      async () => {
        await externalIcon.hoverOver();
        await tooltipAssertion.assertElementText(
          tooltip,
          ExpectedConstants.externalAppTooltip,
        );
      },
    );

    await dialTest.step('Open the card and verify the details', async () => {
      await agentElement.click();
      await baseAssertion.assertElementState(agentDetailsModal, 'visible');
      await agentDetailsModalAssertion.assertApplicationName(appEntity.name);
      await agentDetailsModalAssertion.assertApplicationVersion(
        appEntity.version!,
      );
      await agentDetailsModalAssertion.assertApplicationAuthor(currentUsername);
      //TODO: enable when fixed https://github.com/epam/ai-dial-chat/issues/3218
      // const configApp = await modelApiHelper.getAgentByNameAndVersion({
      //   name: appEntity.name,
      //   version: appEntity.version,
      // });
      // await agentDetailsModalAssertion.assertApplicationReleaseDate(
      //   configApp.createdAt!,
      // );
      await agentDetailsModalAssertion.assertElementState(
        agentDetailsModal.openInNewTabButton,
        'visible',
      );
      const viewport = page.viewportSize();
      await agentDetailsModalAssertion.assertOpenInNewTabButtonTitle(viewport);
      await agentDetailsModalAssertion.assertElementState(
        agentDetailsModal.openInNewTabButtonIcon,
        'visible',
      );
      await agentDetailsModalAssertion.assertElementAttribute(
        agentDetailsModal.openInNewTabButton,
        Attributes.href,
        externalUrl,
      );
      await agentDetailsModalAssertion.assertElementAttribute(
        agentDetailsModal.openInNewTabButton,
        Attributes.target,
        Attributes.blank,
      );
      await agentDetailsModalAssertion.assertEntityIcon(agentDetailsModal.icon);
      await agentDetailsModalAssertion.assertElementState(
        agentDetailsModal.externalAppIcon,
        'visible',
      );
      await agentDetailsModal.closeButton.click();
    });

    await dialTest.step(
      'Back to chat and verify created app is not used for a new conversation',
      async () => {
        await navigationPanel.backToChat();
        await dialHomePage.waitForPageLoaded();
        //TODO: enable the step when fixed https://github.com/epam/ai-dial-chat/issues/4881
        // await agentInfoAssertion.assertAgentName(
        //   ModelsUtil.getDefaultAgent()!.name,
        // );
        await chat.changeAgentButton.click();
        await talkToAgentDialog.selectAgent(appEntity, {
          isAgentVisible: false,
        });
        await talkToAgentDialogAssertion.assertElementState(
          talkToAgentDialog.noResultFound,
          'visible',
        );
      },
    );
  },
);
