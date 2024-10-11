import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  Attachment,
  ExpectedMessages,
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

dialTest(
  'Clip icon does not exist while editing user message in chat history when the functionality is unavailable for the model',
  async ({
    dialHomePage,
    conversationData,
    talkToSelector,
    marketplacePage,
    setTestIds,
    chatHeader,
    fileApiHelper,
    dataInjector,
    localStorageManager,
    chatMessages,
    chat,
  }) => {
    setTestIds('EPMRTC-1583');
    const randomModelWithAttachment = GeneratorUtil.randomArrayElement(
      modelsWithAttachments,
    );
    let imageUrl: string;
    let conversation: Conversation;

    await dialTest.step('Upload file to app', async () => {
      imageUrl = await fileApiHelper.putFile(Attachment.sunImageName);
    });

    await dialTest.step(
      'Create conversation with attachment in the request',
      async () => {
        conversation =
          conversationData.prepareConversationWithAttachmentsInRequest(
            randomModelWithAttachment,
            false,
            imageUrl,
          );
        await dataInjector.createConversations([conversation]);
        await localStorageManager.setSelectedConversation(conversation);
      },
    );

    await dialTest.step(
      'Edit conversation model to the one that do not support attachment inputs',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await chatHeader.openConversationSettingsPopup();
        await talkToSelector.selectEntity(
          ModelsUtil.getDefaultModel()!,
          marketplacePage,
        );
        await chat.applyNewEntity();
      },
    );

    await dialTest.step(
      'Edit first conversation message and verify no Clip icon is available',
      async () => {
        await chatMessages.openEditMessageMode(1);
        await expect
          .soft(
            chatMessages.getChatMessageClipIcon(
              conversation.messages[0]!.content,
            ),
            ExpectedMessages.clipIconNotAvailable,
          )
          .toBeHidden();
      },
    );
  },
);

dialTest(
  'Change attached files in message box.\n' +
    'Delete attachment on x from message box',
  async ({
    dialHomePage,
    talkToSelector,
    marketplacePage,
    setTestIds,
    attachFilesModal,
    sendMessage,
    fileApiHelper,
    attachmentDropdownMenu,
    sendMessageInputAttachments,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-1764', 'EPMRTC-1901');
    const randomModelWithAttachment = GeneratorUtil.randomArrayElement(
      modelsWithAttachments,
    );
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

    await dialTest.step('Upload 3 files to app', async () => {
      for (const file of allAttachedFiles) {
        await fileApiHelper.putFile(file);
      }
      await localStorageManager.setRecentModelsIds(randomModelWithAttachment);
    });

    await dialTest.step(
      'Create new conversation based on model with input attachments and attach files to request',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await talkToSelector.selectEntity(
          randomModelWithAttachment,
          marketplacePage,
        );
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
        );
        for (const file of initAttachedFiles) {
          await attachFilesModal.checkAttachedFile(
            file,
            FileModalSection.AllFiles,
          );
        }
        await attachFilesModal.attachFiles();
      },
    );

    await dialTest.step(
      'Open "Attach files" modal again and verify files are checked and marked with blue',
      async () => {
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
        );
        for (const file of initAttachedFiles) {
          const isFileChecked = attachFilesModal
            .getAllFilesTree()
            .getEntityCheckbox(file);
          await expect
            .soft(isFileChecked, ExpectedMessages.attachmentFileIsChecked)
            .toBeChecked();

          const fileNameColor = await attachFilesModal
            .getAllFilesTree()
            .getEntityName(file)
            .getComputedStyleProperty(Styles.color);
          expect
            .soft(fileNameColor[0], ExpectedMessages.attachmentNameColorIsValid)
            .toBe(Colors.controlsBackgroundAccent);
        }
      },
    );

    await dialTest.step(
      'Uncheck attached file, check another and verify updated files are displayed in Send message box',
      async () => {
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
              sendMessageInputAttachments.inputAttachment(file),
              ExpectedMessages.fileIsAttached,
            )
            .toBeVisible();
        }
        expect
          .soft(
            await sendMessageInputAttachments.inputAttachments.getElementsCount(),
            ExpectedMessages.attachedFilesCountIsValid,
          )
          .toBe(updatedAttachedFiles.length);
      },
    );

    await dialTest.step(
      'Verify attachment file removing from Send message box',
      async () => {
        const removeAttachmentIcon =
          sendMessageInputAttachments.removeInputAttachmentIcon(
            initAttachedFiles[0],
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
            sendMessageInputAttachments.inputAttachment(initAttachedFiles[0]),
            ExpectedMessages.fileIsNotAttached,
          )
          .toBeHidden();
      },
    );
  },
);
