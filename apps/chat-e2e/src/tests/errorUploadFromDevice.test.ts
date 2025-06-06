import dialTest from '@/src/core/dialFixtures';
import {
  Attachment,
  ExpectedConstants,
  ExpectedMessages,
} from '@/src/testData';
import {
  Attributes,
  Colors,
  Styles,
  ThemeColorAttributes,
} from '@/src/ui/domData';
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
    attachFilesModal,
    fileApiHelper,
    chatBar,
    uploadFromDeviceModal,
    manageAttachmentsAssertion,
    baseAssertion,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-1777', 'EPMRTC-1778');
    const expectedErrorTextClassAttribute = 'truncate whitespace-pre-wrap';

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
        await manageAttachmentsAssertion.assertEntityState(
          { name: Attachment.longImageName },
          FileModalSection.AllFiles,
          'visible',
        );
        await dialHomePage.uploadData(
          { path: Attachment.longImageName, dataType: 'upload' },
          () => attachFilesModal.uploadFromDevice(),
        );
        await baseAssertion.assertElementState(
          uploadFromDeviceModal.getUploadedFile(Attachment.longImageName),
          'visible',
        );
        await uploadFromDeviceModal.uploadButton.click();
      },
    );

    await dialTest.step(
      'Verify error message is shown, it is red and has valid class attribute value',
      async () => {
        const error = uploadFromDeviceModal.getModalError();
        await baseAssertion.assertElementState(error, 'visible');
        await baseAssertion.assertElementText(
          error.errorMessage,
          ExpectedConstants.duplicatedFilenameError(Attachment.longImageName),
          ExpectedMessages.errorMessageContentIsValid,
        );
        await baseAssertion.assertElementColor(
          error.errorMessage,
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textPrimary),
        );
        await baseAssertion.assertElementAttribute(
          error.errorMessage,
          Attributes.class,
          expectedErrorTextClassAttribute,
        );
      },
    );
  },
);

dialTest(
  '[Upload from device] Error appears if to load the file with restricted special char in the name which was renamed.\n' +
    '[Upload from device] File name is updated ok if the file has restricted special char in the name',
  async ({
    dialHomePage,
    setTestIds,
    attachFilesModal,
    chatBar,
    uploadFromDeviceModal,
    baseAssertion,
    localStorageManager,
    attachAllFilesTreeAssertion,
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
      await baseAssertion.assertElementState(attachFilesModal, 'visible');
      await dialHomePage.uploadData(
        { path: Attachment.sunImageName, dataType: 'upload' },
        () => attachFilesModal.uploadFromDevice(),
      );
    });

    await dialTest.step(
      'Add restricted symbol to file name, click Upload and observe restricted symbols are restricted, file is not renamed',
      async () => {
        await uploadFromDeviceModal.typeInUploadedFilename(
          Attachment.sunImageName,
          restrictedChar,
        );
        await uploadFromDeviceModal.uploadButton.click();
        await attachAllFilesTreeAssertion.assertEntityState(
          {
            name: Attachment.sunImageName,
          },
          'visible',
        );
        await attachAllFilesTreeAssertion.assertEntityColor(
          {
            name: Attachment.sunImageName,
          },
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textAccentPrimary),
        );
      },
    );

    await dialTest.step(
      'Upload a file without a restricted symbol, click Upload and verify file is uploaded and had blue color name',
      async () => {
        await dialHomePage.uploadData(
          { path: Attachment.heartImageName, dataType: 'upload' },
          () => attachFilesModal.uploadFromDevice(),
        );
        await uploadFromDeviceModal.uploadButton.click();
        await expect
          .soft(
            attachFilesModal
              .getAllFilesTree()
              .getEntityByName(Attachment.heartImageName),
            ExpectedMessages.fileIsUploaded,
          )
          .toBeVisible();
        const attachmentNameColor = await attachFilesModal
          .getAllFilesTree()
          .getEntityName(Attachment.sunImageName)
          .getComputedStyleProperty(Styles.color);
        expect
          .soft(
            attachmentNameColor[0],
            ExpectedMessages.attachmentNameColorIsValid,
          )
          .toBe(Colors.controlsBackgroundAccent);
      },
    );
  },
);

dialTest(
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
