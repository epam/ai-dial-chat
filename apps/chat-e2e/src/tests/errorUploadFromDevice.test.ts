import dialTest from '@/src/core/dialFixtures';
import {
  Attachment,
  ExpectedConstants,
  ExpectedMessages,
} from '@/src/testData';
import { Attributes, Colors, Styles } from '@/src/ui/domData';
import { GeneratorUtil } from '@/src/utils';
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
  }) => {
    setTestIds('EPMRTC-1777', 'EPMRTC-1778');
    const expectedErrorTextClassAttribute = 'truncate whitespace-pre-wrap';

    await dialTest.step('Upload file with long name to app', async () => {
      await fileApiHelper.putFile(Attachment.longImageName);
    });

    await dialTest.step(
      'Upload the same file again through chat bar dots menu',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await chatBar.openManageAttachmentsModal();
        await dialHomePage.uploadData(
          { path: Attachment.longImageName, dataType: 'upload' },
          () => attachFilesModal.uploadFromDeviceButton.click(),
        );
        await uploadFromDeviceModal.uploadButton.click();
      },
    );

    await dialTest.step(
      'Verify error message is shown, it is red and has valid class attribute value',
      async () => {
        await expect
          .soft(
            uploadFromDeviceModal.getUploadErrorText.getElementLocator(),
            ExpectedMessages.notAllowedNameErrorShown,
          )
          .toBeVisible();

        const uploadErrorText = uploadFromDeviceModal.getUploadErrorText;
        expect
          .soft(
            await uploadErrorText.getElementContent(),
            ExpectedMessages.errorMessageContentIsValid,
          )
          .toBe(
            ExpectedConstants.duplicatedFilenameError(Attachment.longImageName),
          );

        const errorTextColor = await uploadErrorText.getComputedStyleProperty(
          Styles.color,
        );
        expect
          .soft(errorTextColor[0], ExpectedMessages.errorTextColorIsValid)
          .toBe(Colors.textPrimary);
        await expect
          .soft(
            uploadErrorText.getElementLocator(),
            ExpectedMessages.elementAttributeValueIsValid,
          )
          .toHaveAttribute(Attributes.class, expectedErrorTextClassAttribute);
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
  }) => {
    setTestIds('EPMRTC-1780', 'EPMRTC-1802');
    const restrictedChar = GeneratorUtil.randomArrayElement(
      ExpectedConstants.restrictedNameChars.split(''),
    );
    const notAllowedFilename = `${restrictedChar}${Attachment.sunImageName}`;

    await dialTest.step('Upload file through chat bar dots menu', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded({
        isNewConversationVisible: true,
      });
      await chatBar.openManageAttachmentsModal();
      await dialHomePage.uploadData(
        { path: Attachment.sunImageName, dataType: 'upload' },
        () => attachFilesModal.uploadFromDeviceButton.click(),
      );
    });

    await dialTest.step(
      'Add restricted symbol to file name, click Upload and verify error is shown',
      async () => {
        await uploadFromDeviceModal.typeInUploadedFilename(
          Attachment.sunImageName,
          restrictedChar,
        );
        await uploadFromDeviceModal.uploadButton.click();
        await expect
          .soft(
            uploadFromDeviceModal.getUploadErrorText.getElementLocator(),
            ExpectedMessages.notAllowedNameErrorShown,
          )
          .toBeVisible();
        expect
          .soft(
            await uploadFromDeviceModal.getUploadErrorText.getElementContent(),
            ExpectedMessages.errorMessageContentIsValid,
          )
          .toBe(ExpectedConstants.notAllowedFilenameError(notAllowedFilename));
      },
    );

    await dialTest.step(
      'Remove restricted symbol, click Upload and verify file is uploaded and had blue color name',
      async () => {
        await uploadFromDeviceModal.setUploadedFilename(
          notAllowedFilename,
          Attachment.sunImageName.split('.')[0],
        );
        await uploadFromDeviceModal.uploadButton.click();
        await expect
          .soft(
            attachFilesModal
              .getAllFilesTree()
              .getEntityByName(Attachment.sunImageName),
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
  }) => {
    setTestIds('EPMRTC-3217', 'EPMRTC-3194', 'EPMRTC-1779');

    await dialTest.step('Upload file with valid name to app', async () => {
      await fileApiHelper.putFile(Attachment.sunImageName);
    });

    await dialTest.step(
      'Upload one file with already uploaded name, 2 files with restricted symbols, 2 files with equal names through chat bar dots menu',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await chatBar.openManageAttachmentsModal();
        await attachFilesModal.uploadFromDeviceButton.click();
        await uploadFromDeviceModal.addMoreFilesToUpload(
          Attachment.sunImageName,
          Attachment.restrictedSemicolonCharFilename,
          Attachment.restrictedEqualCharFilename,
          Attachment.cloudImageName,
          Attachment.cloudImageName,
        );
        await uploadFromDeviceModal.uploadButton.click();
      },
    );

    await dialTest.step('Verify 3 error messages are shown', async () => {
      await expect
        .soft(
          uploadFromDeviceModal.getUploadErrorText.getElementLocator(),
          ExpectedMessages.errorMessageIsShown,
        )
        .toBeVisible();
      const errorText =
        await uploadFromDeviceModal.getUploadErrorText.getElementContent();
      expect
        .soft(
          errorText?.replaceAll('\n', ''),
          ExpectedMessages.errorMessageContentIsValid,
        )
        .toBe(
          ExpectedConstants.notAllowedFilenameError(
            [
              Attachment.restrictedSemicolonCharFilename,
              Attachment.restrictedEqualCharFilename,
            ].join(', '),
          ) +
            ExpectedConstants.duplicatedFilenameError(Attachment.sunImageName) +
            ExpectedConstants.sameFilenamesError(Attachment.cloudImageName),
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
  }) => {
    setTestIds('EPMRTC-3216', 'EPMRTC-3113');
    const dot = '.';

    await dialTest.step(
      'Upload file without extension through chat bar dots menu',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await chatBar.openManageAttachmentsModal();
        await dialHomePage.uploadData(
          { path: Attachment.fileWithoutExtension, dataType: 'upload' },
          () => attachFilesModal.uploadFromDeviceButton.click(),
        );
      },
    );

    await dialTest.step(
      'Add dot at the end of file name and verify error message is shown',
      async () => {
        await uploadFromDeviceModal
          .getUploadedFilenameInput(Attachment.fileWithoutExtension)
          .click();
        await uploadFromDeviceModal.typeInUploadedFilename(
          Attachment.fileWithoutExtension,
          dot,
        );
        await uploadFromDeviceModal.uploadButton.click();
        await expect
          .soft(
            uploadFromDeviceModal.getUploadErrorText.getElementLocator(),
            ExpectedMessages.notAllowedNameErrorShown,
          )
          .toBeVisible();
        expect
          .soft(
            await uploadFromDeviceModal.getUploadErrorText.getElementContent(),
            ExpectedMessages.errorMessageContentIsValid,
          )
          .toBe(
            ExpectedConstants.endDotFilenameError(
              Attachment.fileWithoutExtension + dot,
            ),
          );
      },
    );

    await dialTest.step(
      'Remove end dot and verify file is successfully uploaded',
      async () => {
        await uploadFromDeviceModal
          .getDeleteUploadedFileIcon(Attachment.fileWithoutExtension)
          .click();
        await uploadFromDeviceModal.addMoreFilesToUpload(
          Attachment.fileWithoutExtension,
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
