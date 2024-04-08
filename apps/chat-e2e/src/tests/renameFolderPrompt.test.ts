import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
} from '@/src/testData';
import { GeneratorUtil } from '@/src/utils';
import { expect } from '@playwright/test';

dialTest(
  'Rename prompt folder on Enter.\n' + 'Rename prompt folders on nested levels',
  async ({
    dialHomePage,
    promptBar,
    folderPrompts,
    folderDropdownMenu,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-948', 'EPMRTC-1382');
    const newName = 'updated folder name';
    const randomFolderIndex = GeneratorUtil.randomNumberInRange(2) + 1;

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
      ExpectedConstants.newFolderWithIndexTitle(randomFolderIndex),
    );
    await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
    await folderPrompts.editFolderNameWithEnter(
      ExpectedConstants.newFolderWithIndexTitle(randomFolderIndex),
      newName,
    );
    expect
      .soft(
        await folderPrompts.getFolderByName(newName).isVisible(),
        ExpectedMessages.folderNameUpdated,
      )
      .toBeTruthy();

    for (let i = 1; i <= 3; i++) {
      if (i !== randomFolderIndex) {
        expect
          .soft(
            await folderPrompts
              .getFolderByName(ExpectedConstants.newFolderWithIndexTitle(i))
              .isVisible(),
            ExpectedMessages.folderNameNotUpdated,
          )
          .toBeTruthy();
      }
    }
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
    const folderInput = await folderPrompts.editFolderName(
      ExpectedConstants.newFolderWithIndexTitle(1),
      newName,
    );
    await folderInput.clickCancelButton();
    expect
      .soft(
        await folderPrompts
          .getFolderByName(ExpectedConstants.newFolderWithIndexTitle(1))
          .isVisible(),
        ExpectedMessages.folderNameNotUpdated,
      )
      .toBeTruthy();
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
  },
);
