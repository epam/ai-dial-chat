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
  setTestIds,
}) => {
  setTestIds('EPMRTC-569');
  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
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
  setTestIds,
}) => {
  setTestIds('EPMRTC-571');
  const folder = conversationData.prepareDefaultFolder();
  await localStorageManager.setFolders(folder);

  const newName = 'updated folder name';
  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded();
  await folderConversations.openFolderDropdownMenu(folder.name);
  await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
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
  setTestIds,
}) => {
  setTestIds('EPMRTC-572');
  const newName = 'updated folder name';
  const folder = conversationData.prepareDefaultFolder();
  await localStorageManager.setFolders(folder);

  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded();
  await folderConversations.openFolderDropdownMenu(folder.name);
  await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
  const folderInput = await folderConversations.editFolderName(
    folder.name,
    newName,
  );
  await folderInput.clickCancelButton();
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
  setTestIds,
}) => {
  setTestIds('EPMRTC-573');
  const conversationInFolder =
    conversationData.prepareDefaultConversationInFolder();
  await localStorageManager.setFolders(conversationInFolder.folders);
  await localStorageManager.setConversationHistory(
    conversationInFolder.conversations[0],
  );

  const newName = 'updated folder name';
  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded();
  await folderConversations.openFolderDropdownMenu(
    conversationInFolder.folders.name,
  );
  await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
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
  setTestIds,
}) => {
  setTestIds('EPMRTC-579');
  const conversationInFolder =
    conversationData.prepareDefaultConversationInFolder();
  await localStorageManager.setFolders(conversationInFolder.folders);
  await localStorageManager.setConversationHistory(
    conversationInFolder.conversations[0],
  );
  const folderName = conversationInFolder.folders.name;

  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded();
  await folderConversations.expandCollapseFolder(folderName);
  let isConversationVisible =
    await folderConversations.isFolderConversationVisible(
      folderName,
      conversationInFolder.conversations[0].name,
    );
  expect
    .soft(isConversationVisible, ExpectedMessages.folderExpanded)
    .toBeTruthy();

  await folderConversations.expandCollapseFolder(folderName);
  isConversationVisible = await folderConversations.isFolderConversationVisible(
    folderName,
    conversationInFolder.conversations[0].name,
  );
  expect
    .soft(isConversationVisible, ExpectedMessages.folderCollapsed)
    .toBeFalsy();
});

test('Delete folder. Cancel', async ({
  dialHomePage,
  conversationData,
  folderConversations,
  localStorageManager,
  conversationDropdownMenu,
  confirmationDialog,
  setTestIds,
}) => {
  setTestIds('EPMRTC-606');
  const folder = conversationData.prepareDefaultFolder();
  await localStorageManager.setFolders(folder);

  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded();
  await folderConversations.openFolderDropdownMenu(folder.name);
  await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
  await confirmationDialog.cancelDialog();
  expect
    .soft(
      await folderConversations.getFolderByName(folder.name).isVisible(),
      ExpectedMessages.folderNotDeleted,
    )
    .toBeTruthy();
});

test('Delete folder when there are some chats inside', async ({
  dialHomePage,
  conversationData,
  folderConversations,
  localStorageManager,
  conversationDropdownMenu,
  conversations,
  confirmationDialog,
  setTestIds,
}) => {
  setTestIds('EPMRTC-605');
  const conversationInFolder =
    conversationData.prepareDefaultConversationInFolder();
  await localStorageManager.setFolders(conversationInFolder.folders);
  await localStorageManager.setConversationHistory(
    conversationInFolder.conversations[0],
  );

  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded();
  await folderConversations.openFolderDropdownMenu(
    conversationInFolder.folders.name,
  );
  await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
  await confirmationDialog.confirm();
  expect
    .soft(
      await folderConversations
        .getFolderByName(conversationInFolder.folders.name)
        .isVisible(),
      ExpectedMessages.folderDeleted,
    )
    .toBeFalsy();

  const todayConversations = await conversations.getTodayConversations();
  expect
    .soft(
      todayConversations.includes(conversationInFolder.conversations[0].name),
      ExpectedMessages.conversationOfToday,
    )
    .toBeFalsy();
});
