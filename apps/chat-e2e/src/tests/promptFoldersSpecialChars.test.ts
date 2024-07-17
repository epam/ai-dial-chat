import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
} from '@/src/testData';
import { expect } from '@playwright/test';

dialTest.only(
  'Prompt folder: Error message appears if there is a dot is at the end of folder name.\n' +
  'Prompt folder: allowed special characters',
  async ({
    dialHomePage,
    promptBar,
    folderPrompts,
    folderDropdownMenu,
    errorToast,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-2975', 'EPMRTC-2976');
    const folderName = ExpectedConstants.newFolderWithIndexTitle(1);
    const newNameWithEndDot = `${folderName}.`;
    const newNameWithSpecialChars = `${folderName} ${ExpectedConstants.allowedSpecialChars}`;

    await dialTest.step('Create prompt folder', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();

      await promptBar.createNewFolder();
      await expect
        .soft(
          folderPrompts.getFolderByName(folderName),
          ExpectedMessages.folderIsVisible,
        )
        .toBeVisible();
    });

    await dialTest.step(
      'Rename it to have a dot at the end of the name',
      async () => {
        await folderPrompts.openFolderDropdownMenu(folderName);
        await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
        await folderPrompts.editFolderName(newNameWithEndDot);
      },
    );

    await dialTest.step('Click on confirmation button', async () => {
      await folderPrompts.getEditFolderInputActions().clickTickButton();

      const errorMessage = await errorToast.getElementContent();
      expect
        .soft(errorMessage, ExpectedMessages.notAllowedNameErrorShown)
        .toBe(ExpectedConstants.nameWithDotErrorMessage);

      // Verify folder name stays in edit mode
      await expect
        .soft(
          folderPrompts.getEditFolderInput().getElementLocator(),
          ExpectedMessages.folderEditModeIsActive,
        )
        .toBeVisible();
    });

    await dialTest.step('Rename it to contain special characters', async () => {
      await folderPrompts.editFolderNameWithTick(newNameWithSpecialChars);
      await expect
        .soft(
          folderPrompts.getFolderByName(newNameWithSpecialChars),
          ExpectedMessages.folderNameUpdated,
        )
        .toBeVisible();
    });
  },
);