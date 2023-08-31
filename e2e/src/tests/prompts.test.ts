import test from '@/e2e/src/core/fixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
} from '@/e2e/src/testData';
import { expect } from '@playwright/test';

const newName = 'test prompt';
const newDescr = 'test description';
const newValue = 'what is {{}}';

test('Create new prompt', async ({ dialHomePage, promptBar, prompts }) => {
  await dialHomePage.openHomePage();
  await promptBar.createNewPrompt();
  expect
    .soft(
      await prompts
        .getPromptByName(ExpectedConstants.newPromptTitle(1))
        .isVisible(),
      ExpectedMessages.newPromptCreated,
    )
    .toBeTruthy();
});

test('Prompt menu', async ({
  dialHomePage,
  promptData,
  prompts,
  localStorageManager,
  promptDropdownMenu,
}) => {
  const prompt = promptData.prepareDefaultPrompt();
  await localStorageManager.setPrompts(prompt);

  await dialHomePage.openHomePage();
  await prompts.openPromptDropdownMenu(prompt.name);

  const menuOptions = await promptDropdownMenu.getAllMenuOptions();
  expect
    .soft(menuOptions, ExpectedMessages.conversationContextOptionsValid)
    .toEqual([
      MenuOptions.edit,
      MenuOptions.export,
      MenuOptions.moveTo,
      MenuOptions.delete,
    ]);
});

test('Edit prompt. Cancel', async ({
  dialHomePage,
  promptData,
  prompts,
  localStorageManager,
  promptDropdownMenu,
  promptModalDialog,
  promptBar,
}) => {
  const prompt = promptData.prepareDefaultPrompt();
  await localStorageManager.setPrompts(prompt);

  await dialHomePage.openHomePage();
  await prompts.openPromptDropdownMenu(prompt.name);
  await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
  await promptModalDialog.fillPromptDetails(newName, newDescr, newValue);
  await promptBar.click();

  const isPromptModalVisible = await promptModalDialog.isVisible();
  await expect
    .soft(isPromptModalVisible, ExpectedMessages.promptModalClosed)
    .toBeFalsy();

  const isPromptVisible = await prompts
    .getPromptByName(prompt.name)
    .isVisible();
  expect.soft(isPromptVisible, ExpectedMessages.promptNotUpdated).toBeTruthy();
});

test('Edit prompt. Save', async ({
  dialHomePage,
  promptData,
  prompts,
  localStorageManager,
  promptDropdownMenu,
  promptModalDialog,
}) => {
  const prompt = promptData.prepareDefaultPrompt();
  await localStorageManager.setPrompts(prompt);

  await dialHomePage.openHomePage();
  await prompts.openPromptDropdownMenu(prompt.name);
  await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
  await promptModalDialog.updatePromptDetails(newName, newDescr, newValue);

  const isPromptModalVisible = await promptModalDialog.isVisible();
  await expect
    .soft(isPromptModalVisible, ExpectedMessages.promptModalClosed)
    .toBeFalsy();

  const isPromptVisible = await prompts.getPromptByName(newName).isVisible();
  expect.soft(isPromptVisible, ExpectedMessages.promptNotUpdated).toBeTruthy();

  await prompts.openPromptDropdownMenu(newName);
  await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
  expect
    .soft(await promptModalDialog.getName(), ExpectedMessages.promptNameUpdated)
    .toBe(newName);
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

test('Edit prompt on Enter', async ({
  dialHomePage,
  promptData,
  prompts,
  localStorageManager,
  promptDropdownMenu,
  promptModalDialog,
}) => {
  const prompt = promptData.prepareDefaultPrompt();
  await localStorageManager.setPrompts(prompt);

  await dialHomePage.openHomePage();
  await prompts.openPromptDropdownMenu(prompt.name);
  await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
  await promptModalDialog.updatePromptDetailsWithEnter(
    newName,
    newDescr,
    newValue,
  );

  const isPromptModalVisible = await promptModalDialog.isVisible();
  await expect
    .soft(isPromptModalVisible, ExpectedMessages.promptModalClosed)
    .toBeFalsy();

  const isPromptVisible = await prompts.getPromptByName(newName).isVisible();
  expect.soft(isPromptVisible, ExpectedMessages.promptNotUpdated).toBeTruthy();

  await prompts.openPromptDropdownMenu(newName);
  await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
  expect
    .soft(await promptModalDialog.getName(), ExpectedMessages.promptNameUpdated)
    .toBe(newName);
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

test('Delete prompt located in the root', async ({
  dialHomePage,
  promptData,
  prompts,
  localStorageManager,
  promptDropdownMenu,
}) => {
  const prompt = promptData.prepareDefaultPrompt();
  await localStorageManager.setPrompts(prompt);

  await dialHomePage.openHomePage();

  await prompts.openPromptDropdownMenu(prompt.name);
  await promptDropdownMenu.selectMenuOption(MenuOptions.delete);
  await prompts.getPromptInput(prompt.name).clickTickButton();
  expect
    .soft(
      await prompts.getPromptByName(prompt.name).isVisible(),
      ExpectedMessages.promptDeleted,
    )
    .toBeFalsy();
});

test('Delete prompt. Cancel', async ({
  dialHomePage,
  promptData,
  prompts,
  localStorageManager,
  promptDropdownMenu,
}) => {
  const prompt = promptData.prepareDefaultPrompt();
  await localStorageManager.setPrompts(prompt);

  await dialHomePage.openHomePage();

  await prompts.openPromptDropdownMenu(prompt.name);
  await promptDropdownMenu.selectMenuOption(MenuOptions.delete);
  await prompts.getPromptInput(prompt.name).clickCancelButton();
  expect
    .soft(
      await prompts.getPromptByName(prompt.name).isVisible(),
      ExpectedMessages.promptNotDeleted,
    )
    .toBeTruthy();
});

test('Clear prompts. Cancel', async ({
  dialHomePage,
  conversations,
  conversationData,
  promptData,
  localStorageManager,
  folderConversations,
  folderPrompts,
  promptBar,
  confirmationDialog,
  prompts,
}) => {
  const emptyPromptFolder = promptData.prepareFolder();
  promptData = promptData.resetData();
  const singlePrompt = promptData.prepareDefaultPrompt();
  promptData = promptData.resetData();
  const promptInFolder = promptData.prepareDefaultPromptInFolder();

  const singleConversation = conversationData.prepareDefaultConversation();
  conversationData = conversationData.resetData();
  const conversationInFolder =
    conversationData.prepareDefaultConversationInFolder();

  await localStorageManager.setPrompts(singlePrompt, promptInFolder.prompts);
  await localStorageManager.setConversationHistory(
    singleConversation,
    conversationInFolder.conversations,
  );
  await localStorageManager.setFolders(
    emptyPromptFolder,
    promptInFolder.folders,
    conversationInFolder.folders,
  );

  await dialHomePage.openHomePage();
  await folderPrompts.expandCollapseFolder(promptInFolder.folders.name);
  await folderConversations.expandCollapseFolder(
    conversationInFolder.folders.name,
  );
  await promptBar.deleteAllPrompts();
  await confirmationDialog.cancelDialog();

  const isFolderConversationVisible =
    await folderConversations.isFolderConversationVisible(
      conversationInFolder.folders.name,
      conversationInFolder.conversations.name,
    );
  expect
    .soft(isFolderConversationVisible, ExpectedMessages.conversationNotDeleted)
    .toBeTruthy();

  const isSingleConversationVisible = await conversations
    .getConversationByName(singleConversation.name)
    .isVisible();
  expect
    .soft(isSingleConversationVisible, ExpectedMessages.conversationNotDeleted)
    .toBeTruthy();

  const isPromptFolderVisible = await folderPrompts
    .getFolderByName(emptyPromptFolder.name)
    .isVisible();
  expect
    .soft(isPromptFolderVisible, ExpectedMessages.folderNotDeleted)
    .toBeTruthy();

  const isFolderPromptVisible = await folderPrompts.isFolderPromptVisible(
    promptInFolder.folders.name,
    promptInFolder.prompts.name,
  );
  expect
    .soft(isFolderPromptVisible, ExpectedMessages.promptNotDeleted)
    .toBeTruthy();

  const isSinglePromptVisible = await prompts
    .getPromptByName(singlePrompt.name)
    .isVisible();
  expect
    .soft(isSinglePromptVisible, ExpectedMessages.promptNotDeleted)
    .toBeTruthy();
});
