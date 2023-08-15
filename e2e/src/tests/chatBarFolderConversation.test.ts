import test from '@/e2e/src/core/fixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
} from '@/e2e/src/testData';
import { expect } from '@playwright/test';

test('Create new chat folder', async ({
  dialHomePage,
  chatBar,
  folderConversations,
}) => {
  await dialHomePage.openHomePage();
  await chatBar.createNewFolder();
  expect
    .soft(
      await folderConversations
        .getFolderByName(ExpectedConstants.newFolderTitle)
        .isVisible(),
      ExpectedMessages.newFolderCreated,
    )
    .toBeTruthy();
});

test(`Rename chat folder when it's empty using Enter`, async ({
  dialHomePage,
  conversationData,
  folderConversations,
  localStorageManager,
  folderDropdownMenu,
}) => {
  const folder = conversationData.prepareDefaultFolder();
  await localStorageManager.setFolders(folder);

  const newName = 'updated folder name';
  await dialHomePage.openHomePage();
  await folderConversations.openFolderDropdownMenu(folder.name);
  await folderDropdownMenu.selectMenuOption(MenuOptions.edit);
  await folderConversations.editFolderNameWithEnter(folder.name, newName);
  expect
    .soft(
      await folderConversations.getFolderByName(newName).isVisible(),
      ExpectedMessages.folderNameUpdated,
    )
    .toBeTruthy();
});

test(`Cancel folder renaming on "x"`, async ({
  dialHomePage,
  conversationData,
  folderConversations,
  localStorageManager,
  conversationDropdownMenu,
}) => {
  const folder = conversationData.prepareDefaultFolder();
  await localStorageManager.setFolders(folder);

  await dialHomePage.openHomePage();
  await folderConversations.openFolderDropdownMenu(folder.name);
  await conversationDropdownMenu.selectMenuOption(MenuOptions.edit);
  await folderConversations.getFolderInput(folder.name).clickCancelButton();
  expect
    .soft(
      await folderConversations.getFolderByName(folder.name).isVisible(),
      ExpectedMessages.folderNameNotUpdated,
    )
    .toBeTruthy();
});

test('Rename chat folder when chats are inside using check button', async ({
  dialHomePage,
  conversationData,
  folderConversations,
  localStorageManager,
  folderDropdownMenu,
}) => {
  const conversationInFolder =
    conversationData.prepareDefaultConversationInFolder();
  await localStorageManager.setFolders(conversationInFolder.folders);
  await localStorageManager.setConversationHistory(
    conversationInFolder.conversations,
  );

  const newName = 'updated folder name';
  await dialHomePage.openHomePage();
  await folderConversations.openFolderDropdownMenu(
    conversationInFolder.folders.name,
  );
  await folderDropdownMenu.selectMenuOption(MenuOptions.edit);
  await folderConversations.editFolderNameWithTick(
    conversationInFolder.folders.name,
    newName,
  );
  expect
    .soft(
      await folderConversations.getFolderByName(newName).isVisible(),
      ExpectedMessages.folderNameUpdated,
    )
    .toBeTruthy();
});

test('Folders can expand and collapse', async ({
  dialHomePage,
  conversationData,
  folderConversations,
  localStorageManager,
}) => {
  const conversationInFolder =
    conversationData.prepareDefaultConversationInFolder();
  await localStorageManager.setFolders(conversationInFolder.folders);
  await localStorageManager.setConversationHistory(
    conversationInFolder.conversations,
  );
  const folderName = conversationInFolder.folders.name;

  await dialHomePage.openHomePage();
  await folderConversations.expandCollapseFolder(folderName);
  let conversations = await folderConversations.getFolderConversations(
    folderName,
  );
  expect
    .soft(await conversations.isVisible(), ExpectedMessages.folderExpanded)
    .toBeTruthy();

  await folderConversations.expandCollapseFolder(folderName);
  conversations = await folderConversations.getFolderConversations(folderName);
  expect
    .soft(await conversations.isVisible(), ExpectedMessages.folderCollapsed)
    .toBeFalsy();
});

test('Delete folder. Cancel', async ({
  dialHomePage,
  conversationData,
  folderConversations,
  localStorageManager,
  conversationDropdownMenu,
}) => {
  const folder = conversationData.prepareDefaultFolder();
  await localStorageManager.setFolders(folder);

  await dialHomePage.openHomePage();
  await folderConversations.openFolderDropdownMenu(folder.name);
  await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
  await folderConversations.getFolderInput(folder.name).clickCancelButton();
  expect
    .soft(
      await folderConversations.getFolderByName(folder.name).isVisible(),
      ExpectedMessages.folderNotDeleted,
    )
    .toBeTruthy();
});
