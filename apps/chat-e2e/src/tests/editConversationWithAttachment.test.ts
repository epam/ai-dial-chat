import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  Attachment,
  CheckboxState,
  ExpectedMessages,
  UploadMenuOptions,
} from '@/src/testData';
import { ThemeColorAttributes } from '@/src/ui/domData';
import { FileModalSection } from '@/src/ui/webElements';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';
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
    talkToAgentDialog,
    setTestIds,
    chatHeader,
    fileApiHelper,
    dataInjector,
    conversations,
    chatMessages,
    localStorageManager,
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
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Edit conversation model to the one that do not support attachment inputs',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(conversation.name);
        await chatHeader.chatAgent.click();
        await talkToAgentDialog.selectAgent(ModelsUtil.getDefaultAgent()!);
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
    setTestIds,
    attachFilesModal,
    sendMessage,
    fileApiHelper,
    attachmentDropdownMenu,
    sendMessageInputAttachments,
    sendMessageInputAttachmentsAssertions,
    attachAllFilesTreeAssertion,
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
    const expectedColor = ThemesUtil.getRgbColorByKey(
      ThemeColorAttributes.textAccentPrimary,
    );

    await dialTest.step('Upload 3 files to app', async () => {
      for (const file of allAttachedFiles) {
        await fileApiHelper.putFile(file);
      }
      await localStorageManager.setRecentModelsIdsAndUseLastModel(
        randomModelWithAttachment,
      );
      await localStorageManager.setShowSideBarPanels();
    });

    await dialTest.step(
      'Create new conversation based on model with input attachments and attach files to request',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
          { triggeredHttpMethod: 'GET', apiHost: API.filesListingHost() },
        );
        for (const file of initAttachedFiles) {
          await attachFilesModal.checkAttachedFile(
            file,
            FileModalSection.AllFiles,
          );
          await attachAllFilesTreeAssertion.assertEntityCheckboxState(
            { name: file },
            CheckboxState.checked,
          );
        }
        await attachFilesModal.attachFiles();
        for (const file of initAttachedFiles) {
          await sendMessageInputAttachmentsAssertions.assertAttachedFileState(
            file,
            'visible',
          );
        }
      },
    );

    await dialTest.step(
      'Open "Attach files" modal again and verify files are checked and marked with blue',
      async () => {
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
          { triggeredHttpMethod: 'GET', apiHost: API.filesListingHost() },
        );
        for (const file of initAttachedFiles) {
          await attachAllFilesTreeAssertion.assertEntityCheckboxState(
            { name: file },
            CheckboxState.checked,
          );
          await attachAllFilesTreeAssertion.assertEntityColor(
            { name: file },
            expectedColor,
          );
          await attachAllFilesTreeAssertion.assertEntityCheckboxColor(
            { name: file },
            expectedColor,
          );
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
        await attachAllFilesTreeAssertion.assertEntityCheckboxState(
          { name: initAttachedFiles[1] },
          CheckboxState.unchecked,
        );
        await attachFilesModal.checkAttachedFile(
          updatedAttachedFiles[1],
          FileModalSection.AllFiles,
        );
        await attachAllFilesTreeAssertion.assertEntityCheckboxState(
          { name: updatedAttachedFiles[1] },
          CheckboxState.checked,
        );
        await attachFilesModal.attachFiles();

        for (const file of updatedAttachedFiles) {
          await sendMessageInputAttachmentsAssertions.assertAttachedFileState(
            file,
            'visible',
          );
        }
        await sendMessageInputAttachmentsAssertions.assertElementsCount(
          sendMessageInputAttachments.inputAttachments,
          updatedAttachedFiles.length,
        );
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
        await sendMessageInputAttachmentsAssertions.assertElementColor(
          removeAttachmentIcon,
          expectedColor,
        );

        await removeAttachmentIcon.click();
        await sendMessageInputAttachmentsAssertions.assertAttachedFileState(
          initAttachedFiles[0],
          'hidden',
        );
      },
    );
  },
);
