import { FolderInterface } from '@/chat/types/folder';
import { Prompt } from '@/chat/types/prompt';
import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
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
const levelsCount = 4;

dialTest(
  'Export and import prompt structure with all prompts.\n' +
    'Continue working with imported file. Add imported prompt to a message.\n' +
    'Prompt from the list is navigated on arrows and selected on Enter.\n' +
    'Prompt text without parameters in Input message box influences on model response',
  async ({
    dialHomePage,
    setTestIds,
    dataInjector,
    prompts,
    folderPrompts,
    promptBar,
    confirmationDialog,
    promptData,
    sendMessage,
    chatMessagesAssertion,
    chat,
  }) => {
    setTestIds('EPMRTC-883', 'EPMRTC-895', 'EPMRTC-3835', 'EPMRTC-3822');
    let promptsInsideFolder: FolderPrompt;
    let promptOutsideFolder: Prompt;
    let nestedFolders: FolderInterface[];
    let nestedPrompts: Prompt[];
    let exportedData: UploadDownloadData;
    const promptContent = `Let's play a game. I give you a word and you answer me a word of opposite meaning`;

    await dialTest.step(
      'Prepare empty folder, folder with 2 prompts, another prompt in the root and nested folders with prompts inside',
      async () => {
        promptsInsideFolder = promptData.preparePromptsInFolder(2);
        promptData.resetData();

        promptOutsideFolder = promptData.preparePrompt(promptContent);
        promptData.resetData();

        nestedFolders = promptData.prepareNestedFolder(levelsCount);
        nestedPrompts =
          promptData.preparePromptsForNestedFolders(nestedFolders);

        await dataInjector.createPrompts(
          [
            ...promptsInsideFolder.prompts,
            promptOutsideFolder,
            ...nestedPrompts,
          ],
          promptsInsideFolder.folders,
          ...nestedFolders,
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
        await promptBar.createNewFolder();
        for (const nestedFolder of nestedFolders) {
          await folderPrompts.expandFolder(nestedFolder.name);
        }
        await folderPrompts.expandFolder(promptsInsideFolder.folders.name);
        exportedData = await dialHomePage.downloadData(() =>
          promptBar.exportButton.click(),
        );
      },
    );

    await dialTest.step(
      'Delete all prompts and folders, re-import again and verify that all entities except empty folders are displayed',
      async () => {
        await promptBar.deleteAllEntities();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        await promptBar.deleteEntitiesButton.waitForState({ state: 'hidden' });

        await dialHomePage.importFile(exportedData, () =>
          promptBar.importButton.click(),
        );

        await folderPrompts
          .getFolderByName(promptsInsideFolder.folders.name)
          .waitFor();
        await expect
          .soft(
            folderPrompts.getFolderByName(
              ExpectedConstants.newFolderWithIndexTitle(1),
            ),
            ExpectedMessages.folderIsNotVisible,
          )
          .toBeHidden();

        await prompts.getEntityByName(promptOutsideFolder.name).waitFor();

        for (let i = 0; i < nestedFolders.length; i++) {
          const nestedFolder = nestedFolders[i];
          await folderPrompts.getFolderByName(nestedFolder.name).waitFor();
          await folderPrompts
            .getFolderEntity(nestedFolder.name, nestedPrompts[i].name)
            .waitFor();
        }

        for (const prompt of promptsInsideFolder.prompts) {
          await folderPrompts
            .getFolderEntity(promptsInsideFolder.folders.name, prompt.name)
            .waitFor();
        }
      },
    );

    await dialTest.step(
      'Type / in chat and verify imported prompt appears',
      async () => {
        await sendMessage.messageInput.fillInInput('/');
        await sendMessage
          .getPromptList()
          .selectPromptWithKeyboard(promptOutsideFolder.name, {
            triggeredHttpMethod: 'GET',
          });

        const selectedPromptContent =
          await sendMessage.messageInput.getElementContent();
        expect
          .soft(selectedPromptContent, ExpectedMessages.promptNameValid)
          .toBe(promptContent);
      },
    );

    await dialTest.step(
      'Send request and verify response corresponds prompt',
      async () => {
        await chat.sendRequestWithPrompt(promptContent);
        await chat.sendRequestWithButton('white');
        await chatMessagesAssertion.assertLastMessageContent('black');
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
    dataInjector,
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
        await dataInjector.createPrompts([
          promptOutsideFolder,
          ...promptInsideFolder.prompts,
        ]);
      },
    );

    await dialTest.step(
      'Export prompt inside folder using prompt dropdown menu',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await folderPrompts.expandFolder(promptInsideFolder.folders.name);
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
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        await dialHomePage.importFile(exportedData, () =>
          promptBar.importButton.click(),
        );

        await folderPrompts
          .getFolderEntity(
            promptInsideFolder.folders.name,
            promptInsideFolder.prompts[0].name,
          )
          .waitFor();
        await prompts.getEntityByName(promptOutsideFolder.name).waitFor();
      },
    );

    await dialTest.step(
      'Delete imported prompt with its folder, re-import again and verify it is displayed inside folder',
      async () => {
        await folderPrompts.openFolderDropdownMenu(
          promptInsideFolder.folders.name,
        );
        await promptDropdownMenu.selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        await dialHomePage.importFile(exportedData, () =>
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
        await prompts.openEntityDropdownMenu(promptOutsideFolder.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
        await promptModalDialog.updatePromptDetailsWithButton(
          newName,
          newDescr,
          newValue,
        );
        await prompts.getEntityByName(newName).waitFor();
        await prompts.openEntityDropdownMenu(newName);
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
    dataInjector,
    prompts,
    promptBar,
    promptData,
    promptDropdownMenu,
    confirmationDialog,
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

        await dataInjector.createPrompts(
          [...promptInsideFolder.prompts, promptOutsideFolder],
          promptInsideFolder.folders,
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
        await prompts.openEntityDropdownMenu(promptOutsideFolder.name);
        exportedData = await dialHomePage.downloadData(() =>
          promptDropdownMenu.selectMenuOption(MenuOptions.export),
        );
      },
    );

    await dialTest.step(
      'Delete exported prompt, re-import again and verify it is displayed in the root',
      async () => {
        await prompts.openEntityDropdownMenu(promptOutsideFolder.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        await expect
          .soft(
            prompts.getEntityByName(promptOutsideFolder.name),
            ExpectedMessages.noPromptsImported,
          )
          .toBeHidden();

        await dialHomePage.importFile(exportedData, () =>
          promptBar.importButton.click(),
        );
        await expect
          .soft(
            prompts.getEntityByName(promptOutsideFolder.name),
            ExpectedMessages.promptIsVisible,
          )
          .toBeVisible();
      },
    );
  },
);

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
        await expect
          .soft(
            folderPrompts.getFolderEntity(
              promptsInsideFolder.folders.name,
              importedFolderPrompt.name,
            ),
            ExpectedMessages.promptIsVisible,
          )
          .toBeVisible();

        for (const existingPrompts of promptsInsideFolder.prompts) {
          await expect
            .soft(
              folderPrompts.getFolderEntity(
                promptsInsideFolder.folders.name,
                existingPrompts.name,
              ),
              ExpectedMessages.promptIsVisible,
            )
            .toBeVisible();
        }
      },
    );

    await dialTest.step(
      'Import root prompt and verify it is imported and existing root prompt remain',
      async () => {
        await dialHomePage.importFile(rootPromptData, () =>
          promptBar.importButton.click(),
        );
        await prompts.getEntityByName(importedRootPrompt.name).waitFor();
        await prompts.getEntityByName(promptOutsideFolder.name).waitFor();
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
        await folderPrompts.expandFolder(importedNewFolderPrompt.folders.name);
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
    variableModalAssertion,
    sendMessageAssertion,
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
          .selectPromptWithKeyboard(newName, { triggeredHttpMethod: 'GET' });

        await variableModalAssertion.assertPromptName(newName);
        await variableModalAssertion.assertPromptDescription(newDescr);

        const variable = '20';
        await variableModalDialog.setVariableValue(aVariable, variable);
        await variableModalDialog.submitButton.click();
        await sendMessageAssertion.assertMessageValue(
          newValue.replace(`{{${aVariable}}}`, variable),
        );
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
    dataInjector,
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

        await dataInjector.createPrompts([...nestedPrompts], ...nestedFolders);
      },
    );

    await dialTest.step('Export prompt from 3rd level folder', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded({
        isNewConversationVisible: true,
      });
      for (const nestedFolder of nestedFolders) {
        await folderPrompts.expandFolder(nestedFolder.name);
      }
      await folderPrompts.openFolderEntityDropdownMenu(
        nestedFolders[levelsCount - 1].name,
        nestedPrompts[levelsCount - 1].name,
      );
      exportedData = await dialHomePage.downloadData(() =>
        promptDropdownMenu.selectMenuOption(MenuOptions.export),
      );
    });

    await dialTest.step(
      'Delete all prompts and folders, import exported prompt and verify folder structure with 3rd level prompt are displayed',
      async () => {
        await promptBar.deleteAllEntities();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        await dialHomePage.importFile(exportedData, () =>
          promptBar.importButton.click(),
        );

        for (const nestedFolder of nestedFolders) {
          await folderPrompts.getFolderByName(nestedFolder.name).waitFor();
        }

        await folderPrompts
          .getFolderEntity(
            nestedFolders[levelsCount - 1].name,
            nestedPrompts[levelsCount - 1].name,
          )
          .waitFor();

        expect
          .soft(
            await folderPrompts.getFolderEntitiesCount(
              nestedFolders[levelsCount - 1].name,
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
          nestedFolders[levelsCount - 1].name,
        );
        await folderDropdownMenu.selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });

        await dialHomePage.importFile(exportedData, () =>
          promptBar.importButton.click(),
        );

        await folderPrompts
          .getFolderEntity(
            nestedFolders[levelsCount - 1].name,
            nestedPrompts[levelsCount - 1].name,
          )
          .waitFor();
      },
    );

    await dialTest.step(
      'Delete 2nd level folder with its nested content, re-import exported file and verify 2nd/3rd level folders with 3rd level prompt are imported',
      async () => {
        await folderPrompts.openFolderDropdownMenu(
          nestedFolders[levelsCount - 2].name,
        );
        await folderDropdownMenu.selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });

        await dialHomePage.importFile(exportedData, () =>
          promptBar.importButton.click(),
        );

        await folderPrompts
          .getFolderEntity(
            nestedFolders[levelsCount - 1].name,
            nestedPrompts[levelsCount - 1].name,
          )
          .waitFor();

        await folderPrompts
          .getFolderByName(nestedFolders[levelsCount - 2].name)
          .waitFor();

        expect
          .soft(
            await folderPrompts.getFolderEntitiesCount(
              nestedFolders[levelsCount - 1].name,
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
          .toBe(levelsCount);

        for (let i = 0; i < levelsCount - 1; i++) {
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

dialTest.only(
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
        thirdLevelFolderPrompt.folderId = nestedFolders[levelsCount - 1].id;
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
        nestedFolders[levelsCount - 1].name,
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
          nestedFolders[levelsCount - 1].name,
          nestedFolders[0].name,
          { isHttpMethodTriggered: true },
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
          nestedFolders[levelsCount - 1].name,
          { isHttpMethodTriggered: false },
          2,
        );
        await folderPrompts
          .getFolderEntity(
            nestedFolders[levelsCount - 1].name,
            thirdLevelFolderPrompt.name,
            2,
          )
          .waitFor();

        const foldersCount = await folderPrompts.getFoldersCount();
        expect
          .soft(foldersCount, ExpectedMessages.foldersCountIsValid)
          .toBe(levelsCount + 1);
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
