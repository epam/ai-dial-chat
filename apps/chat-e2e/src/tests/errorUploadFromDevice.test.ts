import dialTest from '@/src/core/dialFixtures';
import {
  API,
  Attachment,
  ExpectedConstants,
  UploadMenuOptions,
} from '@/src/testData';
import { DateUtil } from '@/src/utils';

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
  '[Upload from device] File name is updated ok if the file had restricted special char in the name',
  async ({
    dialHomePage,
    setTestIds,
    attachmentDropdownMenu,
    fileManagerModalGridAssertion,
    fileManagerModal,
    localStorageManager,
    sendMessage,
    sendMessageInputAttachmentsAssertions,
  }) => {
    setTestIds('EPMRTC-1802');
    const replacedSymbolsFilename =
      ExpectedConstants.replacedRestrictedCharsName(
        Attachment.restrictedCharsFilename,
      ).toLowerCase();

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
      'Verify restricted filename chars are replaced automatically and file id uploaded successfully',
      async () => {
        await fileManagerModalGridAssertion.assertGridRowByNameState(
          replacedSymbolsFilename,
          'visible',
        );
        await fileManagerModal.getAttachButton().click();
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
    localStorageManager,
    sendMessage,
    fileApiHelper,
    fileManagerModal,
    fileManagerModalGridAssertion,
    fileConflictConfirmationPopup,
    fileConflictConfirmationPopupAssertion,
    sendMessageInputAttachmentsAssertions,
  }) => {
    setTestIds('EPMRTC-3217', 'EPMRTC-3194', 'EPMRTC-1779');

    const yearMonthSubfolder = DateUtil.getCurrentYearMonth();
    const uploadFolder = `${ExpectedConstants.fileUploadFolder}/${yearMonthSubfolder}`;

    const sanitizedFilename = ExpectedConstants.replacedRestrictedCharsName(
      Attachment.restrictedSemicolonCharFilename,
    );
    const expectedFiles = [
      Attachment.cloudImageName,
      Attachment.sunImageName,
      sanitizedFilename,
    ];

    await dialTest.step('Upload file with valid name to app', async () => {
      await fileApiHelper.putFile(Attachment.sunImageName, {
        parentPath: uploadFolder,
      });
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
                apiHost: uploadFolder,
              },
            ),
        );
      },
    );

    await dialTest.step(
      'Verify conflict modal is displayed for the 1st image',
      async () => {
        await fileConflictConfirmationPopupAssertion.assertConfirmationPopupHeader(
          ExpectedConstants.replaceAttachmentConfirmationTitle,
        );
        await fileConflictConfirmationPopupAssertion.assertConfirmationPopupContent(
          ExpectedConstants.replaceAttachmentConfirmationMessage(
            Attachment.sunImageName,
          ),
        );
      },
    );

    await dialTest.step('Confirm replacing', async () => {
      await fileConflictConfirmationPopup.confirm({
        triggeredHttpMethod: 'PUT',
        triggeredHttpHost: API.fileHost(),
      });
    });

    await dialTest.step(
      'Verify files with restricted chars are auto-sanitized in modal',
      async () => {
        for (const file of expectedFiles) {
          await fileManagerModalGridAssertion.assertGridRowByNameState(
            file,
            'visible',
          );
        }
      },
    );

    await dialTest.step(
      'Attach files and verify they are displayed in the send message input',
      async () => {
        await fileManagerModal.getAttachButton().click();
        await sendMessageInputAttachmentsAssertions.assertAttachedFileState(
          Attachment.sunImageName,
          'visible',
        );
        await sendMessageInputAttachmentsAssertions.assertAttachedFileState(
          sanitizedFilename,
          'visible',
        );
        await sendMessageInputAttachmentsAssertions.assertAttachedFileState(
          Attachment.cloudImageName,
          'visible',
        );
      },
    );
  },
);

dialTest(
  '[Upload from device] A file without extension is uploaded successfully',
  async ({
    dialHomePage,
    setTestIds,
    attachmentDropdownMenu,
    fileManagerModal,
    localStorageManager,
    sendMessage,
    fileManagerModalGridAssertion,
    sendMessageInputAttachmentsAssertions,
  }) => {
    setTestIds('EPMRTC-3113');

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
      'Verify file without extension appears in the send input',
      async () => {
        await fileManagerModalGridAssertion.assertGridRowByNameState(
          Attachment.fileWithoutExtension,
          'visible',
        );
        await fileManagerModal.getAttachButton().click();
        await sendMessageInputAttachmentsAssertions.assertAttachedFileState(
          Attachment.fileWithoutExtension,
          'visible',
        );
      },
    );
  },
);
