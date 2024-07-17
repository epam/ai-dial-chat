import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
} from '@/src/testData';
import { expect } from '@playwright/test';
import { keys } from '@/src/ui/keyboard'; 
import { keys } from '@/src/ui/keyboard';

dialTest.only(
  'Prompt folder: Error message appears if there is a dot is at the end of folder name.\n' +
  'Prompt folder: allowed special characters.\n' +
  'Prompt folder: restricted special characters are not entered.\n' +
  'Prompt folder: restricted special characters are removed if to copy-paste.\n' +
  'Prompt folder: spaces in the middle of folder name stay.\n' +
  'Prompt folder: name can not be blank or with spaces only',
  async ({
    dialHomePage,
    promptBar,
    folderPrompts,
    folderDropdownMenu,
    errorToast,
    setTestIds,
    page,
  }) => {
    setTestIds('EPMRTC-2975', 'EPMRTC-2976', 'EPMRTC-2977', 'EPMRTC-2978', 'EPMRTC-2979', 'EPMRTC-2980');
    const folderName = ExpectedConstants.newFolderWithIndexTitle(1);
    const newNameWithEndDot = `${folderName}.`;
    const newNameWithSpecialChars = `${folderName} ${ExpectedConstants.allowedSpecialChars}`;
    const nameWithRestrictedChars = `Folder=,:;{}\\/%&"_name`;
    const expectedFolderName = 'Folder_name';
    const newNameWithSpaces = 'Folder   1';

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

    await dialTest.step('Try to type restricted special characters', async () => {
      await folderPrompts.openFolderDropdownMenu(newNameWithSpecialChars);
      await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
      for (const char of ExpectedConstants.restrictedNameChars.split('')) {
        await folderPrompts.editFolderName(char);
        expect
          .soft(
            await folderPrompts.getEditFolderInput().getEditInputValue(),
            ExpectedMessages.charactersAreNotDisplayed,
          )
          .toBe('');
      }
    });

    await dialTest.step('Copy and paste restricted special characters', async () => {
      await page.evaluate(
        (text) => navigator.clipboard.writeText(text),
        nameWithRestrictedChars,
      );
      await folderPrompts.getEditFolderInput().editInput.click();
      await page.keyboard.press(keys.ctrlPlusV);
      await folderPrompts.getEditFolderInputActions().clickTickButton();
      await expect
        .soft(
          folderPrompts.getFolderByName(expectedFolderName),
          ExpectedMessages.folderIsVisible,
        )
        .toBeVisible();
      await expect
        .soft(
          errorToast.getElementLocator(),
          ExpectedMessages.noErrorToastIsShown,
        )
        .toBeHidden();
    });

    await dialTest.step('Rename folder to have spaces in the middle', async () => {
      await folderPrompts.openFolderDropdownMenu(expectedFolderName);
      await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
      await folderPrompts.editFolderName(newNameWithSpaces);
      // Assert that the input field displays the name with spaces
      expect
        .soft(
          await folderPrompts.getEditFolderInput().getEditInputValue(),
          ExpectedMessages.folderNameUpdated,
        )
        .toBe(newNameWithSpaces);
      await folderPrompts.getEditFolderInputActions().clickTickButton();
      // Assert that the folder is renamed with spaces on the panel
      await expect
        .soft(
          folderPrompts.getFolderByName(newNameWithSpaces),
          ExpectedMessages.folderNameUpdated,
        )
        .toBeVisible();
    });

    await dialTest.step('Prompt folder: name can not be blank or with spaces only', async () => {
      for (const name of ['', '   ']) {
        await dialTest.step(`Try to rename folder to "${name}"`, async () => {
          await folderPrompts.openFolderDropdownMenu(newNameWithSpaces);
          await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
          await folderPrompts.editFolderName(name);
          await folderPrompts.getEditFolderInputActions().clickTickButton();
          await expect
            .soft(
              folderPrompts.getFolderByName(newNameWithSpaces),
              ExpectedMessages.folderNameNotUpdated,
            )
            .toBeVisible();
        });
      }
    });
  },
);