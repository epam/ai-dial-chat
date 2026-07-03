import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  Attachment,
  ExpectedMessages,
  ThemeId,
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

//test-case is not relevant since no uploadFromDeviceModal is displayed anymore
dialTest.skip(
  '"Add more files..." on "Upload from device" opens system file manager.\n' +
    '[Upload from device] is closed on X',
  async ({
    dialHomePage,
    sendMessage,
    attachmentDropdownMenu,
    setTestIds,
    localStorageManager,
    uploadFromDeviceModal,
    conversations,
    baseAssertion,
    conversationData,
    dataInjector,
  }) => {
    setTestIds('EPMRTC-3197', 'EPMRTC-3233');
    const attachments = [Attachment.sunImageName, Attachment.cloudImageName];
    let theme: string;
    let conversation: Conversation;

    await dialTest.step(
      'Prepare a conversation that allows attachments in the request',
      async () => {
        conversation = conversationData.prepareDefaultConversation(
          randomModelWithImageAttachment,
        );
        await dataInjector.createConversations([conversation]);
        await localStorageManager.setRecentModelsIdsAndUseLastModel(
          randomModelWithImageAttachment,
        );
      },
    );

    await dialTest.step('Set random app theme', async () => {
      theme = GeneratorUtil.randomArrayElement(Object.keys(ThemeId));
      await localStorageManager.setSettings(theme);
      await localStorageManager.setShowSideBarPanels();
    });

    await dialTest.step(
      'Open created conversation, select "Upload from device" from Send message menu and verify "Upload" button is disabled by default, possibility to upload file through "Add more files..." link',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(conversation.name);
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.uploadFromDevice,
          {
            isHttpMethodTriggered: true,
            triggeredHttpMethod: 'GET',
          },
        );
        await baseAssertion.assertElementActionabilityState(
          uploadFromDeviceModal.uploadButton,
          'disabled',
        );
        await baseAssertion.assertElementColor(
          uploadFromDeviceModal.addMoreFiles,
          ThemesUtil.getRgbColorByKey(
            ThemeColorAttributes.textInfo,
            theme as ThemeId,
          ),
        );

        await uploadFromDeviceModal.addMoreFilesToUpload(...attachments);
        for (const attachment of attachments) {
          await baseAssertion.assertElementState(
            uploadFromDeviceModal.getUploadedFile(attachment),
            'visible',
            ExpectedMessages.fileIsUploaded,
          );
        }
      },
    );

    await dialTest.step(
      'Close "Upload from device" modal, open again and verify no files are uploaded',
      async () => {
        await uploadFromDeviceModal.closeButton.click();
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.uploadFromDevice,
          {
            isHttpMethodTriggered: true,
            triggeredHttpMethod: 'GET',
          },
        );
        for (const attachment of attachments) {
          await baseAssertion.assertElementState(
            uploadFromDeviceModal.getUploadedFile(attachment),
            'hidden',
            ExpectedMessages.fileIsNotUploaded,
          );
        }
      },
    );
  },
);

//test-case is not relevant since no uploadFromDeviceModal is displayed anymore
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
    setTestIds('EPMRTC-3203', 'EPMRTC-3195', 'EPMRTC-3236');
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

//test-case is not relevant since no uploadFromDeviceModal is displayed anymore
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
    setTestIds('EPMRTC-2043', 'EPMRTC-2044', 'EPMRTC-3284');
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

//test-case is not relevant since no uploadFromDeviceModal is displayed anymore
dialTest.skip(
  '[Upload from device] No error appears if to load two files with equal names but different extensions.\n' +
    '[Upload from device] Files with weight 0 and 512Mb are uploaded',
  async ({
    dialHomePage,
    conversations,
    setTestIds,
    sendMessageInputAttachmentsAssertions,
    uploadFromDeviceModal,
    localStorageManager,
    baseAssertion,
    conversationData,
    sendMessage,
    attachmentDropdownMenu,
    dataInjector,
  }) => {
    setTestIds('EPMRTC-3196', 'EPMRTC-3235');
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
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.uploadFromDevice,
          {
            isHttpMethodTriggered: true,
            triggeredHttpMethod: 'GET',
          },
        );
        await uploadFromDeviceModal.addMoreFilesToUpload(...attachments);
        for (const attachment of attachments) {
          await baseAssertion.assertElementState(
            uploadFromDeviceModal.getUploadedFullFilename(attachment),
            'visible',
          );
        }
        await uploadFromDeviceModal.uploadFiles();
        for (const attachment of attachments) {
          await sendMessageInputAttachmentsAssertions.assertFileIsAttached(
            attachment,
            'visible',
          );
        }
      },
    );
  },
);

//test-case is not relevant since no uploadFromDeviceModal is displayed anymore
dialTest.skip(
  `Focus stays in the file named while it's being renamed manually on "Upload from device".\n` +
    "[Upload from device] It's allowed to upload a file with a dot at the end of the name but before extension. Renamed file.\n" +
    "[Upload from device] It's allowed to upload a file with a dot at the end of the name but before extension.\n" +
    'File extension is changed to lower case on "Upload from device"',
  async ({
    dialHomePage,
    setTestIds,
    uploadFromDeviceModal,
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
    setTestIds('EPMRTC-1674', 'EPMRTC-3023', 'EPMRTC-3215', 'EPMRTC-2922');
    const fileNameExtension = Attachment.sunImageName.split('.');
    const expectedName = `${fileNameExtension[0]}${'.'.repeat(2)}${fileNameExtension[1]}`;
    let conversation: Conversation;

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
      'Upload files through "Upload from device" modal',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(conversation.name);
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.uploadFromDevice,
          {
            isHttpMethodTriggered: true,
            triggeredHttpMethod: 'GET',
          },
        );
        await uploadFromDeviceModal.addMoreFilesToUpload(
          Attachment.sunImageName,
          Attachment.dotExtensionImageName,
        );
        for (const file of [
          Attachment.sunImageName,
          Attachment.dotExtensionImageName,
        ]) {
          await baseAssertion.assertElementState(
            uploadFromDeviceModal.getUploadedFile(file),
            'visible',
          );
        }
      },
    );

    await dialTest.step(
      'Type "." at the end of first uploaded file name and verify cursor stays in the field',
      async () => {
        await uploadFromDeviceModal
          .getUploadedFilenameInput(Attachment.sunImageName)
          .click();
        await page.keyboard.press(keys.end);
        await uploadFromDeviceModal.typeInUploadedFilename(
          Attachment.sunImageName,
          '.',
        );
        await baseAssertion.assertIsElementFocused(
          uploadFromDeviceModal.getUploadedFilenameInputLocator(expectedName),
          true,
        );
      },
    );

    await dialTest.step(
      'Verify second file changed extension to lower case',
      async () => {
        await baseAssertion.assertElementState(
          uploadFromDeviceModal.getUploadedFile(
            Attachment.dotExtensionImageName.toLowerCase(),
          ),
          'visible',
          ExpectedMessages.fileIsUploaded,
        );
      },
    );

    await dialTest.step(
      'Click "Upload" button and verify both files are uploaded',
      async () => {
        await uploadFromDeviceModal.uploadFiles();
        await sendMessageInputAttachmentsAssertions.assertFileIsAttached(
          expectedName,
          'visible',
        );
        await sendMessageInputAttachmentsAssertions.assertFileIsAttached(
          Attachment.dotExtensionImageName.toLowerCase(),
          'visible',
        );
      },
    );
  },
);
