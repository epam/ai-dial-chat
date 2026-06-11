import dialTest from '@/src/core/dialFixtures';
import {
  Attachment,
  ExpectedConstants,
  ImportResolutionOption,
  UploadMenuOptions,
} from '@/src/testData';
import { FileUtil, GeneratorUtil } from '@/src/utils';

dialTest(
  '[Upload from device] Error appears if to load the file with the same name and extension if it already exists in a folder.\n' +
    'Long file name in errors does not break UI on "Upload from device"',
  async ({
    fileManagerPage,
    setTestIds,
    fileManagerToolbar,
    fileManagerGridAssertion,
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
        await fileManagerPage.openFileManagerPage();
        await fileManagerPage.waitForPageLoaded();
        await fileManagerGridAssertion.assertGridRowByNameState(
          Attachment.longImageName,
          'visible',
        );
        await fileManagerToolbar.getNewButton().click();
        await fileManagerPage.uploadData(
          { path: Attachment.longImageName, dataType: 'upload' },
          () =>
            fileManagerToolbar
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
        await fileManagerGridAssertion.assertGridRowByNameState(
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

dialTest(
  '[Upload from device] Duplicate names in upload list are auto-renamed on upload.\n' +
    '[Upload from device] Files with restricted chars in the name are sanitized and uploaded.\n' +
    '[Upload from device] Upload succeeds when batch contains files that sanitize to the same name',
  async ({
    dialHomePage,
    setTestIds,
    attachmentDropdownMenu,
    uploadFromDeviceModal,
    localStorageManager,
    sendMessage,
    fileApiHelper,
    baseAssertion,
    sendMessageInputAttachmentsAssertions,
    replaceConfirmationModal,
    replaceConfirmationModalAssertion,
  }) => {
    setTestIds('EPMRTC-3217', 'EPMRTC-3194', 'EPMRTC-1779');

    const sanitizedFilename = ExpectedConstants.replacedRestrictedCharsName(
      Attachment.restrictedSemicolonCharFilename,
    );
    const renamedSunImageName = Attachment.sunImageName.replace(
      /(\.)([^.]+)$/,
      ' 1.$2',
    );
    const renamedRestrictedCharFilename = sanitizedFilename.replace(
      /(\.)([^.]+)$/,
      ' 1.$2',
    );
    const renamedCloudImageName = Attachment.cloudImageName.replace(
      /(\.)([^.]+)$/,
      ' 1.$2',
    );

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
        await baseAssertion.assertElementState(
          uploadFromDeviceModal
            .getUploadedFilenameInput(sanitizedFilename)
            .getNthElement(1),
          'visible',
        );
        await baseAssertion.assertElementState(
          uploadFromDeviceModal
            .getUploadedFilenameInput(sanitizedFilename)
            .getNthElement(2),
          'visible',
        );
      },
    );

    await dialTest.step(
      'Upload all files and verify duplicates are auto-renamed in attachments',
      async () => {
        await uploadFromDeviceModal.uploadButton.click();
        await replaceConfirmationModal.waitForState({ state: 'visible' });
        await baseAssertion.assertElementText(
          replaceConfirmationModal.title,
          ExpectedConstants.uploadDuplicateNamesModalTitle,
        );
        await baseAssertion.assertElementText(
          replaceConfirmationModal.description,
          ExpectedConstants.uploadDuplicateNamesModalDescription,
        );
        await replaceConfirmationModalAssertion.assertAllItemsOption(
          ImportResolutionOption.Postfix,
        );
        await replaceConfirmationModal.confirmUploadDuplicates();
        await baseAssertion.assertElementState(uploadFromDeviceModal, 'hidden');

        await sendMessageInputAttachmentsAssertions.assertAttachedFileState(
          renamedSunImageName,
          'visible',
        );
        await sendMessageInputAttachmentsAssertions.assertAttachedFileState(
          sanitizedFilename,
          'visible',
        );
        await sendMessageInputAttachmentsAssertions.assertAttachedFileState(
          renamedRestrictedCharFilename,
          'visible',
        );
        await sendMessageInputAttachmentsAssertions.assertAttachedFileState(
          Attachment.cloudImageName,
          'visible',
        );
        await sendMessageInputAttachmentsAssertions.assertAttachedFileState(
          renamedCloudImageName,
          'visible',
        );
      },
    );
  },
);

dialTest(
  '[Upload from device] Dot at the end of the name without extension is not allowed to be entered.\n' +
    '[Upload from device] A file without extension is uploaded successfully',
  async ({
    dialHomePage,
    setTestIds,
    attachmentDropdownMenu,
    uploadFromDeviceModal,
    localStorageManager,
    sendMessage,
    baseAssertion,
    sendMessageInputAttachmentsAssertions,
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
      'Verify file extension is empty and attempt to add a dot at the end',
      async () => {
        await baseAssertion.assertElementState(
          uploadFromDeviceModal.getUploadedFileExtension(
            Attachment.fileWithoutExtension,
          ),
          'hidden',
        );

        await uploadFromDeviceModal
          .getUploadedFilenameInput(Attachment.fileWithoutExtension)
          .click();
        await uploadFromDeviceModal.typeInUploadedFilename(
          Attachment.fileWithoutExtension,
          dot,
        );

        // Verify dot is NOT entered
        await baseAssertion.assertElementState(
          uploadFromDeviceModal.getUploadedFilenameInput(
            Attachment.fileWithoutExtension,
          ),
          'visible',
        );
        await baseAssertion.assertElementState(
          uploadFromDeviceModal.getUploadedFilenameInput(
            `${Attachment.fileWithoutExtension}${dot}${dot}`, // A hack to make it work with a filename without extension
          ),
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Upload file without extension successfully',
      async () => {
        await uploadFromDeviceModal.uploadFiles();
        await baseAssertion.assertElementState(uploadFromDeviceModal, 'hidden');

        await sendMessageInputAttachmentsAssertions.assertAttachedFileState(
          Attachment.fileWithoutExtension,
          'visible',
        );
      },
    );
  },
);
