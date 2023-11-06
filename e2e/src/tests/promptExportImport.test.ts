import { FolderInterface } from '@/src/types/folder';
import { Prompt } from '@/src/types/prompt';

import test from '@/e2e/src/core/fixtures';
import {
  ExpectedMessages,
  FolderPrompt,
  Import,
  MenuOptions,
} from '@/e2e/src/testData';
import { ImportPrompt } from '@/e2e/src/testData/conversationHistory/importPrompt';
import { UploadDownloadData } from '@/e2e/src/ui/pages';
import { FileUtil } from '@/e2e/src/utils';
import { expect } from '@playwright/test';

let folderPromptData: UploadDownloadData;
let rootPromptData: UploadDownloadData;
let newFolderPromptData: UploadDownloadData;
const newName = 'test prompt';
const newDescr = 'test description';
const newValue = 'what is {{A}}';

test(
  'Export and import prompt structure with all prompts.\n' +
    'Continue working with imported file. Add imported prompt to a message',
  async ({
    dialHomePage,
    setTestIds,
    localStorageManager,
    prompts,
    folderPrompts,
    promptBar,
    confirmationDialog,
    promptData,
    sendMessage,
  }) => {
    setTestIds('EPMRTC-883', 'EPMRTC-895');
    let promptsInsideFolder: FolderPrompt;
    let emptyFolder: FolderInterface;
    let promptOutsideFolder: Prompt;
    let exportedData: UploadDownloadData;
    const promptContent = 'test';

    await test.step('Prepare empty folder, folder with 2 prompts and another prompt in the root', async () => {
      emptyFolder = promptData.prepareFolder();
      promptData.resetData();

      promptsInsideFolder = promptData.preparePromptsInFolder(2);
      promptData.resetData();

      promptOutsideFolder = promptData.preparePrompt(promptContent);

      await localStorageManager.setFolders(
        emptyFolder,
        promptsInsideFolder.folders,
      );
      await localStorageManager.setPrompts(
        ...promptsInsideFolder.prompts,
        promptOutsideFolder,
      );
    });

    await test.step('Export all prompts using prompt bar Export button', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
      exportedData = await dialHomePage.downloadData(() =>
        promptBar.exportButton.click(),
      );
    });

    await test.step('Delete all prompts and folders, re-import again and verify they are displayed', async () => {
      await promptBar.deleteAllPrompts();
      await confirmationDialog.confirm();
      await dialHomePage.uploadData(exportedData, () =>
        promptBar.importButton.click(),
      );

      await folderPrompts
        .getFolderByName(promptsInsideFolder.folders.name)
        .waitFor();
      await folderPrompts.getFolderByName(emptyFolder.name).waitFor();
      await prompts.getPromptByName(promptOutsideFolder.name).waitFor();

      await folderPrompts.expandCollapseFolder(
        promptsInsideFolder.folders.name,
      );
      for (const prompt of promptsInsideFolder.prompts) {
        expect
          .soft(
            await folderPrompts.isFolderPromptVisible(
              promptsInsideFolder.folders.name,
              prompt.name,
            ),
            ExpectedMessages.promptIsVisible,
          )
          .toBeTruthy();
      }
    });

    await test.step('Type / in chat and verify imported prompt appears', async () => {
      await sendMessage.messageInput.fillInInput('/');
      await sendMessage.getPromptList().selectPrompt(promptOutsideFolder.name);

      const selectedPromptContent =
        await sendMessage.messageInput.getElementContent();
      expect
        .soft(selectedPromptContent, ExpectedMessages.promptNameValid)
        .toBe(promptContent);
    });
  },
);

test(
  'Export and import one prompt in a folder.\n' +
    `Export and import one prompt in a folder when folder doesn't exist.\n` +
    'Continue working with imported file. Edit imported prompt',
  async ({
    dialHomePage,
    setTestIds,
    localStorageManager,
    prompts,
    folderPrompts,
    promptBar,
    promptData,
    promptDropdownMenu,
    promptModalDialog,
    confirmationDialog,
  }) => {
    setTestIds('EPMRTC-884', 'EPMRTC-885', 'EPMRTC-896');
    let promptInsideFolder: FolderPrompt;
    let promptOutsideFolder: Prompt;
    let exportedData: UploadDownloadData;

    await test.step('Prepare folder with prompt and another prompt in the root', async () => {
      promptInsideFolder = promptData.prepareDefaultPromptInFolder();
      promptData.resetData();

      promptOutsideFolder = promptData.prepareDefaultPrompt();

      await localStorageManager.setFolders(promptInsideFolder.folders);
      await localStorageManager.setPrompts(
        ...promptInsideFolder.prompts,
        promptOutsideFolder,
      );
    });

    await test.step('Export prompt inside folder using prompt dropdown menu', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
      await folderPrompts.expandCollapseFolder(promptInsideFolder.folders.name);
      await folderPrompts.openFolderPromptDropdownMenu(
        promptInsideFolder.folders.name,
        promptInsideFolder.prompts[0].name,
      );
      exportedData = await dialHomePage.downloadData(() =>
        promptDropdownMenu.selectMenuOption(MenuOptions.export),
      );
    });

    await test.step('Delete exported prompt, re-import again and verify it is displayed inside folder', async () => {
      await folderPrompts.openFolderPromptDropdownMenu(
        promptInsideFolder.folders.name,
        promptInsideFolder.prompts[0].name,
      );
      await promptDropdownMenu.selectMenuOption(MenuOptions.delete);
      await prompts
        .getPromptInput(promptInsideFolder.prompts[0].name)
        .clickTickButton();
      await dialHomePage.uploadData(exportedData, () =>
        promptBar.importButton.click(),
      );

      await folderPrompts
        .getFolderPrompt(
          promptInsideFolder.folders.name,
          promptInsideFolder.prompts[0].name,
        )
        .waitFor();
      await prompts.getPromptByName(promptOutsideFolder.name).waitFor();
    });

    await test.step('Delete imported prompt with its folder, re-import again and verify it is displayed inside folder', async () => {
      await folderPrompts.openFolderDropdownMenu(
        promptInsideFolder.folders.name,
      );
      await promptDropdownMenu.selectMenuOption(MenuOptions.delete);
      await confirmationDialog.confirm();
      await dialHomePage.uploadData(exportedData, () =>
        promptBar.importButton.click(),
      );
      await folderPrompts
        .getFolderByName(promptInsideFolder.folders.name)
        .waitFor();
      await folderPrompts
        .getFolderPrompt(
          promptInsideFolder.folders.name,
          promptInsideFolder.prompts[0].name,
        )
        .waitFor();
    });

    await test.step('Open imported prompt edit screen, make some updates and verify imported prompt appears', async () => {
      await prompts.openPromptDropdownMenu(promptOutsideFolder.name);
      await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
      await promptModalDialog.updatePromptDetails(newName, newDescr, newValue);
      await prompts.getPromptByName(newName).waitFor();
      await prompts.openPromptDropdownMenu(newName);
      await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
      expect
        .soft(
          await promptModalDialog.getDescription(),
          ExpectedMessages.promptDescriptionUpdated,
        )
        .toBe(newDescr);
      expect
        .soft(
          await promptModalDialog.getPrompt(),
          ExpectedMessages.promptValueUpdated,
        )
        .toBe(newValue);
    });
  },
);

test('Export and import one prompt in hierarchy tree', async ({
  dialHomePage,
  setTestIds,
  localStorageManager,
  prompts,
  promptBar,
  promptData,
  promptDropdownMenu,
}) => {
  setTestIds('EPMRTC-886');
  let promptInsideFolder: FolderPrompt;
  let promptOutsideFolder: Prompt;
  let exportedData: UploadDownloadData;
  const promptContent = 'test prompt';

  await test.step('Prepare folder with prompt and another prompt in the root', async () => {
    promptInsideFolder = promptData.prepareDefaultPromptInFolder();
    promptData.resetData();

    promptOutsideFolder = promptData.preparePrompt(promptContent);

    await localStorageManager.setFolders(promptInsideFolder.folders);
    await localStorageManager.setPrompts(
      ...promptInsideFolder.prompts,
      promptOutsideFolder,
    );
  });

  await test.step('Export prompt in the root using prompt dropdown menu', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    await prompts.openPromptDropdownMenu(promptOutsideFolder.name);
    exportedData = await dialHomePage.downloadData(() =>
      promptDropdownMenu.selectMenuOption(MenuOptions.export),
    );
  });

  await test.step('Delete exported prompt, re-import again and verify it is displayed in the root', async () => {
    await prompts.openPromptDropdownMenu(promptOutsideFolder.name);
    await promptDropdownMenu.selectMenuOption(MenuOptions.delete);
    await prompts.getPromptInput(promptOutsideFolder.name).clickTickButton();
    await prompts
      .getPromptByName(promptOutsideFolder.name)
      .waitFor({ state: 'hidden' });
    await dialHomePage.uploadData(exportedData, () =>
      promptBar.importButton.click(),
    );
    await prompts.getPromptByName(promptOutsideFolder.name).waitFor();
  });
});

test('Existed prompts stay after import', async ({
  dialHomePage,
  setTestIds,
  localStorageManager,
  prompts,
  folderPrompts,
  promptBar,
  promptData,
}) => {
  setTestIds('EPMRTC-889');
  let promptsInsideFolder: FolderPrompt;
  let promptOutsideFolder: Prompt;
  let importedFolderPrompt: Prompt;
  let importedRootPrompt: Prompt;
  let importedNewFolderPrompt: FolderPrompt;

  await test.step('Prepare folder with 2 prompts and another prompt in the root', async () => {
    promptsInsideFolder = promptData.preparePromptsInFolder(2);
    promptData.resetData();

    promptOutsideFolder = promptData.prepareDefaultPrompt();
    promptData.resetData();

    await localStorageManager.setFolders(promptsInsideFolder.folders);
    await localStorageManager.setPrompts(
      ...promptsInsideFolder.prompts,
      promptOutsideFolder,
    );
  });

  await test.step('Prepare prompt inside existing folder to import, prompt inside new folder to import and prompt inside root', async () => {
    importedFolderPrompt = promptData.prepareDefaultPrompt();
    folderPromptData = ImportPrompt.preparePromptFile(
      importedFolderPrompt,
      promptsInsideFolder,
    );
    promptData.resetData();

    importedRootPrompt = promptData.prepareDefaultPrompt();
    rootPromptData = ImportPrompt.preparePromptFile(importedRootPrompt);
    promptData.resetData();

    importedNewFolderPrompt = promptData.prepareDefaultPromptInFolder();
    newFolderPromptData = ImportPrompt.preparePromptFile(
      importedNewFolderPrompt.prompts[0],
      importedNewFolderPrompt,
    );
  });

  await test.step('Import prompt inside existing folder and verify it is imported and existing prompts remain inside folder', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });

    await dialHomePage.uploadData(folderPromptData, () =>
      promptBar.importButton.click(),
    );
    await folderPrompts.expandCollapseFolder(promptsInsideFolder.folders.name);
    await folderPrompts
      .getFolderPrompt(
        promptsInsideFolder.folders.name,
        importedFolderPrompt.name,
      )
      .waitFor();
    for (const existingPrompts of promptsInsideFolder.prompts) {
      await folderPrompts
        .getFolderPrompt(promptsInsideFolder.folders.name, existingPrompts.name)
        .waitFor();
    }
  });

  await test.step('Import root prompt and verify it is imported and existing root prompt remain', async () => {
    await dialHomePage.uploadData(rootPromptData, () =>
      promptBar.importButton.click(),
    );
    await prompts.getPromptByName(importedRootPrompt.name).waitFor();
    await prompts.getPromptByName(promptOutsideFolder.name).waitFor();
  });

  await test.step('Import conversation inside new folder and verify it is imported', async () => {
    await dialHomePage.uploadData(newFolderPromptData, () =>
      promptBar.importButton.click(),
    );
    await folderPrompts
      .getFolderByName(importedNewFolderPrompt.folders.name)
      .waitFor();
    const newFolderPrompt = folderPrompts.getFolderPrompt(
      importedNewFolderPrompt.folders.name,
      importedNewFolderPrompt.prompts[0].name,
    );
    if (await newFolderPrompt.isHidden()) {
      await folderPrompts.expandCollapseFolder(
        importedNewFolderPrompt.folders.name,
      );
      await newFolderPrompt.waitFor();
    }
  });
});

test('Import file from 1.4 version to prompts and continue working with it', async ({
  dialHomePage,
  promptBar,
  setTestIds,
  folderPrompts,
  sendMessage,
  variableModalDialog,
  promptDropdownMenu,
  promptModalDialog,
}) => {
  setTestIds('EPMRTC-1135');
  const aVariable = 'A';
  await test.step('Import prompt from 1.4 app version and verify folder with prompt is visible', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    await dialHomePage.uploadData({ path: Import.v14AppImportedFilename }, () =>
      promptBar.importButton.click(),
    );

    await folderPrompts.expandCollapseFolder(Import.v14AppFolderName);
    await folderPrompts
      .getFolderPrompt(Import.v14AppFolderName, Import.v14AppFolderPromptName)
      .waitFor();
  });

  await test.step('Edit imported prompt', async () => {
    await folderPrompts.openFolderPromptDropdownMenu(
      Import.v14AppFolderName,
      Import.v14AppFolderPromptName,
    );
    await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
    await promptModalDialog.updatePromptDetails(newName, newDescr, newValue);
    await folderPrompts
      .getFolderPrompt(Import.v14AppFolderName, newName)
      .waitFor();
  });

  await test.step('Enter prompt in the request, set params and verify it is applied in the request field', async () => {
    await sendMessage.messageInput.fillInInput('/');
    await sendMessage.getPromptList().selectPrompt(newName);

    const promptName = await variableModalDialog.getName();
    expect.soft(promptName, ExpectedMessages.promptNameValid).toBe(newName);

    const promptDescr = await variableModalDialog.getDescription();
    expect
      .soft(promptDescr, ExpectedMessages.promptDescriptionValid)
      .toBe(newDescr);

    const variable = '20';
    await variableModalDialog.setVariable(aVariable, variable);

    const actualMessage = await sendMessage.getMessage();
    expect
      .soft(actualMessage, ExpectedMessages.promptApplied)
      .toBe(newValue.replace(`{{${aVariable}}}`, variable));
  });
});

test.afterAll(async () => {
  FileUtil.removeExportFolder();
  const importFilesToDelete: UploadDownloadData[] = [
    folderPromptData,
    rootPromptData,
    newFolderPromptData,
  ];
  importFilesToDelete.forEach((d) => {
    if (d) {
      FileUtil.deleteImportFile(d.path);
    }
  });
});
