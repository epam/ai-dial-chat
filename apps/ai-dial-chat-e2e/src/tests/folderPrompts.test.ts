import { FolderInterface } from '@/ai-dial-chat/types/folder';
import { Prompt } from '@/ai-dial-chat/types/prompt';
import test from '@/src/core/fixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  FolderPrompt,
  MenuOptions,
} from '@/src/testData';
import { GeneratorUtil } from '@/src/utils';
import { expect } from '@playwright/test';

test('Create new prompt folder', async ({
  dialHomePage,
  promptBar,
  folderPrompts,
  setTestIds,
}) => {
  setTestIds('EPMRTC-944');
  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
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
  await localStorageManager.setPrompts(promptInFolder.prompts[0]);
  const folderName = promptInFolder.folders.name;

  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded();
  await folderPrompts.expandCollapseFolder(folderName);
  let isPromptVisible = await folderPrompts.isFolderEntityVisible(
    folderName,
    promptInFolder.prompts[0].name,
  );
  expect.soft(isPromptVisible, ExpectedMessages.folderExpanded).toBeTruthy();

  await folderPrompts.expandCollapseFolder(folderName);
  isPromptVisible = await folderPrompts.isFolderEntityVisible(
    folderName,
    promptInFolder.prompts[0].name,
  );
  expect.soft(isPromptVisible, ExpectedMessages.folderCollapsed).toBeFalsy();
});

test(
  'Rename prompt folder on Enter.\n' + 'Rename prompt folders on nested levels',
  async ({
    dialHomePage,
    promptData,
    folderPrompts,
    localStorageManager,
    folderDropdownMenu,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-948', 'EPMRTC-1382');
    const newName = 'updated folder name';
    const nestedFolders = promptData.prepareNestedFolder(3);
    const randomFolder = GeneratorUtil.randomArrayElement(nestedFolders);
    const randomFolderIndex = nestedFolders.indexOf(randomFolder);
    await localStorageManager.setFolders(...nestedFolders);
    await localStorageManager.setOpenedFolders(...nestedFolders);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await folderPrompts.openFolderDropdownMenu(randomFolder.name);
    await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
    await folderPrompts.editFolderNameWithEnter(randomFolder.name, newName);
    expect
      .soft(
        await folderPrompts.getFolderByName(newName).isVisible(),
        ExpectedMessages.folderNameUpdated,
      )
      .toBeTruthy();

    for (let i = 0; i < nestedFolders.length; i++) {
      if (i !== randomFolderIndex) {
        expect
          .soft(
            await folderPrompts
              .getFolderByName(nestedFolders[i].name)
              .isVisible(),
            ExpectedMessages.folderNameNotUpdated,
          )
          .toBeTruthy();
      }
    }
  },
);

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
  await localStorageManager.setPrompts(promptInFolder.prompts[0]);

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
  const isFolderPromptVisible = await folderPrompts.isFolderEntityVisible(
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

  const isFolderPromptVisible = await folderPrompts.isFolderEntityVisible(
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
  confirmationDialog,
  setTestIds,
}) => {
  setTestIds('EPMRTC-966');
  const promptInFolder = promptData.prepareDefaultPromptInFolder();
  await localStorageManager.setFolders(promptInFolder.folders);
  await localStorageManager.setPrompts(promptInFolder.prompts[0]);

  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded();
  await folderPrompts.openFolderDropdownMenu(promptInFolder.folders.name);
  await promptDropdownMenu.selectMenuOption(MenuOptions.delete);
  await confirmationDialog.confirm();
  expect
    .soft(
      await folderPrompts
        .getFolderByName(promptInFolder.folders.name)
        .isVisible(),
      ExpectedMessages.folderDeleted,
    )
    .toBeFalsy();

  const isPromptVisible = await prompts
    .getPromptByName(promptInFolder.prompts[0].name)
    .isVisible();
  expect.soft(isPromptVisible, ExpectedMessages.promptIsVisible).toBeFalsy();
});

test(
  'Delete folder. Cancel.\n' + 'Delete root prompt folder with nested folders',
  async ({
    dialHomePage,
    promptData,
    folderPrompts,
    localStorageManager,
    promptDropdownMenu,
    confirmationDialog,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-967', 'EPMRTC-1383');
    const nestedFolders = promptData.prepareNestedFolder(3);
    await localStorageManager.setFolders(...nestedFolders);
    await localStorageManager.setOpenedFolders(...nestedFolders);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await folderPrompts.openFolderDropdownMenu(nestedFolders[0].name);
    await promptDropdownMenu.selectMenuOption(MenuOptions.delete);
    expect
      .soft(
        await confirmationDialog.getConfirmationMessage(),
        ExpectedMessages.confirmationMessageIsValid,
      )
      .toBe(ExpectedConstants.deleteFolderMessage);
    await confirmationDialog.cancelDialog();
    expect
      .soft(
        await folderPrompts.getFolderByName(nestedFolders[0].name).isVisible(),
        ExpectedMessages.folderNotDeleted,
      )
      .toBeTruthy();

    await folderPrompts.openFolderDropdownMenu(nestedFolders[0].name);
    await promptDropdownMenu.selectMenuOption(MenuOptions.delete);
    await confirmationDialog.confirm();
    for (const nestedFolder of nestedFolders) {
      expect
        .soft(
          await folderPrompts.getFolderByName(nestedFolder.name).isVisible(),
          ExpectedMessages.folderDeleted,
        )
        .toBeFalsy();
    }
  },
);

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
  await localStorageManager.setPrompts(promptInFolder.prompts[0]);

  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded();
  await folderPrompts.expandCollapseFolder(promptInFolder.folders.name);
  await folderPrompts.openFolderEntityDropdownMenu(
    promptInFolder.folders.name,
    promptInFolder.prompts[0].name,
  );
  await promptDropdownMenu.selectMenuOption(MenuOptions.delete);
  await folderPrompts
    .getFolderInput(promptInFolder.prompts[0].name)
    .clickTickButton();
  expect
    .soft(
      await folderPrompts
        .getFolderEntity(
          promptInFolder.folders.name,
          promptInFolder.prompts[0].name,
        )
        .isVisible(),
      ExpectedMessages.promptDeleted,
    )
    .toBeFalsy();
});

test('Delete nested prompt folder with prompt', async ({
  dialHomePage,
  folderPrompts,
  localStorageManager,
  conversationDropdownMenu,
  prompts,
  confirmationDialog,
  promptData,
  setTestIds,
}) => {
  setTestIds('EPMRTC-1384');
  const levelsCount = 3;
  const levelToDelete = 2;
  let nestedFolders: FolderInterface[];
  const nestedPrompts: Prompt[] = [];

  await test.step('Prepare nested folders with prompts inside each one', async () => {
    nestedFolders = promptData.prepareNestedFolder(levelsCount);
    for (let i = 0; i <= levelsCount; i++) {
      const nestedPrompt = promptData.prepareDefaultPrompt();
      nestedPrompts.push(nestedPrompt);
      nestedPrompt.folderId = nestedFolders[i].id;
      promptData.resetData();
    }
    await localStorageManager.setFolders(...nestedFolders);
    await localStorageManager.setOpenedFolders(...nestedFolders);
    await localStorageManager.setPrompts(...nestedPrompts);
  });

  await test.step('Delete 2nd level folder and verify all nested content is deleted as well', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await folderPrompts.openFolderDropdownMenu(
      nestedFolders[levelToDelete].name,
    );
    await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
    await confirmationDialog.confirm();

    for (let i = levelToDelete; i <= levelsCount; i++) {
      expect
        .soft(
          await folderPrompts
            .getFolderByName(nestedFolders[i].name)
            .isVisible(),
          ExpectedMessages.folderDeleted,
        )
        .toBeFalsy();
      expect
        .soft(
          await prompts.getPromptByName(nestedPrompts[i].name).isVisible(),
          ExpectedMessages.promptDeleted,
        )
        .toBeFalsy();
    }

    for (let i = 0; i <= levelsCount - levelToDelete; i++) {
      expect
        .soft(
          await folderPrompts
            .getFolderByName(nestedFolders[i].name)
            .isVisible(),
          ExpectedMessages.folderNotDeleted,
        )
        .toBeTruthy();
      expect
        .soft(
          await folderPrompts
            .getFolderEntity(nestedFolders[i].name, nestedPrompts[i].name)
            .isVisible(),
          ExpectedMessages.promptNotDeleted,
        )
        .toBeTruthy();
    }
  });
});

test('Search prompt located in folders', async ({
  dialHomePage,
  localStorageManager,
  promptData,
  folderPrompts,
  promptBarSearch,
  setTestIds,
}) => {
  setTestIds('EPMRTC-1174');
  let firstFolderPrompt: FolderPrompt;
  let secondFolderPrompts: FolderPrompt;

  const promptContent = 'Prompt search test';
  const searchTerm = 'test';

  await test.step('Prepare prompts in folders with different content', async () => {
    firstFolderPrompt = promptData.prepareDefaultPromptInFolder();
    firstFolderPrompt.prompts[0].name = promptContent;
    promptData.resetData();

    secondFolderPrompts = promptData.preparePromptsInFolder(3);
    secondFolderPrompts.prompts[0].description = promptContent;
    secondFolderPrompts.prompts[1].content = promptContent;

    await localStorageManager.setFolders(
      firstFolderPrompt.folders,
      secondFolderPrompts.folders,
    );
    await localStorageManager.setPrompts(
      ...firstFolderPrompt.prompts,
      ...secondFolderPrompts.prompts,
    );
  });

  await test.step('Type search term in the field and verify all prompts displayed', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    await promptBarSearch.setSearchValue(searchTerm);
    const firstFolderResultCount = await folderPrompts.getFolderEntitiesCount(
      firstFolderPrompt.folders.name,
    );
    const secondFolderResultCount = await folderPrompts.getFolderEntitiesCount(
      secondFolderPrompts.folders.name,
    );
    expect
      .soft(
        firstFolderResultCount + secondFolderResultCount,
        ExpectedMessages.searchResultCountIsValid,
      )
      .toBe(3);
  });

  await test.step('Clear search field and verify all prompts displayed', async () => {
    await promptBarSearch.setSearchValue('');
    const firstFolderResultCount = await folderPrompts.getFolderEntitiesCount(
      secondFolderPrompts.folders.name,
    );
    const secondFolderResultCount = await folderPrompts.getFolderEntitiesCount(
      firstFolderPrompt.folders.name,
    );
    expect
      .soft(
        firstFolderResultCount + secondFolderResultCount,
        ExpectedMessages.searchResultCountIsValid,
      )
      .toBe(4);
  });
});
