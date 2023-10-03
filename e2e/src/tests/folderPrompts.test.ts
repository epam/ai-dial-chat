import test from '@/e2e/src/core/fixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
} from '@/e2e/src/testData';
import { expect } from '@playwright/test';

test('Create new prompt folder', async ({
  dialHomePage,
  promptBar,
  folderPrompts,
  setTestIds,
}) => {
  setTestIds('EPMRTC-944');
  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded();
  await promptBar.createNewFolder();
  expect
    .soft(
      await folderPrompts
        .getFolderByName(ExpectedConstants.newFolderTitle)
        .isVisible(),
      ExpectedMessages.newFolderCreated,
    )
    .toBeTruthy();
});

test('Prompt folder can expand and collapse', async ({
  dialHomePage,
  promptData,
  folderPrompts,
  localStorageManager,
  setTestIds,
}) => {
  setTestIds('EPMRTC-946');
  const promptInFolder = promptData.prepareDefaultPromptInFolder();
  await localStorageManager.setFolders(promptInFolder.folders);
  await localStorageManager.setPrompts(promptInFolder.prompts);
  const folderName = promptInFolder.folders.name;

  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded();
  await folderPrompts.expandCollapseFolder(folderName);
  let isPromptVisible = await folderPrompts.isFolderPromptVisible(
    folderName,
    promptInFolder.prompts.name,
  );
  expect.soft(isPromptVisible, ExpectedMessages.folderExpanded).toBeTruthy();

  await folderPrompts.expandCollapseFolder(folderName);
  isPromptVisible = await folderPrompts.isFolderPromptVisible(
    folderName,
    promptInFolder.prompts.name,
  );
  expect.soft(isPromptVisible, ExpectedMessages.folderCollapsed).toBeFalsy();
});

test('Rename prompt folder on Enter', async ({
  dialHomePage,
  promptData,
  folderPrompts,
  localStorageManager,
  folderDropdownMenu,
  setTestIds,
}) => {
  setTestIds('EPMRTC-948');
  const newName = 'updated folder name';
  const folder = promptData.prepareFolder();
  await localStorageManager.setFolders(folder);

  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded();
  await folderPrompts.openFolderDropdownMenu(folder.name);
  await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
  await folderPrompts.editFolderNameWithEnter(folder.name, newName);
  expect
    .soft(
      await folderPrompts.getFolderByName(newName).isVisible(),
      ExpectedMessages.folderNameUpdated,
    )
    .toBeTruthy();
});

test('Cancel folder renaming on "x"', async ({
  dialHomePage,
  promptData,
  folderPrompts,
  localStorageManager,
  folderDropdownMenu,
  setTestIds,
}) => {
  setTestIds('EPMRTC-949');
  const newName = 'updated folder name';
  const folder = promptData.prepareFolder();
  await localStorageManager.setFolders(folder);

  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded();
  await folderPrompts.openFolderDropdownMenu(folder.name);
  await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
  const folderInput = await folderPrompts.editFolderName(folder.name, newName);
  await folderInput.clickCancelButton();
  expect
    .soft(
      await folderPrompts.getFolderByName(folder.name).isVisible(),
      ExpectedMessages.folderNameNotUpdated,
    )
    .toBeTruthy();
});

test('Rename prompt folder when prompts are inside using check button', async ({
  dialHomePage,
  promptData,
  folderPrompts,
  localStorageManager,
  folderDropdownMenu,
  setTestIds,
}) => {
  setTestIds('EPMRTC-950');
  const promptInFolder = promptData.prepareDefaultPromptInFolder();
  await localStorageManager.setFolders(promptInFolder.folders);
  await localStorageManager.setPrompts(promptInFolder.prompts);

  const newName = 'updated folder name';
  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded();
  await folderPrompts.openFolderDropdownMenu(promptInFolder.folders.name);
  await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
  await folderPrompts.editFolderNameWithTick(
    promptInFolder.folders.name,
    newName,
  );
  expect
    .soft(
      await folderPrompts.getFolderByName(newName).isVisible(),
      ExpectedMessages.folderNameUpdated,
    )
    .toBeTruthy();
});

test('Prompt is moved out of the folder via drag&drop', async ({
  dialHomePage,
  promptData,
  folderPrompts,
  localStorageManager,
  prompts,
  setTestIds,
}) => {
  setTestIds('EPMRTC-961');
  const promptInFolder = promptData.prepareDefaultPromptInFolder();
  await localStorageManager.setFolders(promptInFolder.folders);
  await localStorageManager.setPrompts(promptInFolder.prompts);

  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded();
  await folderPrompts.expandCollapseFolder(promptInFolder.folders.name);
  await folderPrompts.dropPromptFromFolder(
    promptInFolder.folders.name,
    promptInFolder.prompts.name,
  );
  expect
    .soft(
      await folderPrompts.isFolderPromptVisible(
        promptInFolder.folders.name,
        promptInFolder.prompts.name,
      ),
      ExpectedMessages.promptMovedToFolder,
    )
    .toBeFalsy();

  const isPromptVisible = await prompts
    .getPromptByName(promptInFolder.prompts.name)
    .isVisible();
  expect.soft(isPromptVisible, ExpectedMessages.promptIsVisible).toBeTruthy();
});

test('Prompt is moved to folder created from Move to', async ({
  dialHomePage,
  prompts,
  promptDropdownMenu,
  promptData,
  localStorageManager,
  folderPrompts,
  setTestIds,
}) => {
  setTestIds('EPMRTC-962');
  const prompt = promptData.prepareDefaultPrompt();
  await localStorageManager.setPrompts(prompt);

  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded();
  await prompts.openPromptDropdownMenu(prompt.name);
  await promptDropdownMenu.selectMenuOption(MenuOptions.moveTo);
  await promptDropdownMenu.selectMenuOption(MenuOptions.newFolder);

  await folderPrompts.expandCollapseFolder(ExpectedConstants.newFolderTitle);
  const isFolderPromptVisible = await folderPrompts.isFolderPromptVisible(
    ExpectedConstants.newFolderTitle,
    prompt.name,
  );
  expect
    .soft(isFolderPromptVisible, ExpectedMessages.promptMovedToFolder)
    .toBeTruthy();
});

test('Prompt is moved to folder from Move to list', async ({
  dialHomePage,
  prompts,
  promptDropdownMenu,
  promptData,
  localStorageManager,
  folderPrompts,
  setTestIds,
}) => {
  setTestIds('EPMRTC-963');
  const folderToMoveIn = promptData.prepareFolder();
  const prompt = promptData.prepareDefaultPrompt();
  await localStorageManager.setPrompts(prompt);
  await localStorageManager.setFolders(folderToMoveIn);

  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded();
  await folderPrompts.expandCollapseFolder(folderToMoveIn.name);

  await prompts.openPromptDropdownMenu(prompt.name);
  await promptDropdownMenu.selectMenuOption(MenuOptions.moveTo);
  await promptDropdownMenu.selectMenuOption(folderToMoveIn.name);

  const isFolderPromptVisible = await folderPrompts.isFolderPromptVisible(
    folderToMoveIn.name,
    prompt.name,
  );
  expect
    .soft(isFolderPromptVisible, ExpectedMessages.promptMovedToFolder)
    .toBeTruthy();
});

test('Delete folder when there are some prompts inside', async ({
  dialHomePage,
  promptData,
  folderPrompts,
  localStorageManager,
  promptDropdownMenu,
  prompts,
  setTestIds,
}) => {
  setTestIds('EPMRTC-966');
  const promptInFolder = promptData.prepareDefaultPromptInFolder();
  await localStorageManager.setFolders(promptInFolder.folders);
  await localStorageManager.setPrompts(promptInFolder.prompts);

  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded();
  await folderPrompts.openFolderDropdownMenu(promptInFolder.folders.name);
  await promptDropdownMenu.selectMenuOption(MenuOptions.delete);
  await folderPrompts
    .getFolderInput(promptInFolder.folders.name)
    .clickTickButton();
  expect
    .soft(
      await folderPrompts
        .getFolderByName(promptInFolder.folders.name)
        .isVisible(),
      ExpectedMessages.folderDeleted,
    )
    .toBeFalsy();

  const isPromptVisible = await prompts.getPromptByName(
    promptInFolder.prompts.name,
  );
  expect.soft(isPromptVisible, ExpectedMessages.promptIsVisible).toBeTruthy();
});

test('Delete folder. Cancel', async ({
  dialHomePage,
  promptData,
  folderPrompts,
  localStorageManager,
  promptDropdownMenu,
  setTestIds,
}) => {
  setTestIds('EPMRTC-967');
  const folder = promptData.prepareFolder();
  await localStorageManager.setFolders(folder);

  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded();
  await folderPrompts.openFolderDropdownMenu(folder.name);
  await promptDropdownMenu.selectMenuOption(MenuOptions.delete);
  await folderPrompts.getFolderInput(folder.name).clickCancelButton();
  expect
    .soft(
      await folderPrompts.getFolderByName(folder.name).isVisible(),
      ExpectedMessages.folderNotDeleted,
    )
    .toBeTruthy();
});

test('Delete prompt in the folder', async ({
  dialHomePage,
  promptData,
  folderPrompts,
  localStorageManager,
  promptDropdownMenu,
  setTestIds,
}) => {
  setTestIds('EPMRTC-968');
  const promptInFolder = promptData.prepareDefaultPromptInFolder();
  await localStorageManager.setFolders(promptInFolder.folders);
  await localStorageManager.setPrompts(promptInFolder.prompts);

  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded();
  await folderPrompts.expandCollapseFolder(promptInFolder.folders.name);
  await folderPrompts.openFolderPromptDropdownMenu(
    promptInFolder.folders.name,
    promptInFolder.prompts.name,
  );
  await promptDropdownMenu.selectMenuOption(MenuOptions.delete);
  await folderPrompts
    .getFolderInput(promptInFolder.prompts.name)
    .clickTickButton();
  expect
    .soft(
      await folderPrompts
        .getFolderPrompt(
          promptInFolder.folders.name,
          promptInFolder.prompts.name,
        )
        .isVisible(),
      ExpectedMessages.promptDeleted,
    )
    .toBeFalsy();
});
