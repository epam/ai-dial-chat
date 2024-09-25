import dialTest from '@/src/core/dialFixtures';
import {
  API,
  Attachment,
  MenuOptions,
  ModelIds, TreeEntity,
} from '@/src/testData';
import { Colors } from '@/src/ui/domData';
import { ManageAttachmentsAssertion } from '@/src/assertions/manageAttachmentsAssertion';
import {ShareByLinkResponseModel} from "@/chat/types/share";
import {Message, Role} from "@/chat/types/chat";

dialTest.only(
  'Arrow icon appears for file in Manage attachments if it was shared along with chat. The file is located in folders in "All files". The file is used in the model answer.',
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
    setTestIds('EPMRTC-4133');
    let imageUrl: string;
    let imageUrl2: string;
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
          model: { id: defaultModel },
          settings: settings,
        };
        const assistantMessage: Message = {
          role: Role.Assistant,
          content: '',
          model: { id: defaultModel },
          custom_content: {
            attachments: [conversationData.getAttachmentData(imageUrl2)],
          },
          settings: settings,
        };
        conversation.messages.push(userMessage, assistantMessage);

        await dataInjector.createConversations([conversation]);
        shareByLinkResponse = await mainUserShareApiHelper.shareEntityByLink([
          conversation,
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

        const firstImageEntity: TreeEntity = { name: Attachment.sunImageName };
        await attachedFilesAssertion.assertSharedFileArrowIconState(firstImageEntity, 'visible');
        await attachedFilesAssertion.assertEntityArrowIconColor(firstImageEntity, Colors.controlsBackgroundAccent);

        const secondImageEntity: TreeEntity = { name: Attachment.cloudImageName };
        await attachedFilesAssertion.assertSharedFileArrowIconState(secondImageEntity, 'visible');
        await attachedFilesAssertion.assertEntityArrowIconColor(secondImageEntity, Colors.controlsBackgroundAccent);
      },
    );
  },
);
