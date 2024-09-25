import dialTest from '@/src/core/dialFixtures';
import {
  API,
  Attachment,
  MenuOptions,
  ModelIds, TreeEntity,
} from '@/src/testData';
import {Colors} from '@/src/ui/domData';
import {ShareByLinkResponseModel} from "@/chat/types/share";
import {Message, Role} from "@/chat/types/chat";

dialTest.only(
  'Arrow icon appears for file in Manage attachments if it was shared along with chat. The file is located in folders in "All files". The file is used in the model answer.\n' +
  'Arrow icon appears for file in Manage attachments if it was shared along with chat folder.',
  async ({
           setTestIds,
           conversationData,
           dataInjector,
           fileApiHelper,
           mainUserShareApiHelper,
           additionalUserShareApiHelper,
           dialHomePage,
           attachedFilesAssertion,
           chatBar,
           attachedAllFiles,
         }) => {
    setTestIds('EPMRTC-4133, EPMRTC-4134');
    let imageUrl: string;
    let imageUrl2: string;
    let imageInFolderUrl: string;
    let shareByLinkResponse: ShareByLinkResponseModel;
    let defaultModel;

    await dialTest.step(
      'Upload image file to a conversation and prepare conversation with attachments in response',
      async () => {
        defaultModel = ModelIds.DALLE;
        await fileApiHelper.deleteAllFiles();
        imageUrl = await fileApiHelper.putFile(
          Attachment.sunImageName,
          API.modelFilePath(defaultModel),
        );
        imageUrl2 = await fileApiHelper.putFile(
          Attachment.cloudImageName,
          API.modelFilePath(defaultModel),
        );
        imageInFolderUrl = await fileApiHelper.putFile(
          Attachment.flowerImageName,
          API.modelFilePath(defaultModel),
        );
        const conversation = conversationData.prepareConversationWithAttachmentInResponse(
          imageUrl,
          defaultModel,
        );

        const settings = {
          prompt: conversation.prompt,
          temperature: conversation.temperature,
          selectedAddons: conversation.selectedAddons,
        };

        const userMessage: Message = {
          role: Role.User,
          content: 'draw smiling emoticon',
          model: {id: defaultModel},
          settings: settings,
        };
        const assistantMessage: Message = {
          role: Role.Assistant,
          content: '',
          model: {id: defaultModel},
          custom_content: {
            attachments: [conversationData.getAttachmentData(imageUrl2)],
          },
          settings: settings,
        };
        conversation.messages.push(userMessage, assistantMessage);

        conversationData.resetData();

        const conversationInFolder = conversationData.prepareConversationWithAttachmentInResponse(
          imageInFolderUrl,
          defaultModel,
          'folderWithConversation'
        );

        await dataInjector.createConversations([conversation, conversationInFolder]);
        shareByLinkResponse = await mainUserShareApiHelper.shareEntityByLink([
          conversation, conversationInFolder
        ]);
      },
    );

    await dialTest.step(
      'Accept share invitation by another user',
      async () => {
        await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);
      },
    );

    await dialTest.step(
      'Open "Manage attachments" modal and verify shared files have arrow icons',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await chatBar.bottomDotsMenuIcon.click();
        await chatBar
          .getBottomDropdownMenu()
          .selectMenuOption(MenuOptions.attachments);
        await attachedAllFiles.waitForState();

        await attachedAllFiles.expandFolder('appdata', {
          isHttpMethodTriggered: true,
        });
        await attachedAllFiles.expandFolder(ModelIds.DALLE, {
          isHttpMethodTriggered: true,
        });
        await attachedAllFiles.expandFolder('images', {
          isHttpMethodTriggered: true,
        });

        await attachedAllFiles.getFolderByName('images').hover();

        const firstImageEntity: TreeEntity = {name: Attachment.sunImageName};
        await attachedFilesAssertion.assertSharedFileArrowIconState(firstImageEntity, 'visible');
        await attachedFilesAssertion.assertEntityArrowIconColor(firstImageEntity, Colors.controlsBackgroundAccent);

        const secondImageEntity: TreeEntity = {name: Attachment.cloudImageName};
        await attachedFilesAssertion.assertSharedFileArrowIconState(secondImageEntity, 'visible');
        await attachedFilesAssertion.assertEntityArrowIconColor(secondImageEntity, Colors.controlsBackgroundAccent);

        const thirdImageEntity: TreeEntity = {name: Attachment.flowerImageName};
        await attachedFilesAssertion.assertSharedFileArrowIconState(thirdImageEntity, 'visible');
        await attachedFilesAssertion.assertEntityArrowIconColor(thirdImageEntity, Colors.controlsBackgroundAccent);
      },
    );
  },
);
