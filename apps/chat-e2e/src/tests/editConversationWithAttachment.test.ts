import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import { Attachment, ExpectedMessages } from '@/src/testData';
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
          conversationData.prepareConversationWithAttachmentInRequest(
            imageUrl,
            randomModelWithAttachment,
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
        await talkToSelector.selectModel(ModelsUtil.getDefaultModel()!);
        await chat.applyNewEntity();
      },
    );

    await dialTest.step(
      'Edit first conversation message and verify no Clip icon is available',
      async () => {
        await chatMessages.openEditMessageMode(1);
        await expect
          .soft(
            await chatMessages.getChatMessageClipIcon(
              conversation.messages[0]!.content,
            ),
            ExpectedMessages.clipIconNotAvailable,
          )
          .toBeHidden();
      },
    );
  },
);
