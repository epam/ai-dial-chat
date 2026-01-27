import dialTest from '@/src/core/dialFixtures';
import {
  Attachment,
  ExpectedConstants,
  ExpectedMessages,
  UploadMenuOptions,
} from '@/src/testData';
import { ThemeColorAttributes } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
import { FileModalSection } from '@/src/ui/webElements';
import { GeneratorUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { expect } from '@playwright/test';

dialTest(
  '[Upload from device] Error appears if to load the file with the same name and extension if it already exists in a folder.\n' +
    'Long file name in errors does not break UI on "Upload from device"',
  async ({
    filesManagerPage,
    setTestIds,
    filesManagerToolbar,
    filesManagerGridAssertion,
    fileConflictConfirmationPopup,
    fileConflictConfirmationPopupAssertion,
    fileApiHelper,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-1777', 'EPMRTC-1778');

    await dialTest.step('Upload file with long name to app', async () => {
      await fileApiHelper.putFile(Attachment.longImageName);
      await localStorageManager.setShowSideBarPanels();
    });

    await dialTest.step(
      'Upload the same file again through File manager',
      async () => {
        await filesManagerPage.openFilesManagerPage();
        await filesManagerPage.waitForPageLoaded();
        await filesManagerGridAssertion.assertGridRowByNameState(
          Attachment.longImageName,
          'visible',
        );
        await filesManagerToolbar.getNewButton().click();
        await filesManagerPage.uploadData(
          { path: Attachment.longImageName, dataType: 'upload' },
          () =>
            filesManagerToolbar
              .getNewButtonDropdownMenu()
              .selectItem(UploadMenuOptions.uploadFiles),
        );
        await fileConflictConfirmationPopupAssertion.assertConfirmationPopupHeader(
          ExpectedConstants.replaceAttachmentConfirmationTitle,
        );
        await fileConflictConfirmationPopupAssertion.assertConfirmationPopupContent(
          ExpectedConstants.replaceAttachmentConfirmationMessage(
            Attachment.longImageName,
          ),
        );
        await fileConflictConfirmationPopup.getCancelButton().click();
        await filesManagerGridAssertion.assertGridRowByNameState(
          Attachment.longImageName,
          'visible',
        );
      },
    );
  },
);

dialTest.only(
  '[Upload from device] Restricted special chars are not allowed to be entered or copied\n' +
    '[Upload from device] File name is updated ok if the file had restricted special char in the name',
  async ({
    dialHomePage,
    setTestIds,
    attachmentDropdownMenu,
    uploadFromDeviceModal,
    localStorageManager,
    sendMessage,
    manageAttachmentsAssertion,
           sendMessageInputAttachmentsAssertions,
           baseAssertion,
  }) => {
    setTestIds('EPMRTC-1780', 'EPMRTC-1802');
    const restrictedChar = GeneratorUtil.randomArrayElement(
      ExpectedConstants.restrictedNameChars.split(''),
    );
    const replacedSymbolsFilename = ExpectedConstants.replacedRestrictedCharsName(Attachment.restrictedCharsFilename);

    await dialTest.step(
      'Upload file through chat bar attachment menu',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await sendMessage.attachmentMenuTrigger.click();
        await dialHomePage.uploadData(
          { path: Attachment.restrictedCharsFilename, dataType: 'upload' },
          () =>
            attachmentDropdownMenu.selectMenuOption(
              UploadMenuOptions.uploadFromDevice,
              {
                isHttpMethodTriggered: true,
                triggeredHttpMethod: 'GET',
              },
            ),
        );
      },
    );

    await dialTest.step(
      'Add restricted symbol to filename and verify filename is not changed',
      async () => {
        await uploadFromDeviceModal
          .getUploadedFilenameInput(ExpectedConstants.replacedRestrictedCharsName(Attachment.restrictedCharsFilename))
          .click();
        await uploadFromDeviceModal.typeInUploadedFilename(
          replacedSymbolsFilename,
          restrictedChar,
        );
        await baseAssertion.assertElementState(uploadFromDeviceModal
          .getUploadedFilenameInput(replacedSymbolsFilename),
          'visible'
        )
        await baseAssertion.assertElementState(uploadFromDeviceModal
            .getUploadedFilenameInput(`${replacedSymbolsFilename}${restrictedChar}`),
          'hidden'
        )
      },
    );

    await dialTest.step(
      'Fix file name and upload file successfully',
      async () => {
        await uploadFromDeviceModal.uploadFiles();
        await baseAssertion.assertElementState(uploadFromDeviceModal, 'hidden');
        await sendMessageInputAttachmentsAssertions.assertAttachedFileState(
          replacedSymbolsFilename,
          'visible',
        );
        await manageAttachmentsAssertion.assertEntityState(
          { name: Attachment.cloudImageName },
          FileModalSection.AllFiles,
          'visible',
        );
      },
    );
  },
);

// TODO: The test is skipped due to a bug in multi-file upload logic.
// When uploading a mix of:
// 1. A duplicate file (triggers confirmation popup)
// 2. Files with equal sanitized names (e.g. 'restricted=char.jpg' and 'restricted=,;{}%&.JPG' both become 'restrictedchar.jpg')
// 3. Files with restricted characters
//
// The current behavior is incorrect:
// - The confirmation popup appears for the duplicate file.
// - Upon confirmation, one of the files with restricted characters is silently sanitized and uploaded (e.g. 'restrictedchar.jpg').
// - No error messages found for restricted characters or duplicate names.
dialTest(
  '[Upload from device] Several different errors are combined into one (error about restricted symbols, already existed file, equal files).\n' +
    "'[Upload from device] Error appears if to load two files with equal names and extension'.\n" +
    '[Upload from device] Error appears if to upload the file if to rename it using restricted chars',
  async ({
    dialHomePage,
    navigationPanel,
    filesManagerPage,
    filesManagerToolbar,
    filesManagerGridAssertion,
    setTestIds,
    fileConflictConfirmationPopupAssertion,
    toastAssertion,
    fileApiHelper,
    fileConflictConfirmationPopup,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-3217', 'EPMRTC-3194', 'EPMRTC-1779');

    await dialTest.step('Upload file with valid name to app', async () => {
      await fileApiHelper.putFile(Attachment.sunImageName);
      await localStorageManager.setShowSideBarPanels();
    });

    await dialTest.step(
      'Upload one file with already uploaded name, 2 files with restricted symbols, 2 files with equal names through chat bar dots menu',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await navigationPanel.goToFilesManager();
        await filesManagerPage.waitForPageLoaded();
        await filesManagerGridAssertion.assertGridRowByNameState(
          Attachment.sunImageName,
          'visible',
        );

        await filesManagerToolbar.getNewButton().click();
        await filesManagerPage.uploadData(
          {
            path: [
              Attachment.sunImageName,
              Attachment.restrictedSemicolonCharFilename,
              Attachment.restrictedEqualCharFilename,
              Attachment.cloudImageName,
              Attachment.cloudImageName,
            ],
            dataType: 'upload',
          },
          () =>
            filesManagerToolbar
              .getNewButtonDropdownMenu()
              .selectItem(UploadMenuOptions.uploadFiles),
        );

        await fileConflictConfirmationPopupAssertion.assertConfirmationPopupHeader(
          ExpectedConstants.replaceAttachmentConfirmationTitle,
        );
        await fileConflictConfirmationPopupAssertion.assertConfirmationPopupContent(
          ExpectedConstants.replaceAttachmentConfirmationMessage(
            Attachment.sunImageName,
          ),
        );

        const expectedRequests = new Map([
          [Attachment.sunImageName, 'POST'],
          [Attachment.cloudImageName, 'POST'],
          [
            encodeURIComponent(Attachment.restrictedSemicolonCharFilename),
            'POST',
          ],
          [encodeURIComponent(Attachment.restrictedEqualCharFilename), 'POST'],
        ]);
        await fileConflictConfirmationPopup.confirm({ expectedRequests });
      },
    );

    // TODO: when uploading files with restricted chars in the name, neither toast nor file appears
    // Based on previous code, it expected a modal error, but now we deal with toasts or other indicators.
    await dialTest.step('Verify 2 error messages are shown', async () => {
      await toastAssertion.assertToastMessage(
        ExpectedConstants.notAllowedFilenameError(
          Attachment.restrictedSemicolonCharFilename,
        ),
      );
      await toastAssertion.assertToastMessage(
        ExpectedConstants.sameFilenamesError(
          `${Attachment.restrictedEqualCharFilename.replace('=', '_')}, ${Attachment.cloudImageName}`,
        ),
      );
    });
  },
);

dialTest(
  '[Upload from device] Error appears if to upload a file with a dot at the name without extension.\n' +
    '[Upload from device] A file without extension is uploaded successfully',
  async ({
    dialHomePage,
    setTestIds,
    attachFilesModal,
    attachmentDropdownMenu,
    uploadFromDeviceModal,
    localStorageManager,
    sendMessage,
  }) => {
    setTestIds('EPMRTC-3216', 'EPMRTC-3113');
    const dot = '.';

    await dialTest.step(
      'Upload file without extension through chat bar attachment menu',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await sendMessage.attachmentMenuTrigger.click();
        await dialHomePage.uploadData(
          { path: Attachment.fileWithoutExtension, dataType: 'upload' },
          () =>
            attachmentDropdownMenu.selectMenuOption(
              UploadMenuOptions.uploadFromDevice,
              {
                isHttpMethodTriggered: true,
                triggeredHttpMethod: 'GET',
              },
            ),
        );
      },
    );

    await dialTest.step(
      'Add dot at the end of file name and verify file is uploaded',
      async () => {
        await uploadFromDeviceModal
          .getUploadedFilenameInput(Attachment.fileWithoutExtension)
          .click();
        await uploadFromDeviceModal.typeInUploadedFilename(
          Attachment.fileWithoutExtension,
          dot,
        );
        const uploadedFileExtension = await uploadFromDeviceModal
          .getUploadedFileExtension(Attachment.fileWithoutExtension)
          .getElementInnerContent();
        expect
          .soft(uploadedFileExtension, ExpectedMessages.fileExtensionIsValid)
          .toBe('');

        await uploadFromDeviceModal.uploadFiles();
        await expect
          .soft(
            attachFilesModal
              .getAllFilesTree()
              .getEntityByName(Attachment.fileWithoutExtension),
            ExpectedMessages.fileIsAttached,
          )
          .toBeVisible();

        const isFileChecked = attachFilesModal
          .getAllFilesTree()
          .getEntityCheckbox(Attachment.fileWithoutExtension);
        await expect
          .soft(isFileChecked, ExpectedMessages.attachmentFileIsChecked)
          .toBeChecked();
      },
    );
  },
);
