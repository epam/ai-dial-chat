import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  Attachment,
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  UploadMenuOptions,
} from '@/src/testData';
import { Colors, Styles } from '@/src/ui/domData';
import { FileModalSection } from '@/src/ui/webElements';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

let modelsWithAttachments: DialAIEntityModel[];
dialTest.beforeAll(async () => {
  modelsWithAttachments = ModelsUtil.getLatestModelsWithAttachment();
});
const attachedFiles = [Attachment.sunImageName, Attachment.flowerImageName];

dialTest(
  '[Manage attachments] Delete a file through context menu. Cancel.\n' +
    '[Manage attachments] Delete a file though context menu. Delete',
  async ({
    dialHomePage,
    setTestIds,
    attachFilesModal,
    fileApiHelper,
    confirmationDialog,
    chatBar,
  }) => {
    setTestIds('EPMRTC-1884', 'EPMRTC-3296');

    await dialTest.step('Upload file to app', async () => {
      await fileApiHelper.putFile(Attachment.sunImageName);
    });

    await dialTest.step(
      'Open "Manage attachments" modal through chat side bar menu icon',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await chatBar.bottomDotsMenuIcon.click();
        await chatBar
          .getBottomDropdownMenu()
          .selectMenuOption(MenuOptions.attachments);
      },
    );

    await dialTest.step(
      'Hover over attached file, open file dropdown menu and select Delete option',
      async () => {
        await attachFilesModal.openFileDropdownMenu(Attachment.sunImageName);
        await attachFilesModal
          .getFileDropdownMenu()
          .selectMenuOption(MenuOptions.delete);
      },
    );

    await dialTest.step(
      'Verify "Confirm deleting file" modal with valid text appears',
      async () => {
        expect
          .soft(
            await confirmationDialog.getConfirmationMessage(),
            ExpectedMessages.confirmationMessageIsValid,
          )
          .toBe(ExpectedConstants.deleteFileMessage);
      },
    );

    await dialTest.step(
      'Close modal and verify file is not deleted',
      async () => {
        await confirmationDialog.cancelDialog();
        await expect
          .soft(
            attachFilesModal
              .getAllFilesTree()
              .getEntityByName(Attachment.sunImageName),
            ExpectedMessages.fileIsAttached,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Proceed again to "Confirm deleting file" modal, confirm file delete and verify it disappears from files list',
      async () => {
        await attachFilesModal.openFileDropdownMenu(Attachment.sunImageName);
        await attachFilesModal
          .getFileDropdownMenu()
          .selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        await expect
          .soft(
            attachFilesModal
              .getAllFilesTree()
              .getEntityByName(Attachment.sunImageName),
            ExpectedMessages.fileIsNotAttached,
          )
          .toBeHidden();
      },
    );
  },
);

dialTest(
  '[Manage attachments] Delete several files. Cancel.\n' +
    '[Manage attachments] Delete several files. Delete',
  async ({
    dialHomePage,
    setTestIds,
    attachFilesModal,
    fileApiHelper,
    confirmationDialog,
    conversationData,
    sendMessage,
    dataInjector,
    conversations,
    attachmentDropdownMenu,
  }) => {
    setTestIds('EPMRTC-3298', 'EPMRTC-3299');
    const randomModelWithAttachment = GeneratorUtil.randomArrayElement(
      modelsWithAttachments,
    );
    let conversation: Conversation;

    await dialTest.step('Upload 2 files to app', async () => {
      for (const file of attachedFiles) {
        await fileApiHelper.putFile(file);
      }
    });

    await dialTest.step(
      'Create empty conversation that allow input attachments',
      async () => {
        conversation = conversationData.prepareEmptyConversation(
          randomModelWithAttachment,
        );
        await dataInjector.createConversations([conversation]);
      },
    );

    await dialTest.step(
      'Open "Attach files" modal for created conversation and check attached files',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(conversation.name);
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
        );
        for (const file of attachedFiles) {
          await attachFilesModal.checkAttachedFile(
            file,
            FileModalSection.AllFiles,
          );
        }
      },
    );

    await dialTest.step(
      'Click Delete button at the bottom and verify "Confirm deleting file" modal with valid text appears',
      async () => {
        await attachFilesModal.deleteFilesButton.click();
        expect
          .soft(
            await confirmationDialog.getConfirmationMessage(),
            ExpectedMessages.confirmationMessageIsValid,
          )
          .toBe(ExpectedConstants.deleteFilesMessage);
      },
    );

    await dialTest.step(
      'Close modal and verify files are not deleted',
      async () => {
        await confirmationDialog.cancelDialog();
        for (const file of attachedFiles) {
          await expect
            .soft(
              attachFilesModal.getAllFilesTree().getEntityByName(file),
              ExpectedMessages.fileIsAttached,
            )
            .toBeVisible();
        }
      },
    );

    await dialTest.step(
      'Proceed again to "Confirm deleting file" modal, confirm files delete and verify they disappear from files list',
      async () => {
        await attachFilesModal.deleteFilesButton.click();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        for (const file of attachedFiles) {
          await expect
            .soft(
              attachFilesModal.getAllFilesTree().getEntityByName(file),
              ExpectedMessages.fileIsNotAttached,
            )
            .toBeHidden();
        }
      },
    );
  },
);

dialTest(
  '[Manage attachments] Delete file while it is being uploaded',
  async ({
    dialHomePage,
    setTestIds,
    attachFilesModal,
    uploadFromDeviceModal,
    chatBar,
  }) => {
    setTestIds('EPMRTC-3302');

    await dialTest.step(
      'Open "Manage attachments" modal through chat side bar menu icon',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await chatBar.bottomDotsMenuIcon.click();
        await chatBar
          .getBottomDropdownMenu()
          .selectMenuOption(MenuOptions.attachments);
      },
    );

    await dialTest.step('Start upload attachment from device', async () => {
      await dialHomePage.uploadData(
        { path: Attachment.sunImageName, dataType: 'upload' },
        () => attachFilesModal.uploadFromDeviceButton.click(),
      );
      await dialHomePage.throttleAPIResponse('**/*');
      await uploadFromDeviceModal.uploadButton.click();
    });

    await dialTest.step(
      'Verify loading indicator is shown while file is uploading, cancel button is highlighted on hover',
      async () => {
        await expect
          .soft(
            attachFilesModal
              .getAllFilesTree()
              .attachedFileLoadingIndicator(Attachment.sunImageName),
            ExpectedMessages.attachmentLoadingIndicatorIsVisible,
          )
          .toBeAttached();

        await attachFilesModal
          .getAllFilesTree()
          .removeAttachedFileIcon(Attachment.sunImageName)
          .hoverOver();
        const removeIconColor = await attachFilesModal
          .getAllFilesTree()
          .removeAttachedFileIcon(Attachment.sunImageName)
          .getComputedStyleProperty(Styles.color);
        expect
          .soft(
            removeIconColor[0],
            ExpectedMessages.removeAttachmentIconIsHighlighted,
          )
          .toBe(Colors.controlsBackgroundAccent);
      },
    );

    await dialTest.step(
      'Click on cancel button near loading indicator and verify uploading stops, file disappears from the list',
      async () => {
        await attachFilesModal
          .getAllFilesTree()
          .removeAttachedFileIcon(Attachment.sunImageName)
          .click();
        await expect
          .soft(
            attachFilesModal
              .getAllFilesTree()
              .attachedFileLoadingIndicator(Attachment.sunImageName),
            ExpectedMessages.attachmentLoadingIndicatorNotVisible,
          )
          .toBeHidden();
        await expect
          .soft(
            attachFilesModal
              .getAllFilesTree()
              .getEntityByName(Attachment.sunImageName),
            ExpectedMessages.fileIsNotAttached,
          )
          .toBeHidden();
      },
    );
  },
);

dialTest(
  '[Manage attachments] Delete file after there was internet connection error',
  async ({
    dialHomePage,
    setTestIds,
    attachFilesModal,
    uploadFromDeviceModal,
    chatBar,
    context,
  }) => {
    setTestIds('EPMRTC-3304');

    await dialTest.step(
      'Open "Manage attachments" modal through chat side bar menu icon',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await chatBar.bottomDotsMenuIcon.click();
        await chatBar
          .getBottomDropdownMenu()
          .selectMenuOption(MenuOptions.attachments);
      },
    );

    await dialTest.step(
      'Upload file from device in offline mode and verify filename is red and has error icon',
      async () => {
        await dialHomePage.uploadData(
          { path: Attachment.sunImageName, dataType: 'upload' },
          () => attachFilesModal.uploadFromDeviceButton.click(),
        );
        await context.setOffline(true);
        await uploadFromDeviceModal.uploadButton.click();

        const filenameColor = await attachFilesModal
          .getAllFilesTree()
          .getEntityName(Attachment.sunImageName)
          .getComputedStyleProperty(Styles.color);
        expect
          .soft(filenameColor[0], ExpectedMessages.attachmentNameColorIsValid)
          .toBe(Colors.textError);
        await expect
          .soft(
            attachFilesModal
              .getAllFilesTree()
              .attachedFileErrorIcon(Attachment.sunImageName),
            ExpectedMessages.attachmentHasErrorIcon,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Set online mode, click on cancel button near loading indicator and verify file disappears from the list',
      async () => {
        await context.setOffline(false);
        await attachFilesModal
          .getAllFilesTree()
          .removeAttachedFileIcon(Attachment.sunImageName)
          .click();
        await expect
          .soft(
            attachFilesModal
              .getAllFilesTree()
              .getEntityByName(Attachment.sunImageName),
            ExpectedMessages.fileIsNotAttached,
          )
          .toBeHidden();
      },
    );
  },
);

dialTest(
  '[Manage attachments] Reload file after there was internet connection error',
  async ({
    dialHomePage,
    setTestIds,
    attachFilesModal,
    uploadFromDeviceModal,
    chatBar,
    context,
  }) => {
    setTestIds('EPMRTC-3303');

    await dialTest.step(
      'Open "Manage attachments" modal through chat side bar menu icon',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await chatBar.bottomDotsMenuIcon.click();
        await chatBar
          .getBottomDropdownMenu()
          .selectMenuOption(MenuOptions.attachments);
      },
    );

    await dialTest.step(
      'Set offline mode before uploading attachment from device',
      async () => {
        await dialHomePage.uploadData(
          { path: Attachment.sunImageName, dataType: 'upload' },
          () => attachFilesModal.uploadFromDeviceButton.click(),
        );
        await context.setOffline(true);
        await uploadFromDeviceModal.uploadButton.click();
      },
    );

    await dialTest.step(
      'Set online mode, click on Reload button near loading indicator and verify file displayed in the list and change color to blue',
      async () => {
        await context.setOffline(false);
        await attachFilesModal
          .getAllFilesTree()
          .attachedFileLoadingRetry(Attachment.sunImageName)
          .click();
        await expect
          .soft(
            attachFilesModal
              .getAllFilesTree()
              .attachedFileLoadingRetry(Attachment.sunImageName),
            ExpectedMessages.attachmentLoadingIndicatorNotVisible,
          )
          .toBeHidden();
        const filenameColor = await attachFilesModal
          .getAllFilesTree()
          .getEntityName(Attachment.sunImageName)
          .getComputedStyleProperty(Styles.color);
        expect
          .soft(filenameColor[0], ExpectedMessages.attachmentNameColorIsValid)
          .toBe(Colors.controlsBackgroundAccent);
      },
    );
  },
);

dialTest(
  '[Manage attachments] Download a file though context menu with special chars in a name.\n' +
    'Allowed special chars in the file name while renaming on "Upload from device"',
  async ({
    dialHomePage,
    setTestIds,
    attachFilesModal,
    uploadFromDeviceModal,
    chatBar,
  }) => {
    setTestIds('EPMRTC-2015', 'EPMRTC-3187');

    await dialTest.step(
      'Upload file and set his name to contain special symbols',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await chatBar.bottomDotsMenuIcon.click();
        await chatBar
          .getBottomDropdownMenu()
          .selectMenuOption(MenuOptions.attachments);
        await dialHomePage.uploadData(
          { path: Attachment.sunImageName, dataType: 'upload' },
          () => attachFilesModal.uploadFromDeviceButton.click(),
        );
        await uploadFromDeviceModal.setUploadedFilename(
          Attachment.sunImageName,
          ExpectedConstants.allowedSpecialSymbolsInName(),
        );
        await uploadFromDeviceModal.uploadFiles();
      },
    );

    await dialTest.step(
      'Select "Download" option from file dropdown menu and verify file is successfully downloaded, file is not highlighted in "Manage attachments" modal',
      async () => {
        await attachFilesModal.openFileDropdownMenu(
          ExpectedConstants.allowedSpecialSymbolsInName(),
        );
        const downloadedData = await dialHomePage.downloadData(() =>
          attachFilesModal
            .getFileDropdownMenu()
            .selectMenuOption(MenuOptions.download),
        );
        expect
          .soft(
            downloadedData.path,
            ExpectedMessages.attachmentIsSuccessfullyDownloaded,
          )
          .toContain(ExpectedConstants.winAllowedSpecialSymbolsInName);

        const fileBackgroundColor = await attachFilesModal
          .getAllFilesTree()
          .getEntityName(ExpectedConstants.allowedSpecialSymbolsInName())
          .getComputedStyleProperty(Styles.backgroundColor);
        expect
          .soft(fileBackgroundColor[0], ExpectedMessages.fileIsNotHighlighted)
          .toBe(Colors.defaultBackground);
      },
    );
  },
);

dialTest(
  '[Manage attachments] Download several files',
  async ({
    dialHomePage,
    setTestIds,
    attachFilesModal,
    fileApiHelper,
    conversationData,
    sendMessage,
    dataInjector,
    conversations,
    attachmentDropdownMenu,
  }) => {
    setTestIds('EPMRTC-3300');
    const randomModelWithAttachment = GeneratorUtil.randomArrayElement(
      modelsWithAttachments,
    );
    let conversation: Conversation;

    await dialTest.step('Upload 2 files to app', async () => {
      for (const file of attachedFiles) {
        await fileApiHelper.putFile(file);
      }
    });

    await dialTest.step(
      'Create empty conversation that allow input attachments',
      async () => {
        conversation = conversationData.prepareEmptyConversation(
          randomModelWithAttachment,
        );
        await dataInjector.createConversations([conversation]);
      },
    );

    await dialTest.step(
      'Open "Attach files" modal for created conversation and check attached files',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(conversation.name);
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
        );
        for (const file of attachedFiles) {
          await attachFilesModal.checkAttachedFile(
            file,
            FileModalSection.AllFiles,
          );
        }
      },
    );

    await dialTest.step(
      'Click "Download" button at the bottom and verify files are successfully downloaded and stay checked',
      async () => {
        const downloadedData = await dialHomePage.downloadMultipleData(
          () => attachFilesModal.downloadFilesButton.click(),
          attachedFiles.length,
        );

        for (const file of attachedFiles) {
          const isFileChecked = attachFilesModal
            .getAllFilesTree()
            .getEntityCheckbox(file);
          await expect
            .soft(isFileChecked, ExpectedMessages.attachmentFileIsChecked)
            .toBeChecked();
          expect
            .soft(
              downloadedData.find((d) => d.path.includes(file)),
              ExpectedMessages.attachmentIsSuccessfullyDownloaded,
            )
            .toBeDefined();
        }
      },
    );
  },
);
