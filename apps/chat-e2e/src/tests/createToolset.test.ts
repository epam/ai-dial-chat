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
import { OAuthMockHelper } from '@/src/testData/toolsets/oauthMockHelper';
import { Attributes, Cursors } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
import { BaseElement } from '@/src/ui/webElements';
import {
  DateUtil,
  GeneratorUtil,
  SortingUtil,
  UserUtil,
  filenamePrefix,
} from '@/src/utils';
import {
  Toolset,
  ToolsetAuthTypes,
  ToolsetTransportType,
} from '@epam/ai-dial-shared';

let toolsetForCleanup: BackendEntity | undefined;
const defaultToolsetNamePattern = new RegExp(
  `${ExpectedConstants.defaultToolsetName} \\d+`,
);

dialTest(
  'Create toolset - basic scenario.\n' +
    '[Editor]: detailed card view is displayed by default on Preview side.\n' +
    `[Toolset]: toolset's card is open on My Workspace page when create toolset and click "save and exit" (without login).\n` +
    `Icon is shown on the toolset's card if the svg contains some special chars.\n` +
    '[Toolsets] Create toolset without authentication.\n' +
    '[Toolset]: Login option is not displayed for toolsets without authentication.\n' +
    '[Toolset]: connect option is available from context menu',
  async (
    {
      marketplacePage,
      marketplaceHeader,
      marketplaceEntitiesSection,
      marketplaceEntities,
      toolsetBuilder,
      entityEditorPage,
      entityEditorHeader,
      entityDetailsModal,
      setTestIds,
      baseAssertion,
      toolsetEditorViewForm,
      entityEditorHeaderAssertion,
      entityDetailsModalAssertion,
      entityEditorGeneralForm,
      toolsetEditorViewFormAssertion,
      listboxMenu,
      fileManagerModal,
      fileManagerModalGrid,
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
      'EPMDIAL-5355',
      'EPMDIAL-5359',
      'EPMDIAL-5352',
      'EPMDIAL-5354',
      'EPMDIAL-5416',
      'EPMDIAL-5362',
      'EPMDIAL-5622',
    );
    const shortDescription = GeneratorUtil.randomShortDescription();
    const longDescription = GeneratorUtil.randomLongDescription();
    const toolsetEntity = {
      name: GeneratorUtil.randomToolsetName(),
      version: GeneratorUtil.randomEntityVersion(),
      description: `${shortDescription}\n\n${longDescription}`,
      endpoint: GeneratorUtil.randomUrl(),
      allowedTools: [
        GeneratorUtil.randomString(5),
        GeneratorUtil.randomString(5),
      ],
      releaseDate: DateUtil.getCurrentLocalDate(),
      author: UserUtil.getE2EUsername(testInfo.parallelIndex),
    };

    const filename = `${filenamePrefix}${ExpectedConstants.allowedSpecialChars}.svg`;
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
        await baseAssertion.assertElementText(
          marketplaceHeader.addToolsetButton,
          ExpectedConstants.addToolsetButtonTitle,
        );
        await baseAssertion.assertElementState(
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
        const defaultToolsetNamePattern = new RegExp(
          `${ExpectedConstants.defaultToolsetName} \\d+`,
        );
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
            ExpectedMessages.entityFormFieldShouldHaveAsterisk,
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

      await entityEditorGeneralForm.topicsDropdownDownIcon.click();
      const allTopics = await listboxMenu.getAllOptions();
      topicsToSelect = allTopics
        .sort((a, b) => b.length - a.length)
        .slice(0, 2);
      for (const topic of topicsToSelect) {
        await listboxMenu.selectOption(topic);
      }
      await entityEditorGeneralForm.topicsDropdownUpIcon.click();

      await entityEditorGeneralForm.addIconButton.click();
      const attachmentCheckbox =
        await fileManagerModalGrid.gridCheckboxByNameCell(filename);
      await attachmentCheckbox.click();
      await fileManagerModal.getSelectButton().click();
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
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorToolsetTypes.Toolset,
        );
        await toolsetEditorViewFormAssertion.assertToolsetEditorViewFormAttributes(
          {
            endpoint: '',
            transportProtocol: ToolsetTransportType.HTTP,
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
        const fieldRequiredIndicator =
          toolsetEditorViewForm.getRequiredIndicator(
            ExpectedConstants.endpointLabel,
          );
        await baseAssertion.assertElementState(
          fieldRequiredIndicator,
          'visible',
          ExpectedMessages.entityFormFieldShouldHaveAsterisk,
        );
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
      'Open toolset card menu and verify "Login with my creds" option is not available, "Connect" option is presented',
      async () => {
        await marketplaceHeader
          .getSearch()
          .inputField.fillInInput(toolsetEntity.name);
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
        baseAssertion.assertArrayExcludesAll(
          allMenuOptions,
          [MenuOptions.loginWithMyCreds],
          ExpectedMessages.contextMenuOptionIsNotAvailable,
        );
        baseAssertion.assertArrayIncludesAll(
          allMenuOptions,
          [MenuOptions.connect],
          ExpectedMessages.contextMenuOptionIsAvailable,
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
    setTestIds('EPMDIAL-5357', 'EPMDIAL-5356', 'EPMDIAL-5360', 'EPMDIAL-5358');
    const toolsetEntity = {
      name: '',
      version: ExpectedConstants.defaultEntityVersion,
      endpoint: GeneratorUtil.randomUrl(),
      releaseDate: DateUtil.getCurrentLocalDate(),
      author: UserUtil.getE2EUsername(testInfo.parallelIndex),
    };
    let defaultName: string;
    const secondToolsetVersion = GeneratorUtil.randomEntityVersion();
    const sortedVersions = SortingUtil.sortVersionsArray([
      toolsetEntity.version,
      secondToolsetVersion,
    ]);
    let searchInput: BaseElement;

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
        searchInput = marketplaceHeader.getSearch().inputField;
        await searchInput.fillInInput(toolsetEntity.name);
        const toolsetElement =
          await marketplaceEntitiesSection.findEntityElement(
            toolsetEntity.name,
            { isWorkspaceEntity: true, isEditable: true },
          );
        await baseAssertion.assertElementState(toolsetElement, 'visible');
        await searchInput.fillInInput(defaultName);
        await baseAssertion.assertElementText(
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
        await searchInput.fillInInput(toolsetEntity.name);
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
    baseAssertion,
    marketplaceHeader,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-5343');

    await dialTest.step(
      'Open My workspace directly, switch on "Toolsets" tab and verify "No toolset" label is displayed set some filters and search word',
      async () => {
        await marketplacePage.openMyWorkspacePage({
          updateInstalledDeployments: false,
          getStyles: true,
        });
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.toolsetsTab.click();
        await baseAssertion.assertElementText(
          marketplace.noDataHeader,
          ExpectedConstants.noToolsetsHeader,
        );
        await baseAssertion.assertElementText(
          marketplace.noResultsFoundDescription,
          ExpectedConstants.noToolsetsLabel,
        );
        await baseAssertion.assertElementState(
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
    tooltip,
    tooltipAssertion,
    page,
  }) => {
    setTestIds('EPMDIAL-5366', 'EPMDIAL-5361', 'EPMDIAL-5345');
    const toolsetEntity = {
      name: GeneratorUtil.randomToolsetName(),
      version: ExpectedConstants.defaultEntityVersion,
      endpoint: GeneratorUtil.randomUrl(),
    };
    let initialToolset: Toolset;
    let checkedOption: string;
    let toolsetElement: BaseElement;
    let oauthMockHelper: OAuthMockHelper;
    let searchInput: BaseElement;

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
        searchInput = marketplaceHeader.getSearch().inputField;
        await searchInput.fillInInput(toolsetEntity.name);
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
        initialToolset = (await toolsetApiHelper.getToolset(
          toolsetEntity.name,
          toolsetEntity.version,
        ))!;
      },
    );

    await dialTest.step(
      'Mock update toolset response to return 400 error code',
      async () => {
        oauthMockHelper = new OAuthMockHelper(
          page,
          initialToolset,
          toolsetEntity.endpoint,
          { updateToolsetCode: 400 },
        );
        await oauthMockHelper.setupToolsetRoutes();
        oauthMockHelper.enableMocking();
      },
    );

    await dialTest.step(
      'Set Endpoint field value, select "OAuth" authentication, click "Log in" and verify error toast is shown',
      async () => {
        await toolsetEditorViewForm.endpoint.fillInInput(
          toolsetEntity.endpoint,
        );
        await toolsetEditorViewForm.oauthContainer.click();
        await toolsetEditorViewForm.loginButton.click();
        await oauthMockHelper.cleanup();
        await toastAssertion.assertToastIsVisible();
        await toastAssertion.assertToastMessage(
          ExpectedConstants.oAuthNotSupportedError,
        );
        await toast.closeToast();
        await entityEditorPage.waitForExpectedResponses(
          () => entityEditorHeader.saveAndExitButton.click(),
          [
            {
              apiMethod: 'PUT',
              urlPattern: toolsetEntity.name,
            },
            { apiMethod: 'GET', urlPattern: toolsetEntity.name },
          ],
        );
        await baseAssertion.assertElementState(toolsetEditorViewForm, 'hidden');
      },
    );

    await dialTest.step(
      'Verify filter and search word are preserved',
      async () => {
        await entityDetailsModal.closeButton.click();
        await baseAssertion.assertElementAttribute(
          searchInput,
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
      'Find created toolset, hover over the icon and verify no tooltip is displayed',
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
        await tooltipAssertion.assertElementState(tooltip, 'hidden');
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
