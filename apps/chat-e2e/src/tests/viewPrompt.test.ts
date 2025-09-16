import { Prompt } from '@/chat/types/prompt';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  ExpectedConstants,
  ExpectedPromptModalConst,
} from '@/src/testData';
import { ThemeColorAttributes } from '@/src/ui/domData';
import { DateUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';

dialTest(
  '[View prompt] View prompt modal is opened on click.\n' +
    '[View prompt] Prompt with parameters is purple-highlighted.\n' +
    '[View prompt] Info.\n' +
    '[View prompt] Duplicate.\n' +
    '[View prompt] Export.\n' +
    '[View prompt] Move to.\n' +
    '[View prompt] Share.\n' +
    '[View prompt] Publish.\n' +
    '[View prompt] Delete',
  async ({
    dialHomePage,
    promptData,
    dataInjector,
    prompts,
    promptPreviewModal,
    promptPreviewModalAssertion,
    selectFolderModalAssertion,
    promptBarFolderAssertion,
    selectFolders,
    selectFoldersAssertion,
    selectFolderModal,
    tooltipAssertion,
    setTestIds,
    localStorageManager,
    downloadAssertion,
    shareModal,
    shareModalAssertion,
    publishingRequestModal,
    publishingRequestModalAssertion,
    informationModal,
    informationModalAssertion,
    baseAssertion,
    confirmationDialog,
    confirmationDialogAssertion,
  }) => {
    setTestIds(
      'EPMRTC-6144',
      'EPMRTC-6139',
      'EPMRTC-6153',
      'EPMRTC-6148',
      'EPMRTC-6149',
      'EPMRTC-6150',
      'EPMRTC-6151',
      'EPMRTC-6152',
      'EPMRTC-6154',
    );
    let prompt: Prompt;
    const aVar = 'a';
    const aVarDefaultValue = '5';
    const bVar = 'b';
    const bVarDefaultValue = '4';
    const promptTemplate = (a: string, b: string) => `${a} - ${b} =`;
    const content = promptTemplate(
      `{{${aVar}|${aVarDefaultValue}}}`,
      `{{${bVar}|${bVarDefaultValue}}}`,
    );
    const newFolderName = ExpectedConstants.newFolderWithIndexTitle(1);
    const currentDate = DateUtil.getCurrentLocalDate();

    await dialTest.step(
      'Prepare a prompt with parametrized content',
      async () => {
        prompt = promptData.preparePrompt(content);
        await dataInjector.createPrompts([prompt]);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      `Click on created prompt and verify "View prompt" modal is opened`,
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await prompts.selectEntity(prompt.name, {
          isHttpMethodTriggered: true,
        });
        await promptPreviewModalAssertion.assertElementState(
          promptPreviewModal,
          'visible',
        );
        for (const variable of [
          aVar,
          aVarDefaultValue,
          bVar,
          bVarDefaultValue,
        ]) {
          await promptPreviewModalAssertion.assertElementColor(
            promptPreviewModal.promptContentVar(variable),
            ThemesUtil.getRgbColorByKey(
              ThemeColorAttributes.textAccentTertiary,
            ),
          );
        }
      },
    );

    await dialTest.step(
      'Hover over every button at the bottom panel and verify it is highlighted, tooltip is shown',
      async () => {
        for (const buttonWithLabel of [
          {
            button: promptPreviewModal.editPromptButton,
            tooltip: ExpectedPromptModalConst.editButtonTooltip,
          },
          {
            button: promptPreviewModal.promptDuplicateButton,
            tooltip: ExpectedPromptModalConst.duplicateButtonTooltip,
          },
          {
            button: promptPreviewModal.promptExportButton,
            tooltip: ExpectedPromptModalConst.exportButtonTooltip,
          },
          {
            button: promptPreviewModal.promptMoveToButton,
            tooltip: ExpectedPromptModalConst.moveToButtonTooltip,
          },
          {
            button: promptPreviewModal.promptShareButton,
            tooltip: ExpectedPromptModalConst.shareButtonTooltip,
          },
          {
            button: promptPreviewModal.promptPublishButton,
            tooltip: ExpectedPromptModalConst.publishButtonTooltip,
          },
          {
            button: promptPreviewModal.promptInfoButton,
            tooltip: ExpectedPromptModalConst.infoButtonTooltip,
          },
          {
            button: promptPreviewModal.promptDeleteButton,
            tooltip: ExpectedPromptModalConst.deleteButtonTooltip,
          },
        ]) {
          await buttonWithLabel.button.hoverOver();
          await promptPreviewModalAssertion.assertElementColor(
            buttonWithLabel.button,
            ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textAccentPrimary),
          );
          await tooltipAssertion.assertTooltipContent(buttonWithLabel.tooltip);
        }
      },
    );

    await dialTest.step('Verify prompt info can be viewed', async () => {
      await promptPreviewModal.openPromptInfo({ isHttpMethodTriggered: true });
      await baseAssertion.assertElementState(informationModal, 'visible');
      await informationModalAssertion.assertFields({
        createdDate: currentDate,
        lastUpdatedDate: currentDate,
      });
      await informationModal.cancelButton.click();
      await promptPreviewModalAssertion.assertPromptPreviewModalState(
        'visible',
      );
      await promptPreviewModalAssertion.assertElementState(
        promptPreviewModal.notFound,
        'hidden',
      );
    });

    await dialTest.step('Verify prompt can be duplicated', async () => {
      await promptPreviewModal.duplicatePrompt();
      await promptPreviewModalAssertion.assertElementText(
        promptPreviewModal.promptName,
        prompt.name + ' 1',
      );
    });

    await dialTest.step('Verify prompt can be exported', async () => {
      const exportedData = await dialHomePage.downloadData(() =>
        promptPreviewModal.promptExportButton.click(),
      );
      await downloadAssertion.assertDownloadFileExtension(
        exportedData,
        ExpectedConstants.exportedFileExtension,
      );
      await downloadAssertion.assertJsonFileIsDownloaded(exportedData);
      await promptPreviewModalAssertion.assertPromptPreviewModalState(
        'visible',
      );
      await promptPreviewModalAssertion.assertElementState(
        promptPreviewModal.notFound,
        'hidden',
      );
    });

    await dialTest.step(
      'Verify prompt can be moved to a new folder',
      async () => {
        await promptPreviewModal.promptMoveToButton.click();
        await selectFolderModalAssertion.assertElementState(
          selectFolderModal,
          'visible',
        );
        await selectFolderModal.newFolderButton.click();
        await selectFolders.getEditFolderInputActions().clickTickButton();
        await selectFoldersAssertion.assertFolderState(
          { name: newFolderName },
          'visible',
        );
        await selectFolderModal.clickSelectFolderButton({
          triggeredApiHost: API.promptHost,
        });
        await selectFolderModalAssertion.assertElementState(
          selectFolderModal,
          'hidden',
        );
        await promptPreviewModalAssertion.assertPromptPreviewModalState(
          'visible',
        );
        await promptPreviewModalAssertion.assertElementState(
          promptPreviewModal.notFound,
          'hidden',
        );
        await promptBarFolderAssertion.assertFolderEntityState(
          { name: newFolderName },
          { name: prompt.name, index: 1 },
          'visible',
        );
      },
    );

    await dialTest.step('Verify prompt can be shared', async () => {
      await promptPreviewModal.sharePrompt();
      await shareModalAssertion.assertModalState('visible');
      await shareModal.closeButton.click();
      await promptPreviewModalAssertion.assertPromptPreviewModalState(
        'visible',
      );
      await promptPreviewModalAssertion.assertElementState(
        promptPreviewModal.notFound,
        'hidden',
      );
    });

    await dialTest.step(
      'Verify prompt publishing request can be created',
      async () => {
        await promptPreviewModal.promptPublishButton.click();
        await publishingRequestModalAssertion.assertElementState(
          publishingRequestModal,
          'visible',
        );
        await publishingRequestModal.cancelButton.click();
        await promptPreviewModalAssertion.assertPromptPreviewModalState(
          'visible',
        );
        await promptPreviewModalAssertion.assertElementState(
          promptPreviewModal.notFound,
          'hidden',
        );
      },
    );

    await dialTest.step('Verify prompt deletion can be cancelled', async () => {
      await promptPreviewModal.promptDeleteButton.click();
      await confirmationDialogAssertion.assertElementState(
        confirmationDialog,
        'visible',
      );
      await confirmationDialog.cancelDialog();
      await promptPreviewModalAssertion.assertPromptPreviewModalState(
        'visible',
      );
      await promptPreviewModalAssertion.assertElementState(
        promptPreviewModal.notFound,
        'hidden',
      );
      await promptBarFolderAssertion.assertFolderEntityState(
        { name: newFolderName },
        { name: prompt.name, index: 1 },
        'visible',
      );
    });

    await dialTest.step('Verify prompt can be deleted', async () => {
      await promptPreviewModal.promptDeleteButton.click();
      await confirmationDialogAssertion.assertElementState(
        confirmationDialog,
        'visible',
      );
      await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
      await promptPreviewModalAssertion.assertPromptPreviewModalState('hidden');
      await promptBarFolderAssertion.assertFolderEntityState(
        { name: newFolderName },
        { name: prompt.name, index: 1 },
        'hidden',
      );
    });
  },
);
