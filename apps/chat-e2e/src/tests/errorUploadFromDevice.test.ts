import dialTest from '@/src/core/dialFixtures';
import {
  Attachment,
  ExpectedConstants,
  ExpectedMessages,
  UploadMenuOptions,
} from '@/src/testData';
import { FileUtil, GeneratorUtil } from '@/src/utils';
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

dialTest(
  '[Upload from device] Restricted special chars are not allowed to be entered or copied\n' +
    '[Upload from device] File name is updated ok if the file had restricted special char in the name',
  async ({
    dialHomePage,
    setTestIds,
    attachmentDropdownMenu,
    uploadFromDeviceModal,
    localStorageManager,
    sendMessage,
    sendMessageInputAttachmentsAssertions,
    baseAssertion,
  }) => {
    setTestIds('EPMRTC-1780', 'EPMRTC-1802');
    const restrictedChar = GeneratorUtil.randomArrayElement(
      ExpectedConstants.restrictedNameChars.split(''),
    );
    const replacedSymbolsFilename =
      ExpectedConstants.replacedRestrictedCharsName(
        Attachment.restrictedCharsFilename,
      );

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
          .getUploadedFilenameInput(
            ExpectedConstants.replacedRestrictedCharsName(
              Attachment.restrictedCharsFilename,
            ),
          )
          .click();
        await uploadFromDeviceModal.typeInUploadedFilename(
          replacedSymbolsFilename,
          restrictedChar,
        );
        await baseAssertion.assertElementState(
          uploadFromDeviceModal.getUploadedFilenameInput(
            replacedSymbolsFilename,
          ),
          'visible',
        );

        const filenameWithoutExt = FileUtil.getFilenameWithoutExtension(
          replacedSymbolsFilename,
        );
        const fileExtension = FileUtil.getFileExtension(
          replacedSymbolsFilename,
        );
        await baseAssertion.assertElementState(
          uploadFromDeviceModal.getUploadedFilenameInput(
            `${filenameWithoutExt}${restrictedChar}${fileExtension}`,
          ),
          'hidden',
        );
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
      },
    );
  },
);

dialTest.only(
  '[Upload from device] Several different errors are combined into one (error about restricted symbols, already existed file, equal files).\n' +
    "'[Upload from device] Error appears if to load two files with equal names and extension'.\n" +
    '[Upload from device] Error appears if to upload the file if to rename it using restricted chars',
  async ({
    dialHomePage,
    setTestIds,
    attachmentDropdownMenu,
    uploadFromDeviceModal,
    localStorageManager,
    sendMessage,
    fileApiHelper,
    baseAssertion,
  }) => {
    setTestIds('EPMRTC-3217', 'EPMRTC-3194', 'EPMRTC-1779');

    await dialTest.step('Upload file with valid name to app', async () => {
      await fileApiHelper.putFile(Attachment.sunImageName);
      await localStorageManager.setShowSideBarPanels();
    });

    await dialTest.step(
      'Upload one file with already uploaded name, 2 files with restricted symbols, 2 files with equal names through chat bar attachment menu',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await sendMessage.attachmentMenuTrigger.click();
        await dialHomePage.uploadData(
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
      'Verify files with restricted chars are auto-sanitized in modal',
      async () => {
        const sanitizedSemicolon =
          ExpectedConstants.replacedRestrictedCharsName(
            Attachment.restrictedSemicolonCharFilename,
          );
        const sanitizedEqual = ExpectedConstants.replacedRestrictedCharsName(
          Attachment.restrictedEqualCharFilename,
        );

        await baseAssertion.assertElementState(
          uploadFromDeviceModal.getUploadedFilenameInput(sanitizedSemicolon).getNthElement(1),
          'visible',
        );
        await baseAssertion.assertElementState(
          uploadFromDeviceModal.getUploadedFilenameInput(sanitizedEqual).getNthElement(2),
          'visible',
        );
      },
    );

    await dialTest.step(
      'Click Upload and verify combined error messages are shown',
      async () => {
        await uploadFromDeviceModal.uploadButton.click();

        const modalError = uploadFromDeviceModal.getModalError();
        await baseAssertion.assertElementState(modalError, 'visible');

        const sanitizedFilename = ExpectedConstants.replacedRestrictedCharsName(
          Attachment.restrictedSemicolonCharFilename,
        );

        await baseAssertion.assertElementText(
          modalError.errorMessage,
          new RegExp(
            ExpectedConstants.duplicatedFilenameError(Attachment.sunImageName),
          ),
          ExpectedMessages.errorMessageContentIsValid,
        );
        await baseAssertion.assertElementText(
          modalError.errorMessage,
          new RegExp(
            ExpectedConstants.sameFilenamesError(
              `${sanitizedFilename}, ${Attachment.cloudImageName}`,
            ),
          ),
          ExpectedMessages.errorMessageContentIsValid,
        );
      },
    );
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
