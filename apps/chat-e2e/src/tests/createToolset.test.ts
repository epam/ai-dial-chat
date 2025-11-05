import { BackendEntity } from '@/chat/types/common';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  Attachment,
  EntityEditorGeneralFormFields,
  EntityEditorToolsetTypes,
  EntityMenuActions,
  ExpectedConstants,
  ExpectedMessages,
} from '@/src/testData';
import { Cursors } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
import { BaseElement, FileModalSection } from '@/src/ui/webElements';
import { DateUtil, GeneratorUtil, UserUtil } from '@/src/utils';
import { ToolsetAuthTypes, ToolsetTransportType } from '@epam/ai-dial-shared';

let toolsetForCleanup: BackendEntity | undefined;

dialTest(
  'Create toolset - basic scenario',
  async (
    {
      marketplacePage,
      marketplaceHeader,
      marketplaceAgentsAssertion,
      toolsetBuilder,
      entityEditorPage,
      entityEditorHeader,
      entityDetailsModal,
      setTestIds,
      baseAssertion,
      toolsetEditorViewForm,
      entityEditorHeaderAssertion,
      localStorageManager,
      entityDetailsModalAssertion,
      customAppEditorAppSettingsPreviewBody,
      entityEditorGeneralForm,
      toolsetEditorViewFormAssertion,
      listboxMenu,
      attachFilesModal,
      entityEditorGeneralInfoPreview,
      entityEditorGeneralInfoPreviewCardAssertion,
      toolsetEditorSettingsPreviewCardAssertion,
      entityEditorGeneralInfoPreviewCard,
      fileApiHelper,
      toolsetApiHelper,
      page,
    },
    testInfo,
  ) => {
    setTestIds('EPMRTC-6877');
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
    const imageUrl = await fileApiHelper.putFile(Attachment.sunImageName);
    const expectedImageUrl = `${API.api}/${imageUrl}`;
    let topicsToSelect: string[];
    let generalInfoStep: BaseElement;
    let toolsetSettingsStep: BaseElement;
    await localStorageManager.setShowSideBarPanels();

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
        await marketplaceAgentsAssertion.assertElementText(
          marketplaceHeader.addToolsetButton,
          ExpectedConstants.addToolsetButtonTitle,
        );
        await marketplaceAgentsAssertion.assertElementState(
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
        Attachment.sunImageName,
        FileModalSection.AllFiles,
      );
      await attachFilesModal.attachFiles();
    });

    await dialTest.step(
      'Verify toolset preview on the right side of General Info screen',
      async () => {
        //TODO: remove view switching when fixed https://github.com/epam/ai-dial-chat/issues/4576
        await entityEditorGeneralInfoPreview
          .getEntityEditorPreviewToggle()
          .detailedSwitch.click();
        await entityEditorGeneralInfoPreviewCardAssertion.assertPreviewCardAttributes(
          {
            expectedName: toolsetEntity.name,
            expectedIcon: expectedImageUrl,
            expectedShortDescription: shortDescription,
            expectedLongDescription: longDescription,
            expectedTopics: topicsToSelect,
            //TODO: enable when fixed https://github.com/epam/ai-dial-chat/issues/4998
            // expectedAuthor: UserUtil.getE2EUsername(testInfo.parallelIndex),
            //TODO: enable when fixed https://github.com/epam/ai-dial-chat/issues/3218
            // expectedReleaseDade: DateUtil.getCurrentLocalDate(),
          },
        );
      },
    );

    await dialTest.step(
      'Click Next and verify toolset settings are pre-filled in the form',
      async () => {
        await entityEditorGeneralForm.goNext({
          hostsArray: [API.toolsetCreateHost, API.installedToolsetsHost()],
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
        await toolsetEditorSettingsPreviewCardAssertion.assertPreviewCardAttributes(
          {
            expectedName: toolsetEntity.name,
            expectedIcon: expectedImageUrl,
            expectedShortDescription: shortDescription,
            expectedLongDescription: longDescription,
            expectedTopics: topicsToSelect,
            //TODO: enable when fixed https://github.com/epam/ai-dial-chat/issues/4998
            // expectedAuthor: toolsetEntity.author,
            expectedReleaseDade: toolsetEntity.releaseDate,
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
        expectedReleaseDade: toolsetEntity.releaseDate,
        //TODO: enable when fixed https://github.com/epam/ai-dial-chat/issues/5012
        // expectedAuthor: toolsetEntity.author,
        expectedTopics: topicsToSelect,
        expectedIcon: '',
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
      ]) {
        await entityDetailsModalAssertion.assertElementState(element, 'hidden');
      }
    });
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
