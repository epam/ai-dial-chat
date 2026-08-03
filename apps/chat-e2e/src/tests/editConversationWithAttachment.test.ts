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
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { expect } from '@playwright/test';

let modelsWithAttachments: DialAIEntityModel[];
dialTest.beforeAll(async () => {
  modelsWithAttachments = ModelsUtil.getLatestModelsWithAttachment(true, [
    'image/*',
    '*/*',
  ]);
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
    setTestIds('EPMDIAL-6464');
    const randomModelWithAttachment = GeneratorUtil.randomArrayElement(
      modelsWithAttachments,
    );
    const modelWithoutAttachments = GeneratorUtil.randomArrayElement(
      ModelsUtil.getModelsWithoutAttachment(),
    );
    await localStorageManager.setRecentModelsIdsOnceWithPermanentLastUsedModel(
      modelWithoutAttachments,
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
            undefined,
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
        await talkToAgentDialog.selectAgent(modelWithoutAttachments);
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
    fileManagerModal,
    fileManagerModalGrid,
    sendMessage,
    fileApiHelper,
    attachmentDropdownMenu,
    sendMessageInputAttachments,
    sendMessageInputAttachmentsAssertions,
    fileManagerModalGridAssertion,
    localStorageManager,
  }) => {
    setTestIds('EPMDIAL-6483', 'EPMDIAL-6481');
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
      Attachment.cloudImageName,
    ];
    const finalAttachedFiles = [
      Attachment.flowerImageName,
      Attachment.cloudImageName,
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
          const attachmentCheckbox =
            await fileManagerModalGrid.gridCheckboxByNameCell(file);
          await attachmentCheckbox.click();
          await fileManagerModalGridAssertion.assertGridCheckboxByNameState(
            file,
            CheckboxState.checked,
          );
        }
        await fileManagerModal.getAttachButton().click();
        for (const file of initAttachedFiles) {
          await sendMessageInputAttachmentsAssertions.assertAttachedFileState(
            file,
            'visible',
          );
        }
      },
    );

    await dialTest.step(
      'Open "Attach files" modal again and check another file',
      async () => {
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
          { triggeredHttpMethod: 'GET', apiHost: API.filesListingHost() },
        );
        const updatedAttachmentCheckbox =
          await fileManagerModalGrid.gridCheckboxByNameCell(
            updatedAttachedFiles[1],
          );
        await updatedAttachmentCheckbox.click();
        await fileManagerModalGridAssertion.assertGridCheckboxByNameState(
          updatedAttachedFiles[1],
          CheckboxState.checked,
        );
        await fileManagerModal.getAttachButton().click();

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
        for (const file of finalAttachedFiles) {
          await sendMessageInputAttachmentsAssertions.assertAttachedFileState(
            file,
            'visible',
          );
        }
      },
    );
  },
);
