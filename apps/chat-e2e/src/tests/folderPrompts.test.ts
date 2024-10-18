import { FolderInterface } from '@/chat/types/folder';
import { Prompt } from '@/chat/types/prompt';
import dialTest from '@/src/core/dialFixtures';
import { isApiStorageType } from '@/src/hooks/global-setup';
import {
  ExpectedConstants,
  ExpectedMessages,
  FolderPrompt,
  MenuOptions,
} from '@/src/testData';
import { GeneratorUtil } from '@/src/utils';
import { expect } from '@playwright/test';

dialTest(
  'Create new prompt folder',
  async ({ dialHomePage, promptBar, folderPrompts, setTestIds }) => {
    setTestIds('EPMRTC-944');
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    await promptBar.createNewFolder();
    await expect
      .soft(
        folderPrompts.getFolderByName(
          ExpectedConstants.newFolderWithIndexTitle(1),
        ),
        ExpectedMessages.newFolderCreated,
      )
      .toBeVisible();
  },
);

dialTest(
  'Prompt folder can expand and collapse',
  async ({
    dialHomePage,
    promptData,
    folderPrompts,
    dataInjector,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-946');
    const promptInFolder = promptData.prepareDefaultPromptInFolder();
    await dataInjector.createPrompts(
      promptInFolder.prompts,
      promptInFolder.folders,
    );
    const folderName = promptInFolder.folders.name;

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await folderPrompts.expandFolder(folderName);
    let isPromptVisible = await folderPrompts.isFolderEntityVisible(
      folderName,
      promptInFolder.prompts[0].name,
    );
    expect.soft(isPromptVisible, ExpectedMessages.folderExpanded).toBeTruthy();

    await folderPrompts.expandCollapsedFolder(folderName);
    isPromptVisible = await folderPrompts.isFolderEntityVisible(
      folderName,
      promptInFolder.prompts[0].name,
    );
    expect.soft(isPromptVisible, ExpectedMessages.folderCollapsed).toBeFalsy();
  },
);

dialTest(
  'Share option is unavailable in prompt folder if there is no any prompt inside.\n' +
    'Rename prompt folder on Enter.\n' +
    'Rename prompt folders on nested levels',
  async ({
    dialHomePage,
    promptBar,
    folderPrompts,
    folderDropdownMenu,
    folderDropdownMenuAssertion,
    promptBarFolderAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-2730', 'EPMRTC-948', 'EPMRTC-1382');
    const newName = 'updated folder name';
    const randomFolderIndex = GeneratorUtil.randomNumberInRange(2) + 1;

    await dialTest.step(
      'Prepare nested folders hierarchy and expand it',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();

        for (let i = 1; i <= 3; i++) {
          await promptBar.createNewFolder();
        }
        for (let i = 3; i >= 2; i--) {
          await promptBar.dragAndDropEntityToFolder(
            folderPrompts.getFolderByName(
              ExpectedConstants.newFolderWithIndexTitle(i),
            ),
            folderPrompts.getFolderByName(
              ExpectedConstants.newFolderWithIndexTitle(i - 1),
            ),
          );
        }
        await folderPrompts.expandFolder(
          ExpectedConstants.newFolderWithIndexTitle(2),
        );
      },
    );

    await dialTest.step(
      'Open folder dropdown menu and verify available options',
      async () => {
        await folderPrompts.openFolderDropdownMenu(
          ExpectedConstants.newFolderWithIndexTitle(randomFolderIndex),
        );
        await folderDropdownMenuAssertion.assertMenuOptions([
          MenuOptions.select,
          MenuOptions.rename,
          MenuOptions.delete,
        ]);
      },
    );

    await dialTest.step(
      'Select "Rename" option, set new name and verify folder is renamed',
      async () => {
        await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
        await folderPrompts.editFolderNameWithEnter(newName);
        await promptBarFolderAssertion.assertFolderState(
          { name: newName },
          'visible',
        );

        for (let i = 1; i <= 3; i++) {
          if (i !== randomFolderIndex) {
            await promptBarFolderAssertion.assertFolderState(
              { name: ExpectedConstants.newFolderWithIndexTitle(i) },
              'visible',
            );
          }
        }
      },
    );
  },
);

dialTest(
  'Cancel folder renaming on "x"',
  async ({
    dialHomePage,
    promptBar,
    folderPrompts,
    folderDropdownMenu,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-949');
    const newName = 'updated folder name';
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await promptBar.createNewFolder();
    await folderPrompts.openFolderDropdownMenu(
      ExpectedConstants.newFolderWithIndexTitle(1),
    );
    await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
    await folderPrompts.editFolderName(newName);
    await folderPrompts.getEditFolderInputActions().clickCancelButton();
    await expect
      .soft(
        folderPrompts.getFolderByName(
          ExpectedConstants.newFolderWithIndexTitle(1),
        ),
        ExpectedMessages.folderNameNotUpdated,
      )
      .toBeVisible();
  },
);

dialTest(
  'Rename prompt folder when prompts are inside using check button',
  async ({
    dialHomePage,
    promptData,
    dataInjector,
    folderPrompts,
    folderDropdownMenu,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-950');
    const promptInFolder = promptData.prepareDefaultPromptInFolder();
    await dataInjector.createPrompts(
      promptInFolder.prompts,
      promptInFolder.folders,
    );

    const newName = 'updated folder name';
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await folderPrompts.openFolderDropdownMenu(promptInFolder.folders.name);
    await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
    await folderPrompts.editFolderNameWithTick(newName);
    await expect
      .soft(
        folderPrompts.getFolderByName(newName),
        ExpectedMessages.folderNameUpdated,
      )
      .toBeVisible();
  },
);

dialTest(
  'Prompt is moved to folder created from Move to',
  async ({
    dialHomePage,
    prompts,
    promptDropdownMenu,
    promptData,
    dataInjector,
    folderPrompts,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-962');
    const prompt = promptData.prepareDefaultPrompt();
    await dataInjector.createPrompts([prompt]);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await prompts.openEntityDropdownMenu(prompt.name);
    await promptDropdownMenu.selectMenuOption(MenuOptions.moveTo);
    await promptDropdownMenu.selectMenuOption(MenuOptions.newFolder);

    await folderPrompts.expandFolder(ExpectedConstants.newFolderTitle);
    await expect
      .soft(
        folderPrompts.getFolderEntity(
          ExpectedConstants.newFolderWithIndexTitle(1),
          prompt.name,
        ),
        ExpectedMessages.newFolderCreated,
      )
      .toBeVisible();
  },
);

dialTest(
  'Prompt is moved to folder from Move to list',
  async ({
    dialHomePage,
    prompts,
    promptDropdownMenu,
    promptData,
    dataInjector,
    folderPrompts,
    promptBar,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-963');
    const prompt = promptData.prepareDefaultPrompt();
    await dataInjector.createPrompts([prompt]);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await promptBar.createNewFolder();

    await prompts.openEntityDropdownMenu(prompt.name);
    await promptDropdownMenu.selectMenuOption(MenuOptions.moveTo);
    await prompts.selectMoveToMenuOption(
      ExpectedConstants.newFolderWithIndexTitle(1),
    );
    await folderPrompts.expandFolder(
      ExpectedConstants.newFolderWithIndexTitle(1),
    );
    const isFolderPromptVisible = await folderPrompts.isFolderEntityVisible(
      ExpectedConstants.newFolderWithIndexTitle(1),
      prompt.name,
    );
    expect
      .soft(isFolderPromptVisible, ExpectedMessages.promptMovedToFolder)
      .toBeTruthy();
  },
);

dialTest(
  'Delete folder when there are some prompts inside',
  async ({
    dialHomePage,
    promptData,
    folderPrompts,
    dataInjector,
    promptDropdownMenu,
    prompts,
    confirmationDialog,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-966');
    const promptInFolder = promptData.prepareDefaultPromptInFolder();
    await dataInjector.createPrompts(
      promptInFolder.prompts,
      promptInFolder.folders,
    );

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await folderPrompts.openFolderDropdownMenu(promptInFolder.folders.name);
    await promptDropdownMenu.selectMenuOption(MenuOptions.delete);
    await confirmationDialog.confirm();
    await expect
      .soft(
        folderPrompts.getFolderByName(promptInFolder.folders.name),
        ExpectedMessages.folderDeleted,
      )
      .toBeHidden();

    await expect
      .soft(
        prompts.getEntityByName(promptInFolder.prompts[0].name),
        ExpectedMessages.promptIsVisible,
      )
      .toBeHidden();
  },
);

dialTest(
  'Delete folder. Cancel.\n' + 'Delete root prompt folder with nested folders',
  async ({
    dialHomePage,
    folderPrompts,
    promptBar,
    promptDropdownMenu,
    confirmationDialog,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-967', 'EPMRTC-1383');
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    for (let i = 1; i <= 3; i++) {
      await promptBar.createNewFolder();
    }
    for (let i = 3; i >= 2; i--) {
      await promptBar.dragAndDropEntityToFolder(
        folderPrompts.getFolderByName(
          ExpectedConstants.newFolderWithIndexTitle(i),
        ),
        folderPrompts.getFolderByName(
          ExpectedConstants.newFolderWithIndexTitle(i - 1),
        ),
      );
    }
    await folderPrompts.expandFolder(
      ExpectedConstants.newFolderWithIndexTitle(2),
    );

    await folderPrompts.openFolderDropdownMenu(
      ExpectedConstants.newFolderWithIndexTitle(1),
    );
    await promptDropdownMenu.selectMenuOption(MenuOptions.delete);
    expect
      .soft(
        await confirmationDialog.getConfirmationMessage(),
        ExpectedMessages.confirmationMessageIsValid,
      )
      .toBe(ExpectedConstants.deleteFolderMessage);
    await confirmationDialog.cancelDialog();
    await expect
      .soft(
        folderPrompts.getFolderByName(
          ExpectedConstants.newFolderWithIndexTitle(1),
        ),
        ExpectedMessages.folderNotDeleted,
      )
      .toBeVisible();

    await folderPrompts.openFolderDropdownMenu(
      ExpectedConstants.newFolderWithIndexTitle(1),
    );
    await promptDropdownMenu.selectMenuOption(MenuOptions.delete);
    await confirmationDialog.confirm();
    for (let i = 1; i <= 3; i++) {
      await expect
        .soft(
          folderPrompts.getFolderByName(
            ExpectedConstants.newFolderWithIndexTitle(i),
          ),
          ExpectedMessages.folderDeleted,
        )
        .toBeHidden();
    }
  },
);

dialTest(
  'Delete prompt in the folder',
  async ({
    dialHomePage,
    promptData,
    folderPrompts,
    dataInjector,
    promptDropdownMenu,
    setTestIds,
    confirmationDialog,
  }) => {
    setTestIds('EPMRTC-968');
    const promptInFolder = promptData.prepareDefaultPromptInFolder();
    await dataInjector.createPrompts(
      promptInFolder.prompts,
      promptInFolder.folders,
    );

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await folderPrompts.expandFolder(promptInFolder.folders.name);
    await folderPrompts.openFolderEntityDropdownMenu(
      promptInFolder.folders.name,
      promptInFolder.prompts[0].name,
    );
    await promptDropdownMenu.selectMenuOption(MenuOptions.delete);
    await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
    await expect
      .soft(
        folderPrompts.getFolderEntity(
          promptInFolder.folders.name,
          promptInFolder.prompts[0].name,
        ),
        ExpectedMessages.promptDeleted,
      )
      .toBeHidden();
  },
);

dialTest(
  'Delete nested prompt folder with prompt',
  async ({
    dialHomePage,
    folderPrompts,
    dataInjector,
    conversationDropdownMenu,
    prompts,
    confirmationDialog,
    promptData,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1384');
    const levelsCount = 4;
    const levelToDelete = 2;
    let nestedFolders: FolderInterface[];
    const nestedPrompts: Prompt[] = [];

    await dialTest.step(
      'Prepare nested folders with prompts inside each one',
      async () => {
        nestedFolders = promptData.prepareNestedFolder(levelsCount);
        for (let i = 0; i < levelsCount; i++) {
          const nestedPrompt = promptData.prepareDefaultPrompt();
          nestedPrompts.push(nestedPrompt);
          nestedPrompt.folderId = nestedFolders[i].id;
          nestedPrompt.id = `${nestedFolders[i].id}/${nestedPrompt.id}`;
          promptData.resetData();
        }
        await dataInjector.createPrompts(nestedPrompts, ...nestedFolders);
      },
    );

    await dialTest.step(
      'Delete 2nd level folder and verify all nested content is deleted as well',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        for (const nestedFolder of nestedFolders) {
          await folderPrompts.expandFolder(nestedFolder.name);
        }
        await folderPrompts.openFolderDropdownMenu(
          nestedFolders[levelToDelete].name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });

        for (let i = levelToDelete; i < levelsCount; i++) {
          await expect
            .soft(
              folderPrompts.getFolderByName(nestedFolders[i].name),
              ExpectedMessages.folderDeleted,
            )
            .toBeHidden();
          await expect
            .soft(
              prompts.getEntityByName(nestedPrompts[i].name),
              ExpectedMessages.promptDeleted,
            )
            .toBeHidden();
        }

        for (let i = 0; i < levelsCount - levelToDelete; i++) {
          await expect
            .soft(
              folderPrompts.getFolderByName(nestedFolders[i].name),
              ExpectedMessages.folderNotDeleted,
            )
            .toBeVisible();
          await expect
            .soft(
              folderPrompts.getFolderEntity(
                nestedFolders[i].name,
                nestedPrompts[i].name,
              ),
              ExpectedMessages.promptNotDeleted,
            )
            .toBeVisible();
        }
      },
    );
  },
);

dialTest(
  'Search prompt located in folders',
  async ({
    dialHomePage,
    dataInjector,
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

    await dialTest.step(
      'Prepare prompts in folders with different content',
      async () => {
        firstFolderPrompt =
          promptData.prepareDefaultPromptInFolder(promptContent);
        promptData.resetData();

        secondFolderPrompts = promptData.preparePromptsInFolder(3);
        secondFolderPrompts.prompts[0].description = promptContent;
        secondFolderPrompts.prompts[1].content = promptContent;

        await dataInjector.createPrompts(
          [...firstFolderPrompt.prompts, ...secondFolderPrompts.prompts],
          firstFolderPrompt.folders,
          secondFolderPrompts.folders,
        );
      },
    );

    await dialTest.step(
      'Type search term in the field and verify all prompts displayed',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await promptBarSearch.setSearchValue(searchTerm);
        const firstFolderResultCount =
          await folderPrompts.getFolderEntitiesCount(
            firstFolderPrompt.folders.name,
          );
        const secondFolderResultCount =
          await folderPrompts.getFolderEntitiesCount(
            secondFolderPrompts.folders.name,
          );
        expect
          .soft(
            firstFolderResultCount + secondFolderResultCount,
            ExpectedMessages.searchResultCountIsValid,
          )
          .toBe(isApiStorageType ? 1 : 3);
      },
    );

    await dialTest.step(
      'Clear search field and verify all prompts displayed',
      async () => {
        await promptBarSearch.setSearchValue('');
        await folderPrompts.expandFolder(secondFolderPrompts.folders.name);
        const firstFolderResultCount =
          await folderPrompts.getFolderEntitiesCount(
            secondFolderPrompts.folders.name,
          );
        const secondFolderResultCount =
          await folderPrompts.getFolderEntitiesCount(
            firstFolderPrompt.folders.name,
          );
        expect
          .soft(
            firstFolderResultCount + secondFolderResultCount,
            ExpectedMessages.searchResultCountIsValid,
          )
          .toBe(4);
      },
    );
  },
);
