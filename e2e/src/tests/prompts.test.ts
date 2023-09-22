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

test('Create new prompt', async ({
  dialHomePage,
  promptBar,
  prompts,
  chat,
  setTestIds,
}) => {
  setTestIds('EPMRTC-945');
  await dialHomePage.openHomePage();
  await chat.waitForState();
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
  setTestIds,
  chat,
}) => {
  setTestIds('EPMRTC-952');
  const prompt = promptData.prepareDefaultPrompt();
  await localStorageManager.setPrompts(prompt);

  await dialHomePage.openHomePage();
  await chat.waitForState();
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
  setTestIds,
  chat,
}) => {
  setTestIds('EPMRTC-953');
  const prompt = promptData.prepareDefaultPrompt();
  await localStorageManager.setPrompts(prompt);

  await dialHomePage.openHomePage();
  await chat.waitForState();
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
  chat,
  setTestIds,
}) => {
  setTestIds('EPMRTC-954');
  const prompt = promptData.prepareDefaultPrompt();
  await localStorageManager.setPrompts(prompt);

  await dialHomePage.openHomePage();
  await chat.waitForState();
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
  chat,
  setTestIds,
}) => {
  setTestIds('EPMRTC-955');
  const prompt = promptData.prepareDefaultPrompt();
  await localStorageManager.setPrompts(prompt);

  await dialHomePage.openHomePage();
  await chat.waitForState();
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
  chat,
  setTestIds,
}) => {
  setTestIds('EPMRTC-969');
  const prompt = promptData.prepareDefaultPrompt();
  await localStorageManager.setPrompts(prompt);

  await dialHomePage.openHomePage();
  await chat.waitForState();
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
  chat,
  setTestIds,
}) => {
  setTestIds('EPMRTC-970');
  const prompt = promptData.prepareDefaultPrompt();
  await localStorageManager.setPrompts(prompt);

  await dialHomePage.openHomePage();
  await chat.waitForState();
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
  chat,
  setTestIds,
}) => {
  setTestIds('EPMRTC-971');
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
  await chat.waitForState();
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

test('Clear prompts. Clear', async ({
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
  chat,
  setTestIds,
  setIssueIds,
}) => {
  setTestIds('EPMRTC-972');
  setIssueIds('269');
  const emptyPromptFolder = promptData.prepareFolder();
  promptData = promptData.resetData();
  const singlePrompt = promptData.prepareDefaultPrompt();
  promptData = promptData.resetData();
  const promptInFolder = promptData.prepareDefaultPromptInFolder();

  const emptyConversationFolder = conversationData.prepareFolder();
  conversationData = conversationData.resetData();
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
    emptyConversationFolder,
    promptInFolder.folders,
    conversationInFolder.folders,
  );

  await dialHomePage.openHomePage();
  await chat.waitForState();
  await folderPrompts.expandCollapseFolder(promptInFolder.folders.name);
  await folderConversations.expandCollapseFolder(
    conversationInFolder.folders.name,
  );
  await promptBar.deleteAllPrompts();
  await confirmationDialog.confirm();

  let i = 2;
  while (i > 0) {
    const isEmptyConversationFolderVisible = await folderConversations
      .getFolderByName(emptyConversationFolder.name)
      .isVisible();
    expect
      .soft(isEmptyConversationFolderVisible, ExpectedMessages.folderNotDeleted)
      .toBeTruthy();

    const isFolderConversationVisible =
      await folderConversations.isFolderConversationVisible(
        conversationInFolder.folders.name,
        conversationInFolder.conversations.name,
      );
    expect
      .soft(
        isFolderConversationVisible,
        ExpectedMessages.conversationNotDeleted,
      )
      .toBeTruthy();

    const isSingleConversationVisible = await conversations
      .getConversationByName(singleConversation.name)
      .isVisible();
    expect
      .soft(
        isSingleConversationVisible,
        ExpectedMessages.conversationNotDeleted,
      )
      .toBeTruthy();

    const isPromptFolderVisible = await folderPrompts
      .getFolderByName(emptyPromptFolder.name)
      .isVisible();
    expect
      .soft(isPromptFolderVisible, ExpectedMessages.folderDeleted)
      .toBeFalsy();

    const isFolderPromptVisible = await folderPrompts.isFolderPromptVisible(
      promptInFolder.folders.name,
      promptInFolder.prompts.name,
    );
    expect
      .soft(isFolderPromptVisible, ExpectedMessages.promptDeleted)
      .toBeFalsy();

    const isSinglePromptVisible = await prompts
      .getPromptByName(singlePrompt.name)
      .isVisible();
    expect
      .soft(isSinglePromptVisible, ExpectedMessages.promptDeleted)
      .toBeFalsy();

    if (i > 1) {
      await dialHomePage.reloadPage();
    }
    i--;
  }
});

test(`[UI] Delete all prompts button doesn't exist if not prompts are created`, async ({
  dialHomePage,
  promptBar,
  setTestIds,
}) => {
  setTestIds('EPMRTC-973');
  await dialHomePage.openHomePage();

  const isDeleteAllPromptVisible =
    await promptBar.deleteAllPromptsButton.isVisible();
  expect
    .soft(
      isDeleteAllPromptVisible,
      ExpectedMessages.deleteAllPromptsButtonNotVisible,
    )
    .toBeFalsy();
});

test('Use simple prompt in system prompt', async ({
  dialHomePage,
  promptData,
  localStorageManager,
  entitySettings,
  setTestIds,
}) => {
  setTestIds('EPMRTC-1010');
  const promptContent = 'prompt content';
  const prompt = promptData.preparePrompt(promptContent);
  await localStorageManager.setPrompts(prompt);

  await dialHomePage.openHomePage();
  await entitySettings.setSystemPrompt('/');
  await entitySettings.getPromptList().selectPrompt(prompt.name);
  const actualPrompt = await entitySettings.getSystemPrompt();
  expect
    .soft(actualPrompt, ExpectedMessages.systemPromptValid)
    .toBe(prompt.content);
});

test('Use prompt with parameters', async ({
  dialHomePage,
  promptData,
  localStorageManager,
  sendMessage,
  variableModalDialog,
  chat,
  setTestIds,
}) => {
  setTestIds('EPMRTC-1012');
  const promptDescription = 'Prompt description';
  const aVariable = 'A';
  const promptContent = (variable: string) => `Calculate ${variable} * 100`;
  const prompt = promptData.preparePrompt(
    promptContent(`{{${aVariable}}}`),
    promptDescription,
  );
  await localStorageManager.setPrompts(prompt);

  await dialHomePage.openHomePage();
  await chat.waitForState();
  await sendMessage.messageInput.fillInInput('/');
  await sendMessage.getPromptList().selectPrompt(prompt.name);

  const promptName = await variableModalDialog.getName();
  expect.soft(promptName, ExpectedMessages.promptNameValid).toBe(prompt.name);

  const promptDescr = await variableModalDialog.getDescription();
  expect
    .soft(promptDescr, ExpectedMessages.promptDescriptionValid)
    .toBe(prompt.description);

  const promptVariablePlaceholder =
    await variableModalDialog.getVariablePlaceholder(aVariable);
  expect
    .soft(
      promptVariablePlaceholder,
      ExpectedMessages.promptVariablePlaceholderValid,
    )
    .toBe(ExpectedConstants.promptPlaceholder(aVariable));

  const variable = '20';
  await variableModalDialog.setVariable(aVariable, variable);

  const actualMessage = await sendMessage.getMessage();
  expect
    .soft(actualMessage, ExpectedMessages.promptApplied)
    .toBe(promptContent(variable));
});

test('Check that all parameters in prompt are required', async ({
  page,
  dialHomePage,
  promptData,
  localStorageManager,
  sendMessage,
  variableModalDialog,
  chat,
  setTestIds,
}) => {
  setTestIds('EPMRTC-1013');
  const promptContent = (first: string, second: string) =>
    `Calculate ${first} * ${second}`;
  const aVariable = 'A';
  const bVariable = 'B';
  const prompt = promptData.preparePrompt(
    promptContent(`{{${aVariable}}}`, `{{${bVariable}}}`),
  );
  await localStorageManager.setPrompts(prompt);

  await dialHomePage.openHomePage();
  await chat.waitForState();
  await sendMessage.messageInput.fillInInput('/');
  await sendMessage.getPromptList().selectPrompt(prompt.name);

  const firstVariableValue = '20';
  const secondVariableValue = '30';
  page.on('dialog', (dialog) => dialog.accept('Please fill out all variables'));
  await variableModalDialog.submitButton.click();
  await variableModalDialog.setVariable(aVariable, firstVariableValue);
  await variableModalDialog.setVariable(bVariable, secondVariableValue);

  const actualMessage = await sendMessage.getMessage();
  expect
    .soft(actualMessage, ExpectedMessages.promptApplied)
    .toBe(promptContent(firstVariableValue, secondVariableValue));
});
