import dialTest from '@/src/core/dialFixtures';
import {
  Attachment,
  CheckboxState,
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  UploadMenuOptions,
} from '@/src/testData';
import { ThemeColorAttributes } from '@/src/ui/domData';
import { FileModalSection } from '@/src/ui/webElements';
import { GeneratorUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { expect } from '@playwright/test';

dialTest(
  '[Upload from device] Error appears if to load the file with the same name and extension if it already exists in a folder.\n' +
    'Long file name in errors does not break UI on "Upload from device"',
  async ({
    dialHomePage,
    setTestIds,
    filesManagerModal,
    filesManagerModalGrid,
    fileConflictConfirmationPopup,
    fileConflictConfirmationPopupAssertion,
    fileApiHelper,
    chatBar,
    baseAssertion,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-1777', 'EPMRTC-1778');

    await dialTest.step('Upload file with long name to app', async () => {
      await fileApiHelper.putFile(Attachment.longImageName);
      await localStorageManager.setShowSideBarPanels();
    });

    await dialTest.step(
      'Upload the same file again through chat bar dots menu',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await chatBar.openManageAttachmentsModal();
        await baseAssertion.assertElementState(
          filesManagerModalGrid.gridRowByNameCell(Attachment.longImageName),
          'visible',
        );
        await dialHomePage.uploadData(
          { path: Attachment.longImageName, dataType: 'upload' },
          () => filesManagerModal.openUploadFromDeviceModal(),
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
        await baseAssertion.assertElementState(
          filesManagerModalGrid.gridRowByNameCell(Attachment.longImageName),
          'visible',
        );
      },
    );
  },
);

dialTest.only(
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
        () =>
          filesManagerModal.openUploadFromDeviceModal(
            UploadMenuOptions.uploadFiles,
          ),
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

dialTest.only(
  '[Upload from device] Several different errors are combined into one (error about restricted symbols, already existed file, equal files).\n' +
    "'[Upload from device] Error appears if to load two files with equal names and extension'.\n" +
    '[Upload from device] Error appears if to upload the file if to rename it using restricted chars',
  async ({
    dialHomePage,
    setTestIds,
    attachFilesModal,
    chatBar,
    uploadFromDeviceModal,
    fileApiHelper,
    baseAssertion,
    localStorageManager,
    manageAttachmentsAssertion,
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
        await manageAttachmentsAssertion.assertEntityState(
          { name: Attachment.sunImageName },
          FileModalSection.AllFiles,
          'visible',
        );
        await attachFilesModal.uploadFromDeviceButton.click();
        await uploadFromDeviceModal.addMoreFilesToUpload(
          Attachment.sunImageName,
          Attachment.restrictedSemicolonCharFilename,
          Attachment.restrictedEqualCharFilename,
          Attachment.cloudImageName,
          Attachment.cloudImageName,
        );
        for (const fileConfig of [
          { name: Attachment.sunImageName, index: 0 },
          { name: Attachment.restrictedSemicolonCharFilename, index: 0 },
          { name: Attachment.restrictedEqualCharFilename, index: 1 },
          { name: Attachment.cloudImageName, index: 0 },
          { name: Attachment.cloudImageName, index: 1 },
        ]) {
          await baseAssertion.assertElementState(
            uploadFromDeviceModal
              .getUploadedFile(fileConfig.name.replace(/[=;]/g, '_'))
              .nth(fileConfig.index),
            'visible',
          );
        }
        await uploadFromDeviceModal.uploadButton.click();
      },
    );

    await dialTest.step('Verify 2 error messages are shown', async () => {
      const error = uploadFromDeviceModal.getModalError();
      await baseAssertion.assertElementState(error, 'visible');
      const errorText = await error.errorMessage.getElementContent();
      baseAssertion.assertValue(
        errorText?.replaceAll('\n', ''),
        ExpectedConstants.duplicatedFilenameError(Attachment.sunImageName) +
          ExpectedConstants.sameFilenamesError(
            `${Attachment.restrictedEqualCharFilename.replace('=', '_')}, ${Attachment.cloudImageName}`,
          ),
        ExpectedMessages.errorMessageContentIsValid,
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
