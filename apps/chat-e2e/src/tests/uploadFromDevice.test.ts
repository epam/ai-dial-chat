import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  Attachment,
  ExpectedMessages,
  MenuOptions,
  Theme,
  UploadMenuOptions,
} from '@/src/testData';
import { Attributes, Colors, Overflow, Styles } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
import { BaseElement } from '@/src/ui/webElements';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

let modelsWithAttachments: DialAIEntityModel[];
let modelsWithoutAttachments: DialAIEntityModel[];
dialTest.beforeAll(async () => {
  modelsWithAttachments = ModelsUtil.getLatestModelsWithAttachment();
  modelsWithoutAttachments = ModelsUtil.getModelsWithoutAttachment();
});

dialTest(
  '[Upload from device] is opened from Manage attachments screen.\n' +
    '"Add more files..." on "Upload from device" opens system file manager.\n' +
    '[Upload from device] is closed on X',
  async ({
    dialHomePage,
    chatBar,
    setTestIds,
    attachFilesModal,
    localStorageManager,
    uploadFromDeviceModal,
  }) => {
    setTestIds('EPMRTC-1888', 'EPMRTC-3197', 'EPMRTC-3233');
    const attachments = [Attachment.sunImageName, Attachment.cloudImageName];
    let theme: string;

    await dialTest.step('Set random app theme', async () => {
      theme = GeneratorUtil.randomArrayElement(Object.keys(Theme));
      await localStorageManager.setSettings(theme);
    });

    await dialTest.step(
      'Open "Manage attachments" modal through chat side bar menu icon and verify "Upload from device" button colors',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await chatBar.bottomDotsMenuIcon.click();
        await chatBar
          .getBottomDropdownMenu()
          .selectMenuOption(MenuOptions.attachments);

        const uploadFromDeviceBackgroundColor =
          await attachFilesModal.uploadFromDeviceButton.getComputedStyleProperty(
            Styles.backgroundColor,
          );
        expect
          .soft(
            uploadFromDeviceBackgroundColor[0],
            ExpectedMessages.buttonBackgroundColorIsValid,
          )
          .toBe(Colors.controlsBackgroundAccent);

        const uploadFromDeviceTextColor =
          await attachFilesModal.uploadFromDeviceButton.getComputedStyleProperty(
            Styles.color,
          );
        expect
          .soft(
            uploadFromDeviceTextColor[0],
            ExpectedMessages.buttonTextColorIsValid,
          )
          .toBe(Colors.textPermanent);
      },
    );

    await dialTest.step(
      'Click "Upload from device" button and verify "Upload" button is disabled by default, possibility to upload file through "Add more files..." link',
      async () => {
        await attachFilesModal.uploadFromDeviceButton.click();
        await expect
          .soft(
            uploadFromDeviceModal.uploadButton.getElementLocator(),
            ExpectedMessages.buttonIsDisabled,
          )
          .toBeDisabled();

        const addModeFilesTextColor =
          await uploadFromDeviceModal.addMoreFiles.getComputedStyleProperty(
            Styles.color,
          );
        expect
          .soft(
            addModeFilesTextColor[0],
            ExpectedMessages.buttonTextColorIsValid,
          )
          .toBe(
            theme === Theme.light
              ? Colors.controlsBackgroundAccentPrimary
              : Colors.controlsBackgroundAccent,
          );

        await uploadFromDeviceModal.addMoreFilesToUpload(...attachments);
        for (const attachment of attachments) {
          await expect
            .soft(
              uploadFromDeviceModal.getUploadedFile(attachment),
              ExpectedMessages.fileIsUploaded,
            )
            .toBeVisible();
        }
      },
    );

    await dialTest.step(
      'Close "Upload from device" modal, open again and verify no files are uploaded',
      async () => {
        await uploadFromDeviceModal.closeButton.click();
        await attachFilesModal.uploadFromDeviceButton.click();
        for (const attachment of attachments) {
          await expect
            .soft(
              uploadFromDeviceModal.getUploadedFile(attachment),
              ExpectedMessages.fileIsNotUploaded,
            )
            .toBeHidden();
        }
      },
    );
  },
);

dialTest(
  'Delete a file from "Upload from device".\n' +
    'Three dots appear at the end of long file name on "Upload from device".\n' +
    '"Upload" button become disabled if to remove all files from "Upload from device"',
  async ({
    dialHomePage,
    chatBar,
    setTestIds,
    attachFilesModal,
    uploadFromDeviceModal,
    page,
  }) => {
    setTestIds('EPMRTC-3203', 'EPMRTC-3195', 'EPMRTC-3236');
    let deleteUploadedFileIcon: BaseElement;
    const attachments = [Attachment.longImageName, Attachment.cloudImageName];
    const expectedExtensionClassAttribute = 'absolute right-2';
    let uploadedFileInput: BaseElement;
    let uploadedFileExtension: BaseElement;

    await dialTest.step(
      'Upload from device 2 files and verify file with long name is cut with dots, file extension is separated from file name',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await chatBar.bottomDotsMenuIcon.click();
        await chatBar
          .getBottomDropdownMenu()
          .selectMenuOption(MenuOptions.attachments);
        await attachFilesModal.uploadFromDeviceButton.click();
        await uploadFromDeviceModal.addMoreFilesToUpload(...attachments);

        uploadedFileInput = uploadFromDeviceModal.getUploadedFilenameInput(
          attachments[0],
        );
        uploadedFileExtension = uploadFromDeviceModal.getUploadedFileExtension(
          attachments[0],
        );
        const fileInputOverflow =
          await uploadedFileInput.getComputedStyleProperty(
            Styles.text_overflow,
          );
        expect
          .soft(fileInputOverflow[0], ExpectedMessages.filenameIsTruncated)
          .toBe(Overflow.ellipsis);
        await expect
          .soft(
            uploadedFileExtension.getElementLocator(),
            ExpectedMessages.elementAttributeValueIsValid,
          )
          .toHaveAttribute(Attributes.class, expectedExtensionClassAttribute);
      },
    );

    await dialTest.step(
      'Click on file with long name input and verify file extension is separated from file name',
      async () => {
        await uploadedFileInput.click();
        await expect
          .soft(
            uploadedFileExtension.getElementLocator(),
            ExpectedMessages.elementAttributeValueIsValid,
          )
          .toHaveAttribute(Attributes.class, expectedExtensionClassAttribute);

        await page.keyboard.press(keys.end);
        await expect
          .soft(
            uploadedFileExtension.getElementLocator(),
            ExpectedMessages.elementAttributeValueIsValid,
          )
          .toHaveAttribute(Attributes.class, expectedExtensionClassAttribute);
      },
    );

    await dialTest.step(
      'Hover over bin icon for the 1st uploaded file and verify it is highlighted',
      async () => {
        deleteUploadedFileIcon =
          uploadFromDeviceModal.getDeleteUploadedFileIcon(attachments[0]);
        await deleteUploadedFileIcon.hoverOver();

        const deleteUploadedFileIconColor =
          await deleteUploadedFileIcon.getComputedStyleProperty(Styles.color);
        expect
          .soft(
            deleteUploadedFileIconColor[0],
            ExpectedMessages.buttonColorIsValid,
          )
          .toBe(Colors.controlsBackgroundAccent);
      },
    );

    await dialTest.step(
      'Delete 1st uploaded file and verify it is removed from the list',
      async () => {
        await deleteUploadedFileIcon.click();
        await expect
          .soft(
            uploadFromDeviceModal.getUploadedFile(attachments[0]),
            ExpectedMessages.fileIsNotUploaded,
          )
          .toBeHidden();
      },
    );

    await dialTest.step(
      'Click on "Upload" button and verify only one file is attached',
      async () => {
        await uploadFromDeviceModal.uploadFiles();
        await expect
          .soft(
            attachFilesModal
              .getAllFilesTree()
              .getEntityName(attachments[1])
              .getElementLocator(),
            ExpectedMessages.fileIsAttached,
          )
          .toBeVisible();
        expect
          .soft(
            await attachFilesModal.getAllFilesTree().getElementsCount(),
            ExpectedMessages.filesCountIsValid,
          )
          .toBe(1);
      },
    );

    await dialTest.step(
      'Open again "Upload from device" modal, remove remained file and verify "Upload" button becomes disabled',
      async () => {
        await attachFilesModal.uploadFromDeviceButton.click();
        uploadFromDeviceModal.getDeleteUploadedFileIcon(attachments[1]);
        await expect
          .soft(
            uploadFromDeviceModal.uploadButton.getElementLocator(),
            ExpectedMessages.buttonIsDisabled,
          )
          .toBeDisabled();
      },
    );
  },
);

dialTest(
  '[Upload from device] opened from message box. Select 15 files at the same time.\n' +
    '[Upload from device] opened from Attach files. Select 15 files at the same time.\n' +
    '[Upload from device] Images are allowed to be selected if images are allowed only',
  async ({
    dialHomePage,
    setTestIds,
    attachFilesModal,
    conversationData,
    sendMessage,
    dataInjector,
    conversations,
    attachmentDropdownMenu,
    uploadFromDeviceModal,
    sendMessageInputAttachments,
  }) => {
    setTestIds('EPMRTC-2043', 'EPMRTC-2044', 'EPMRTC-3284');
    const menuItems = Object.values(UploadMenuOptions);
    const randomMenuItem =
      menuItems[GeneratorUtil.randomNumberInRange(menuItems.length)];
    const randomModelWithImageAttachment = GeneratorUtil.randomArrayElement(
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
          randomModelWithImageAttachment,
        );
        await dataInjector.createConversations([conversation]);
      },
    );

    await dialTest.step(
      'Open "Upload from device" modal for created conversation and verify supported types label is "images"',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(conversation.name);
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(randomMenuItem);
        if (randomMenuItem === UploadMenuOptions.attachUploadedFiles) {
          await attachFilesModal.uploadFromDeviceButton.click();
        }
        expect
          .soft(
            await uploadFromDeviceModal.getModalHeader().getSupportedTypes(),
            ExpectedMessages.supportedTypesLabelIsCorrect,
          )
          .toBe(Attachment.imagesTypesLabel);
      },
    );

    await dialTest.step(
      'Upload 15 files at once and verify scroll appears on modal window',
      async () => {
        await uploadFromDeviceModal.addMoreFilesToUpload(...attachments);
        for (const attachment of attachments) {
          await expect
            .soft(
              uploadFromDeviceModal.getUploadedFile(attachment),
              ExpectedMessages.fileIsUploaded,
            )
            .toBeVisible();
        }
        expect
          .soft(
            await uploadFromDeviceModal.uploadedFiles.isElementScrollableVertically(),
            ExpectedMessages.uploadedFilesAreaIsScrollable,
          )
          .toBeTruthy();
      },
    );

    await dialTest.step(
      'Click on "Upload" -> "Attach" buttons and verify files are attached to request',
      async () => {
        await uploadFromDeviceModal.uploadFiles();
        if (randomMenuItem === UploadMenuOptions.attachUploadedFiles) {
          await attachFilesModal.attachFiles();
        }
        for (const attachment of attachments) {
          await expect
            .soft(
              sendMessageInputAttachments.inputAttachment(attachment),
              ExpectedMessages.fileIsAttached,
            )
            .toBeVisible();
        }
      },
    );
  },
);

dialTest(
  '[Upload from device] No error appears if to load two files with equal names but different extensions.\n' +
    '[Upload from device] Files with weight 0 and 512Mb are uploaded',
  async ({
    dialHomePage,
    chatBar,
    setTestIds,
    attachFilesModal,
    uploadFromDeviceModal,
  }) => {
    setTestIds('EPMRTC-3196', 'EPMRTC-3235');
    const attachments = [
      Attachment.incrementedImageName(1),
      Attachment.zeroSizeFileName,
    ];

    await dialTest.step(
      'Verify files with same names, zero size but different extensions can be uploaded',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await chatBar.bottomDotsMenuIcon.click();
        await chatBar
          .getBottomDropdownMenu()
          .selectMenuOption(MenuOptions.attachments);
        await attachFilesModal.uploadFromDeviceButton.click();
        await uploadFromDeviceModal.addMoreFilesToUpload(...attachments);
        await uploadFromDeviceModal.uploadFiles();
        for (const attachment of attachments) {
          await expect
            .soft(
              attachFilesModal.getAllFilesTree().getEntityByName(attachment),
              ExpectedMessages.fileIsUploaded,
            )
            .toBeVisible();
        }
      },
    );
  },
);

dialTest(
  `Focus stays in the file named while it's being renamed manually on "Upload from device".\n` +
    "[Upload from device] It's allowed to upload a file with a dot at the end of the name but before extension. Renamed file.\n" +
    "[Upload from device] It's allowed to upload a file with a dot at the end of the name but before extension.\n" +
    'File extension is changed to lower case on "Upload from device"',
  async ({
    dialHomePage,
    chatBar,
    setTestIds,
    attachFilesModal,
    uploadFromDeviceModal,
    page,
  }) => {
    setTestIds('EPMRTC-1674', 'EPMRTC-3023', 'EPMRTC-3215', 'EPMRTC-2922');
    const fileNameExtension = Attachment.sunImageName.split('.');
    const expectedName = `${fileNameExtension[0]}${'.'.repeat(2)}${fileNameExtension[1]}`;

    await dialTest.step(
      'Upload files through "Upload from device" modal',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await chatBar.bottomDotsMenuIcon.click();
        await chatBar
          .getBottomDropdownMenu()
          .selectMenuOption(MenuOptions.attachments);
        await attachFilesModal.uploadFromDeviceButton.click();
        await uploadFromDeviceModal.addMoreFilesToUpload(
          Attachment.sunImageName,
          Attachment.dotExtensionImageName,
        );
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
        await expect
          .soft(
            uploadFromDeviceModal.getUploadedFilenameInputLocator(expectedName),
            ExpectedMessages.fieldIsInFocus,
          )
          .toBeFocused();
      },
    );

    await dialTest.step(
      'Verify second file changed extension to lower case',
      async () => {
        await expect
          .soft(
            uploadFromDeviceModal.getUploadedFile(
              Attachment.dotExtensionImageName.toLowerCase(),
            ),
            ExpectedMessages.fileIsUploaded,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Click "Upload" button and verify both files are uploaded',
      async () => {
        await uploadFromDeviceModal.uploadFiles();
        await expect
          .soft(
            attachFilesModal.getAllFilesTree().getEntityByName(expectedName),
            ExpectedMessages.fileIsUploaded,
          )
          .toBeVisible();
        await expect
          .soft(
            attachFilesModal
              .getAllFilesTree()
              .getEntityByName(Attachment.dotExtensionImageName.toLowerCase()),
            ExpectedMessages.fileIsUploaded,
          )
          .toBeVisible();
      },
    );
  },
);

dialTest(
  '[Manage attachments] Any type file is uploaded in Manage Attachments without any dependency on model set in chat',
  async ({
    dialHomePage,
    chatBar,
    setTestIds,
    attachFilesModal,
    uploadFromDeviceModal,
    conversationData,
    conversations,
    dataInjector,
  }) => {
    setTestIds('EPMRTC-1614');
    const modelWithAttachmentExtensions = modelsWithAttachments.find(
      (m) => m.inputAttachmentTypes![0] !== '*/*',
    );
    const conversationModel = GeneratorUtil.randomArrayElement([
      modelWithAttachmentExtensions,
      ...modelsWithoutAttachments,
    ]);
    let conversation: Conversation;

    await dialTest.step(
      'Create conversation with model that do not allow input attachments or have limited attachment extensions',
      async () => {
        conversation =
          conversationData.prepareDefaultConversation(conversationModel);
        await dataInjector.createConversations([conversation]);
      },
    );

    await dialTest.step(
      'Open "Manage attachments" modal and verify "Supported types" label has "all" value',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(conversation.name);
        await chatBar.bottomDotsMenuIcon.click();
        await chatBar
          .getBottomDropdownMenu()
          .selectMenuOption(MenuOptions.attachments);
        expect
          .soft(
            await attachFilesModal.getModalHeader().getSupportedTypes(),
            ExpectedMessages.supportedTypesLabelIsCorrect,
          )
          .toBe(Attachment.allTypesLabel);
      },
    );

    await dialTest.step(
      'Upload a new file and verify it is displayed on "Manage attachments" modal',
      async () => {
        await dialHomePage.uploadData(
          { path: Attachment.cloudImageName, dataType: 'upload' },
          () => attachFilesModal.uploadFromDeviceButton.click(),
        );
        await uploadFromDeviceModal.uploadFiles();
        await expect
          .soft(
            attachFilesModal
              .getAllFilesTree()
              .getEntityByName(Attachment.cloudImageName),
            ExpectedMessages.fileIsAttached,
          )
          .toBeVisible();
      },
    );
  },
);
