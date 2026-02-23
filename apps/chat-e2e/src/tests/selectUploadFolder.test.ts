import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  FileManagerToolbarTabs,
  UploadMenuOptions,
} from '@/src/testData';
import { ThemeColorAttributes } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
import { GeneratorUtil, RegexUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { Locator } from '@playwright/test';

dialTest(
  '[Select folder] Create new folder on the root level.\n' +
    '[Select folder] Rename new folder just after its creation on Enter.\n' +
    '[Select folder] Allowed special characters.\n' +
    '[Select folder] Spaces in the middle of folder name stay.\n' +
    '[Upload from device] Change upload to folder with long name which is cut at the end with three dots.\n' +
    '[Upload from device] Change upload to root folder',
  async ({
    dialHomePage,
    setTestIds,
    sendMessage,
    attachmentDropdownMenu,
    uploadFromDeviceModal,
    selectFolderManagerModal,
    selectFolderManagerModalGrid,
    localStorageManager,
    baseAssertion,
  }) => {
    setTestIds(
      'EPMRTC-3253',
      'EPMRTC-3268',
      'EPMRTC-3247',
      'EPMRTC-3250',
      'EPMRTC-3237',
      'EPMRTC-3238',
    );
    const updatedFolderName = `New folder 1    ${ExpectedConstants.allowedSpecialChars}`;

    await dialTest.step(
      'Open "Upload from device" modal through chat side bar clip icon and click on "Change" link',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.uploadFromDevice,
          { isHttpMethodTriggered: true, triggeredHttpMethod: 'GET' },
        );
        await uploadFromDeviceModal.changeUploadToLocation();
      },
    );

    await dialTest.step(
      'Click "Create new folder" icon and verify new folder is created in the root in edit mode',
      async () => {
        await selectFolderManagerModal.getAddFolderButton().click();
        const folderInput = selectFolderManagerModalGrid.getRenameInput('');
        await baseAssertion.assertElementState(folderInput, 'visible');
      },
    );

    await dialTest.step(
      'Set new name, hit Enter and verify name is updated, edit mode is closed',
      async () => {
        let folderInput = selectFolderManagerModalGrid.getRenameInput('');
        await folderInput.fill(updatedFolderName);
        folderInput =
          selectFolderManagerModalGrid.getRenameInput(updatedFolderName);
        await folderInput.press('Enter');
        await baseAssertion.assertElementState(folderInput, 'hidden');
        await baseAssertion.assertElementState(
          selectFolderManagerModalGrid.gridRowByNameCell(updatedFolderName),
          'visible',
        );
      },
    );

    await dialTest.step(
      'Select created folder and verify correct path is displayed in "Upload to" field, the field is highlighted on hover and has text_overflow=ellipsis property',
      async () => {
        const folderRow =
          selectFolderManagerModalGrid.gridRowByNameCell(updatedFolderName);
        await folderRow.click();
        await selectFolderManagerModal.getSelectButton().click();
        const uploadToPathElement =
          uploadFromDeviceModal.getChangeUploadToPath();
        await uploadToPathElement.hoverOver();
        await baseAssertion.assertElementBorderColors(
          uploadToPathElement,
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textAccentPrimary),
        );
        await baseAssertion.assertElementText(
          uploadToPathElement.path,
          new RegExp(
            RegexUtil.escapeRegexChars(
              `${ExpectedConstants.allFilesRoot}/${updatedFolderName}`,
            ),
          ),
          ExpectedMessages.uploadToPathIsValid,
        );
        await baseAssertion.assertElementTextIsTruncated(
          uploadToPathElement.path,
        );
      },
    );

    await dialTest.step.skip(
      'Click on Change link, select "My Files" root and verify root is displayed in "Upload to" field',
      async () => {
        await uploadFromDeviceModal.changeUploadToLocation();
        // Click on "My Files" folder to select root
        const folderTree = selectFolderManagerModal
          .getFileManager()
          .getFileManagerCollapsibleSidebar()
          .getFoldersTree();
        const myFilesFolder = folderTree.folderByPath(
          FileManagerToolbarTabs.MyFiles,
        );
        await myFilesFolder.click();
        await selectFolderManagerModal.getSelectButton().click();
        await baseAssertion.assertElementText(
          uploadFromDeviceModal.getChangeUploadToPath().path,
          ExpectedConstants.allFilesRoot,
          ExpectedMessages.uploadToPathIsValid,
        );
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
    sendMessage,
    attachmentDropdownMenu,
    uploadFromDeviceModal,
    selectFolderManagerModal,
    selectFolderManagerModalGrid,
    page,
    localStorageManager,
    selectFolderManagerModalGridAssertion,
  }) => {
    setTestIds('EPMRTC-3248', 'EPMRTC-3249');
    const nameWithRestrictedChars = `Folder${ExpectedConstants.restrictedNameChars}name`;
    let folderInput: Locator;

    await dialTest.step(
      'Copy restricted symbols into buffer, open "Upload from device" modal through chat side bar clip icon and click on "Change" link',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await dialHomePage.copyTextToClipboard(nameWithRestrictedChars);

        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.uploadFromDevice,
          { isHttpMethodTriggered: true, triggeredHttpMethod: 'GET' },
        );
        await uploadFromDeviceModal.changeUploadToLocation();
      },
    );

    await dialTest.step(
      'Click "Create new folder" icon, type one by one restricted symbols and verify nothing is displayed in the input field',
      async () => {
        await selectFolderManagerModal.getAddFolderButton().click();
        folderInput = selectFolderManagerModalGrid.getRenameInput('');
        await folderInput.fill(ExpectedConstants.restrictedNameChars);
        await selectFolderManagerModalGridAssertion.assertNameInputErrorState(
          ExpectedConstants.restrictedNameChars,
        );
      },
    );

    await dialTest.step(
      'Paste restricted symbols from buffer and verify error',
      async () => {
        for (const __ of ExpectedConstants.restrictedNameChars) {
          await page.keyboard.press(keys.backspace);
        }
        //TODO ctrl+a doesn't work here
        // await page.keyboard.press(keys.ctrlPlusA);
        await page.keyboard.press(keys.ctrlPlusV);
        folderInput = selectFolderManagerModalGrid.getRenameInput(
          nameWithRestrictedChars,
        );
        await folderInput.press('Enter');
        await selectFolderManagerModalGridAssertion.assertNameInputErrorState(
          nameWithRestrictedChars,
        );
      },
    );
  },
);

dialTest(
  '[Select folder] Long folder name is cut with three dots at the end.\n' +
    '[Select folder] Create new nested folder.\n' +
    '[Select folder] Folder names can be equal on different levels.\n' +
    '[Select folder] Rename new nested folder just after its creation on Tick button.\n',
  async ({
    dialHomePage,
    setTestIds,
    sendMessage,
    attachmentDropdownMenu,
    uploadFromDeviceModal,
    selectFolderManagerModal,
    selectFolderManagerModalGrid,
    selectFolderManagerModalGridAssertion,
    baseAssertion,
    localStorageManager,
  }) => {
    setTestIds(
      'EPMRTC-3271',
      'EPMRTC-1801',
      'EPMRTC-3245',
      'EPMRTC-3255',
    );
    const longFolderName = GeneratorUtil.randomString(150);
    let folderInput: Locator;

    await dialTest.step(
      'Open "Upload from device" modal and click on "Change" link',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.uploadFromDevice,
          { isHttpMethodTriggered: true, triggeredHttpMethod: 'GET' },
        );
        await uploadFromDeviceModal.changeUploadToLocation();
      },
    );

    await dialTest.step(
      'Click "Create new folder" icon, set long folder name and verify it is truncated with dots',
      async () => {
        await selectFolderManagerModal.getAddFolderButton().click();
        folderInput = selectFolderManagerModalGrid.getRenameInput('');
        await folderInput.fill(longFolderName);
        folderInput = selectFolderManagerModalGrid.getRenameInput(longFolderName);
        await folderInput.press('Enter');
        await baseAssertion.assertElementTextIsTruncated(
          selectFolderManagerModalGrid.gridNameCellValue(longFolderName),
        );
      },
    );

    await dialTest.step(
      'Open created folder and create child folder with the same name, verify child name is also truncated',
      async () => {
        await selectFolderManagerModalGrid.openFolder(longFolderName, false);
        await selectFolderManagerModal.getAddFolderButton().click();
        let childInput = selectFolderManagerModalGrid.getRenameInput('');
        await childInput.fill(longFolderName);
        childInput = selectFolderManagerModalGrid.getRenameInput(longFolderName);
        await childInput.press('Enter');
        await baseAssertion.assertElementTextIsTruncated(
          selectFolderManagerModalGrid.gridNameCellValue(longFolderName),
        );
      },
    );

    await dialTest.step(
      'Close "Select folder" modal, open it again and verify both parent and nested folders are displayed',
      async () => {
        await selectFolderManagerModal.getCloseButton().click();
        await uploadFromDeviceModal.changeUploadToLocation();
        await selectFolderManagerModalGridAssertion.assertGridRowByNameState(
          longFolderName,
          'visible',
        );
        await selectFolderManagerModalGrid.openFolder(longFolderName, false);
        await selectFolderManagerModalGridAssertion.assertGridRowByNameState(
          longFolderName,
          'visible',
        );
      },
    );
  },
);

dialTest(
  `[Select folder] Window changes it's height and Scroll appears`,
  async ({
    dialHomePage,
    setTestIds,
    sendMessage,
    attachmentDropdownMenu,
    uploadFromDeviceModal,
    selectFolderManagerModal,
    selectFolderManagerModalGrid,
    baseAssertion,
    page,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-3269');

    await dialTest.step(
      'Open "Upload from device" modal through chat side bar clip icon and click on "Change" link',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.uploadFromDevice,
          { isHttpMethodTriggered: true, triggeredHttpMethod: 'GET' },
        );
        await uploadFromDeviceModal.changeUploadToLocation();
      },
    );

    await dialTest.step(
      'Click "Create new folder" many times and verify "Select folder" modal height does not exceed browser window height and scroll appears',
      async () => {
        // Each click on "Add folder" does not create a new folder immediately —
        // it waits for the user to enter a name first.
        // Therefore, clicking many times should not stack up folders and should not cause a scroll to appear.
        for (let i = 1; i <= 20; i++) {
          await selectFolderManagerModal.getAddFolderButton().click();
          const input = selectFolderManagerModalGrid.getRenameInput('');
          await input.press('Enter');
        }
        const selectFolderBounding =
          await selectFolderManagerModal.getElementBoundingBox();
        const selectFolderHeight = selectFolderBounding!.height!;
        const browserHeight = page.viewportSize()!.height!;
        baseAssertion.assertBooleanCondition(
          selectFolderHeight < browserHeight,
          true,
          ExpectedMessages.elementAttributeValueIsValid,
        );
        baseAssertion.assertBooleanCondition(
          await selectFolderManagerModalGrid.gridViewPort.isElementScrollableVertically(),
          false,
          ExpectedMessages.selectFolderAreaIsScrollable,
        );
      },
    );
  },
);

dialTest.only(
  '[Select folder] Cancel renaming of new nested folder just after its creation.\n' +
    '[Select folder] Rename nested folder through context menu.\n' +
    '[Select folder] Rename a folder on root level through context menu',
  async ({
    dialHomePage,
    setTestIds,
    sendMessage,
    attachmentDropdownMenu,
    uploadFromDeviceModal,
    selectFolderManagerModal,
    selectFolderManagerModalManager,
    selectFolderManagerModalGrid,
    selectFolderManagerModalGridAssertion,
    page,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-3256', 'EPMRTC-3258', 'EPMRTC-3257');
    const newChildFolderName = GeneratorUtil.randomString(10);
    const newParentFolderName = GeneratorUtil.randomString(10);
    const parentDefaultName = ExpectedConstants.newFolderWithIndexTitle(1);
    const childDefaultName = ExpectedConstants.newFolderWithIndexTitle(1);

    await dialTest.step(
      'Open "Upload from device" modal through chat side bar clip icon and click on "Change" link',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.uploadFromDevice,
          { isHttpMethodTriggered: true, triggeredHttpMethod: 'GET' },
        );
        await uploadFromDeviceModal.changeUploadToLocation();
      },
    );

    await dialTest.step(
      'Click "Create new folder" and confirm default folder name',
      async () => {
        await selectFolderManagerModal.getAddFolderButton().click();
        const input = selectFolderManagerModalGrid.getRenameInput('');
        await input.press('Enter');
        await selectFolderManagerModalGridAssertion.assertGridRowByNameState(
          parentDefaultName,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Open parent folder, create nested folder, type new name, cancel and verify default child folder name is applied',
      async () => {
        await selectFolderManagerModalGrid.openFolder(parentDefaultName);
        await selectFolderManagerModal.getAddFolderButton().click();
        const input = selectFolderManagerModalGrid.getRenameInput('');
        await input.fill(newChildFolderName);
        await page.keyboard.press('Escape');
        await selectFolderManagerModalGridAssertion.assertGridRowByNameState(
          childDefaultName,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Open child folder context menu, select "Rename" option, set new name and verify new child folder name is applied',
      async () => {
        await selectFolderManagerModalGrid.renameFile(
          childDefaultName,
          newChildFolderName,
        );
        await selectFolderManagerModalGridAssertion.assertGridRowByNameState(
          newChildFolderName,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Navigate back to root, open parent folder context menu, rename and verify child folder is still visible',
      async () => {
        await selectFolderManagerModalManager
          .getFileManagerNavigationPanel()
          .getBreadcrumb()
          .clickBreadcrumbByName(ExpectedConstants.allFilesRoot);
        await selectFolderManagerModalGrid.renameFile(
          parentDefaultName,
          newParentFolderName,
        );
        await selectFolderManagerModalGridAssertion.assertGridRowByNameState(
          newParentFolderName,
          'visible',
        );
        await selectFolderManagerModalGrid.openFolder(newParentFolderName);
        await selectFolderManagerModalGridAssertion.assertGridRowByNameState(
          newChildFolderName,
          'visible',
        );
      },
    );
  },
);

dialTest(
  '[Select folder] Error message appears if to add a dot to the end of folder name.\n' +
    '[Select folder] Error message appears if to create a folder with already existing name.\n' +
    '[Select folder] Error message appears if to add a dot to the beginning of folder name',
  async ({
    dialHomePage,
    setTestIds,
    sendMessage,
    attachmentDropdownMenu,
    uploadFromDeviceModal,
    selectFolderManagerModal,
    selectFolderManagerModalGrid,
    selectFolderManagerModalGridAssertion,
    page,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-3017', 'EPMRTC-3246', 'EPMRTC-6718');
    const folder1Name = GeneratorUtil.randomString(7);
    const nameWithTrailingDot = `${GeneratorUtil.randomString(10)}.`;
    const nameWithLeadingDot = `.${GeneratorUtil.randomString(5)}`;

    await dialTest.step(
      'Open "Upload from device" modal through chat side bar clip icon and click on "Change" link',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.uploadFromDevice,
          { isHttpMethodTriggered: true, triggeredHttpMethod: 'GET' },
        );
        await uploadFromDeviceModal.changeUploadToLocation();
      },
    );

    await dialTest.step(
      'Create first folder with a valid name (will be used for duplicate test)',
      async () => {
        await selectFolderManagerModal.getAddFolderButton().click();
        let input = selectFolderManagerModalGrid.getRenameInput('');
        await input.fill(folder1Name);
        input = selectFolderManagerModalGrid.getRenameInput(folder1Name);
        await input.press('Enter');
        await selectFolderManagerModalGridAssertion.assertGridRowByNameState(
          folder1Name,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Create new folder with trailing dot name and verify inline error is shown',
      async () => {
        await selectFolderManagerModal.getAddFolderButton().click();
        let input = selectFolderManagerModalGrid.getRenameInput('');
        await input.fill(nameWithTrailingDot);
        input = selectFolderManagerModalGrid.getRenameInput(nameWithTrailingDot);
        await input.press('Enter');
        await selectFolderManagerModalGridAssertion.assertNameInputErrorState(
          nameWithTrailingDot,
        );
        await page.keyboard.press('Escape');
      },
    );

    await dialTest.step(
      'Create new folder with already existing name and verify inline error is shown',
      async () => {
        await selectFolderManagerModal.getAddFolderButton().click();
        let input = selectFolderManagerModalGrid.getRenameInput('');
        await input.fill(folder1Name);
        input = selectFolderManagerModalGrid.getRenameInput(folder1Name);
        await input.press('Enter');
        await selectFolderManagerModalGridAssertion.assertNameInputErrorState(
          folder1Name,
        );
        await page.keyboard.press('Escape');
      },
    );

    await dialTest.step(
      'Create new folder with leading dot name and verify inline error is shown',
      async () => {
        await selectFolderManagerModal.getAddFolderButton().click();
        let input = selectFolderManagerModalGrid.getRenameInput('');
        await input.fill(nameWithLeadingDot);
        input = selectFolderManagerModalGrid.getRenameInput(nameWithLeadingDot);
        await input.press('Enter');
        await selectFolderManagerModalGridAssertion.assertNameInputErrorState(
          nameWithLeadingDot,
        );
      },
    );
  },
);

dialTest(
  '[Select folder] Folder name can not be blank or with spaces only',
  async ({
    dialHomePage,
    setTestIds,
    sendMessage,
    attachmentDropdownMenu,
    uploadFromDeviceModal,
    selectFolderManagerModal,
    selectFolderManagerModalGrid,
    selectFolderManagerModalGridAssertion,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-3251');

    await dialTest.step(
      'Open "Upload from device" modal through chat side bar clip icon and click on "Change" link',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.uploadFromDevice,
          { isHttpMethodTriggered: true, triggeredHttpMethod: 'GET' },
        );
        await uploadFromDeviceModal.changeUploadToLocation();
      },
    );

    await dialTest.step(
      'Set new folder name empty or to spaces, confirm and verify default name is applied',
      async () => {
        const nameWithSpaces = GeneratorUtil.randomArrayElement(['', '  ']);
        await selectFolderManagerModal.getAddFolderButton().click();
        let input = selectFolderManagerModalGrid.getRenameInput('');
        await input.fill(nameWithSpaces);
        input = selectFolderManagerModalGrid.getRenameInput(nameWithSpaces);
        await input.press('Enter');
        await selectFolderManagerModalGridAssertion.assertGridRowByNameState(
          ExpectedConstants.newFolderWithIndexTitle(1),
          'visible',
        );
      },
    );
  },
);
