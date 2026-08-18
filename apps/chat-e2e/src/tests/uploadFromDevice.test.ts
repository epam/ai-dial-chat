import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  Attachment,
  CheckboxState,
  ExpectedMessages,
  MenuOptions,
  UploadMenuOptions,
} from '@/src/testData';
import { ThemeColorAttributes } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
import { BaseElement } from '@/src/ui/webElements';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { Locator } from '@playwright/test';

let modelsWithAttachments: DialAIEntityModel[];
let randomModelWithImageAttachment: DialAIEntityModel;

dialTest.beforeAll(async () => {
  modelsWithAttachments = ModelsUtil.getLatestModelsWithAttachment();
  randomModelWithImageAttachment = GeneratorUtil.randomArrayElement(
    modelsWithAttachments.filter(
      (m) =>
        m.inputAttachmentTypes?.includes(Attachment.imageTypesExtension) ||
        m.inputAttachmentTypes?.includes(Attachment.allTypesExtension),
    ),
  );
});

//TODO: to update
dialTest.skip(
  'Delete a file from "Upload from device".\n' +
    'Three dots appear at the end of long file name on "Upload from device".\n' +
    '"Upload" button become disabled if to remove all files from "Upload from device"',
  async ({
    dialHomePage,
    sendMessage,
    attachmentDropdownMenu,
    setTestIds,
    uploadFromDeviceModal,
    sendMessageInputAttachmentsAssertions,
    baseAssertion,
    page,
    localStorageManager,
  }) => {
    setTestIds('EPMDIAL-6899', 'EPMDIAL-6910', 'EPMDIAL-6900');
    let deleteUploadedFileIcon: Locator;
    const attachments = [Attachment.longImageName, Attachment.cloudImageName];
    let uploadedFileInput: BaseElement;
    let uploadedFileExtension: BaseElement;

    await dialTest.step(
      'Upload from device 2 files and verify file with long name is cut with dots, file extension is separated from file name',
      async () => {
        await localStorageManager.setRecentModelsIdsAndUseLastModel(
          randomModelWithImageAttachment,
        );
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({ skipSidebars: true });
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.uploadFromDevice,
          {
            isHttpMethodTriggered: true,
            triggeredHttpMethod: 'GET',
          },
        );
        await uploadFromDeviceModal.addMoreFilesToUpload(...attachments);
        uploadedFileInput = uploadFromDeviceModal.getUploadedFilenameInput(
          attachments[0],
        );
        uploadedFileExtension = uploadFromDeviceModal.getUploadedFileExtension(
          attachments[0],
        );
        await baseAssertion.assertInputValueIsTruncated(uploadedFileInput);
        await baseAssertion.assertElementState(
          uploadedFileExtension,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Click on file with long name input and verify file extension is separated from file name',
      async () => {
        await uploadedFileInput.click();
        await baseAssertion.assertElementState(
          uploadedFileExtension,
          'visible',
        );
        await page.keyboard.press(keys.end);
        await baseAssertion.assertElementState(
          uploadedFileExtension,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Hover over bin icon for the 1st uploaded file and verify it is highlighted',
      async () => {
        deleteUploadedFileIcon =
          uploadFromDeviceModal.getDeleteUploadedFileButtonIcon(attachments[0]);
        await deleteUploadedFileIcon.hover();
        await baseAssertion.assertElementColor(
          deleteUploadedFileIcon,
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textAccentPrimary),
        );
      },
    );

    await dialTest.step(
      'Delete 1st uploaded file and verify it is removed from the list',
      async () => {
        await deleteUploadedFileIcon.click();
        await baseAssertion.assertElementState(
          uploadFromDeviceModal.getUploadedFile(attachments[0]),
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Click on "Upload" button and verify only one file is attached',
      async () => {
        await uploadFromDeviceModal.uploadFiles();
        await sendMessageInputAttachmentsAssertions.assertAttachedFileState(
          attachments[1],
          'visible',
        );
        await sendMessageInputAttachmentsAssertions.assertAttachedFileState(
          attachments[0],
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Upload from device one more file, remove it and verify "Upload" button becomes disabled',
      async () => {
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.uploadFromDevice,
          {
            isHttpMethodTriggered: true,
            triggeredHttpMethod: 'GET',
          },
        );
        await uploadFromDeviceModal.addMoreFilesToUpload(attachments[0]);
        await deleteUploadedFileIcon.click();
        await baseAssertion.assertElementActionabilityState(
          uploadFromDeviceModal.uploadButton,
          'disabled',
        );
      },
    );
  },
);

//TODO: to update
dialTest.skip(
  '[Upload from device] opened from message box. Select 15 files at the same time.\n' +
    '[Upload from device] opened from Attach files. Select 15 files at the same time.\n' +
    '[Upload from device] Images are allowed to be selected if images are allowed only',
  async ({
    dialHomePage,
    setTestIds,
    conversationData,
    sendMessage,
    dataInjector,
    conversations,
    conversationAssertion,
    attachmentDropdownMenu,
    uploadFromDeviceModal,
    localStorageManager,
    baseAssertion,
    sendMessageInputAttachmentsAssertions,
  }) => {
    setTestIds('EPMDIAL-6902', 'EPMDIAL-6903', 'EPMDIAL-6923');
    const randomModelWithUnlimitedImageAttachment =
      GeneratorUtil.randomArrayElement(
        modelsWithAttachments.filter(
          (m) =>
            m.inputAttachmentTypes?.length == 1 &&
            m.inputAttachmentTypes[0] === Attachment.imageTypesExtension &&
            !m.maxInputAttachments,
        ),
      );
    const attachmentsCount = 15;
    const attachments: string[] = [];
    for (let i = 1; i <= attachmentsCount; i++) {
      attachments.push(Attachment.incrementedImageName(i));
    }
    let conversation: Conversation;

    await dialTest.step(
      'Create empty conversation that allow input attachments',
      async () => {
        conversation = conversationData.prepareEmptyConversation(
          randomModelWithUnlimitedImageAttachment,
        );
        await dataInjector.createConversations([conversation]);
        await localStorageManager.setRecentModelsIdsAndUseLastModel(
          randomModelWithUnlimitedImageAttachment,
        );
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Open "Upload from device" modal for created conversation and verify supported types label is "images"',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(conversation.name);
        await conversationAssertion.assertSelectedEntity(conversation.name);
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.uploadFromDevice,
          {
            isHttpMethodTriggered: true,
            triggeredHttpMethod: 'GET',
          },
        );
        baseAssertion.assertValue(
          await uploadFromDeviceModal.getModalHeader().getSupportedTypes(),
          Attachment.imagesTypesLabel,
          ExpectedMessages.supportedTypesLabelIsCorrect,
        );
      },
    );

    await dialTest.step(
      'Upload 15 files at once and verify scroll appears on modal window',
      async () => {
        await dialHomePage.emulateSlowNetworkConditions({
          downloadThroughput: -1,
          uploadThroughput: -1,
        });
        await uploadFromDeviceModal.addMoreFilesToUpload(...attachments);
        for (const attachment of attachments) {
          await baseAssertion.assertElementState(
            uploadFromDeviceModal.getUploadedFile(attachment),
            'visible',
            ExpectedMessages.fileIsUploaded,
          );
        }
        baseAssertion.assertBooleanCondition(
          await uploadFromDeviceModal.uploadedFiles.isElementScrollableVertically(),
          true,
          ExpectedMessages.uploadedFilesAreaIsScrollable,
        );
      },
    );

    await dialTest.step(
      'Click on "Upload" button and verify files are attached to request',
      async () => {
        await uploadFromDeviceModal.uploadFiles();
        for (const attachment of attachments) {
          await sendMessageInputAttachmentsAssertions.assertAttachedFileState(
            attachment,
            'visible',
          );
        }
      },
    );
  },
);

dialTest(
  '[Upload from device] No error appears if to load two files with equal names but different extensions',
  async ({
    dialHomePage,
    conversations,
    setTestIds,
    localStorageManager,
    fileManagerModalGridAssertion,
    conversationData,
    sendMessage,
    attachmentDropdownMenu,
    dataInjector,
  }) => {
    setTestIds('EPMDIAL-6909');
    const attachments = [
      Attachment.incrementedImageName(1),
      Attachment.zeroSizeFileName,
    ];
    const randomModelWithAnyAttachment = GeneratorUtil.randomArrayElement(
      modelsWithAttachments.filter(
        (m) =>
          m.inputAttachmentTypes?.length == 1 &&
          m.inputAttachmentTypes[0] === Attachment.allTypesExtension,
      ),
    );
    let conversation: Conversation;

    await dialTest.step(
      'Create a new conversation that allows input attachments',
      async () => {
        conversation = conversationData.prepareDefaultConversation(
          randomModelWithAnyAttachment,
        );
        await dataInjector.createConversations([conversation]);
        await localStorageManager.setRecentModelsIdsAndUseLastModel(
          randomModelWithAnyAttachment,
        );
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Verify files with same names, zero size but different extensions can be uploaded',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(conversation.name);
        await sendMessage.attachmentMenuTrigger.click();
        await dialHomePage.uploadData(
          { path: attachments, dataType: 'upload' },
          () =>
            attachmentDropdownMenu.selectMenuOption(
              UploadMenuOptions.uploadFromDevice,
              {
                isHttpMethodTriggered: true,
                triggeredHttpMethod: 'GET',
              },
            ),
        );
        for (const attachment of attachments) {
          await fileManagerModalGridAssertion.assertGridRowByNameState(
            attachment,
            'visible',
          );
        }
      },
    );
  },
);

dialTest(
  `Focus stays in the file named while it's being renamed manually on "Upload from device".\n` +
    "[Upload from device] It's allowed to upload a file with a dot at the end of the name but before extension.\n" +
    'File extension is changed to lower case on "Upload from device"',
  async ({
    dialHomePage,
    setTestIds,
    fileManagerModal,
    fileManagerModalGrid,
    fileManagerModalGridAssertion,
    page,
    localStorageManager,
    baseAssertion,
    sendMessageInputAttachmentsAssertions,
    conversationData,
    dataInjector,
    conversations,
    sendMessage,
    attachmentDropdownMenu,
  }) => {
    setTestIds('EPMDIAL-6913', 'EPMDIAL-6915', 'EPMDIAL-7317');
    let conversation: Conversation;
    const dotExtensionFileName = Attachment.dotExtensionImageName.toLowerCase();

    await dialTest.step(
      'Create a new conversation that allows image input attachments',
      async () => {
        conversation = conversationData.prepareDefaultConversation(
          randomModelWithImageAttachment,
        );
        await dataInjector.createConversations([conversation]);
        await localStorageManager.setRecentModelsIdsAndUseLastModel(
          randomModelWithImageAttachment,
        );
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Upload a file via "Upload from device", rename it and verify focus stays in the file name',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(conversation.name);
        await sendMessage.attachmentMenuTrigger.click();
        await dialHomePage.uploadData(
          { path: Attachment.sunImageName, dataType: 'upload' },
          () =>
            attachmentDropdownMenu.selectMenuOption(
              UploadMenuOptions.uploadFromDevice,
              { isHttpMethodTriggered: true, triggeredHttpMethod: 'GET' },
            ),
        );
        await baseAssertion.assertElementState(fileManagerModal, 'visible');
        await fileManagerModalGridAssertion.assertGridRowByNameState(
          Attachment.sunImageName,
          'visible',
        );
        await fileManagerModalGrid
          .gridRowByNameCell(Attachment.sunImageName)
          .hover();
        const dotsMenu = await fileManagerModalGrid.gridDotsMenuByNameCell(
          Attachment.sunImageName,
        );
        await dotsMenu.click();
        await fileManagerModalGrid
          .getRowDropdownMenu()
          .selectItem(MenuOptions.rename);
        const renameInput = fileManagerModalGrid.getRenameInput();
        await renameInput.click();
        await page.keyboard.press(keys.end);
        await renameInput.typeInInput(' renamed manually');
        await baseAssertion.assertIsElementFocused(renameInput, true);
        await page.keyboard.press(keys.escape);
      },
    );

    await dialTest.step(
      'Upload a file with a dot before the extension and uppercase extension and verify it is uploaded with lower-case extension and automatically selected',
      async () => {
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
        );
        await dialHomePage.uploadData(
          { path: Attachment.dotExtensionImageName, dataType: 'upload' },
          () => fileManagerModal.openUploadFromDevice(),
        );
        await fileManagerModalGridAssertion.assertGridRowByNameState(
          dotExtensionFileName,
          'visible',
        );
        await fileManagerModalGridAssertion.assertGridCheckboxByNameState(
          dotExtensionFileName,
          CheckboxState.checked,
        );
        await fileManagerModal.getAttachButton().click();
      },
    );

    await dialTest.step(
      'Verify uploaded file is attached to the message input with lowercase extensions',
      async () => {
        await sendMessageInputAttachmentsAssertions.assertFileIsAttached(
          dotExtensionFileName,
          'visible',
        );
      },
    );
  },
);

dialTest(
  '[Upload from device] Change upload to folder with long name which is cut at the end with three dots',
  async ({
    fileManagerPage,
    setTestIds,
    fileManagerFoldersTree,
    fileApiHelper,
    fileManagerBreadcrumb,
    baseAssertion,
  }) => {
    setTestIds('EPMDIAL-6920');
    const folderName = GeneratorUtil.randomString(256);

    await dialTest.step(
      'Upload file to the folder with long name via API',
      async () => {
        await fileApiHelper.putFile(Attachment.flowerImageName, {
          parentPath: folderName,
        });
      },
    );

    await dialTest.step(
      'Open "File manager" page, select created folder and verify folder long name is cut at the end with three dots',
      async () => {
        await fileManagerPage.openFileManagerPage();
        await fileManagerPage.waitForPageLoaded();
        await fileManagerFoldersTree.expandFolder(
          { isFilesListingTriggered: true },
          folderName,
        );
        await baseAssertion.assertElementTextIsTruncated(
          fileManagerBreadcrumb.itemByNameContent(folderName),
        );
      },
    );
  },
);
