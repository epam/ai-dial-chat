import dialTest from '@/src/core/dialFixtures';
import {
  CollapsedSections,
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
} from '@/src/testData';
import { expect } from '@playwright/test';

dialTest(
  'Prompt folder: error message appears if to rename prompt folder to already existed name in the root',
  async ({
    dialHomePage,
    promptBar,
    folderPrompts,
    promptDropdownMenu,
    errorToast,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-2969');
    const duplicatedFolderName = 'Folder prompt';

    await dialTest.step('Create 2 new prompt folders', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      for (let i = 1; i <= 2; i++) {
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

    await dialTest.step('Rename prompt folder to "Folder prompt', async () => {
      await folderPrompts.openFolderDropdownMenu(
        ExpectedConstants.newFolderWithIndexTitle(1),
      );
      await promptDropdownMenu.selectMenuOption(MenuOptions.rename);
      await folderPrompts.editFolderNameWithTick(duplicatedFolderName);
    });

    await dialTest.step(
      'Try to rename second folder to the same name',
      async () => {
        await folderPrompts.openFolderDropdownMenu(
          ExpectedConstants.newFolderWithIndexTitle(2),
        );
        await promptDropdownMenu.selectMenuOption(MenuOptions.rename);
        await folderPrompts.editFolderNameWithTick(duplicatedFolderName, {
          isHttpMethodTriggered: false,
        });
        const errorMessage = await errorToast.getElementContent();
        expect
          .soft(errorMessage, ExpectedMessages.notAllowedNameErrorShown)
          .toBe(
            ExpectedConstants.duplicatedFolderNameErrorMessage(
              duplicatedFolderName,
            ),
          );
      },
    );
  },
);

dialTest(
  'Prompt folder: error message appears if to drag prompt folder IN to another folder where folder with the same name exists',
  async ({
    dialHomePage,
    promptBar,
    folderPrompts,
    errorToast,
    localStorageManager,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-2970');
    const duplicatedFolderName = ExpectedConstants.newFolderWithIndexTitle(2);

    await dialTest.step(
      'Create 2 folders and move one into another. Create one more',
      async () => {
        await localStorageManager.setPromptCollapsedSection(
          CollapsedSections.Organization,
          CollapsedSections.SharedWithMe,
        );
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        for (let i = 1; i <= 2; i++) {
          await promptBar.createNewFolder();
          await expect
            .soft(
              folderPrompts.getFolderByName(
                ExpectedConstants.newFolderWithIndexTitle(i),
              ),
              ExpectedMessages.folderIsVisible,
            )
            .toBeVisible();
        }
        await promptBar.dragAndDropEntityToFolder(
          folderPrompts.getFolderByName(
            ExpectedConstants.newFolderWithIndexTitle(2),
          ),
          folderPrompts.getFolderByName(
            ExpectedConstants.newFolderWithIndexTitle(1),
          ),
        );
      },
    );

    await dialTest.step('Create 1 more folder', async () => {
      await promptBar.createNewFolder();
      await expect
        .soft(
          folderPrompts.getFolderByName(duplicatedFolderName),
          ExpectedMessages.folderIsVisible,
        )
        .toBeVisible();
    });

    await dialTest.step(
      'Drag & drop "New folder 2" to "New folder 1 and expect an error"',
      async () => {
        await promptBar.dragAndDropEntityToFolder(
          folderPrompts.getFolderByName(duplicatedFolderName, 2),
          folderPrompts.getFolderByName(
            ExpectedConstants.newFolderWithIndexTitle(1),
          ),
        );

        await expect
          .soft(
            errorToast.getElementLocator(),
            ExpectedMessages.errorToastIsShown,
          )
          .toBeVisible();
        const errorMessage = await errorToast.getElementContent();
        expect
          .soft(errorMessage, ExpectedMessages.notAllowedNameErrorShown)
          .toBe(
            ExpectedConstants.duplicatedFolderNameErrorMessage(
              duplicatedFolderName,
            ),
          );
      },
    );
  },
);

dialTest(
  'Prompt folder: error message appears if to drag prompt folder OUT to another folder where the same name exists',
  async ({
    dialHomePage,
    promptBar,
    folderPrompts,
    folderDropdownMenu,
    errorToast,
    localStorageManager,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-2971');
    const duplicatedFolderName = 'New folder 2';

    await dialTest.step('Create 3 folders', async () => {
      await localStorageManager.setPromptCollapsedSection(
        CollapsedSections.Organization,
        CollapsedSections.SharedWithMe,
      );
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      for (let i = 1; i <= 3; i++) {
        await promptBar.createNewFolder();
        await expect
          .soft(
            folderPrompts.getFolderByName(
              ExpectedConstants.newFolderWithIndexTitle(i),
            ),
            ExpectedMessages.folderIsVisible,
          )
          .toBeVisible();
      }
    });

    await dialTest.step('Create nested structure', async () => {
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
    });

    await dialTest.step('Expand folders', async () => {
      await folderPrompts.expandFolder(
        ExpectedConstants.newPromptFolderWithIndexTitle(2),
      );
    });

    await dialTest.step('Rename folder 3', async () => {
      await folderPrompts.openFolderDropdownMenu(
        ExpectedConstants.newFolderWithIndexTitle(3),
      );
      await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
      await folderPrompts.editFolderNameWithTick(
        ExpectedConstants.newFolderWithIndexTitle(2),
      );
    });

    await dialTest.step(
      'Drag renamed folder to the level where namesake exists and expect an error',
      async () => {
        await promptBar.dragAndDropEntityToFolder(
          folderPrompts.getFolderByName(
            ExpectedConstants.newFolderWithIndexTitle(2),
            2,
          ),
          folderPrompts.getFolderByName(
            ExpectedConstants.newFolderWithIndexTitle(1),
          ),
        );

        await expect
          .soft(
            errorToast.getElementLocator(),
            ExpectedMessages.errorToastIsShown,
          )
          .toBeVisible();
        const errorMessage = await errorToast.getElementContent();
        expect
          .soft(errorMessage, ExpectedMessages.notAllowedNameErrorShown)
          .toBe(
            ExpectedConstants.duplicatedFolderNameErrorMessage(
              duplicatedFolderName,
            ),
          );
      },
    );
  },
);

dialTest(
  'Prompt folder: error message appears if to drag prompt folder out to root where the same name exists',
  async ({
    dialHomePage,
    promptBar,
    folderPrompts,
    errorToast,
    setTestIds,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-2972');

    await dialTest.step('Create 3 folders', async () => {
      await localStorageManager.setPromptCollapsedSection(
        CollapsedSections.Organization,
        CollapsedSections.SharedWithMe,
      );
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      for (let i = 1; i <= 2; i++) {
        await promptBar.createNewFolder();
        await expect
          .soft(
            folderPrompts.getFolderByName(
              ExpectedConstants.newFolderWithIndexTitle(i),
            ),
            ExpectedMessages.folderIsVisible,
          )
          .toBeVisible();
      }
    });

    await dialTest.step('Create nested structure', async () => {
      await promptBar.dragAndDropEntityToFolder(
        folderPrompts.getFolderByName(
          ExpectedConstants.newFolderWithIndexTitle(2),
        ),
        folderPrompts.getFolderByName(
          ExpectedConstants.newFolderWithIndexTitle(1),
        ),
      );
    });

    await dialTest.step('Create new Folder', async () => {
      await promptBar.createNewFolder();
      await expect
        .soft(
          folderPrompts.getFolderByName(
            ExpectedConstants.newFolderWithIndexTitle(2),
          ),
          ExpectedMessages.folderIsVisible,
        )
        .toBeVisible();
    });

    await dialTest.step(
      'Drag & drop "New folder 2"  located in "New folder 1" to the root and expect an error',
      async () => {
        await promptBar.dragAndDropFolderToRoot(
          folderPrompts.getFolderByName(
            ExpectedConstants.newFolderWithIndexTitle(2),
          ),
        );

        await expect
          .soft(
            errorToast.getElementLocator(),
            ExpectedMessages.errorToastIsShown,
          )
          .toBeVisible();
        const errorMessage = await errorToast.getElementContent();
        expect
          .soft(errorMessage, ExpectedMessages.notAllowedNameErrorShown)
          .toBe(
            ExpectedConstants.duplicatedFolderRootNameErrorMessage(
              ExpectedConstants.newFolderWithIndexTitle(2),
            ),
          );
      },
    );
  },
);
