import { Conversation } from '@/chat/types/chat';
import dialTest from '@/src/core/dialFixtures';
import { API, Attachment, ExpectedMessages, MenuOptions } from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

dialTest(
  'Generated in response picture appears in Manage attachments',
  async ({
    dialHomePage,
    setTestIds,
    chatBar,
    conversationData,
    localStorageManager,
    dataInjector,
    fileApiHelper,
    attachFilesModal,
    attachedAllFiles,
    chatHeader,
    chat,
    talkToSelector,
    marketplacePage,
  }) => {
    setTestIds('EPMRTC-3481');
    const defaultModel = ModelsUtil.getDefaultModel()!;
    let responseImageConversation: Conversation;
    const imagePath = API.modelFilePath(defaultModel.id);
    const imagePathSegments = imagePath.split('/');
    const updatedModel = GeneratorUtil.randomArrayElement(
      ModelsUtil.getLatestModels().filter((m) => m.id !== defaultModel.id),
    );
    const secondImagePath = API.modelFilePath(updatedModel.id);
    const secondImagePathSegments = secondImagePath.split('/');
    const requestContent = 'request';

    await dialTest.step(
      'Create conversation with attachment in the response',
      async () => {
        const responseImageUrl = await fileApiHelper.putFile(
          Attachment.sunImageName,
          imagePath,
        );
        responseImageConversation =
          conversationData.prepareConversationWithAttachmentInResponse(
            responseImageUrl,
            defaultModel,
          );
        await dataInjector.createConversations([responseImageConversation]);
        await localStorageManager.setSelectedConversation(
          responseImageConversation,
        );
        await localStorageManager.setRecentModelsIds(updatedModel);
      },
    );

    await dialTest.step(
      'Open "Manage attachments" modal and verify image is placed inside nested folders',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await chatBar.bottomDotsMenuIcon.click();
        await chatBar
          .getBottomDropdownMenu()
          .selectMenuOption(MenuOptions.attachments);

        for (const segment of imagePathSegments) {
          await attachedAllFiles.expandFolder(segment, {
            isHttpMethodTriggered: true,
          });
        }
        await expect
          .soft(
            attachedAllFiles.getFolderEntity(
              imagePathSegments[imagePathSegments.length - 1],
              Attachment.sunImageName,
            ),
            ExpectedMessages.fileIsAttached,
          )
          .toBeVisible();
        await attachFilesModal.closeButton.click();
      },
    );

    await dialTest.step(
      'Generate one more picture for the same conversation and verify it is visible on "Manage attachments" modal',
      async () => {
        await dialHomePage.mockChatImageResponse(
          defaultModel.id,
          Attachment.cloudImageName,
        );
        await chat.sendRequestWithButton(requestContent);
        await fileApiHelper.putFile(Attachment.cloudImageName, imagePath);

        await chatBar.bottomDotsMenuIcon.click();
        await chatBar
          .getBottomDropdownMenu()
          .selectMenuOption(MenuOptions.attachments);
        for (const segment of imagePathSegments) {
          await attachedAllFiles.expandFolder(segment, {
            isHttpMethodTriggered: true,
          });
        }
        await expect
          .soft(
            attachedAllFiles.getFolderEntity(
              imagePathSegments[imagePathSegments.length - 1],
              Attachment.cloudImageName,
            ),
            ExpectedMessages.fileIsAttached,
          )
          .toBeVisible();
        await attachFilesModal.closeButton.click();
      },
    );

    await dialTest.step(
      'Change conversation model, generate one more picture and verify it is visible on "Manage attachments" modal under new model folder',
      async () => {
        await chatHeader.openConversationSettingsPopup();
        await talkToSelector.selectEntity(updatedModel, marketplacePage);
        await chat.applyNewEntity();

        await dialHomePage.mockChatImageResponse(
          updatedModel.id,
          Attachment.flowerImageName,
        );
        await chat.sendRequestWithButton(requestContent);
        await fileApiHelper.putFile(
          Attachment.flowerImageName,
          secondImagePath,
        );

        await chatBar.bottomDotsMenuIcon.click();
        await chatBar
          .getBottomDropdownMenu()
          .selectMenuOption(MenuOptions.attachments);
        for (const segment of secondImagePathSegments) {
          await attachedAllFiles.expandFolder(segment, {
            isHttpMethodTriggered: true,
          });
        }
        await expect
          .soft(
            attachedAllFiles.getFolderEntity(
              secondImagePathSegments[secondImagePathSegments.length - 1],
              Attachment.flowerImageName,
            ),
            ExpectedMessages.fileIsAttached,
          )
          .toBeVisible();
      },
    );
  },
);
