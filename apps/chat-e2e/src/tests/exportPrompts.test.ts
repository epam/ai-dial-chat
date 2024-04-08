import { FolderInterface } from '@/chat/types/folder';
import { Prompt } from '@/chat/types/prompt';
import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  FolderPrompt,
  MenuOptions,
} from '@/src/testData';
import { UploadDownloadData } from '@/src/ui/pages';
import { FileUtil } from '@/src/utils';
import { expect } from '@playwright/test';

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
    dataInjector,
    prompts,
    folderPrompts,
    promptBar,
    confirmationDialog,
    promptData,
    sendMessage,
  }) => {
    setTestIds('EPMRTC-883', 'EPMRTC-895');
    let promptsInsideFolder: FolderPrompt;
    let promptOutsideFolder: Prompt;
    let nestedFolders: FolderInterface[];
    let nestedPrompts: Prompt[];
    let exportedData: UploadDownloadData;
    const promptContent = 'test';

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
      'Delete all prompts and folders, re-import again and verify they are displayed',
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
        await folderPrompts
          .getFolderByName(ExpectedConstants.newFolderWithIndexTitle(1))
          .waitFor();

        await prompts.getPromptByName(promptOutsideFolder.name).waitFor();

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
          .selectPrompt(promptOutsideFolder.name, {
            triggeredHttpMethod: 'GET',
          });

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
        await prompts.openPromptDropdownMenu(promptOutsideFolder.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
        await promptModalDialog.updatePromptDetailsWithButton(
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
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        await prompts
          .getPromptByName(promptOutsideFolder.name)
          .waitFor({ state: 'hidden' });
        await dialHomePage.importFile(exportedData, () =>
          promptBar.importButton.click(),
        );
        await prompts.getPromptByName(promptOutsideFolder.name).waitFor();
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
        await dialHomePage.importFile(exportedData, () =>
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

        await dialHomePage.importFile(exportedData, () =>
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

        await dialHomePage.importFile(exportedData, () =>
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
