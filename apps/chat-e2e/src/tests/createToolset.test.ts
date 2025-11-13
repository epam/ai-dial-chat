import { BackendEntity } from '@/chat/types/common';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  Attachment,
  CheckboxState,
  EntityEditorGeneralFormFields,
  EntityEditorToolsetTypes,
  EntityMenuActions,
  ExpectedConstants,
  ExpectedMessages,
  MarketplaceFilterTypes,
  MenuOptions,
  ToggleState,
} from '@/src/testData';
import { Attributes, Cursors, StyleValues, Styles } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
import { BaseElement, FileModalSection } from '@/src/ui/webElements';
import { DateUtil, GeneratorUtil, SortingUtil, UserUtil } from '@/src/utils';
import { ToolsetAuthTypes, ToolsetTransportType } from '@epam/ai-dial-shared';

let toolsetForCleanup: BackendEntity | undefined;
const defaultToolsetNamePattern = new RegExp(
  `${ExpectedConstants.defaultToolsetName} \\d+`,
);

dialTest(
  'Create toolset - basic scenario.\n' +
    '[Editor]: detailed card view is displayed by default on Preview side.\n' +
    `[Toolset]: toolset's card is open on My Workspace page when create toolset and click "save and exit" (without login).\n` +
    `Icon is shown on the toolset's card if the svg contains some special chars.\n` +
    '[Toolset]: Login option is not displayed for toolsets without authentication',
  async (
    {
      marketplacePage,
      marketplaceHeader,
      marketplaceEntitiesSection,
      marketplaceEntities,
      marketplaceEntitiesAssertion,
      toolsetBuilder,
      entityEditorPage,
      entityEditorHeader,
      entityDetailsModal,
      setTestIds,
      baseAssertion,
      toolsetEditorViewForm,
      entityEditorHeaderAssertion,
      entityDetailsModalAssertion,
      customAppEditorAppSettingsPreviewBody,
      entityEditorGeneralForm,
      toolsetEditorViewFormAssertion,
      listboxMenu,
      attachFilesModal,
      entityEditorGeneralInfoPreviewCardAssertion,
      toolsetEditorSettingsPreviewCardAssertion,
      entityEditorGeneralInfoPreviewCard,
      entityEditorGeneralInfoPreviewToggleAssertion,
      toolsetEditorSettingsPreviewToggleAssertion,
      fileApiHelper,
      toolsetApiHelper,
      page,
    },
    testInfo,
  ) => {
    setTestIds(
      'EPMRTC-6877',
      'EPMRTC-7292',
      'EPMRTC-6873',
      'EPMRTC-6888',
      'EPMRTC-7192',
    );
    const shortDescription = GeneratorUtil.randomShortDescription();
    const longDescription = GeneratorUtil.randomLongDescription();
    const toolsetEntity = {
      name: GeneratorUtil.randomToolsetName(),
      version: GeneratorUtil.randomEntityVersion(),
      description: `${shortDescription}\n\n${longDescription}`,
      endpoint: `http://${GeneratorUtil.randomString(7)}.com`,
      allowedTools: [
        GeneratorUtil.randomString(5),
        GeneratorUtil.randomString(5),
      ],
      releaseDate: DateUtil.getCurrentLocalDate(),
      author: UserUtil.getE2EUsername(testInfo.parallelIndex),
    };

    const filename = `${ExpectedConstants.allowedSpecialChars}.svg`;
    const iconUrl = await fileApiHelper.putFileWithCustomName(
      filename,
      Attachment.appIconSvg,
    );
    const expectedIconUrl = `${API.api}/${iconUrl.substring(0, iconUrl.lastIndexOf('/') + 1)}${encodeURIComponent(filename)}`;

    let topicsToSelect: string[];
    let generalInfoStep: BaseElement;
    let toolsetSettingsStep: BaseElement;

    await dialTest.step(
      'Precondition: Create toolset via API to avoid inconsistent naming. Issue 4236',
      async () => {
        const toolsetModel = toolsetBuilder
          .withDisplayName(ExpectedConstants.defaultToolsetName)
          .withDisplayVersion(toolsetEntity.version)
          .build();
        toolsetForCleanup = await toolsetApiHelper.createToolset(toolsetModel);
      },
    );

    await dialTest.step(
      'Open My workspace directly, switch on "Toolsets" tab and verify "Add toolset" btn is available',
      async () => {
        await marketplacePage.openMyWorkspacePage({
          updateInstalledDeployments: false,
          getStyles: true,
        });
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.toolsetsTab.click();
        await marketplaceEntitiesAssertion.assertElementText(
          marketplaceHeader.addToolsetButton,
          ExpectedConstants.addToolsetButtonTitle,
        );
        await marketplaceEntitiesAssertion.assertElementState(
          marketplaceHeader.addToolsetButtonIcon,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Click on "Add toolset" btn and verify "General info" tab is opened',
      async () => {
        await marketplaceHeader.clickAddToolsetButton();
        await entityEditorPage.waitForPageLoaded(
          EntityEditorToolsetTypes.Toolset,
        );
        await entityEditorHeaderAssertion.assertActionTitle(
          EntityMenuActions.addToolset,
        );
      },
    );

    await dialTest.step(
      'Verify default Name and Version are pre-filled in the form and preview',
      async () => {
        await baseAssertion.assertElementState(
          entityEditorGeneralForm,
          'visible',
        );
        await entityEditorGeneralInfoPreviewToggleAssertion.assertToggleState(
          ToggleState.on,
        );
        await entityEditorGeneralInfoPreviewCard.previewName
          .getElementLocatorByText(defaultToolsetNamePattern)
          .waitFor();
        await baseAssertion.assertInputValue(
          entityEditorGeneralForm.name,
          defaultToolsetNamePattern,
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
      'Check that the required fields of General Info step form are marked with asterisks',
      async () => {
        for (const field of [
          EntityEditorGeneralFormFields.name,
          EntityEditorGeneralFormFields.version,
        ]) {
          const fieldRequiredIndicator =
            entityEditorGeneralForm.getRequiredIndicator(field);
          await baseAssertion.assertElementState(
            fieldRequiredIndicator,
            'visible',
            ExpectedMessages.applicationFormFieldShouldHaveAsterisk,
          );
        }
      },
    );

    await dialTest.step(
      'Verify header features are valid, "General info" step in the header is selected',
      async () => {
        generalInfoStep = entityEditorHeader.getGeneralInfoStep();
        toolsetSettingsStep = entityEditorHeader.getToolsetSettingsStep();
        await entityEditorHeaderAssertion.assertStepState(
          generalInfoStep,
          'visible',
          Cursors.default,
        );
        await entityEditorHeaderAssertion.assertStepState(
          toolsetSettingsStep,
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
          toolsetSettingsStep,
          false,
        );
        await entityEditorHeaderAssertion.assertNotActiveStepIconState(
          toolsetSettingsStep,
          'visible',
        );
      },
    );

    await dialTest.step('Fill in all the fields', async () => {
      await entityEditorGeneralForm.fillInEntityFields({
        name: toolsetEntity.name,
        version: toolsetEntity.version,
        description: toolsetEntity.description,
      });

      await entityEditorGeneralForm.topicsDropdownToggle.click();
      const allTopics = await listboxMenu.getAllOptions();
      topicsToSelect = allTopics
        .sort((a, b) => b.length - a.length)
        .slice(0, 2);
      for (const topic of topicsToSelect) {
        await listboxMenu.selectOption(topic);
      }
      await entityEditorGeneralForm.topicsDropdownToggle.click();

      await entityEditorGeneralForm.addIconButton.click();
      await attachFilesModal.checkAttachedFile(
        filename,
        FileModalSection.AllFiles,
      );
      await attachFilesModal.attachFiles();
    });

    await dialTest.step(
      'Verify toolset preview on the right side of General Info screen',
      async () => {
        await entityEditorGeneralInfoPreviewCardAssertion.assertPreviewCardAttributes(
          {
            expectedName: toolsetEntity.name,
            expectedIcon: expectedIconUrl,
            expectedShortDescription: shortDescription,
            expectedLongDescription: longDescription,
            expectedTopics: topicsToSelect,
            //TODO: enable when fixed https://github.com/epam/ai-dial-chat/issues/4998
            // expectedAuthor: toolsetEntity.author,
            //TODO: enable when fixed https://github.com/epam/ai-dial-chat/issues/3218
            // expectedReleaseDade: toolsetEntity.releaseDate,
          },
        );
      },
    );

    await dialTest.step(
      'Click Next and verify toolset settings are pre-filled in the form',
      async () => {
        await entityEditorGeneralForm.goNext({
          hostsArray: [API.toolsetCreateHost(), API.installedToolsetsHost()],
        });
        await baseAssertion.assertElementState(
          customAppEditorAppSettingsPreviewBody.previewSpinner,
          'hidden',
        );
        await toolsetEditorViewFormAssertion.assertToolsetEditorViewFormAttributes(
          {
            endpoint: '',
            transportProtocol: ToolsetTransportType.SSE,
            availableAuthTypes: Object.values(ToolsetAuthTypes),
            selectedAuthType: ToolsetAuthTypes.NONE,
            allowedTools: [],
          },
        );
      },
    );

    await dialTest.step(
      'Check that the required fields of Tools settings step form are marked with asterisks',
      async () => {
        for (const field of [
          ExpectedConstants.endpointLabel,
          ExpectedConstants.transportProtocol,
        ]) {
          const fieldRequiredIndicator =
            toolsetEditorViewForm.getRequiredIndicator(field);
          await baseAssertion.assertElementState(
            fieldRequiredIndicator,
            'visible',
            ExpectedMessages.applicationFormFieldShouldHaveAsterisk,
          );
        }
      },
    );

    await dialTest.step(
      'Verify header features are valid, "Tools settings" step in the header is selected',
      async () => {
        await entityEditorHeaderAssertion.assertStepState(
          generalInfoStep,
          'visible',
          Cursors.pointer,
        );
        await entityEditorHeaderAssertion.assertStepState(
          toolsetSettingsStep,
          'visible',
          Cursors.default,
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
          toolsetSettingsStep,
          true,
        );
        await entityEditorHeaderAssertion.assertActiveStepIconState(
          toolsetSettingsStep,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Fill in all the fields except Authentication part',
      async () => {
        await toolsetEditorViewForm.endpoint.fillInInput(
          toolsetEntity.endpoint,
        );
        for (const tool of toolsetEntity.allowedTools) {
          await toolsetEditorViewForm.allowedTools.comboboxInput.fillInInput(
            tool,
          );
          await page.keyboard.press(keys.enter);
        }
      },
    );

    await dialTest.step(
      'Verify toolset preview on the right side of "Toolset settings" screen',
      async () => {
        await toolsetEditorSettingsPreviewToggleAssertion.assertToggleState(
          ToggleState.on,
        );
        await toolsetEditorSettingsPreviewCardAssertion.assertPreviewCardAttributes(
          {
            expectedName: toolsetEntity.name,
            expectedIcon: expectedIconUrl,
            expectedShortDescription: shortDescription,
            expectedLongDescription: longDescription,
            expectedTopics: topicsToSelect,
            //TODO: enable when fixed https://github.com/epam/ai-dial-chat/issues/4998
            // expectedAuthor: toolsetEntity.author,
            expectedReleaseDate: toolsetEntity.releaseDate,
          },
        );
      },
    );

    await dialTest.step(
      'Click on "Save and Exit" btn and verify user is redirected on My workspace page',
      async () => {
        await entityEditorHeader.focusOn();
        await entityEditorHeader.saveAndExitButton.click();
        await baseAssertion.assertElementState(toolsetEditorViewForm, 'hidden');
        await marketplacePage.waitForPageLoaded();
      },
    );

    await dialTest.step('Verify toolset modal details', async () => {
      await entityDetailsModalAssertion.assertElementState(
        entityDetailsModal,
        'visible',
      );
      await entityDetailsModalAssertion.assertEntityCommonAttributes({
        expectedName: toolsetEntity.name,
        expectedVersion: toolsetEntity.version,
        expectedDescription: toolsetEntity.description,
        expectedReleaseDate: toolsetEntity.releaseDate,
        expectedAuthor: toolsetEntity.author,
        expectedTopics: topicsToSelect,
        expectedIcon: expectedIconUrl,
      });
      for (const element of [
        entityDetailsModal.editButton,
        entityDetailsModal.publishButton,
        entityDetailsModal.deleteButton,
      ]) {
        await entityDetailsModalAssertion.assertElementState(
          element,
          'visible',
        );
      }
      for (const element of [
        entityDetailsModal.shareButton,
        entityDetailsModal.useButton,
        entityDetailsModal.loginButton,
      ]) {
        await entityDetailsModalAssertion.assertElementState(element, 'hidden');
      }
      await entityDetailsModal.closeButton.click();
    });

    await dialTest.step(
      'Open toolset card menu and verify "Login with my creds" option is not available',
      async () => {
        await marketplaceHeader.searchInput.fillInInput(toolsetEntity.name);
        const toolsetElement =
          await marketplaceEntitiesSection.findEntityElement(
            toolsetEntity.name,
            { isWorkspaceEntity: true, isEditable: true },
          );
        await toolsetElement.hoverOver();
        await marketplaceEntities
          .getEntityElementDotsMenu(toolsetElement)
          .click();
        const allMenuOptions = await marketplaceEntities
          .getEntityDropdownMenu()
          .getAllMenuOptions();
        marketplaceEntitiesAssertion.assertArrayExcludesAll(
          allMenuOptions,
          [MenuOptions.loginWithMyCreds],
          ExpectedMessages.contextMenuOptionIsNotAvailable,
        );
      },
    );
  },
);

dialTest(
  '[Toolset]: toolset with default name and version is saved correctly.\n' +
    '[Toolset]: cards are not duplicated for each saved changes when edit toolset several times.\n' +
    '[App editor]: Release date displayed on detailed preview on "General info" step when edit toolset.\n' +
    '[Toolset]: add 2 toolsets with the same name and different versions - not published toolsets grouped by name',
  async (
    {
      marketplacePage,
      marketplaceHeader,
      marketplaceEntitiesSection,
      marketplaceEntitiesAssertion,
      toolsetBuilder,
      entityEditorPage,
      entityEditorHeader,
      entityDetailsModal,
      setTestIds,
      baseAssertion,
      toolsetEditorViewForm,
      marketplace,
      entityEditorGeneralInfoPreviewToggleAssertion,
      entityEditorGeneralInfoPreview,
      entityDetailsModalAssertion,
      customAppEditorAppSettingsPreviewBody,
      entityEditorGeneralForm,
      entityEditorGeneralInfoPreviewCardAssertion,
      entityEditorGeneralInfoPreviewCard,
      toolsetApiHelper,
      entityVersionsDropdownMenuAssertion,
    },
    testInfo,
  ) => {
    setTestIds('EPMRTC-6874', 'EPMRTC-6870', 'EPMRTC-6889', 'EPMRTC-6886');
    const toolsetEntity = {
      name: '',
      version: ExpectedConstants.defaultEntityVersion,
      endpoint: `http://${GeneratorUtil.randomString(7)}.com`,
      releaseDate: DateUtil.getCurrentLocalDate(),
      author: UserUtil.getE2EUsername(testInfo.parallelIndex),
    };
    let defaultName: string;
    const secondToolsetVersion = GeneratorUtil.randomEntityVersion();
    const sortedVersions = SortingUtil.sortVersionsArray([
      toolsetEntity.version,
      secondToolsetVersion,
    ]);

    await dialTest.step(
      'Precondition: Create toolset via API to avoid inconsistent naming. Issue 4236',
      async () => {
        const toolsetModel = toolsetBuilder
          .withDisplayName(ExpectedConstants.defaultToolsetName)
          .withDisplayVersion(toolsetEntity.version)
          .build();
        toolsetForCleanup = await toolsetApiHelper.createToolset(toolsetModel);
      },
    );

    await dialTest.step(
      'Open My workspace directly, switch on "Toolsets" tab and click on "Add toolset" btn',
      async () => {
        await marketplacePage.openMyWorkspacePage({
          updateInstalledDeployments: false,
          getStyles: true,
        });
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.toolsetsTab.click();
        await marketplaceHeader.clickAddToolsetButton();
        await entityEditorPage.waitForPageLoaded(
          EntityEditorToolsetTypes.Toolset,
        );
      },
    );

    await dialTest.step('Leave the fields as is and click Next', async () => {
      await entityEditorGeneralInfoPreviewCard.previewName
        .getElementLocatorByText(defaultToolsetNamePattern)
        .waitFor();
      defaultName = await entityEditorGeneralForm.name.getElementInputValue();
      toolsetEntity.name = defaultName!;
      await entityEditorGeneralForm.goNext({
        hostsArray: [API.toolsetCreateHost(), API.installedToolsetsHost()],
      });
      await baseAssertion.assertElementState(
        customAppEditorAppSettingsPreviewBody.previewSpinner,
        'hidden',
      );
    });

    await dialTest.step(
      'Fill in Endpoint field, click "Save and exit" and verify toolset is successfully created',
      async () => {
        await toolsetEditorViewForm.endpoint.fillInInput(
          toolsetEntity.endpoint,
        );
        await entityEditorHeader.focusOn();
        await entityEditorHeader.saveAndExitButton.click();
        await baseAssertion.assertElementState(toolsetEditorViewForm, 'hidden');
        await marketplacePage.waitForPageLoaded();
        await entityDetailsModalAssertion.assertElementState(
          entityDetailsModal,
          'visible',
        );
        await entityDetailsModalAssertion.assertEntityCommonAttributes({
          expectedName: toolsetEntity.name,
          expectedVersion: toolsetEntity.version,
          expectedReleaseDate: toolsetEntity.releaseDate,
          expectedAuthor: toolsetEntity.author,
          expectedIcon: entityDetailsModal.defaultToolsetIcon,
        });
      },
    );

    await dialTest.step(
      'Click on "Edit" icon and navigate to "General info" step',
      async () => {
        await entityDetailsModal.clickEditButton({
          triggeredHttpMethod: 'GET',
        });
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorToolsetTypes.Toolset,
        );
        await entityEditorHeader.goOnGeneralInfoStepWithHeaderStepper({
          isHttpMethodTriggered: false,
        });
        await entityEditorGeneralInfoPreview.waitForState();
      },
    );

    await dialTest.step(
      'Verify "Detailed view" is on and "Release date" is displayed on the preview card',
      async () => {
        await entityEditorGeneralInfoPreviewToggleAssertion.assertToggleState(
          ToggleState.on,
        );
        await entityEditorGeneralInfoPreviewCardAssertion.assertPreviewCardAttributes(
          {
            expectedReleaseDate: toolsetEntity.releaseDate,
          },
        );
      },
    );

    await dialTest.step(
      'Update toolset name, save changes and verify existing toolset is not duplicated',
      async () => {
        toolsetEntity.name = GeneratorUtil.randomToolsetName();
        await entityEditorGeneralForm.fillInEntityFields({
          name: toolsetEntity.name,
        });
        await marketplacePage.waitForExpectedResponses(
          () => entityEditorHeader.saveAndExitButton.click(),
          [
            { apiMethod: 'POST', urlPattern: API.moveHost },
            { apiMethod: 'GET', urlPattern: toolsetEntity.name },
          ],
        );
        await marketplacePage.waitForPageLoaded();
        await entityDetailsModal.closeButton.click();
        await marketplaceHeader.searchInput.fillInInput(toolsetEntity.name);
        const toolsetElement =
          await marketplaceEntitiesSection.findEntityElement(
            toolsetEntity.name,
            { isWorkspaceEntity: true, isEditable: true },
          );
        await marketplaceEntitiesAssertion.assertElementState(
          toolsetElement,
          'visible',
        );
        await marketplaceHeader.searchInput.fillInInput(defaultName);
        await marketplaceEntitiesAssertion.assertElementText(
          marketplace.noResultsFound,
          ExpectedConstants.noResults,
        );
      },
    );

    await dialTest.step(
      'Create one more toolset with the same name but different version via API',
      async () => {
        const toolsetModel = toolsetBuilder
          .withDisplayName(toolsetEntity.name)
          .withDisplayVersion(secondToolsetVersion)
          .build();
        await toolsetApiHelper.createToolset(toolsetModel);
      },
    );

    await dialTest.step(
      'Find the toolset by name and verify one card with 2 versions is found',
      async () => {
        await marketplacePage.reloadPage();
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.searchInput.fillInInput(toolsetEntity.name);
        const toolsetElement =
          await marketplaceEntitiesSection.findEntityElement(
            toolsetEntity.name,
            { isWorkspaceEntity: true, isEditable: true },
          );
        await toolsetElement.click();
        await entityDetailsModalAssertion.assertEntityVersion(
          sortedVersions[0],
        );
        await entityDetailsModalAssertion.assertElementState(
          entityDetailsModal.versionMenuTrigger,
          'visible',
        );
        await entityDetailsModal.versionMenuTrigger.click();
        await entityVersionsDropdownMenuAssertion.assertMenuOptions(
          sortedVersions,
        );
      },
    );
  },
);

dialTest(
  '[Toolset]: message on Toolsets tab if no any toolset is created',
  async ({
    marketplacePage,
    marketplace,
    marketplaceEntitiesAssertion,
    marketplaceHeader,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-6972');

    await dialTest.step(
      'Open My workspace directly, switch on "Toolsets" tab and verify "No toolset" label is displayed set some filters and search word',
      async () => {
        await marketplacePage.openMyWorkspacePage({
          updateInstalledDeployments: false,
          getStyles: true,
        });
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.toolsetsTab.click();
        await marketplaceEntitiesAssertion.assertElementText(
          marketplace.noDataHeader,
          ExpectedConstants.noToolsetsHeader,
        );
        await marketplaceEntitiesAssertion.assertElementText(
          marketplace.noResultsFoundDescription,
          ExpectedConstants.noToolsetsLabel,
        );
        await marketplaceEntitiesAssertion.assertElementState(
          marketplace.noToolsetsIcon,
          'visible',
        );
      },
    );
  },
);

dialTest(
  'Card detailed view is open when user redirected back to My workspace (where search and filters are applied) after creating toolset.\n' +
    '[Toolset]:Endpoint url is save after login failed.\n' +
    "Tooltip for long toolset's name displayed in several lines",
  async ({
    marketplacePage,
    toolsetBuilder,
    toolsetApiHelper,
    marketplaceHeader,
    marketplaceFilter,
    marketplaceEntitiesSection,
    marketplaceEntities,
    entityEditorPage,
    entityEditorHeader,
    entityDetailsModal,
    setTestIds,
    baseAssertion,
    toast,
    toolsetEditorViewForm,
    toolsetEditorViewFormAssertion,
    toastAssertion,
    customAppEditorAppSettingsPreviewBody,
    entityEditorGeneralForm,
    tooltipAssertion,
  }) => {
    setTestIds('EPMRTC-7312', 'EPMRTC-6996', 'EPMRTC-6890');
    const toolsetEntity = {
      name: GeneratorUtil.randomToolsetName(),
      version: ExpectedConstants.defaultEntityVersion,
      endpoint: ExpectedConstants.mcpServerUrl,
    };
    let checkedOption: string;
    let toolsetElement: BaseElement;

    await dialTest.step(
      `Precondition: Create toolset via API to make filter's panel available`,
      async () => {
        //TODO: remove topic from the builder when fixed https://github.com/epam/ai-dial-chat/issues/5085
        const toolsetModel = toolsetBuilder
          .withDisplayName(GeneratorUtil.randomToolsetName())
          .withDescriptionKeywords(GeneratorUtil.randomString(5))
          .build();
        toolsetForCleanup = await toolsetApiHelper.createToolset(toolsetModel);
      },
    );

    await dialTest.step(
      'Open My workspace directly, set some filters and search word',
      async () => {
        await marketplacePage.openMyWorkspacePage({
          updateInstalledDeployments: false,
          getStyles: true,
        });
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.toolsetsTab.click();
        await marketplaceHeader.searchInput.fillInInput(toolsetEntity.name);
        //TODO: replace Topics filter with Sources when fixed https://github.com/epam/ai-dial-chat/issues/5085
        const filterOptions =
          await marketplaceFilter.filterByPropertyOptionLabels(
            MarketplaceFilterTypes.topics,
          );
        checkedOption = GeneratorUtil.randomArrayElement(filterOptions);
        await marketplaceFilter
          .filterByPropertyOptionInput(
            MarketplaceFilterTypes.topics,
            checkedOption,
          )
          .click();
      },
    );

    await dialTest.step(
      'Click on "Add toolset" btn and proceed to "Toolset settings" step',
      async () => {
        await marketplaceHeader.clickAddToolsetButton();
        await entityEditorPage.waitForPageLoaded(
          EntityEditorToolsetTypes.Toolset,
        );
        await entityEditorGeneralForm.fillInEntityFields({
          name: toolsetEntity.name,
        });
        await entityEditorGeneralForm.goNext({
          hostsArray: [API.toolsetCreateHost(), API.installedToolsetsHost()],
        });
        await baseAssertion.assertElementState(
          customAppEditorAppSettingsPreviewBody.previewSpinner,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Set Endpoint field value that do not support OAuth, select "OAuth" authentication, click "Log in" and verify error toast is shown',
      async () => {
        await toolsetEditorViewForm.endpoint.fillInInput(
          toolsetEntity.endpoint,
        );
        await toolsetEditorViewForm.oauthContainer.click();
        await toolsetEditorViewForm.clickSignInButton();
        await toastAssertion.assertToastIsVisible();
        await toastAssertion.assertToastMessage(
          ExpectedConstants.oAuthNotSupportedError,
        );
        await toast.closeToast();
        await entityEditorHeader.saveAndExitButton.click();
        await baseAssertion.assertElementState(toolsetEditorViewForm, 'hidden');
      },
    );

    await dialTest.step(
      'Verify filter and search word are preserved',
      async () => {
        await entityDetailsModal.closeButton.click();
        await baseAssertion.assertElementAttribute(
          marketplaceHeader.searchInput,
          Attributes.value,
          toolsetEntity.name,
        );
        await baseAssertion.assertCheckboxState(
          marketplaceFilter.filterByPropertyOptionInput(
            MarketplaceFilterTypes.topics,
            checkedOption,
          ),
          CheckboxState.checked,
        );
      },
    );

    await dialTest.step(
      'Find created toolset, hover over the icon and verify name displaying on the tooltip',
      async () => {
        await marketplaceFilter
          .filterByPropertyOptionInput(
            MarketplaceFilterTypes.topics,
            checkedOption,
          )
          .click();
        toolsetElement = await marketplaceEntitiesSection.findEntityElement(
          toolsetEntity.name,
          { isWorkspaceEntity: true, isEditable: true },
        );
        await marketplaceEntities
          .getToolsetDefaultIcon(toolsetElement)
          .hoverOver();
        await tooltipAssertion.assertTooltipStyle(
          Styles.overflow_wrap,
          StyleValues.breakWord,
        );
        await tooltipAssertion.assertTooltipStyle(
          Styles.wordBreak,
          StyleValues.breakWord,
        );
      },
    );

    await dialTest.step(
      'Open the toolset and verify entered endpoint is preserved',
      async () => {
        await toolsetElement.hoverOver();
        await marketplaceEntities
          .getEntityElementDotsMenu(toolsetElement)
          .click();
        await marketplaceEntities
          .getEntityDropdownMenu()
          .selectMenuOption(MenuOptions.edit, {
            isHttpMethodTriggered: true,
            triggeredHttpMethod: 'GET',
          });
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorToolsetTypes.Toolset,
        );
        await toolsetEditorViewFormAssertion.assertToolsetEditorViewFormAttributes(
          { endpoint: toolsetEntity.endpoint },
        );
      },
    );
  },
);

dialTest.afterEach(
  'Teardown: Delete created toolset via API',
  async ({ itemApiHelper }) => {
    if (toolsetForCleanup) {
      await itemApiHelper.deleteBackendItem(toolsetForCleanup);
      toolsetForCleanup = undefined;
    }
  },
);
