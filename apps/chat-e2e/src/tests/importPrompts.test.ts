import { FolderInterface } from '@/chat/types/folder';
import { Prompt } from '@/chat/types/prompt';
import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedMessages,
  FolderPrompt,
  Import,
  MenuOptions,
} from '@/src/testData';
import { ImportPrompt } from '@/src/testData/conversationHistory/importPrompt';
import { UploadDownloadData } from '@/src/ui/pages';
import { FileUtil, GeneratorUtil } from '@/src/utils';
import { expect } from '@playwright/test';

let folderPromptData: UploadDownloadData;
let rootPromptData: UploadDownloadData;
let newFolderPromptData: UploadDownloadData;
const exportedPrompts: UploadDownloadData[] = [];
const updatedExportedPrompts: UploadDownloadData[] = [];
const newName = 'test prompt';
const newDescr = 'test description';
const newValue = 'what is {{A}}';
const levelsCount = 3;

dialTest(
  'Existed prompts stay after import',
  async ({
    dialHomePage,
    setTestIds,
    dataInjector,
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

    await dialTest.step(
      'Prepare folder with 2 prompts and another prompt in the root',
      async () => {
        promptsInsideFolder = promptData.preparePromptsInFolder(2);
        promptData.resetData();

        promptOutsideFolder = promptData.prepareDefaultPrompt();
        promptData.resetData();

        await dataInjector.createPrompts(
          [...promptsInsideFolder.prompts, promptOutsideFolder],
          promptsInsideFolder.folders,
        );
      },
    );

    await dialTest.step(
      'Prepare prompt inside existing folder to import, prompt inside new folder to import and prompt inside root',
      async () => {
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
      },
    );

    await dialTest.step(
      'Import prompt inside existing folder and verify it is imported and existing prompts remain inside folder',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });

        await dialHomePage.importFile(folderPromptData, () =>
          promptBar.importButton.click(),
        );
        await folderPrompts.expandFolder(promptsInsideFolder.folders.name);
        await folderPrompts
          .getFolderEntity(
            promptsInsideFolder.folders.name,
            importedFolderPrompt.name,
          )
          .waitFor();
        for (const existingPrompts of promptsInsideFolder.prompts) {
          await folderPrompts
            .getFolderEntity(
              promptsInsideFolder.folders.name,
              existingPrompts.name,
            )
            .waitFor();
        }
      },
    );

    await dialTest.step(
      'Import root prompt and verify it is imported and existing root prompt remain',
      async () => {
        await dialHomePage.importFile(rootPromptData, () =>
          promptBar.importButton.click(),
        );
        await prompts.getPromptByName(importedRootPrompt.name).waitFor();
        await prompts.getPromptByName(promptOutsideFolder.name).waitFor();
      },
    );

    await dialTest.step(
      'Import conversation inside new folder and verify it is imported',
      async () => {
        await dialHomePage.importFile(newFolderPromptData, () =>
          promptBar.importButton.click(),
        );
        await folderPrompts
          .getFolderByName(importedNewFolderPrompt.folders.name)
          .waitFor();
        const newFolderPrompt = folderPrompts.getFolderEntity(
          importedNewFolderPrompt.folders.name,
          importedNewFolderPrompt.prompts[0].name,
        );
        await folderPrompts.expandFolder(importedNewFolderPrompt.folders.name),
          await newFolderPrompt.waitFor();
      },
    );
  },
);

dialTest(
  'Import file from 1.4 version to prompts and continue working with it',
  async ({
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
    await dialTest.step(
      'Import prompt from 1.4 app version and verify folder with prompt is visible',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await dialHomePage.importFile(
          { path: Import.v14AppImportedFilename },
          () => promptBar.importButton.click(),
        );

        await folderPrompts.expandFolder(Import.oldVersionAppFolderName);
        await folderPrompts
          .getFolderEntity(
            Import.oldVersionAppFolderName,
            Import.v14AppFolderPromptName,
          )
          .waitFor();
      },
    );

    await dialTest.step('Edit imported prompt', async () => {
      await folderPrompts.openFolderEntityDropdownMenu(
        Import.oldVersionAppFolderName,
        Import.v14AppFolderPromptName,
      );
      await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
      await promptModalDialog.updatePromptDetailsWithButton(
        newName,
        newDescr,
        newValue,
      );
      await folderPrompts
        .getFolderEntity(Import.oldVersionAppFolderName, newName)
        .waitFor();
    });

    await dialTest.step(
      'Enter prompt in the request, set params and verify it is applied in the request field',
      async () => {
        await sendMessage.messageInput.fillInInput('/');
        await sendMessage
          .getPromptList()
          .selectPrompt(newName, { triggeredHttpMethod: 'GET' });

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
      },
    );
  },
);

dialTest(
  'Import a prompt in nested folder',
  async ({
    dialHomePage,
    setTestIds,
    dataInjector,
    folderPrompts,
    promptBar,
    promptData,
    promptDropdownMenu,
  }) => {
    setTestIds('EPMRTC-1378');
    let nestedFolders: FolderInterface[];
    let nestedPrompts: Prompt[];
    const updatedPromptNames: string[] = [];

    await dialTest.step(
      'Prepare 3 levels nested folders with prompts inside',
      async () => {
        nestedFolders = promptData.prepareNestedFolder(levelsCount);
        nestedPrompts =
          promptData.preparePromptsForNestedFolders(nestedFolders);

        await dataInjector.createPrompts(nestedPrompts, ...nestedFolders);
      },
    );

    await dialTest.step('Export 2nd and 3rd level folder prompts', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
      for (const nestedFolder of nestedFolders) {
        await folderPrompts.expandFolder(nestedFolder.name);
      }
      for (let i = 1; i <= 3; i = i + 2) {
        await folderPrompts.openFolderEntityDropdownMenu(
          nestedFolders[i].name,
          nestedPrompts[i].name,
        );
        const exportedData = await dialHomePage.downloadData(
          () => promptDropdownMenu.selectMenuOption(MenuOptions.export),
          `${i}.json`,
        );
        exportedPrompts.push(exportedData);
      }
    });

    await dialTest.step(
      'Update id and name of exported prompts and import them again',
      async () => {
        for (const exportedData of exportedPrompts) {
          const exportedContent = FileUtil.readFileData(exportedData.path);
          const prompt = exportedContent.prompts[0];
          prompt.id = GeneratorUtil.randomString(10);
          prompt.name = GeneratorUtil.randomString(10);
          const updatedExportedPrompt = {
            path: FileUtil.writeDataToFile(exportedContent),
            isDownloadedData: false,
          };
          updatedExportedPrompts.push(updatedExportedPrompt);
          await dialHomePage.importFile(updatedExportedPrompt, () =>
            promptBar.importButton.click(),
          );
          updatedPromptNames.push(prompt.name);
        }
      },
    );

    await dialTest.step(
      'Verify new prompts are added to 2nd and 3rd level folders, folders structure remains the same',
      async () => {
        expect
          .soft(
            await folderPrompts.getFoldersCount(),
            ExpectedMessages.foldersCountIsValid,
          )
          .toBe(levelsCount + 1);

        for (let i = 0; i < levelsCount; i++) {
          expect
            .soft(
              await folderPrompts.isFolderEntityVisible(
                nestedFolders[i].name,
                nestedPrompts[i].name,
              ),
              ExpectedMessages.promptIsVisible,
            )
            .toBeTruthy();
          if (i === 1) {
            expect
              .soft(
                await folderPrompts.isFolderEntityVisible(
                  nestedFolders[i].name,
                  updatedPromptNames[0],
                ),
                ExpectedMessages.promptIsVisible,
              )
              .toBeTruthy();
          } else if (i === 3) {
            expect
              .soft(
                await folderPrompts.isFolderEntityVisible(
                  nestedFolders[i].name,
                  updatedPromptNames[1],
                ),
                ExpectedMessages.promptIsVisible,
              )
              .toBeTruthy();
          }
        }
      },
    );
  },
);

dialTest(
  'Import a prompt from nested folder which was moved to another place',
  async ({
    dialHomePage,
    setTestIds,
    dataInjector,
    folderPrompts,
    promptBar,
    promptData,
    promptDropdownMenu,
  }) => {
    setTestIds('EPMRTC-1388');
    let nestedFolders: FolderInterface[];
    let thirdLevelFolderPrompt: Prompt;
    let exportedData: UploadDownloadData;

    await dialTest.step(
      'Prepare 3 levels nested folders and prompt inside the 3rd level folder',
      async () => {
        nestedFolders = promptData.prepareNestedFolder(levelsCount);
        thirdLevelFolderPrompt = promptData.prepareDefaultPrompt();
        thirdLevelFolderPrompt.folderId = nestedFolders[levelsCount].folderId;
        thirdLevelFolderPrompt.id = `${thirdLevelFolderPrompt.folderId}/${thirdLevelFolderPrompt.name}`;

        await dataInjector.createPrompts(
          [thirdLevelFolderPrompt],
          ...nestedFolders,
        );
      },
    );

    await dialTest.step('Export 3rd level folder prompt', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
      for (const nestedFolder of nestedFolders) {
        await folderPrompts.expandFolder(nestedFolder.name);
      }
      await folderPrompts.openFolderEntityDropdownMenu(
        nestedFolders[levelsCount].name,
        thirdLevelFolderPrompt.name,
      );
      exportedData = await dialHomePage.downloadData(() =>
        promptDropdownMenu.selectMenuOption(MenuOptions.export),
      );
    });

    await dialTest.step(
      'Move 3rd level folder on the 1st level folder and import exported prompt',
      async () => {
        await promptBar.drugAndDropFolderToFolder(
          nestedFolders[levelsCount].name,
          nestedFolders[0].name,
        );
        await dialHomePage.importFile(exportedData, () =>
          promptBar.importButton.click(),
        );
      },
    );

    await dialTest.step(
      'Verify imported prompt is in 3rd level folder on the 1st level',
      async () => {
        await folderPrompts.expandFolder(
          nestedFolders[levelsCount].name,
          { isHttpMethodTriggered: false },
          2,
        );
        await folderPrompts
          .getFolderEntity(
            nestedFolders[levelsCount].name,
            thirdLevelFolderPrompt.name,
            2,
          )
          .waitFor();

        const foldersCount = await folderPrompts.getFoldersCount();
        expect
          .soft(foldersCount, ExpectedMessages.foldersCountIsValid)
          .toBe(levelsCount + 2);
      },
    );
  },
);

dialTest.afterAll(async () => {
  const importFilesToDelete: UploadDownloadData[] = [
    folderPromptData,
    rootPromptData,
    newFolderPromptData,
    ...updatedExportedPrompts,
  ];
  importFilesToDelete.forEach((d) => {
    if (d) {
      FileUtil.deleteImportFile(d.path);
    }
  });
});
