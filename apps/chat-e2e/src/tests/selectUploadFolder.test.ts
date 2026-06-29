import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  FileManagerToolbarTabs,
  UploadMenuOptions,
} from '@/src/testData';
import { ThemeColorAttributes } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
import { BaseElement } from '@/src/ui/webElements';
import { GeneratorUtil, RegexUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';

//test-case is not relevant since no uploadFromDeviceModal is displayed anymore
dialTest.skip(
  '[Select folder] Create new folder on the root level.\n' +
    '[Select folder] Rename new folder just after its creation on Enter.\n' +
    '[Select folder] Allowed special characters.\n' +
    '[Select folder] Spaces in the middle of folder name stay.\n' +
    '[Upload from device] Change upload to folder with long name which is cut at the end with three dots.',
  // '[Upload from device] Change upload to root folder',
  async ({
    dialHomePage,
    setTestIds,
    sendMessage,
    attachmentDropdownMenu,
    uploadFromDeviceModal,
    selectFolderManagerModal,
    selectFolderManagerModalGrid,
    selectFolderManagerModalFoldersTree,
    localStorageManager,
    baseAssertion,
  }) => {
    setTestIds(
      'EPMRTC-3253',
      'EPMRTC-3268',
      'EPMRTC-3247',
      'EPMRTC-3250',
      'EPMRTC-3237',
      //TODO the case is not actual with the new select folder manager
      // 'EPMRTC-3238',
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
        const folderInput = selectFolderManagerModalGrid.getRenameInput();
        await baseAssertion.assertElementState(folderInput, 'visible');
      },
    );

    await dialTest.step(
      'Set new name, hit Enter and verify name is updated, edit mode is closed',
      async () => {
        await selectFolderManagerModalGrid.setFolderName(
          updatedFolderName,
          false,
        );
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
        await selectFolderManagerModal.getSelectFolderButton().click();
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
        const myFilesFolder = selectFolderManagerModalFoldersTree.folderByPath(
          FileManagerToolbarTabs.MyFiles,
        );
        await myFilesFolder.click();
        await selectFolderManagerModal.getSelectFolderButton().click();
        await baseAssertion.assertElementText(
          uploadFromDeviceModal.getChangeUploadToPath().path,
          ExpectedConstants.allFilesRoot,
          ExpectedMessages.uploadToPathIsValid,
        );
      },
    );
  },
);

//test-case is not relevant since no uploadFromDeviceModal is displayed anymore
dialTest.skip(
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
    let folderInput: BaseElement;

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
      'Click "Create new folder" icon, type one by one restricted symbols and verify error is displayed',
      async () => {
        await selectFolderManagerModal.getAddFolderButton().click();
        folderInput = selectFolderManagerModalGrid.getRenameInput();
        await folderInput.fillInInput(ExpectedConstants.restrictedNameChars);
        await selectFolderManagerModalGridAssertion.assertInputError(
          'visible',
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
        await selectFolderManagerModalGridAssertion.assertInputError(
          'visible',
          nameWithRestrictedChars,
        );
      },
    );
  },
);

//test-case is not relevant since no uploadFromDeviceModal is displayed anymore
dialTest.skip(
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
    selectFolderManagerModalManager,
  }) => {
    setTestIds('EPMRTC-3271', 'EPMRTC-1801', 'EPMRTC-3245', 'EPMRTC-3255');
    const longFolderName = GeneratorUtil.randomString(150);

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
        await selectFolderManagerModalGrid.setFolderName(longFolderName, false);
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
        await selectFolderManagerModalGrid.setFolderName(longFolderName, false);
        await baseAssertion.assertElementTextIsTruncated(
          selectFolderManagerModalGrid.gridNameCellValue(longFolderName),
        );
      },
    );

    await dialTest.step(
      'Close "Select folder" modal, open it again and verify both parent and nested folders are displayed',
      async () => {
        await selectFolderManagerModal.getCloseButton().click();
        await uploadFromDeviceModal.waitForState({ state: 'visible' });
        await uploadFromDeviceModal.changeUploadToLocation();
        const breadcrumb = selectFolderManagerModalManager
          .getFileManagerNavigationPanel()
          .getBreadcrumb();
        await breadcrumb.clickBreadcrumbByName(FileManagerToolbarTabs.MyFiles);
        // Wait for navigation to root: folder item disappears from breadcrumb
        await breadcrumb
          .itemByName(longFolderName)
          .waitFor({ state: 'detached' });
        await selectFolderManagerModalGridAssertion.assertGridRowByNameState(
          longFolderName,
          'visible',
        );
        await selectFolderManagerModalGrid.openFolder(longFolderName, false);
        // Wait for navigation into folder: folder item appears in breadcrumb
        await breadcrumb
          .itemByName(longFolderName)
          .waitFor({ state: 'visible' });
        await selectFolderManagerModalGridAssertion.assertGridRowByNameState(
          longFolderName,
          'visible',
        );
      },
    );
  },
);

//test-case is not relevant since no uploadFromDeviceModal is displayed anymore
dialTest.skip(
  `[Select folder] Window changes it's height and Scroll doesn't appear`,
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
        for (let i = 1; i <= 20; i++) {
          await selectFolderManagerModal.getAddFolderButton().click();
          await selectFolderManagerModalGrid.setFolderName(
            GeneratorUtil.randomString(5),
          );
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
          true,
          ExpectedMessages.selectFolderAreaIsScrollable,
        );
      },
    );
  },
);

//test-case is not relevant since no uploadFromDeviceModal is displayed anymore
dialTest.skip(
  '[Select folder] Error message appears if to add a dot to the end of folder name.\n' +
    '[Select folder] Error message appears if to create a folder with already existing name.\n' +
    '[Select folder] Error message appears if to add a dot to the beginning of folder name.\n' +
    '[File Manager][My Files]: Error message appears if create folder with already existing name',
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
    setTestIds('EPMRTC-3017', 'EPMRTC-3246', 'EPMRTC-6718', 'EPMRTC-3291');
    const folder1Name = GeneratorUtil.randomString(7);
    const nameWithTrailingDot = `${GeneratorUtil.randomString(10)}.`;
    const nameWithLeadingDot = `.${GeneratorUtil.randomString(5)}`;

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
      'Create first folder with a valid name (will be used for duplicate test)',
      async () => {
        await selectFolderManagerModal.getAddFolderButton().click();
        await selectFolderManagerModalGrid.setFolderName(folder1Name);
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
        await selectFolderManagerModalGrid
          .getRenameInput()
          .fillInInput(nameWithTrailingDot);
        await selectFolderManagerModalGridAssertion.assertInputError(
          'visible',
          nameWithTrailingDot,
        );
        await page.keyboard.press(keys.enter);
        await selectFolderManagerModalGridAssertion.assertGridRowByNameState(
          ExpectedConstants.newFolderWithIndexTitle(1),
          'visible',
        );
      },
    );

    await dialTest.step(
      'Create new folder with already existing name and verify inline error is shown',
      async () => {
        await selectFolderManagerModal.getAddFolderButton().click();
        await selectFolderManagerModalGrid
          .getRenameInput()
          .fillInInput(folder1Name);
        await selectFolderManagerModalGridAssertion.assertInputError(
          'visible',
          folder1Name,
        );
        await page.keyboard.press(keys.enter);
        await selectFolderManagerModalGridAssertion.assertGridRowByNameState(
          ExpectedConstants.newFolderWithIndexTitle(2),
          'visible',
        );
      },
    );

    await dialTest.step(
      'Create new folder with leading dot name and verify inline error is shown',
      async () => {
        await selectFolderManagerModal.getAddFolderButton().click();
        await selectFolderManagerModalGrid
          .getRenameInput()
          .fillInInput(nameWithLeadingDot);
        await selectFolderManagerModalGridAssertion.assertInputWarning(
          'visible',
          nameWithLeadingDot,
        );
      },
    );
  },
);

//test-case is not relevant since no uploadFromDeviceModal is displayed anymore
dialTest.skip(
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
      'Set new folder name empty or to spaces and verify inline error is shown',
      async () => {
        const nameWithSpaces = GeneratorUtil.randomArrayElement(['', '  ']);
        await selectFolderManagerModal.getAddFolderButton().click();
        await selectFolderManagerModalGrid
          .getRenameInput()
          .fillInInput(nameWithSpaces);
        await selectFolderManagerModalGridAssertion.assertInputError(
          'visible',
          nameWithSpaces,
        );
      },
    );
  },
);
