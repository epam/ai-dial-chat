import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  AddAppMenuOptions,
  EntityEditorAppTypes,
  EntityEditorGeneralFormFields,
  EntityEditorViewFormFields,
  EntityMenuActions,
  ExpectedConstants,
  ExpectedMessages,
  MarketplaceFilterTypes,
  SourcesFilterOptions,
} from '@/src/testData';
import { AttributeValues, Attributes, StyleValues } from '@/src/ui/domData';
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
      entityEditorPage,
      entityEditorGeneralForm,
      externalAppEditorViewForm,
      entityEditorHeader,
      marketplaceEntitiesSection,
      marketplaceEntities,
      entityDetailsModal,
      setTestIds,
      baseAssertion,
      entityEditorHeaderAssertion,
      dialHomePage,
      agentInfo,
      agentInfoAssertion,
      localStorageManager,
      chat,
      talkToAgentDialog,
      talkToAgentDialogAssertion,
      entityDetailsModalAssertion,
      entityEditorGeneralInfoPreviewCard,
      navigationPanel,
      externalAppEditorAppSettingsPreviewCard,
      page,
      tooltip,
      tooltipAssertion,
      entityEditorGeneralInfoPreviewCardAssertion,
      externalAppEditorSettingsPreviewCardAssertion,
    },
    testInfo,
  ) => {
    setTestIds(
      'EPMDIAL-5305',
      'EPMDIAL-5319',
      'EPMDIAL-5308',
      'EPMDIAL-5307',
      'EPMDIAL-5309',
      'EPMDIAL-5306',
      'EPMDIAL-5317',
    );
    const appEntity = {
      name: GeneratorUtil.randomApplicationName(),
      version: GeneratorUtil.randomEntityVersion(),
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
        await entityEditorPage.waitForPageLoaded(
          EntityEditorAppTypes.ExternalApp,
        );
        await baseAssertion.assertElementState(
          entityEditorGeneralForm,
          'visible',
        );
        await entityEditorHeaderAssertion.assertActionTitle(
          EntityMenuActions.addApp(AddAppMenuOptions.externalApp),
        );
        generalInfoStep = entityEditorHeader.getGeneralInfoStep();
        await entityEditorHeaderAssertion.assertStepIsSelected(
          generalInfoStep,
          true,
        );
        await entityEditorHeaderAssertion.assertActiveStepIconState(
          generalInfoStep,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Check that the required fields of General Info step form are marked with asterisks, optional fields are displayed',
      async () => {
        for (const field of [
          EntityEditorGeneralFormFields.name,
          EntityEditorGeneralFormFields.version,
        ]) {
          await baseAssertion.assertElementState(
            entityEditorGeneralForm.getRequiredIndicator(field),
            'visible',
            ExpectedMessages.entityFormFieldShouldHaveAsterisk,
          );
        }
        for (const field of [
          entityEditorGeneralForm.iconField,
          entityEditorGeneralForm.description,
          entityEditorGeneralForm.topicsDropdownContainer,
        ]) {
          await baseAssertion.assertElementState(field, 'visible');
        }
      },
    );

    await dialTest.step(
      `Fill required fields and verify app preview form on the right side of General Info screen`,
      async () => {
        await entityEditorGeneralForm.fillInEntityFields({
          name: appEntity.name,
          version: appEntity.version,
          description: appEntity.description,
        });
        await entityEditorGeneralInfoPreviewCardAssertion.assertPreviewCardAttributes(
          {
            expectedName: appEntity.name,
            expectedIcon: '',
            expectedShortDescription: appEntity.description,
            expectedAuthor: currentUsername,
          },
        );
        await baseAssertion.assertElementState(
          entityEditorGeneralInfoPreviewCard.externalAppIcon,
          'visible',
        );
        await baseAssertion.assertElementDisplayStyle(
          entityEditorGeneralInfoPreviewCard.descriptionParagraphs,
          StyleValues.block,
        );
      },
    );

    await dialTest.step('Click Next and verify the header', async () => {
      await entityEditorGeneralForm.goNext({
        hostsArray: [API.applicationCreateHost, API.installedDeploymentsHost()],
      });
      await baseAssertion.assertElementState(
        externalAppEditorViewForm,
        'visible',
      );
      appSettingsStep = entityEditorHeader.getAppSettingsStep();
      await entityEditorHeaderAssertion.assertStepIsSelected(
        appSettingsStep,
        true,
      );
      await entityEditorHeaderAssertion.assertActiveStepIconState(
        appSettingsStep,
        'visible',
      );
    });

    await dialTest.step(
      'Check that the required field of App Settings step form is marked with asterisks, app preview form on the right side is the same as on General Info screen',
      async () => {
        await baseAssertion.assertElementState(
          externalAppEditorViewForm.getRequiredIndicator(
            EntityEditorViewFormFields.externalUrl,
          ),
          'visible',
          ExpectedMessages.entityFormFieldShouldHaveAsterisk,
        );
        await externalAppEditorSettingsPreviewCardAssertion.assertPreviewCardAttributes(
          {
            expectedName: appEntity.name,
            expectedIcon: '',
            expectedShortDescription: appEntity.description,
            expectedAuthor: currentUsername,
          },
        );
        await baseAssertion.assertElementState(
          externalAppEditorAppSettingsPreviewCard.externalAppIcon,
          'visible',
        );
        await baseAssertion.assertElementDisplayStyle(
          externalAppEditorAppSettingsPreviewCard.descriptionParagraphs,
          StyleValues.block,
        );
      },
    );

    await dialTest.step(
      'Set External URL, click Save and Exit link and verify user is redirected on My workspace page',
      async () => {
        await externalAppEditorViewForm.externalUrl.fillInInput(externalUrl);
        await entityEditorHeader.focusOn({
          triggeredHost: API.applicationCreateHost,
        });
        await entityEditorHeader.saveAndExitButton.click();
        await baseAssertion.assertElementState(
          externalAppEditorViewForm,
          'hidden',
        );
        await entityDetailsModalAssertion.assertElementState(
          entityDetailsModal,
          'visible',
        );
        await entityDetailsModal.closeButton.click();
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
          await marketplaceEntitiesSection.findEntityElement(appEntity);
        await baseAssertion.assertElementState(agentElement, 'visible');
        await baseAssertion.assertElementText(
          marketplaceEntities.getEntityName(agentElement),
          appEntity.name,
        );
        await baseAssertion.assertElementText(
          marketplaceEntities.getEntityVersion(agentElement),
          appEntity.version!,
        );
        await baseAssertion.assertEntityIcon(
          await marketplaceEntities.getEntityIcon(agentElement),
        );
        externalIcon = marketplaceEntities.getAppExternalIcon(agentElement);
        await baseAssertion.assertElementState(externalIcon, 'visible');
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
      await baseAssertion.assertElementState(entityDetailsModal, 'visible');
      await entityDetailsModalAssertion.assertEntityName(appEntity.name);
      await entityDetailsModalAssertion.assertEntityVersion(appEntity.version!);
      await entityDetailsModalAssertion.assertEntityAuthor(currentUsername);
      //TODO: enable when fixed https://github.com/epam/ai-dial-chat/issues/3218
      // const configApp = await modelApiHelper.getAgentByNameAndVersion({
      //   name: appEntity.name,
      //   version: appEntity.version,
      // });
      // await agentDetailsModalAssertion.assertApplicationReleaseDate(
      //   configApp.createdAt!,
      // );
      await entityDetailsModalAssertion.assertElementState(
        entityDetailsModal.openInNewTabButton,
        'visible',
      );
      const viewport = page.viewportSize();
      await entityDetailsModalAssertion.assertOpenInNewTabButtonTitle(viewport);
      await entityDetailsModalAssertion.assertElementState(
        entityDetailsModal.openInNewTabButtonIcon,
        'visible',
      );
      await entityDetailsModalAssertion.assertElementAttribute(
        entityDetailsModal.openInNewTabButton,
        Attributes.href,
        externalUrl,
      );
      await entityDetailsModalAssertion.assertElementAttribute(
        entityDetailsModal.openInNewTabButton,
        Attributes.target,
        AttributeValues.blank,
      );
      await entityDetailsModalAssertion.assertEntityIcon(
        entityDetailsModal.icon,
      );
      await entityDetailsModalAssertion.assertElementState(
        entityDetailsModal.externalAppIcon,
        'visible',
      );
      await entityDetailsModal.closeButton.click();
    });

    await dialTest.step(
      'Back to chat and verify created app is not used for a new conversation',
      async () => {
        await navigationPanel.backToChat();
        await dialHomePage.waitForPageLoaded();
        await agentInfoAssertion.assertElementDoesNotContainText(
          agentInfo.agentName,
          appEntity.name,
        );
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
