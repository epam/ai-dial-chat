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
import { v4 as uuidv4 } from 'uuid';

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
    let nestedFolders: FolderInterface[];
    let nestedPrompts: Prompt[];
    let exportedData: UploadDownloadData;
    const promptContent = 'test';

    await dialTest.step(
      'Prepare empty folder, folder with 2 prompts, another prompt in the root and nested folders with prompts inside',
      async () => {
        emptyFolder = promptData.prepareFolder();
        promptData.resetData();

        promptsInsideFolder = promptData.preparePromptsInFolder(2);
        promptData.resetData();

        promptOutsideFolder = promptData.preparePrompt(promptContent);
        promptData.resetData();

        nestedFolders = promptData.prepareNestedFolder(levelsCount);
        nestedPrompts =
          promptData.preparePromptsForNestedFolders(nestedFolders);

        await localStorageManager.setFolders(
          emptyFolder,
          promptsInsideFolder.folders,
          ...nestedFolders,
        );
        await localStorageManager.setPrompts(
          ...promptsInsideFolder.prompts,
          promptOutsideFolder,
          ...nestedPrompts,
        );
      },
    );

    await dialTest.step(
      'Export all prompts using prompt bar Export button',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        for (const nestedFolder of nestedFolders) {
          await folderPrompts.expandCollapseFolder(nestedFolder.name);
        }
        await folderPrompts.expandCollapseFolder(
          promptsInsideFolder.folders.name,
        );
        exportedData = await dialHomePage.downloadData(() =>
          promptBar.exportButton.click(),
        );
      },
    );

    await dialTest.step(
      'Delete all prompts and folders, re-import again and verify they are displayed',
      async () => {
        await promptBar.deleteAllEntities();
        await confirmationDialog.confirm();
        await promptBar.deleteEntitiesButton.waitForState({ state: 'hidden' });

        await dialHomePage.uploadData(exportedData, () =>
          promptBar.importButton.click(),
        );

        await folderPrompts
          .getFolderByName(promptsInsideFolder.folders.name)
          .waitFor();
        await folderPrompts.getFolderByName(emptyFolder.name).waitFor();

        for (let i = 0; i < nestedFolders.length; i++) {
          const nestedFolder = nestedFolders[i];
          await folderPrompts.getFolderByName(nestedFolder.name).waitFor();
          await folderPrompts.getFolderEntity(
            nestedFolder.name,
            nestedPrompts[i].name,
          );
        }

        await prompts.getPromptByName(promptOutsideFolder.name).waitFor();

        for (const prompt of promptsInsideFolder.prompts) {
          expect
            .soft(
              await folderPrompts.isFolderEntityVisible(
                promptsInsideFolder.folders.name,
                prompt.name,
              ),
              ExpectedMessages.promptIsVisible,
            )
            .toBeTruthy();
        }
      },
    );

    await dialTest.step(
      'Type / in chat and verify imported prompt appears',
      async () => {
        await sendMessage.messageInput.fillInInput('/');
        await sendMessage
          .getPromptList()
          .selectPrompt(promptOutsideFolder.name);

        const selectedPromptContent =
          await sendMessage.messageInput.getElementContent();
        expect
          .soft(selectedPromptContent, ExpectedMessages.promptNameValid)
          .toBe(promptContent);
      },
    );
  },
);

dialTest(
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

    await dialTest.step(
      'Prepare folder with prompt and another prompt in the root',
      async () => {
        promptInsideFolder = promptData.prepareDefaultPromptInFolder();
        promptData.resetData();

        promptOutsideFolder = promptData.prepareDefaultPrompt();

        await localStorageManager.setFolders(promptInsideFolder.folders);
        await localStorageManager.setPrompts(
          ...promptInsideFolder.prompts,
          promptOutsideFolder,
        );
      },
    );

    await dialTest.step(
      'Export prompt inside folder using prompt dropdown menu',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await folderPrompts.expandCollapseFolder(
          promptInsideFolder.folders.name,
        );
        await folderPrompts.openFolderEntityDropdownMenu(
          promptInsideFolder.folders.name,
          promptInsideFolder.prompts[0].name,
        );
        exportedData = await dialHomePage.downloadData(() =>
          promptDropdownMenu.selectMenuOption(MenuOptions.export),
        );
      },
    );

    await dialTest.step(
      'Delete exported prompt, re-import again and verify it is displayed inside folder',
      async () => {
        await folderPrompts.openFolderEntityDropdownMenu(
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
          .getFolderEntity(
            promptInsideFolder.folders.name,
            promptInsideFolder.prompts[0].name,
          )
          .waitFor();
        await prompts.getPromptByName(promptOutsideFolder.name).waitFor();
      },
    );

    await dialTest.step(
      'Delete imported prompt with its folder, re-import again and verify it is displayed inside folder',
      async () => {
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
          .getFolderEntity(
            promptInsideFolder.folders.name,
            promptInsideFolder.prompts[0].name,
          )
          .waitFor();
      },
    );

    await dialTest.step(
      'Open imported prompt edit screen, make some updates and verify imported prompt appears',
      async () => {
        await prompts.openPromptDropdownMenu(promptOutsideFolder.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
        await promptModalDialog.updatePromptDetails(
          newName,
          newDescr,
          newValue,
        );
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
      },
    );
  },
);

dialTest(
  'Export and import one prompt in hierarchy tree',
  async ({
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

    await dialTest.step(
      'Prepare folder with prompt and another prompt in the root',
      async () => {
        promptInsideFolder = promptData.prepareDefaultPromptInFolder();
        promptData.resetData();

        promptOutsideFolder = promptData.preparePrompt(promptContent);

        await localStorageManager.setFolders(promptInsideFolder.folders);
        await localStorageManager.setPrompts(
          ...promptInsideFolder.prompts,
          promptOutsideFolder,
        );
      },
    );

    await dialTest.step(
      'Export prompt in the root using prompt dropdown menu',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await prompts.openPromptDropdownMenu(promptOutsideFolder.name);
        exportedData = await dialHomePage.downloadData(() =>
          promptDropdownMenu.selectMenuOption(MenuOptions.export),
        );
      },
    );

    await dialTest.step(
      'Delete exported prompt, re-import again and verify it is displayed in the root',
      async () => {
        await prompts.openPromptDropdownMenu(promptOutsideFolder.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.delete);
        await prompts
          .getPromptInput(promptOutsideFolder.name)
          .clickTickButton();
        await prompts
          .getPromptByName(promptOutsideFolder.name)
          .waitFor({ state: 'hidden' });
        await dialHomePage.uploadData(exportedData, () =>
          promptBar.importButton.click(),
        );
        await prompts.getPromptByName(promptOutsideFolder.name).waitFor();
      },
    );
  },
);

dialTest(
  'Existed prompts stay after import',
  async ({
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

    await dialTest.step(
      'Prepare folder with 2 prompts and another prompt in the root',
      async () => {
        promptsInsideFolder = promptData.preparePromptsInFolder(2);
        promptData.resetData();

        promptOutsideFolder = promptData.prepareDefaultPrompt();
        promptData.resetData();

        await localStorageManager.setFolders(promptsInsideFolder.folders);
        await localStorageManager.setPrompts(
          ...promptsInsideFolder.prompts,
          promptOutsideFolder,
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

        await dialHomePage.uploadData(folderPromptData, () =>
          promptBar.importButton.click(),
        );
        await folderPrompts.expandCollapseFolder(
          promptsInsideFolder.folders.name,
        );
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
        await dialHomePage.uploadData(rootPromptData, () =>
          promptBar.importButton.click(),
        );
        await prompts.getPromptByName(importedRootPrompt.name).waitFor();
        await prompts.getPromptByName(promptOutsideFolder.name).waitFor();
      },
    );

    await dialTest.step(
      'Import conversation inside new folder and verify it is imported',
      async () => {
        await dialHomePage.uploadData(newFolderPromptData, () =>
          promptBar.importButton.click(),
        );
        await folderPrompts
          .getFolderByName(importedNewFolderPrompt.folders.name)
          .waitFor();
        const newFolderPrompt = folderPrompts.getFolderEntity(
          importedNewFolderPrompt.folders.name,
          importedNewFolderPrompt.prompts[0].name,
        );
        if (await newFolderPrompt.isHidden()) {
          await folderPrompts.expandCollapseFolder(
            importedNewFolderPrompt.folders.name,
          );
          await newFolderPrompt.waitFor();
        }
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
        await dialHomePage.uploadData(
          { path: Import.v14AppImportedFilename },
          () => promptBar.importButton.click(),
        );

        await folderPrompts.expandCollapseFolder(
          Import.oldVersionAppFolderName,
        );
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
      await promptModalDialog.updatePromptDetails(newName, newDescr, newValue);
      await folderPrompts
        .getFolderEntity(Import.oldVersionAppFolderName, newName)
        .waitFor();
    });

    await dialTest.step(
      'Enter prompt in the request, set params and verify it is applied in the request field',
      async () => {
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
      },
    );
  },
);

dialTest(
  `Export and import single prompt in nested folders when folders structure doesn't exist.\n` +
    `Export and import single prompt in nested folders when it's folder doesn't exist.\n` +
    `Export and import single prompt in nested folders when parent folder doesn't exist`,
  async ({
    dialHomePage,
    setTestIds,
    localStorageManager,
    folderPrompts,
    promptBar,
    confirmationDialog,
    promptData,
    promptDropdownMenu,
    folderDropdownMenu,
  }) => {
    setTestIds('EPMRTC-1375', 'EPMRTC-1376', 'EPMRTC-1377');
    let nestedFolders: FolderInterface[];
    let nestedPrompts: Prompt[];
    let exportedData: UploadDownloadData;

    await dialTest.step(
      'Prepare nested folders with prompts inside',
      async () => {
        nestedFolders = promptData.prepareNestedFolder(levelsCount);
        nestedPrompts =
          promptData.preparePromptsForNestedFolders(nestedFolders);

        await localStorageManager.setFolders(...nestedFolders);
        await localStorageManager.setPrompts(...nestedPrompts);
      },
    );

    await dialTest.step('Export prompt from 3rd level folder', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded({
        isNewConversationVisible: true,
      });
      for (const nestedFolder of nestedFolders) {
        await folderPrompts.expandCollapseFolder(nestedFolder.name);
      }
      await folderPrompts.openFolderEntityDropdownMenu(
        nestedFolders[levelsCount].name,
        nestedPrompts[levelsCount].name,
      );
      exportedData = await dialHomePage.downloadData(() =>
        promptDropdownMenu.selectMenuOption(MenuOptions.export),
      );
    });

    await dialTest.step(
      'Delete all prompts and folders, import exported prompt and verify folder structure with 3rd level prompt are displayed',
      async () => {
        await promptBar.deleteAllEntities();
        await confirmationDialog.confirm();
        await dialHomePage.uploadData(exportedData, () =>
          promptBar.importButton.click(),
        );

        for (const nestedFolder of nestedFolders) {
          await folderPrompts.getFolderByName(nestedFolder.name).waitFor();
        }

        await folderPrompts
          .getFolderEntity(
            nestedFolders[levelsCount].name,
            nestedPrompts[levelsCount].name,
          )
          .waitFor();

        expect
          .soft(
            await folderPrompts.getFolderEntitiesCount(
              nestedFolders[levelsCount].name,
            ),
            ExpectedMessages.promptsCountIsValid,
          )
          .toBe(1);
      },
    );

    await dialTest.step(
      'Delete last folder with its prompt, re-import exported file again and verify last nested folder with its prompt imported',
      async () => {
        await folderPrompts.openFolderDropdownMenu(
          nestedFolders[levelsCount].name,
        );
        await folderDropdownMenu.selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm();

        await dialHomePage.uploadData(exportedData, () =>
          promptBar.importButton.click(),
        );

        await folderPrompts
          .getFolderEntity(
            nestedFolders[levelsCount].name,
            nestedPrompts[levelsCount].name,
          )
          .waitFor();
      },
    );

    await dialTest.step(
      'Delete 2nd level folder with its nested content, re-import exported file and verify 2nd/3rd level folders with 3rd level prompt are imported',
      async () => {
        await folderPrompts.openFolderDropdownMenu(
          nestedFolders[levelsCount - 1].name,
        );
        await folderDropdownMenu.selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm();

        await dialHomePage.uploadData(exportedData, () =>
          promptBar.importButton.click(),
        );

        await folderPrompts
          .getFolderEntity(
            nestedFolders[levelsCount].name,
            nestedPrompts[levelsCount].name,
          )
          .waitFor();

        await folderPrompts
          .getFolderByName(nestedFolders[levelsCount - 1].name)
          .waitFor();

        expect
          .soft(
            await folderPrompts.getFolderEntitiesCount(
              nestedFolders[levelsCount].name,
            ),
            ExpectedMessages.promptsCountIsValid,
          )
          .toBe(1);
      },
    );
  },
);

dialTest(
  'Import a prompt in nested folder',
  async ({
    dialHomePage,
    setTestIds,
    localStorageManager,
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

        await localStorageManager.setFolders(...nestedFolders);
        await localStorageManager.setPrompts(...nestedPrompts);
      },
    );

    await dialTest.step('Export 2nd and 3rd level folder prompts', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
      for (const nestedFolder of nestedFolders) {
        await folderPrompts.expandCollapseFolder(nestedFolder.name);
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
          prompt.id = uuidv4();
          prompt.name = GeneratorUtil.randomString(10);
          const updatedExportedPrompt = {
            path: FileUtil.writeDataToFile(exportedContent),
            isDownloadedData: false,
          };
          updatedExportedPrompts.push(updatedExportedPrompt);
          await dialHomePage.uploadData(updatedExportedPrompt, () =>
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
    localStorageManager,
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
        thirdLevelFolderPrompt.folderId = nestedFolders[levelsCount].id;

        await localStorageManager.setFolders(...nestedFolders);
        await localStorageManager.setPrompts(thirdLevelFolderPrompt);
      },
    );

    await dialTest.step('Export 3rd level folder prompt', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
      for (const nestedFolder of nestedFolders) {
        await folderPrompts.expandCollapseFolder(nestedFolder.name);
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
        nestedFolders[levelsCount].folderId = nestedFolders[1].folderId;
        await localStorageManager.setFolders(...nestedFolders);
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await dialHomePage.uploadData(exportedData, () =>
          promptBar.importButton.click(),
        );
      },
    );

    await dialTest.step(
      'Verify imported prompt is in 3rd level folder on the 1st level',
      async () => {
        for (const nestedFolder of nestedFolders) {
          await folderPrompts.expandCollapseFolder(nestedFolder.name);
        }
        await folderPrompts
          .getFolderEntity(
            nestedFolders[levelsCount].name,
            thirdLevelFolderPrompt.name,
          )
          .waitFor();

        const thirdLevelFolderPromptsCount = await folderPrompts
          .getFolderEntity(nestedFolders[2].name, thirdLevelFolderPrompt.name)
          .count();
        expect
          .soft(
            thirdLevelFolderPromptsCount,
            ExpectedMessages.promptsCountIsValid,
          )
          .toBe(0);

        const foldersCount = await folderPrompts.getFoldersCount();
        expect
          .soft(foldersCount, ExpectedMessages.foldersCountIsValid)
          .toBe(levelsCount + 1);

        const promptsCount = await folderPrompts.getFolderEntitiesCount(
          nestedFolders[3].name,
        );
        expect.soft(promptsCount, ExpectedMessages.promptsCountIsValid).toBe(1);
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
