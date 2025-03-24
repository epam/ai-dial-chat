import dialTest from '@/src/core/dialFixtures';
import {
  Attachment,
  CheckboxState,
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
} from '@/src/testData';
import { Colors } from '@/src/ui/domData';
import { FileSelectors } from '@/src/ui/selectors';
import { GeneratorUtil } from '@/src/utils';
import { Locator, expect } from '@playwright/test';

dialTest(
  '[Manage attachments] Create new folder.\n' +
    '[Manage attachments] Upload file directly to newly created nested folder',
  async ({
    dialHomePage,
    chatBar,
    setTestIds,
    attachFilesModal,
    attachedAllFiles,
    uploadFromDeviceModal,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-3295', 'EPMRTC-3048');

    await dialTest.step(
      'Open "Manage attachments" modal, click on "New folder" icon and verify new folder with default name is created in edit mode',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await chatBar.openManageAttachmentsModal();
        await attachFilesModal.newFolderButton.click();
        const folderEditInput = attachedAllFiles.getEditFolderInput();
        await expect
          .soft(
            folderEditInput.getElementLocator(),
            ExpectedMessages.newFolderCreated,
          )
          .toBeVisible();
        expect
          .soft(
            await folderEditInput.getEditInputValue(),
            ExpectedMessages.elementAttributeValueIsValid,
          )
          .toBe(ExpectedConstants.newFolderWithIndexTitle(1));
      },
    );

    await dialTest.step(
      'Create child folder, and upload file via child folder dropdown menu',
      async () => {
        const attachedAllFilesDropdownMenu = attachedAllFiles.getDropdownMenu();
        await attachedAllFiles.getEditFolderInputActions().clickTickButton();
        await attachedAllFiles.openFolderDropdownMenu(
          ExpectedConstants.newFolderWithIndexTitle(1),
        );
        await attachedAllFilesDropdownMenu.selectMenuOption(
          MenuOptions.addNewFolder,
        );
        await attachedAllFiles.getEditFolderInputActions().clickTickButton();

        await attachedAllFiles.openFolderDropdownMenu(
          ExpectedConstants.newFolderWithIndexTitle(1),
          2,
        );
        await dialHomePage.uploadData(
          { path: Attachment.sunImageName, dataType: 'upload' },
          () =>
            attachedAllFilesDropdownMenu.selectMenuOption(MenuOptions.upload),
        );
        await uploadFromDeviceModal.uploadFiles();
      },
    );

    await dialTest.step(
      'Verify file is uploaded into child folder, it is checked and highlighted',
      async () => {
        await expect
          .soft(
            attachedAllFiles.getFolderEntity(
              ExpectedConstants.newFolderWithIndexTitle(1),
              Attachment.sunImageName,
              2,
            ),
            ExpectedMessages.fileIsUploaded,
          )
          .toBeVisible();

        const isFileChecked = attachedAllFiles.getFolderEntityCheckbox(
          ExpectedConstants.newFolderWithIndexTitle(1),
          Attachment.sunImageName,
          2,
        );
        await expect
          .soft(isFileChecked, ExpectedMessages.attachmentFileIsChecked)
          .toBeChecked();

        const fileNameColor = await attachedAllFiles.getFolderEntityColor(
          ExpectedConstants.newFolderWithIndexTitle(1),
          Attachment.sunImageName,
          2,
        );
        expect
          .soft(fileNameColor, ExpectedMessages.attachmentNameColorIsValid)
          .toBe(Colors.controlsBackgroundAccent);
      },
    );
  },
);

for (let i = 1; i <= 10; i++) {
  dialTest.only(
    `${i}[Manage attachments] Tooltip is shown for folder and file names.\n` +
      '[Manage attachments] Upload file directly to "old" folder',
    async ({
      fileApiHelper,
      uploadFromDeviceModal,
      chatBar,
      attachedAllFiles,
      dialHomePage,
      tooltip,
      setTestIds,
      localStorageManager,
      manageAttachmentsAssertion,
      baseAssertion,
    }) => {
      setTestIds('EPMRTC-3022', 'EPMRTC-1615');
      const folderName = GeneratorUtil.randomString(7);
      let uploadingFileElement: Locator;

      await dialTest.step('Upload file to some folder', async () => {
        await fileApiHelper.putFile(Attachment.longImageName, folderName);
        await localStorageManager.setShowSideBarPanels();
      });

      await dialTest.step(
        'Proceed to "Manage attachments" modal and verify tooltip with name is shown on hover folder and file',
        async () => {
          await dialHomePage.openHomePage();
          await dialHomePage.waitForPageLoaded();
          await chatBar.openManageAttachmentsModal();
          await manageAttachmentsAssertion.assertElementState(
            attachedAllFiles,
            'visible',
          );
          await attachedAllFiles.expandCollapseFolder(folderName, {
            isHttpMethodTriggered: true,
          });
          await attachedAllFiles.getFolderName(folderName).hoverOver();
          await baseAssertion.assertElementText(
            tooltip,
            folderName,
            ExpectedMessages.tooltipContentIsValid,
          );
          await attachedAllFiles
            .getFolderEntity(folderName, Attachment.longImageName)
            .hover();
          await baseAssertion.assertElementText(
            tooltip,
            Attachment.longImageName,
            ExpectedMessages.tooltipContentIsValid,
          );
        },
      );

      await dialTest.step(
        'Upload a new file via existing folder dropdown menu',
        async () => {
          await attachedAllFiles.openFolderDropdownMenu(folderName);
          await dialHomePage.uploadData(
            { path: Attachment.cloudImageName, dataType: 'upload' },
            () =>
              attachedAllFiles
                .getDropdownMenu()
                .selectMenuOption(MenuOptions.upload, {
                  isHttpMethodTriggered: true,
                  triggeredHttpMethod: 'GET',
                }),
          );
          await baseAssertion.assertElementState(
            uploadFromDeviceModal.getUploadedFile(Attachment.cloudImageName),
            'visible',
          );
          await uploadFromDeviceModal.uploadFiles();
          await baseAssertion.assertElementState(
            uploadFromDeviceModal,
            'hidden',
          );
          uploadingFileElement = attachedAllFiles.getFolderEntity(
            folderName,
            Attachment.cloudImageName,
          );
          await baseAssertion.assertElementState(
            uploadingFileElement,
            'visible',
          );
          await manageAttachmentsAssertion.assertElementState(
            uploadingFileElement.locator(FileSelectors.loadingIndicator),
            'hidden',
          );
          await manageAttachmentsAssertion.assertElementState(
            uploadingFileElement.locator(FileSelectors.remove),
            'hidden',
          );
        },
      );

      await dialTest.step(
        'Verify file is uploaded into existing folder, it is checked and highlighted',
        async () => {
          await manageAttachmentsAssertion.assertElementState(
            uploadingFileElement,
            'visible',
          );
          await manageAttachmentsAssertion.assertCheckboxState(
            attachedAllFiles.getFolderEntityCheckbox(
              folderName,
              Attachment.cloudImageName,
            ),
            CheckboxState.checked,
          );

          const fileNameColor = await attachedAllFiles.getFolderEntityColor(
            folderName,
            Attachment.cloudImageName,
          );
          expect
            .soft(fileNameColor, ExpectedMessages.attachmentNameColorIsValid)
            .toBe(Colors.controlsBackgroundAccent);
        },
      );
    },
  );
}
