import { Conversation } from '@/chat/types/chat';
import { BackendDataEntity } from '@/chat/types/common';
import { FolderInterface } from '@/chat/types/folder';
import { DialAIEntityModel } from '@/chat/types/models';
import { ShareByLinkResponseModel } from '@/chat/types/share';
import dialTest from '@/src/core/dialFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  FolderConversation,
  MenuOptions,
} from '@/src/testData';
import { keys } from '@/src/ui/keyboard';
import { GeneratorUtil, ItemUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

const nestedLevel = 3;
let defaultModel: DialAIEntityModel;

dialTest.beforeAll(async () => {
  defaultModel = ModelsUtil.getDefaultModel()!;
});

dialSharedWithMeTest(
  'Shared with me. Share single chat in Folder.\n' +
    'Shared chat disappears from Shared with me if the original was renamed.\n' +
    'Shared with me. Structure appears only once if to open the same link several times',
  async ({
    dialHomePage,
    folderConversations,
    conversationDropdownMenu,
    conversations,
    confirmationDialog,
    page,
    localStorageManager,
    additionalShareUserDialHomePage,
    additionalShareUserSharedWithMeConversations,
    conversationData,
    dataInjector,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1827', 'EPMRTC-2773', 'EPMRTC-1854');
    let conversationInFolder: FolderConversation;
    let conversation: Conversation;
    let shareByLinkResponse: ShareByLinkResponseModel;

    await dialSharedWithMeTest.step(
      'Prepare shared conversation inside folder',
      async () => {
        conversationInFolder =
          conversationData.prepareDefaultConversationInFolder();
        await dataInjector.createConversations(
          conversationInFolder.conversations,
          conversationInFolder.folders,
        );
        conversation = conversationInFolder.conversations[0];
        await localStorageManager.setSelectedConversation(conversation);
        shareByLinkResponse = await mainUserShareApiHelper.shareEntityByLink([
          conversation,
        ]);
      },
    );

    await dialSharedWithMeTest.step(
      'Open twice share link by another user and verify only chat stays under Shared with section',
      async () => {
        for (let i = 1; i <= 2; i++) {
          await additionalShareUserDialHomePage.openHomePage(
            { iconsToBeLoaded: [defaultModel!.iconUrl] },
            ExpectedConstants.sharedConversationUrl(
              shareByLinkResponse.invitationLink,
            ),
          );
          await additionalShareUserDialHomePage.waitForPageLoaded();
          await additionalShareUserSharedWithMeConversations
            .getConversationByName(conversation.name)
            .waitFor();
        }
      },
    );

    await dialSharedWithMeTest.step(
      'Rename shared chat name and verify renamed chat is not shared any more',
      async () => {
        const updatedName = GeneratorUtil.randomString(7);
        await dialHomePage.openHomePage({
          iconsToBeLoaded: [defaultModel!.iconUrl],
        });
        await dialHomePage.waitForPageLoaded();
        await folderConversations.openFolderEntityDropdownMenu(
          conversationInFolder.folders.name,
          conversation.name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
        await conversations.openEditConversationNameMode(
          conversation.name,
          updatedName,
        );
        await page.keyboard.press(keys.enter);
        if (await confirmationDialog.isVisible()) {
          await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        }

        const sharedEntities =
          await additionalUserShareApiHelper.listSharedWithMeEntities();
        expect
          .soft(
            sharedEntities.resources.find(
              (e) => e.name === updatedName || e.name === conversation.name,
            ),
            ExpectedMessages.conversationIsNotShared,
          )
          .toBeUndefined();
      },
    );
  },
);

dialSharedWithMeTest(
  'Shared with me. Share Folder in the middle.\n' +
    'Shared folder disappears from Shared with me if the original was renamed',
  async ({
    dialHomePage,
    page,
    folderConversations,
    folderDropdownMenu,
    confirmationDialog,
    localStorageManager,
    additionalShareUserDialHomePage,
    additionalShareUserSharedFolderConversations,
    conversationData,
    dataInjector,
    mainUserShareApiHelper,
    additionalShareUserLocalStorageManager,
    additionalUserShareApiHelper,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1829', 'EPMRTC-2771');
    let nestedFolders: FolderInterface[];
    let nestedConversations: Conversation[];
    let shareByLinkResponse: ShareByLinkResponseModel;

    await dialSharedWithMeTest.step(
      'Prepare conversations inside nested folder structure, share middle level folder',
      async () => {
        nestedFolders = conversationData.prepareNestedFolder(nestedLevel);
        conversationData.resetData();
        nestedConversations =
          conversationData.prepareConversationsForNestedFolders(nestedFolders);
        await dataInjector.createConversations(
          nestedConversations,
          ...nestedFolders,
        );
        shareByLinkResponse = await mainUserShareApiHelper.shareEntityByLink(
          [nestedConversations[nestedLevel - 1]],
          true,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Open share link by another user and verify the structure below shared folder is displayed under Shared with section',
      async () => {
        await additionalShareUserLocalStorageManager.setSelectedConversation(
          nestedConversations[nestedLevel],
        );
        await additionalShareUserDialHomePage.openHomePage(
          { iconsToBeLoaded: [defaultModel!.iconUrl] },
          ExpectedConstants.sharedConversationUrl(
            shareByLinkResponse.invitationLink,
          ),
        );
        await additionalShareUserDialHomePage.waitForPageLoaded();
        for (let i = nestedLevel - 1; i <= nestedLevel; i++) {
          await additionalShareUserSharedFolderConversations
            .getFolderEntity(nestedFolders[i].name, nestedConversations[i].name)
            .waitFor();
        }
        for (let i = 0; i < nestedLevel - 1; i++) {
          await additionalShareUserSharedFolderConversations
            .getFolderEntity(nestedFolders[i].name, nestedConversations[i].name)
            .waitFor({ state: 'hidden' });
        }
      },
    );

    await dialSharedWithMeTest.step(
      'Rename shared folder and verify it is not displayed under Shared with section',
      async () => {
        await localStorageManager.setSelectedConversation(
          nestedConversations[nestedLevel],
        );
        const updatedFolderName = GeneratorUtil.randomString(7);
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await folderConversations.openFolderDropdownMenu(
          nestedFolders[nestedLevel - 1].name,
        );
        await folderDropdownMenu.selectMenuOption(MenuOptions.rename);

        await folderConversations.editFolderName(
          nestedFolders[nestedLevel - 1].name,
          updatedFolderName,
        );
        await page.keyboard.press(keys.enter);
        if (await confirmationDialog.isVisible()) {
          await confirmationDialog.confirm({ triggeredHttpMethod: 'POST' });
        }

        const sharedEntities =
          await additionalUserShareApiHelper.listSharedWithMeEntities();
        expect
          .soft(
            sharedEntities.resources.find(
              (e) =>
                e.name === updatedFolderName ||
                e.name === nestedConversations[nestedLevel - 1].name,
            ),
            ExpectedMessages.folderIsNotShared,
          )
          .toBeUndefined();
      },
    );
  },
);

dialSharedWithMeTest(
  'Shared with me. Folder structure is updated if to add new folder with chat to original folder',
  async ({
    dialHomePage,
    folderConversations,
    localStorageManager,
    conversationData,
    dataInjector,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    additionalUserItemApiHelper,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-2758');
    let sharedConversationInFolder: FolderConversation;
    let conversationInFolder: FolderConversation;
    let singleConversation: Conversation;
    let sharedConversation: Conversation;
    let movedConversationInFolder: Conversation;
    let shareByLinkResponse: ShareByLinkResponseModel;
    let sharedFolderName: string;
    let folderName: string;

    await dialSharedWithMeTest.step(
      'Prepare shared conversation inside folder, one more conversation inside folder and single conversation',
      async () => {
        sharedConversationInFolder =
          conversationData.prepareDefaultConversationInFolder();
        sharedFolderName = sharedConversationInFolder.folders.name;
        conversationData.resetData();
        conversationInFolder =
          conversationData.prepareDefaultConversationInFolder();
        folderName = conversationInFolder.folders.name;
        conversationData.resetData();
        singleConversation = conversationData.prepareDefaultConversation();

        await dataInjector.createConversations(
          [
            ...sharedConversationInFolder.conversations,
            ...conversationInFolder.conversations,
            singleConversation,
          ],
          sharedConversationInFolder.folders,
          conversationInFolder.folders,
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
      'Move conversation inside folder and single conversation inside shared folder',
      async () => {
        movedConversationInFolder = conversationInFolder.conversations[0];
        movedConversationInFolder.id = movedConversationInFolder.id.replace(
          folderName,
          `${sharedFolderName}/${folderName}`,
        );
        movedConversationInFolder.folderId =
          movedConversationInFolder.folderId.replace(
            folderName,
            `${sharedFolderName}/${folderName}`,
          );
        const singleConversationName = `${singleConversation.model.id}${ItemUtil.conversationIdSeparator}${singleConversation.name}`;
        singleConversation.id = singleConversation.id.replace(
          singleConversationName,
          `${sharedFolderName}/${singleConversationName}`,
        );
        singleConversation.folderId =
          singleConversation.folderId + `/${sharedFolderName}`;

        await dataInjector.updateConversations([
          movedConversationInFolder,
          singleConversation,
        ]);
      },
    );

    await dialSharedWithMeTest.step(
      'Open app by main user and verify moved folder does not have shared icon',
      async () => {
        await localStorageManager.setSelectedConversation(sharedConversation);
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await folderConversations
          .getFolderArrowIcon(folderName)
          .waitFor({ state: 'hidden' });
      },
    );

    await dialSharedWithMeTest.step(
      'Verify moved folder with content and single conversation are shared for the user',
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
            sharedWithMeItems.find(
              (i) => i.url === movedConversationInFolder.id,
            ),
            ExpectedMessages.conversationIsShared,
          )
          .toBeDefined();
        expect
          .soft(
            sharedWithMeItems.find((i) => i.url === singleConversation.id),
            ExpectedMessages.conversationIsShared,
          )
          .toBeDefined();
      },
    );
  },
);
