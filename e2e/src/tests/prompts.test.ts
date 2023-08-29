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
