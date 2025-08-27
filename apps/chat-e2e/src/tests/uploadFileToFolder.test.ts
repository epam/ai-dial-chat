import dialTest from '@/src/core/dialFixtures';
import {
  Attachment,
  CheckboxState,
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
} from '@/src/testData';
import { Attributes, ThemeColorAttributes } from '@/src/ui/domData';
import { GeneratorUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';

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
    allFilesFolderAssertion,
    manageAttachmentsAssertion,
  }) => {
    setTestIds('EPMRTC-3295', 'EPMRTC-3048');

    await dialTest.step(
      'Open "Manage attachments" modal, click on "New folder" icon and verify new folder with default name is created in edit mode',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await chatBar.openManageAttachmentsModal();
        await manageAttachmentsAssertion.assertElementState(
          attachFilesModal,
          'visible',
        );
        await attachFilesModal.newFolderButton.click();
        const folderEditInput = attachedAllFiles.getEditFolderInput().editInput;
        await allFilesFolderAssertion.assertElementState(
          attachedAllFiles.getEditFolderInput(),
          'visible',
        );
        await allFilesFolderAssertion.assertElementAttribute(
          folderEditInput,
          Attributes.value,
          ExpectedConstants.newFolderWithIndexTitle(1),
          ExpectedMessages.elementAttributeValueIsValid,
        );
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
            attachedAllFilesDropdownMenu.selectMenuOption(MenuOptions.upload, {
              isHttpMethodTriggered: true,
              triggeredHttpMethod: 'GET',
            }),
        );
        await uploadFromDeviceModal.uploadFiles();
      },
    );

    await dialTest.step(
      'Verify file is uploaded into child folder, it is checked and highlighted',
      async () => {
        await allFilesFolderAssertion.assertFolderEntityState(
          { name: ExpectedConstants.newFolderWithIndexTitle(1), index: 2 },
          { name: Attachment.sunImageName },
          'visible',
        );
        await allFilesFolderAssertion.assertFolderEntityCheckboxState(
          { name: ExpectedConstants.newFolderWithIndexTitle(1), index: 2 },
          { name: Attachment.sunImageName },
          CheckboxState.checked,
        );
        await allFilesFolderAssertion.assertFolderEntityColor(
          { name: ExpectedConstants.newFolderWithIndexTitle(1), index: 2 },
          { name: Attachment.sunImageName },
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textAccentPrimary),
        );
      },
    );
  },
);

dialTest(
  '[Manage attachments] Tooltip is shown for folder and file names.\n' +
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
    allFilesFolderAssertion,
  }) => {
    setTestIds('EPMRTC-3022', 'EPMRTC-1615');
    const folderName = GeneratorUtil.randomString(7);

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
        await attachedAllFiles
          .getFolderEntity(folderName, Attachment.longImageName)
          .hover();
        await baseAssertion.assertElementText(
          tooltip,
          Attachment.longImageName,
          ExpectedMessages.tooltipContentIsValid,
        );
        await attachedAllFiles.getFolderName(folderName).hoverOver();
        await baseAssertion.assertElementText(
          tooltip,
          folderName,
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
        await baseAssertion.assertElementState(uploadFromDeviceModal, 'hidden');
      },
    );

    await dialTest.step(
      'Verify file is uploaded into existing folder, it is checked and highlighted',
      async () => {
        await allFilesFolderAssertion.assertFolderEntityState(
          { name: folderName },
          { name: Attachment.cloudImageName },
          'visible',
        );
        await allFilesFolderAssertion.assertFolderEntityCheckboxState(
          { name: folderName },
          { name: Attachment.cloudImageName },
          CheckboxState.checked,
        );
        await allFilesFolderAssertion.assertFolderEntityColor(
          { name: folderName },
          { name: Attachment.cloudImageName },
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textAccentPrimary),
        );
      },
    );
  },
);
