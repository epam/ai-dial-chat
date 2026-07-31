import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
} from '@/src/testData';
import { GeneratorUtil } from '@/src/utils';

dialTest(
  'Prompt folder: Error message appears if there is a dot is at the end of folder name.\n' +
    'Prompt folder: allowed special characters.\n' +
    'Prompt folder: restricted special characters are not entered.\n' +
    'Prompt folder: restricted special characters are removed if to copy-paste.\n' +
    'Prompt folder: spaces in the middle of folder name stay.\n' +
    'Prompt folder: name can not be blank or with spaces only.\n' +
    'Prompt folder: spaces at the beginning or end of folder name are removed.\n' +
    'Prompt folder: smiles, hieroglyph, specific letters in name.\n' +
    'Prompt folder: Error message appears if there is a dot is at the beginning of folder name',
  async ({
    dialHomePage,
    promptBar,
    folderPrompts,
    folderDropdownMenu,
    toast,
    setTestIds,
    promptBarFolderAssertion,
    toastAssertion,
    localStorageManager,
  }) => {
    setTestIds(
      'EPMDIAL-3733',
      'EPMDIAL-3735',
      'EPMDIAL-3736',
      'EPMDIAL-3737',
      'EPMDIAL-3738',
      'EPMDIAL-3739',
      'EPMDIAL-3740',
      'EPMDIAL-3741',
      'EPMDIAL-3734',
    );
    const folderName = ExpectedConstants.newFolderWithIndexTitle(1);
    const newNameWithEndDot = `${folderName}.`;
    const newNameWithSpecialChars = `${folderName} ${ExpectedConstants.allowedSpecialChars}`;
    const nameWithRestrictedChars = `Folder${ExpectedConstants.restrictedNameChars}_name`;
    const expectedFolderName = 'Folder_name';
    const newNameWithSpaces = 'Folder   1';
    const expectedName = 'Folder with spaces';
    const nameWithSpacesBeforeAndAfter = `   ${expectedName}   `;
    const newNameWithEmojis = '😂👍🥳 😷 🤧 🤠 🥴😇 😈 ⭐あおㅁㄹñ¿äß';
    const leadingDotFolderName = `.${GeneratorUtil.randomString(5)}`;

    await dialTest.step('Create prompt folder', async () => {
      await localStorageManager.setShowSideBarPanels();
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();

      await promptBar.createNewFolder();
      await promptBarFolderAssertion.assertFolderState(
        { name: folderName },
        'visible',
      );
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
      await toastAssertion.assertToastIsVisible();
      await toastAssertion.assertToastMessage(
        ExpectedConstants.nameWithDotErrorMessage,
        ExpectedMessages.notAllowedNameErrorShown,
      );
      // Verify folder name stays in edit mode
      await promptBarFolderAssertion.assertFolderEditInputState('visible');
      // Closing the toast to move forward
      await toast.closeToast();
    });

    await dialTest.step('Rename it to contain special characters', async () => {
      await folderPrompts.renameEmptyFolderWithTick(newNameWithSpecialChars);
      await promptBarFolderAssertion.assertFolderState(
        { name: newNameWithSpecialChars },
        'visible',
      );
    });

    await dialTest.step(
      'Try to type restricted special characters',
      async () => {
        await folderPrompts.openFolderDropdownMenu(newNameWithSpecialChars);
        await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
        for (const char of ExpectedConstants.restrictedNameChars.split('')) {
          await folderPrompts.editFolderName(char);
          await promptBarFolderAssertion.assertFolderEditInputValue('');
        }
      },
    );

    await dialTest.step(
      'Copy and paste restricted special characters',
      async () => {
        await dialHomePage.copyTextToClipboard(nameWithRestrictedChars);
        await folderPrompts.getEditFolderInput().editInput.click();
        await dialHomePage.pasteFromClipboard();
        await folderPrompts.getEditFolderInputActions().clickTickButton();
        await promptBarFolderAssertion.assertFolderState(
          { name: expectedFolderName },
          'visible',
        );
        await toastAssertion.assertToastIsHidden();
      },
    );

    await dialTest.step(
      'Rename folder to have spaces in the middle',
      async () => {
        await folderPrompts.openFolderDropdownMenu(expectedFolderName);
        await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
        await folderPrompts.editFolderName(newNameWithSpaces);
        // Assert that the input field displays the name with spaces
        await promptBarFolderAssertion.assertFolderEditInputValue(
          newNameWithSpaces,
        );
        await folderPrompts.getEditFolderInputActions().clickTickButton();
        // Assert that the folder is renamed with spaces on the panel
        await promptBarFolderAssertion.assertFolderState(
          { name: newNameWithSpaces },
          'visible',
        );
      },
    );

    await dialTest.step(
      'Prompt folder: name can not be blank or with spaces only',
      async () => {
        for (const name of ['', '   ']) {
          await folderPrompts.openFolderDropdownMenu(newNameWithSpaces);
          await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
          await folderPrompts.editFolderName(name);
          await folderPrompts.getEditFolderInputActions().clickTickButton();
          await promptBarFolderAssertion.assertFolderState(
            { name: newNameWithSpaces },
            'visible',
          );
        }
      },
    );

    await dialTest.step(
      'Rename folder to have spaces at the beginning and at the end',
      async () => {
        await folderPrompts.openFolderDropdownMenu(newNameWithSpaces);
        await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
        await folderPrompts.editFolderName(nameWithSpacesBeforeAndAfter);
        // Assert that the input field displays the name with spaces
        await promptBarFolderAssertion.assertFolderEditInputValue(
          nameWithSpacesBeforeAndAfter,
        );
        await folderPrompts.getEditFolderInputActions().clickTickButton();
        // Assert that the folder is renamed with spaces on the panel
        await promptBarFolderAssertion.assertFolderState(
          { name: expectedName },
          'visible',
        );
      },
    );

    await dialTest.step(
      'Rename folder to contain emojis and hieroglyphs',
      async () => {
        await folderPrompts.openFolderDropdownMenu(expectedName);
        await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
        await folderPrompts.renameEmptyFolderWithTick(newNameWithEmojis);
        await promptBarFolderAssertion.assertFolderState(
          { name: newNameWithEmojis },
          'visible',
        );
      },
    );

    await dialTest.step(
      'Rename folder to name with leading dot and verify the error toast is displayed, folder remains in the edit mode',
      async () => {
        await folderPrompts.openFolderDropdownMenu(newNameWithEmojis);
        await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
        await folderPrompts.renameEmptyFolderWithTick(leadingDotFolderName);
        await toastAssertion.assertToastIsVisible();
        await toastAssertion.assertToastMessage(
          ExpectedConstants.leadingDotErrorToast,
        );
        await toast.closeToast();
        await promptBarFolderAssertion.assertFolderEditInputState('visible');
        await promptBarFolderAssertion.assertFolderEditInputValue(
          leadingDotFolderName,
        );
      },
    );
  },
);
