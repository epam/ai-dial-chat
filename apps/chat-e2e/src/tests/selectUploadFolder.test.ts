import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
} from '@/src/testData';
import { Colors, Overflow, Styles } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
import { GeneratorUtil } from '@/src/utils';
import { expect } from '@playwright/test';

dialTest(
  '[Select folder] Create new folder on the root level.\n' +
    '[Select folder] Rename new folder just after its creation on Enter.\n' +
    '[Select folder] Allowed special characters.\n' +
    '[Select folder] Spaces in the middle of folder name stay',
  async ({
    dialHomePage,
    setTestIds,
    chatBar,
    uploadFromDeviceModal,
    attachFilesModal,
    selectFolderModal,
    selectUploadFolder,
  }) => {
    setTestIds('EPMRTC-3253', 'EPMRTC-3268', 'EPMRTC-3247', 'EPMRTC-3250');
    const updatedFolderName = 'New folder 1    (`~!@#$^*-_+[]\'|<>.?")';

    await dialTest.step(
      'Open "Upload from device" modal through chat side bar clip icon and click on "Change" link',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await chatBar.bottomDotsMenuIcon.click();
        await chatBar
          .getBottomDropdownMenu()
          .selectMenuOption(MenuOptions.attachments);
        await attachFilesModal.uploadFromDeviceButton.click();
        await uploadFromDeviceModal.changeUploadToLocation();
      },
    );

    await dialTest.step(
      'Click "Create new folder" icon and verify new folder is created in the root in edit mode, folder background is blue',
      async () => {
        await selectFolderModal.newFolderButton.click();
        await expect
          .soft(
            selectUploadFolder.getEditFolderInput().getElementLocator(),
            ExpectedMessages.folderEditModeIsActive,
          )
          .toBeVisible();
        const folderBackgroundColor = await selectUploadFolder
          .getFolderInEditMode(ExpectedConstants.newFolderWithIndexTitle(1))
          .getComputedStyleProperty(Styles.backgroundColor);
        expect
          .soft(
            folderBackgroundColor[0],
            ExpectedMessages.folderBackgroundColorIsValid,
          )
          .toBe(Colors.backgroundAccentPrimaryAlpha);
      },
    );

    await dialTest.step(
      'Set new name, hit Enter and verify name is updated, edit mode is closed',
      async () => {
        await selectUploadFolder.editFolderNameWithEnter(updatedFolderName);
        await expect
          .soft(
            selectUploadFolder.getEditFolderInput().getElementLocator(),
            ExpectedMessages.folderEditModeIsClosed,
          )
          .toBeHidden();
        await expect
          .soft(
            selectUploadFolder.getFolderByName(updatedFolderName),
            ExpectedMessages.folderIsVisible,
          )
          .toBeVisible();
      },
    );
  },
);

dialTest(
  '[Select folder] Restricted special characters are not entered.\n' +
    '[Select folder] Restricted special characters are removed if to copy-paste',
  async ({
    dialHomePage,
    setTestIds,
    chatBar,
    uploadFromDeviceModal,
    attachFilesModal,
    selectFolderModal,
    selectUploadFolder,
    sendMessage,
    page,
  }) => {
    setTestIds('EPMRTC-3248', 'EPMRTC-3249');
    const nameWithRestrictedChars = `Folder${ExpectedConstants.restrictedNameChars}name`;

    await dialTest.step(
      'Copy restricted symbols into buffer, open "Upload from device" modal through chat side bar clip icon and click on "Change" link',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await sendMessage.fillRequestData(nameWithRestrictedChars);
        await page.keyboard.press(keys.ctrlPlusA);
        await page.keyboard.press(keys.ctrlPlusC);

        await chatBar.bottomDotsMenuIcon.click();
        await chatBar
          .getBottomDropdownMenu()
          .selectMenuOption(MenuOptions.attachments);
        await attachFilesModal.uploadFromDeviceButton.click();
        await uploadFromDeviceModal.changeUploadToLocation();
      },
    );

    await dialTest.step(
      'Click "Create new folder" icon, type one by one restricted symbols and verify nothing is displayed in the input field',
      async () => {
        await selectFolderModal.newFolderButton.click();
        await selectUploadFolder.editFolderName(
          ExpectedConstants.restrictedNameChars,
        );
        expect
          .soft(
            await selectUploadFolder.getEditFolderInput().getEditInputValue(),
            ExpectedMessages.elementAttributeValueIsValid,
          )
          .toBe('');
      },
    );

    await dialTest.step(
      'Paste restricted symbols from buffer and verify nothing is displayed in the input field',
      async () => {
        await page.keyboard.press(keys.ctrlPlusA);
        await page.keyboard.press(keys.ctrlPlusV);
        await selectUploadFolder.getEditFolderInputActions().clickTickButton();
        await expect
          .soft(
            selectUploadFolder.getFolderByName(
              nameWithRestrictedChars.replace(
                ExpectedConstants.restrictedNameChars,
                '',
              ),
            ),
            ExpectedMessages.elementAttributeValueIsValid,
          )
          .toBeVisible();
      },
    );
  },
);

dialTest(
  '[Select folder] Long folder name is cut with three dots at the end.\n' +
    '[Select folder] Folder names can be equal on different levels.\n' +
    '[Select folder] Folder name is blue highlighted if to click on it',
  async ({
    dialHomePage,
    setTestIds,
    chatBar,
    uploadFromDeviceModal,
    attachFilesModal,
    selectFolderModal,
    selectUploadFolder,
    folderDropdownMenu,
  }) => {
    setTestIds('EPMRTC-3271', 'EPMRTC-3245', 'EPMRTC-3272');
    const longFolderName = GeneratorUtil.randomString(150);

    await dialTest.step(
      'Open "Upload from device" modal through chat side bar clip icon and click on "Change" link',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await chatBar.bottomDotsMenuIcon.click();
        await chatBar
          .getBottomDropdownMenu()
          .selectMenuOption(MenuOptions.attachments);
        await attachFilesModal.uploadFromDeviceButton.click();
        await uploadFromDeviceModal.changeUploadToLocation();
      },
    );

    await dialTest.step(
      'Click "Create new folder" icon, set long folder name and verify it is truncated with dots',
      async () => {
        await selectFolderModal.newFolderButton.click();
        await selectUploadFolder.editFolderNameWithTick(longFolderName, {
          isHttpMethodTriggered: false,
        });
        const folderNameOverflowProp = await selectUploadFolder
          .getFolderName(longFolderName)
          .getComputedStyleProperty(Styles.text_overflow);
        expect
          .soft(
            folderNameOverflowProp[0],
            ExpectedMessages.folderNameIsTruncated,
          )
          .toBe(Overflow.ellipsis);
      },
    );

    await dialTest.step(
      'Select create folder and verify folder name and background colors are blue',
      async () => {
        await selectUploadFolder.getFolderByName(longFolderName).click();
        const folderBackgroundColor =
          await selectUploadFolder.getFolderBackgroundColor(longFolderName);
        expect
          .soft(
            folderBackgroundColor[0],
            ExpectedMessages.folderBackgroundColorIsValid,
          )
          .toBe(Colors.backgroundAccentPrimaryAlpha);

        const folderTextColor =
          await selectUploadFolder.getFolderNameColor(longFolderName);
        expect
          .soft(folderTextColor[0], ExpectedMessages.folderTextColorIsValid)
          .toBe(Colors.controlsBackgroundAccent);
      },
    );

    await dialTest.step(
      'Create child folder with the same name and verify folder with same name is created and truncated with dots',
      async () => {
        await selectUploadFolder.openFolderDropdownMenu(longFolderName);
        await folderDropdownMenu.selectMenuOption(MenuOptions.addNewFolder);
        await selectUploadFolder.editFolderNameWithTick(longFolderName, {
          isHttpMethodTriggered: false,
        });
        const childFolderNameOverflowProp = await selectUploadFolder
          .getFolderName(longFolderName, 2)
          .getComputedStyleProperty(Styles.text_overflow);
        expect
          .soft(
            childFolderNameOverflowProp[0],
            ExpectedMessages.folderNameIsTruncated,
          )
          .toBe(Overflow.ellipsis);
      },
    );
  },
);

dialTest(
  '[Select folder] Default numeration on root level',
  async ({
    dialHomePage,
    setTestIds,
    chatBar,
    uploadFromDeviceModal,
    attachFilesModal,
    selectFolderModal,
    selectUploadFolder,
  }) => {
    setTestIds('EPMRTC-3244');
    const updateFoldeNameIndex = 999;

    await dialTest.step(
      'Open "Upload from device" modal through chat side bar clip icon and click on "Change" link',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await chatBar.bottomDotsMenuIcon.click();
        await chatBar
          .getBottomDropdownMenu()
          .selectMenuOption(MenuOptions.attachments);
        await attachFilesModal.uploadFromDeviceButton.click();
        await uploadFromDeviceModal.changeUploadToLocation();
      },
    );

    await dialTest.step(
      'Click "Create new folder" and verify "New folder 1" is created in edit mode',
      async () => {
        await selectFolderModal.newFolderButton.click();
        expect
          .soft(
            await selectUploadFolder.getEditFolderInput().getEditInputValue(),
            ExpectedMessages.elementAttributeValueIsValid,
          )
          .toBe(ExpectedConstants.newFolderWithIndexTitle(1));
        await selectUploadFolder.getEditFolderInputActions().clickTickButton();
      },
    );

    await dialTest.step(
      'Click "Create new folder" again and edit name to "New folder 999"',
      async () => {
        await selectFolderModal.newFolderButton.click();
        await selectUploadFolder.editFolderNameWithTick(
          ExpectedConstants.newFolderWithIndexTitle(updateFoldeNameIndex),
          { isHttpMethodTriggered: false },
        );
      },
    );

    await dialTest.step(
      'Click "Create new folder" again, confirm creation and verify "New folder 1000" folder is created',
      async () => {
        await selectFolderModal.newFolderButton.click();
        await selectUploadFolder.getEditFolderInputActions().clickTickButton();
        await expect
          .soft(
            selectUploadFolder.getFolderByName(
              ExpectedConstants.newFolderWithIndexTitle(
                updateFoldeNameIndex + 1,
              ),
            ),
            ExpectedMessages.folderIsVisible,
          )
          .toBeVisible();
      },
    );
  },
);

dialTest(
  `[Select folder] Window changes it's height and Scroll appears`,
  async ({
    dialHomePage,
    setTestIds,
    chatBar,
    uploadFromDeviceModal,
    attachFilesModal,
    selectFolderModal,
    page,
  }) => {
    setTestIds('EPMRTC-3269');

    await dialTest.step(
      'Open "Upload from device" modal through chat side bar clip icon and click on "Change" link',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await chatBar.bottomDotsMenuIcon.click();
        await chatBar
          .getBottomDropdownMenu()
          .selectMenuOption(MenuOptions.attachments);
        await attachFilesModal.uploadFromDeviceButton.click();
        await uploadFromDeviceModal.changeUploadToLocation();
      },
    );

    await dialTest.step(
      'Click "Create new folder" may times and verify "Select folder" modal height is growing until equal browser window height',
      async () => {
        for (let i = 1; i <= 20; i++) {
          await selectFolderModal.newFolderButton.click();
        }
        const selectFolderBounding =
          await selectFolderModal.getElementBoundingBox();
        const selectFolderHeight = selectFolderBounding!.height!;
        const browserHeight = page.viewportSize()!.height!;
        expect
          .soft(
            selectFolderHeight < browserHeight,
            ExpectedMessages.elementAttributeValueIsValid,
          )
          .toBeTruthy();
        expect
          .soft(
            await selectFolderModal.allFoldersSection.isElementScrollableVertically(),
            ExpectedMessages.selectFolderAreaIsScrollable,
          )
          .toBeTruthy();
      },
    );
  },
);
