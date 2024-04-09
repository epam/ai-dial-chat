import { Conversation } from '@/chat/types/chat';
import { BackendDataEntity } from '@/chat/types/common';
import { ShareByLinkResponseModel } from '@/chat/types/share';
import dialTest from '@/src/core/dialFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import { ExpectedMessages, FolderConversation } from '@/src/testData';
import { expect } from '@playwright/test';

dialSharedWithMeTest(
  'Shared with me. Folder structure is updated if to remove chat from original folder',
  async ({
    conversationData,
    dataInjector,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    additionalUserItemApiHelper,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-2759');
    let sharedConversationInFolder: FolderConversation;
    let sharedConversation: Conversation;
    let shareByLinkResponse: ShareByLinkResponseModel;
    let sharedFolderName: string;

    await dialSharedWithMeTest.step(
      'Prepare shared conversation inside folder',
      async () => {
        sharedConversationInFolder =
          conversationData.prepareDefaultConversationInFolder();
        sharedFolderName = sharedConversationInFolder.folders.name;

        await dataInjector.createConversations(
          sharedConversationInFolder.conversations,
          sharedConversationInFolder.folders,
        );
        sharedConversation = sharedConversationInFolder.conversations[0];
        shareByLinkResponse = await mainUserShareApiHelper.shareEntityByLink(
          [sharedConversation],
          true,
        );
        await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);
      },
    );

    await dialSharedWithMeTest.step(
      'Move shared conversation out of folder',
      async () => {
        sharedConversation.id = sharedConversation.id.replace(
          `/${sharedFolderName}`,
          '',
        );
        sharedConversation.folderId = sharedConversation.folderId.replace(
          `/${sharedFolderName}`,
          '',
        );
        await dataInjector.updateConversations([sharedConversation]);
      },
    );

    await dialSharedWithMeTest.step(
      'Verify only folder is shared with user',
      async () => {
        const sharedEntities =
          await additionalUserShareApiHelper.listSharedWithMeEntities();
        expect
          .soft(
            sharedEntities.resources.find((e) => e.name === sharedFolderName),
            ExpectedMessages.folderIsShared,
          )
          .toBeDefined();

        const sharedWithMeItems: BackendDataEntity[] = [];
        for (const sharedEntity of sharedEntities.resources) {
          const sharedItems = await additionalUserItemApiHelper.listItem(
            sharedEntity.url,
          );
          sharedWithMeItems.push(...sharedItems);
        }
        expect
          .soft(
            sharedWithMeItems.find((i) => i.url === sharedConversation.id),
            ExpectedMessages.conversationIsNotShared,
          )
          .toBeUndefined();
      },
    );
  },
);

dialSharedWithMeTest(
  'Shared folder disappears from Shared with me if the original was deleted.\n' +
    'Shared chat disappears from Shared with me if the original was deleted',
  async ({
    conversationData,
    dataInjector,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    itemApiHelper,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-2770', 'EPMRTC-2772');
    let conversationInFolder: FolderConversation;
    let conversation: Conversation;
    let shareByLinkFolderResponse: ShareByLinkResponseModel;
    let shareByLinkConversationResponse: ShareByLinkResponseModel;

    await dialSharedWithMeTest.step(
      'Prepare shared folder with conversation and single shared conversation',
      async () => {
        conversationInFolder =
          conversationData.prepareDefaultConversationInFolder();
        conversationData.resetData();
        conversation = conversationData.prepareDefaultConversation();
        await dataInjector.createConversations(
          [conversation, ...conversationInFolder.conversations],
          conversationInFolder.folders,
        );

        shareByLinkFolderResponse =
          await mainUserShareApiHelper.shareEntityByLink(
            conversationInFolder.conversations,
            true,
          );
        await additionalUserShareApiHelper.acceptInvite(
          shareByLinkFolderResponse,
        );

        shareByLinkConversationResponse =
          await mainUserShareApiHelper.shareEntityByLink([conversation]);
        await additionalUserShareApiHelper.acceptInvite(
          shareByLinkConversationResponse,
        );
      },
    );

    await dialTest.step(
      'Delete shared folder and conversation by main user',
      async () => {
        await itemApiHelper.deleteConversation(
          conversationInFolder.conversations[0],
        );
        await itemApiHelper.deleteConversation(conversation);
      },
    );

    await dialSharedWithMeTest.step(
      'Verify folder and conversation are not shared with user any more',
      async () => {
        const sharedEntities =
          await additionalUserShareApiHelper.listSharedWithMeEntities();
        //TODO: enable when https://github.com/epam/ai-dial-chat/issues/1139 is fixed
        // expect
        //   .soft(
        //     sharedEntities.resources.find(
        //       (f) => f.name === conversationInFolder.folders.name,
        //     ),
        //     ExpectedMessages.folderIsNotShared,
        //   )
        //   .toBeUndefined();
        expect
          .soft(
            sharedEntities.resources.find((c) => c.url === conversation.id),
            ExpectedMessages.conversationIsNotShared,
          )
          .toBeUndefined();
      },
    );
  },
);
