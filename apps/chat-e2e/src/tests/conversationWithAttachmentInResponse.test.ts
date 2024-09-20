import { Conversation } from '@/chat/types/chat';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  Attachment,
  ExpectedMessages,
  MenuOptions,
  ModelIds,
} from '@/src/testData';
import { ModelsUtil } from '@/src/utils';
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
    let googleImagenConversation: Conversation;
    const googleImagenPath = API.modelFilePath(ModelIds.IMAGE_GENERATION_005);
    const googleImagenPathSegments = googleImagenPath.split('/');
    const stableDiffusionPath = API.modelFilePath(ModelIds.STABLE_DIFFUSION);
    const stableDiffusionPathSegments = stableDiffusionPath.split('/');
    const requestContent = 'request';
    const stableDiffusionModel = ModelsUtil.getModel(
      ModelIds.STABLE_DIFFUSION,
    )!;

    await dialTest.step(
      'Create conversation with attachment in response for "Google Imagen" model',
      async () => {
        const googleImagenImageUrl = await fileApiHelper.putFile(
          Attachment.sunImageName,
          googleImagenPath,
        );
        googleImagenConversation =
          conversationData.prepareConversationWithAttachmentInResponse(
            googleImagenImageUrl,
            ModelIds.IMAGE_GENERATION_005,
          );
        await dataInjector.createConversations([googleImagenConversation]);
        await localStorageManager.setSelectedConversation(
          googleImagenConversation,
        );
        await localStorageManager.setRecentModelsIds(stableDiffusionModel);
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

        for (const segment of googleImagenPathSegments) {
          await attachedAllFiles.expandFolder(segment, {
            isHttpMethodTriggered: true,
          });
        }
        await expect
          .soft(
            attachedAllFiles.getFolderEntity(
              googleImagenPathSegments[googleImagenPathSegments.length - 1],
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
          ModelIds.IMAGE_GENERATION_005,
          Attachment.cloudImageName,
        );
        await chat.sendRequestWithButton(requestContent);
        await fileApiHelper.putFile(
          Attachment.cloudImageName,
          googleImagenPath,
        );

        await chatBar.bottomDotsMenuIcon.click();
        await chatBar
          .getBottomDropdownMenu()
          .selectMenuOption(MenuOptions.attachments);
        for (const segment of googleImagenPathSegments) {
          await attachedAllFiles.expandFolder(segment, {
            isHttpMethodTriggered: true,
          });
        }
        await expect
          .soft(
            attachedAllFiles.getFolderEntity(
              googleImagenPathSegments[googleImagenPathSegments.length - 1],
              Attachment.cloudImageName,
            ),
            ExpectedMessages.fileIsAttached,
          )
          .toBeVisible();
        await attachFilesModal.closeButton.click();
      },
    );

    await dialTest.step(
      'Change conversation model to Stable diffusion, generate one more picture and verify it is visible on "Manage attachments" modal under new model folder',
      async () => {
        await chatHeader.openConversationSettingsPopup();
        await talkToSelector.selectEntity(
          stableDiffusionModel,
          marketplacePage,
        );
        await chat.applyNewEntity();

        await dialHomePage.mockChatImageResponse(
          ModelIds.STABLE_DIFFUSION,
          Attachment.flowerImageName,
        );
        await chat.sendRequestWithButton(requestContent);
        await fileApiHelper.putFile(
          Attachment.flowerImageName,
          stableDiffusionPath,
        );

        await chatBar.bottomDotsMenuIcon.click();
        await chatBar
          .getBottomDropdownMenu()
          .selectMenuOption(MenuOptions.attachments);
        for (const segment of stableDiffusionPathSegments) {
          await attachedAllFiles.expandFolder(segment, {
            isHttpMethodTriggered: true,
          });
        }
        await expect
          .soft(
            attachedAllFiles.getFolderEntity(
              stableDiffusionPathSegments[
                stableDiffusionPathSegments.length - 1
              ],
              Attachment.flowerImageName,
            ),
            ExpectedMessages.fileIsAttached,
          )
          .toBeVisible();
      },
    );
  },
);
