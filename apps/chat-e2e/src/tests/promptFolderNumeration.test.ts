import dialTest from '@/src/core/dialFixtures';
import {
  CollapsedSections,
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
} from '@/src/testData';
import { expect } from '@playwright/test';

dialTest(
  'Prompt folder: default numeration',
  async ({
    dialHomePage,
    promptBar,
    folderPrompts,
    setTestIds,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-1621');

    await dialTest.step(
      'Create several new prompt folders and verify their names are incremented',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        for (let i = 1; i <= 3; i++) {
          await promptBar.createNewFolder();
          await expect
            .soft(
              folderPrompts.getFolderByName(
                ExpectedConstants.newPromptFolderWithIndexTitle(i),
              ),
              ExpectedMessages.folderIsVisible,
            )
            .toBeVisible();
        }
      },
    );
  },
);

dialTest(
  'Prompt folder: renamed and deleted folders are not counted into prompt folder numeration',
  async ({
    dialHomePage,
    promptBar,
    folderPrompts,
    promptDropdownMenu,
    confirmationDialog,
    setTestIds,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-1622');
    let folderNumber = 1;

    await dialTest.step(
      'Create several new prompt folders and verify their names are incremented',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        for (folderNumber = 1; folderNumber < 3; folderNumber++) {
          await promptBar.createNewFolder();
          await expect
            .soft(
              folderPrompts.getFolderByName(
                ExpectedConstants.newPromptFolderWithIndexTitle(folderNumber),
              ),
              ExpectedMessages.folderIsVisible,
            )
            .toBeVisible();
        }
      },
    );

    await dialTest.step(
      'Delete the first folder and create a new one',
      async () => {
        await folderPrompts.openFolderDropdownMenu(
          ExpectedConstants.newFolderWithIndexTitle(1),
        );
        await promptDropdownMenu.selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm();
        await expect(
          folderPrompts.getFolderByName(
            ExpectedConstants.newFolderWithIndexTitle(1),
          ),
          ExpectedMessages.folderDeleted,
        ).toBeHidden();

        await promptBar.createNewFolder();
        await expect
          .soft(
            folderPrompts.getFolderByName(
              ExpectedConstants.newPromptFolderWithIndexTitle(folderNumber),
            ),
            ExpectedMessages.folderIsVisible,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Rename the fourth folder and create a new one',
      async () => {
        await folderPrompts.openFolderDropdownMenu(
          ExpectedConstants.newFolderWithIndexTitle(folderNumber),
        );
        await promptDropdownMenu.selectMenuOption(MenuOptions.rename);
        await folderPrompts.renameEmptyFolderWithTick('Renamed Folder');

        await promptBar.createNewFolder();
        await expect
          .soft(
            folderPrompts.getFolderByName(
              ExpectedConstants.newPromptFolderWithIndexTitle(folderNumber),
            ),
            ExpectedMessages.folderIsVisible,
          )
          .toBeVisible();
      },
    );
  },
);

dialTest(
  'Prompt folder: numeration continues after 999',
  async ({
    dialHomePage,
    promptBar,
    folderPrompts,
    promptDropdownMenu,
    setTestIds,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-2967');

    await dialTest.step('Create a new folder', async () => {
      await localStorageManager.setShowSideBarPanels();
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await promptBar.createNewFolder();
      await expect
        .soft(
          folderPrompts.getFolderByName(
            ExpectedConstants.newPromptFolderWithIndexTitle(1),
          ),
          ExpectedMessages.folderIsVisible,
        )
        .toBeVisible();
    });

    await dialTest.step('Rename the folder to 999', async () => {
      await folderPrompts.openFolderDropdownMenu(
        ExpectedConstants.newFolderWithIndexTitle(1),
      );
      await promptDropdownMenu.selectMenuOption(MenuOptions.rename);
      await folderPrompts.renameEmptyFolderWithTick(
        ExpectedConstants.newPromptFolderWithIndexTitle(999),
      );
    });

    await dialTest.step('Create a new folder', async () => {
      for (let i = 1000; i <= 1002; i++) {
        await promptBar.createNewFolder();
        await expect
          .soft(
            folderPrompts.getFolderByName(
              ExpectedConstants.newPromptFolderWithIndexTitle(i),
            ),
            ExpectedMessages.folderIsVisible,
          )
          .toBeVisible();
      }
    });
  },
);

dialTest(
  'Prompt folder: names can be equal on different levels',
  async ({
    dialHomePage,
    promptBar,
    folderPrompts,
    promptDropdownMenu,
    localStorageManager,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-2968');
    const duplicatedFolderName = 'Duplicated Name';

    await dialTest.step('Create four folders', async () => {
      await localStorageManager.setPromptCollapsedSection(
        CollapsedSections.Organization,
        CollapsedSections.SharedWithMe,
      );
      await localStorageManager.setShowSideBarPanels();
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      for (let i = 1; i <= 3; i++) {
        await promptBar.createNewFolder();
        await expect
          .soft(
            folderPrompts.getFolderByName(
              ExpectedConstants.newPromptFolderWithIndexTitle(i),
            ),
            ExpectedMessages.folderIsVisible,
          )
          .toBeVisible();
      }
    });

    await dialTest.step('Create nested folder hierarchy', async () => {
      for (let i = 3; i >= 2; i--) {
        await promptBar.dragAndDropEntityToFolder(
          folderPrompts.getFolderByName(
            ExpectedConstants.newPromptFolderWithIndexTitle(i),
          ),
          folderPrompts.getFolderByName(
            ExpectedConstants.newPromptFolderWithIndexTitle(i - 1),
          ),
        );
      }
      await folderPrompts.expandFolder(
        ExpectedConstants.newPromptFolderWithIndexTitle(2),
      );
    });

    await dialTest.step('Rename all folders to the same name', async () => {
      for (let i = 1; i <= 3; i++) {
        await folderPrompts.openFolderDropdownMenu(
          ExpectedConstants.newFolderWithIndexTitle(i),
        );
        await promptDropdownMenu.selectMenuOption(MenuOptions.rename);
        await folderPrompts.renameEmptyFolderWithTick(duplicatedFolderName);
        await expect(
          folderPrompts.getFolderByName(duplicatedFolderName, i),
          ExpectedMessages.folderNameUpdated,
        ).toBeVisible();
      }
    });
  },
);
