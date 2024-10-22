import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  Attachment,
  ExpectedMessages,
  UploadMenuOptions,
} from '@/src/testData';
import { Colors, Styles } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
import { FileModalSection } from '@/src/ui/webElements';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { Attachment as AttachmentInterface } from '@epam/ai-dial-shared';
import { expect } from '@playwright/test';

let modelsWithAttachments: DialAIEntityModel[];
dialTest.beforeAll(async () => {
  modelsWithAttachments = ModelsUtil.getLatestModelsWithAttachment();
});

dialTest(
  'Save & Submit button is available if there is only attachment without text.\n' +
    'Save & Submit button is unavailable while attachment is being uploaded',
  async ({
    dialHomePage,
    conversationData,
    setTestIds,
    dataInjector,
    conversations,
    chatMessages,
    chat,
    attachmentDropdownMenu,
    uploadFromDeviceModal,
    page,
  }) => {
    setTestIds('EPMRTC-1613', 'EPMRTC-1776');
    const randomModelWithAttachment = GeneratorUtil.randomArrayElement(
      modelsWithAttachments,
    );
    let conversation: Conversation;

    await dialTest.step(
      'Create conversation with model that accept attachments only with text in request',
      async () => {
        conversation = conversationData.prepareDefaultConversation(
          randomModelWithAttachment,
        );
        await dataInjector.createConversations([conversation]);
      },
    );

    await dialTest.step(
      'Open conversation request in edit mode, delete text and verify Save&Submit button is disabled',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(conversation.name);
        await chatMessages.openEditMessageMode(1);
        await chatMessages.selectEditTextareaContent(
          conversation.messages[0].content,
        );
        await page.keyboard.press(keys.delete);
        await expect
          .soft(
            chatMessages.saveAndSubmit.getElementLocator(),
            ExpectedMessages.buttonIsDisabled,
          )
          .toBeDisabled();
      },
    );

    await dialTest.step(
      'Upload file from device to the request and verify no Save&Submit is disabled while file is uploading',
      async () => {
        await chatMessages.getChatMessageClipIcon(1).click();
        await dialHomePage.uploadData(
          { path: Attachment.sunImageName, dataType: 'upload' },
          () =>
            attachmentDropdownMenu.selectMenuOption(
              UploadMenuOptions.uploadFromDevice,
            ),
        );
        await dialHomePage.throttleAPIResponse('**/*');
        await uploadFromDeviceModal.uploadButton.click();
        await expect
          .soft(
            chatMessages.saveAndSubmit.getElementLocator(),
            ExpectedMessages.buttonIsDisabled,
          )
          .toBeDisabled();
      },
    );

    await dialTest.step(
      'Verify Save&Submit is enabled when file is uploaded',
      async () => {
        await page.unrouteAll();
        await expect
          .soft(
            chatMessages.saveAndSubmit.getElementLocator(),
            ExpectedMessages.buttonIsEnabled,
          )
          .toBeEnabled();
      },
    );

    await dialTest.step(
      'Click Save&Submit button and verify attachment data is sent in the request',
      async () => {
        const request = await chat.saveAndSubmitRequest();
        expect
          .soft(
            request.messages[0].custom_content.attachments[0].title,
            ExpectedMessages.requestCustomContentIsValid,
          )
          .toBe(Attachment.sunImageName);
      },
    );
  },
);

dialTest(
  'Attachment name looks ok if to edit message and name contains special chars.\n' +
    'Delete attachment on x while editing user message in chat history',
  async ({
    dialHomePage,
    setTestIds,
    fileApiHelper,
    chat,
    conversationData,
    dataInjector,
    conversations,
    chatMessages,
    editMessageInputAttachments,
  }) => {
    setTestIds('EPMRTC-1762', 'EPMRTC-1902');
    const randomModelWithAttachment = GeneratorUtil.randomArrayElement(
      modelsWithAttachments,
    );
    let imageUrl: string;
    let conversation: Conversation;

    await dialTest.step(
      'Upload file with special symbols in the name to app',
      async () => {
        imageUrl = await fileApiHelper.putFile(Attachment.specialSymbolsName);
      },
    );

    await dialTest.step(
      'Create conversation with attachment and text in the request',
      async () => {
        conversation =
          conversationData.prepareConversationWithAttachmentsInRequest(
            randomModelWithAttachment,
            false,
            imageUrl,
          );
        await dataInjector.createConversations([conversation]);
      },
    );

    await dialTest.step(
      'Open conversation request in edit mode and verify attachment name is fully visible',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(conversation.name);
        await chatMessages.openEditMessageMode(1);
        await expect
          .soft(
            editMessageInputAttachments
              .inputAttachmentName(Attachment.specialSymbolsName)
              .getElementLocator(),
            ExpectedMessages.attachmentNameIsFullyVisible,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Verify attachment file removing from Edit message box',
      async () => {
        const removeAttachmentIcon =
          editMessageInputAttachments.removeInputAttachmentIcon(
            Attachment.specialSymbolsName,
          );
        await removeAttachmentIcon.hoverOver();
        const removeIconColor =
          await removeAttachmentIcon.getComputedStyleProperty(Styles.color);
        expect
          .soft(
            removeIconColor[0],
            ExpectedMessages.removeAttachmentIconIsHighlighted,
          )
          .toBe(Colors.controlsBackgroundAccent);

        await removeAttachmentIcon.click();
        await expect
          .soft(
            editMessageInputAttachments.inputAttachment(
              Attachment.specialSymbolsName,
            ),
            ExpectedMessages.fileIsNotAttached,
          )
          .toBeHidden();
      },
    );

    await dialTest.step(
      'Set text request in Edit message box, click Save&Submit and verify only updated text is sent in the request',
      async () => {
        const updatedRequestText = 'test';
        await chatMessages.fillEditData(1, updatedRequestText);
        const request = await chat.saveAndSubmitRequest();
        expect
          .soft(
            request.messages[0].custom_content.attachments.length,
            ExpectedMessages.requestCustomContentIsValid,
          )
          .toBe(0);
      },
    );
  },
);

dialTest(
  'Change attached files while editing user message in chat history',
  async ({
    dialHomePage,
    setTestIds,
    attachFilesModal,
    fileApiHelper,
    attachmentDropdownMenu,
    conversationData,
    dataInjector,
    chatMessages,
    conversations,
    editMessageInputAttachments,
    chat,
  }) => {
    setTestIds('EPMRTC-1903');
    const randomModelWithAttachment = GeneratorUtil.randomArrayElement(
      modelsWithAttachments,
    );
    let conversation: Conversation;
    const allAttachedFiles = [
      Attachment.sunImageName,
      Attachment.cloudImageName,
      Attachment.flowerImageName,
    ];
    const initAttachedFiles = [
      Attachment.sunImageName,
      Attachment.cloudImageName,
    ];
    const updatedAttachedFiles = [
      Attachment.sunImageName,
      Attachment.flowerImageName,
    ];
    const attachmentUrls: string[] = [];

    await dialTest.step('Upload 3 files to app', async () => {
      for (const file of allAttachedFiles) {
        attachmentUrls.push(await fileApiHelper.putFile(file));
      }
    });

    await dialTest.step(
      'Create conversation with 2 attachments in request',
      async () => {
        conversation =
          conversationData.prepareConversationWithAttachmentsInRequest(
            randomModelWithAttachment,
            false,
            ...attachmentUrls.slice(0, 2),
          );
        await dataInjector.createConversations([conversation]);
      },
    );

    await dialTest.step(
      'Open conversation request in edit mode, in "Attach files" modal change attached files and verify updated files are displayed in Edit message box',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(conversation.name);
        await chatMessages.openEditMessageMode(1);
        await chatMessages.getChatMessageClipIcon(1).click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
        );
        await attachFilesModal.checkAttachedFile(
          initAttachedFiles[1],
          FileModalSection.AllFiles,
        );
        await attachFilesModal.checkAttachedFile(
          updatedAttachedFiles[1],
          FileModalSection.AllFiles,
        );
        await attachFilesModal.attachFiles();
        for (const file of updatedAttachedFiles) {
          await expect
            .soft(
              editMessageInputAttachments.inputAttachment(file),
              ExpectedMessages.fileIsAttached,
            )
            .toBeVisible();
        }
        expect
          .soft(
            await editMessageInputAttachments.inputAttachments.getElementsCount(),
            ExpectedMessages.attachedFilesCountIsValid,
          )
          .toBe(updatedAttachedFiles.length);
      },
    );

    await dialTest.step(
      'Save&Submit request and verify updated files are sent in the request',
      async () => {
        const request = await chat.saveAndSubmitRequest();
        expect
          .soft(
            request.messages[0].custom_content.attachments.length,
            ExpectedMessages.attachedFilesCountIsValid,
          )
          .toBe(updatedAttachedFiles.length);
        for (const file of updatedAttachedFiles) {
          expect
            .soft(
              request.messages[0].custom_content.attachments.find(
                (a: AttachmentInterface) => a.title === file,
              ),
              ExpectedMessages.requestCustomContentIsValid,
            )
            .toBeDefined();
        }
      },
    );
  },
);

dialTest(
  'Attachments are not grouped in user-message if there are 3 of them.\n' +
    'Attachments are grouped in user-message if there are 4 of them',
  async ({
    dialHomePage,
    setTestIds,
    fileApiHelper,
    conversationData,
    dataInjector,
    chatMessages,
    conversations,
  }) => {
    setTestIds('EPMRTC-3331', 'EPMRTC-3332');
    const randomModelWithAttachment = GeneratorUtil.randomArrayElement(
      modelsWithAttachments,
    );
    let conversation: Conversation;
    const allAttachedFiles = [
      Attachment.sunImageName,
      Attachment.cloudImageName,
      Attachment.flowerImageName,
      Attachment.longImageName,
    ];
    const attachmentUrls: string[] = [];

    await dialTest.step('Upload 4 files to app', async () => {
      for (const file of allAttachedFiles) {
        attachmentUrls.push(await fileApiHelper.putFile(file));
      }
    });

    await dialTest.step(
      'Create conversation with 3 attachments in request',
      async () => {
        conversation =
          conversationData.prepareConversationWithAttachmentsInRequest(
            randomModelWithAttachment,
            false,
            ...attachmentUrls.slice(0, 3),
          );
        await dataInjector.createConversations([conversation]);
      },
    );

    await dialTest.step(
      'Open conversation and verify attachments are separated from each other',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(conversation.name);
        for (const file of allAttachedFiles.slice(0, 3)) {
          await expect
            .soft(
              chatMessages
                .getChatMessageAttachment(1, file)
                .getElementLocator(),
              ExpectedMessages.fileIsAttached,
            )
            .toBeVisible();
        }
      },
    );

    await dialTest.step(
      'Add one more attachment to conversation request and verify attachments are grouped',
      async () => {
        const additionalAttachment = conversationData.getAttachmentData(
          attachmentUrls[attachmentUrls.length - 1],
        );
        conversation.messages[0].custom_content!.attachments!.push(
          additionalAttachment,
        );
        await dataInjector.updateConversations([conversation]);
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(conversation.name);
        await expect
          .soft(
            chatMessages.getChatMessageAttachmentsGroup(1),
            ExpectedMessages.attachmentsAreGrouped,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Expand attachments group and verify attachments are displayed',
      async () => {
        await chatMessages.getChatMessageAttachmentsGroup(1).click();
        for (const file of allAttachedFiles) {
          await expect
            .soft(
              chatMessages
                .getChatMessageAttachment(1, file)
                .getElementLocator(),
              ExpectedMessages.attachmentIsVisible,
            )
            .toBeVisible();
        }
      },
    );

    await dialTest.step(
      'Collapse attachments group and verify attachments are hidden',
      async () => {
        await chatMessages.getChatMessageAttachmentsGroup(1).click();
        for (const file of allAttachedFiles) {
          await expect
            .soft(
              chatMessages
                .getChatMessageAttachment(1, file)
                .getElementLocator(),
              ExpectedMessages.attachmentIsHidden,
            )
            .toBeHidden();
        }
      },
    );
  },
);
