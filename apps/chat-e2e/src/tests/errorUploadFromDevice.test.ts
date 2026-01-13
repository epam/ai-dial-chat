import dialTest from '@/src/core/dialFixtures';
import {
  Attachment,
  ExpectedConstants,
  ExpectedMessages,
  UploadMenuOptions,
} from '@/src/testData';
import { ThemeColorAttributes } from '@/src/ui/domData';
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

dialTest.skip(
  '[Upload from device] Error appears if to load the file with restricted special char in the name which was renamed.\n' +
    '[Upload from device] File name is updated ok if the file has restricted special char in the name',
  async ({
    dialHomePage,
    setTestIds,
    filesManagerModal,
    filesManagerModalGrid,
    filesManagerModalGridAssertion,
    chatBar,
    baseAssertion,
    localStorageManager,
    toastAssertion,
  }) => {
    setTestIds('EPMRTC-1780', 'EPMRTC-1802');
    const restrictedChar = GeneratorUtil.randomArrayElement(
      ExpectedConstants.restrictedNameChars.split(''),
    );

    await dialTest.step('Upload file through chat bar dots menu', async () => {
      await localStorageManager.setShowSideBarPanels();
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await chatBar.openManageAttachmentsModal();
      await baseAssertion.assertElementState(filesManagerModal, 'visible');
      await dialHomePage.uploadData(
        { path: Attachment.sunImageName, dataType: 'upload' },
        () => filesManagerModal.openUploadFromDevice(),
      );
      await baseAssertion.assertElementState(
        filesManagerModalGrid.gridRowByNameCell(Attachment.sunImageName),
        'visible',
      );
    });

    await dialTest.step(
      'Add restricted symbol to file name, click Upload and observe restricted symbols are restricted, file is not renamed',
      async () => {
        await filesManagerModalGrid.renameFile(
          Attachment.sunImageName,
          `${Attachment.sunImageName}${restrictedChar}`,
        );

        await toastAssertion.assertToastMessage(
          ExpectedConstants.failedToMoveFileMessage,
        );

        await filesManagerModalGridAssertion.assertGridRowByNameState(
          Attachment.sunImageName,
          'visible',
        );
        await filesManagerModalGridAssertion.assertGridRowColor(
          Attachment.sunImageName,
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textPrimary),
        );
      },
    );
  },
);

dialTest.skip(
  '[Upload from device] Several different errors are combined into one (error about restricted symbols, already existed file, equal files).\n' +
    "'[Upload from device] Error appears if to load two files with equal names and extension'.\n" +
    '[Upload from device] Error appears if to upload the file if to rename it using restricted chars',
  async ({
    dialHomePage,
    setTestIds,
    filesManagerModal,
    filesManagerModalGridAssertion,
    fileConflictConfirmationPopupAssertion,
    toastAssertion,
    chatBar,
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
        await chatBar.openManageAttachmentsModal();
        await filesManagerModalGridAssertion.assertGridRowByNameState(
          Attachment.sunImageName,
          'visible',
        );

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
          () => filesManagerModal.openUploadFromDevice(),
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
    await dialTest.step.skip('Verify 2 error messages are shown', async () => {
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

dialTest.skip(
  '[Upload from device] Error appears if to upload a file with a dot at the name without extension.\n' +
    '[Upload from device] A file without extension is uploaded successfully',
  async ({
    dialHomePage,
    setTestIds,
    attachFilesModal,
    chatBar,
    uploadFromDeviceModal,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-3216', 'EPMRTC-3113');
    const dot = '.';

    await dialTest.step(
      'Upload file without extension through chat bar dots menu',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await chatBar.openManageAttachmentsModal();
        await dialHomePage.uploadData(
          { path: Attachment.fileWithoutExtension, dataType: 'upload' },
          () => attachFilesModal.uploadFromDevice(),
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
