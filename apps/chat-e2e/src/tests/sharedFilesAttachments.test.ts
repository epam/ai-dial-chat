import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import {
  API,
  Attachment,
  ExpectedConstants,
  MenuOptions,
  ModelIds,
} from '@/src/testData';
import { Colors } from '@/src/ui/domData';
import { ModelsUtil } from '@/src/utils';
import {DialAIEntityModel} from "@/chat/types/models";
import {ShareByLinkResponseModel} from "@/chat/types/share";

let defaultModel: DialAIEntityModel;
let secondModel: DialAIEntityModel;

dialSharedWithMeTest.beforeAll(async () => {
  defaultModel = ModelsUtil.getDefaultModel()!;
  secondModel = ModelsUtil.getModel(ModelIds.GPT_4)!;
});

dialSharedWithMeTest.only(
  'Arrow icon appears for file in Manage attachments if it was shared along with chat. The file is located in folders in "All files". The file is used in the model answer.',
  async ({
           setTestIds,
           conversationData,
           dataInjector,
           fileApiHelper,
           mainUserShareApiHelper,
           additionalUserShareApiHelper,
           dialHomePage,
           attachFilesModal,
           chatBar,
           attachedAllFiles,
         }) => {
    setTestIds('EPMRTC-4133');
    let firstImageUrl: string;
    let secondImageUrl: string;
    let shareByLinkResponse: ShareByLinkResponseModel;

    await dialSharedWithMeTest.step(
      'Upload 2 image files to a conversation and prepare conversation with attachments in response',
      async () => {
        await fileApiHelper.deleteAllFiles();
        firstImageUrl = await fileApiHelper.putFile(
          Attachment.sunImageName,
          API.modelFilePath(defaultModel.id),
        );
        secondImageUrl = await fileApiHelper.putFile(
          Attachment.cloudImageName,
          API.modelFilePath(secondModel.id),
        );
        const firstConversation =
          conversationData.prepareConversationWithAttachmentInResponse(
            firstImageUrl,
            defaultModel,
          );
        conversationData.resetData();

        const historyConversation = conversationData.prepareHistoryConversation(
          firstConversation,
        );
        await dataInjector.createConversations([historyConversation]);
        shareByLinkResponse = await mainUserShareApiHelper.shareEntityByLink([
          historyConversation,
        ]);
      },
    );

    await dialSharedWithMeTest.step(
      'Accept share invitation by another user',
      async () => {
        await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);
      },
    );

    await dialSharedWithMeTest.step(
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
        // await attachedAllFiles.expandFolder(
        //   ExpectedConstants.allFilesRoot,
        //   { isHttpMethodTriggered: true },
        // );
        await attachedAllFiles.expandFolder('appdata', {
          isHttpMethodTriggered: true,
        });
        await attachedAllFiles.expandFolder(defaultModel.id, {
          isHttpMethodTriggered: true,
        });
        await attachedAllFiles.expandFolder('images', {
          isHttpMethodTriggered: true,
        },1);
        await attachedAllFiles.expandFolder(secondModel.id, {
          isHttpMethodTriggered: true,
        });
        await attachedAllFiles.expandFolder('images', {
          isHttpMethodTriggered: true,
        },2);

        // TODO create a method in attachedFilesAssertion.ts instead of chatBarFolderAssertion
        await chatBarFolderAssertion.assertFolderEntityArrowIconState(
          { name: `images` }, // Include full folder path
          { name: Attachment.sunImageName },
          'visible',
        );
        await chatBarFolderAssertion.assertFolderEntityArrowIconState(
          { name: secondModel.id }, // Include full folder path
          { name: Attachment.cloudImageName },
          'visible',
        );

        // TODO create a method in attachedFilesAssertion.ts instead of chatBarFolderAssertion
        await chatBarFolderAssertion.assertSharedFolderArrowIconColor(
          { name: `appdata/${defaultModel.id}` }, // Include full folder path
          { name: Attachment.sunImageName },
          Colors.controlsBackgroundAccent,
        );
        // await chatBarFolderAssertion.assertSharedFolderArrowIconColor(
        //   { name: `appdata/${secondModel.id}` }, // Include full folder path
        //   { name: Attachment.cloudImageName },
        //   Colors.controlsBackgroundAccent,
        // );
      },
    );
  },
);
