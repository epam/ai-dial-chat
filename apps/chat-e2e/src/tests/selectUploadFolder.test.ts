import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  FileManagerToolbarTabs,
  UploadMenuOptions,
} from '@/src/testData';
import { keys } from '@/src/ui/keyboard';
import { BaseElement } from '@/src/ui/webElements';
import { GeneratorUtil } from '@/src/utils';

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
    setTestIds('EPMDIAL-6950', 'EPMDIAL-6951');
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
    setTestIds('EPMDIAL-6953', 'EPMDIAL-6930', 'EPMDIAL-6945', 'EPMDIAL-6935');
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
    setTestIds('EPMDIAL-6929');

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
    setTestIds('EPMDIAL-6942', 'EPMDIAL-6947', 'EPMDIAL-6943', 'EPMDIAL-6510');
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
    setTestIds('EPMDIAL-6952');

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
