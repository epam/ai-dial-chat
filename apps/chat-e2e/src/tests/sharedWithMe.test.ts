import { Conversation, Role } from '@/chat/types/chat';
import { BackendDataEntity } from '@/chat/types/common';
import { FolderInterface } from '@/chat/types/folder';
import { DialAIEntityModel } from '@/chat/types/models';
import { ShareByLinkResponseModel } from '@/chat/types/share';
import dialTest from '@/src/core/dialFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import {
  API,
  AddonIds,
  Attachment,
  ExpectedConstants,
  ExpectedMessages,
  FolderConversation,
  MenuOptions,
  ModelIds,
} from '@/src/testData';
import { keys } from '@/src/ui/keyboard';
import { GeneratorUtil, ItemUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

let defaultModel: DialAIEntityModel;
const nestedLevel = 3;

dialTest.beforeAll(async () => {
  defaultModel = ModelsUtil.getDefaultModel()!;
});

dialSharedWithMeTest(
  'Shared with me. Share single chat in Today section.\n' +
    'Shared chat history is updated in Shared with me.\n' +
    'Shared chat history is shown if to refresh browser when shared chat history is on the screen.\n' +
    'Shared with me. Chat is deleted when it was focused',
  async ({
    additionalShareUserDialHomePage,
    additionalShareUserSharedWithMeConversations,
    additionalShareUserChatBar,
    additionalShareUserChatHeader,
    conversationData,
    dataInjector,
    mainUserShareApiHelper,
    additionalShareUserChatMessages,
    localStorageManager,
    additionalShareUserChatInfoTooltip,
    additionalShareUserNotFound,
    additionalShareUserSharedWithMeConversationDropdownMenu,
    additionalShareUserConfirmationDialog,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1826', 'EPMRTC-1875', 'EPMRTC-2766', 'EPMRTC-2881');
    let conversation: Conversation;
    let shareByLinkResponse: ShareByLinkResponseModel;

    await dialSharedWithMeTest.step('Prepare shared conversation', async () => {
      conversation = conversationData.prepareDefaultConversation();
      await dataInjector.createConversations([conversation]);
      shareByLinkResponse = await mainUserShareApiHelper.shareEntityByLink([
        conversation,
      ]);
      await localStorageManager.setSelectedConversation(conversation);
    });

    await dialSharedWithMeTest.step(
      'Open share link by another user and verify chat stays under Shared with me and is selected',
      async () => {
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
        await additionalShareUserSharedWithMeConversations.selectConversation(
          conversation.name,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Update settings, send new request in shared chat and verify chat history and settings are updated for chat in Shared with me section',
      async () => {
        const updatedTemp = 0;
        const updatedPrompt = 'use numbers';
        conversation.temperature = updatedTemp;
        conversation.prompt = updatedPrompt;
        conversation.messages.push(
          {
            role: Role.User,
            content: '1+2',
            model: { id: ModelIds.GPT_3_5_TURBO },
          },
          {
            role: Role.Assistant,
            content: '3',
            model: { id: ModelIds.GPT_3_5_TURBO },
          },
        );
        await dataInjector.updateConversations([conversation]);

        await additionalShareUserDialHomePage.reloadPage();
        await additionalShareUserChatMessages.getChatMessage(4).waitFor();

        await additionalShareUserChatHeader.hoverOverChatModel();
        const promptInfo =
          await additionalShareUserChatInfoTooltip.getPromptInfo();
        expect
          .soft(promptInfo, ExpectedMessages.chatInfoPromptIsValid)
          .toBe(updatedPrompt);

        const tempInfo =
          await additionalShareUserChatInfoTooltip.getTemperatureInfo();
        expect
          .soft(tempInfo, ExpectedMessages.chatInfoTemperatureIsValid)
          .toBe(updatedTemp.toString());
      },
    );

    await dialSharedWithMeTest.step(
      'Delete shared conversation and verify "Conversation not found" message is not shown',
      async () => {
        await additionalShareUserChatBar.createNewConversation();
        await additionalShareUserSharedWithMeConversations.openConversationDropdownMenu(
          conversation.name,
        );
        await additionalShareUserSharedWithMeConversationDropdownMenu.selectMenuOption(
          MenuOptions.delete,
        );
        await additionalShareUserConfirmationDialog.confirm({
          triggeredHttpMethod: 'POST',
        });
        await additionalShareUserSharedWithMeConversations
          .getConversationByName(conversation.name)
          .waitFor({ state: 'hidden' });
        await additionalShareUserNotFound.waitForState({ state: 'hidden' });
      },
    );
  },
);

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
  'Shared with me. Share root Folder.\n' +
    'Shared with me. Folder with folder/chat inside is deleted.\n' +
    'Shared with me. No delete option in context menu for chat/folder in shared folder',
  async ({
    additionalShareUserDialHomePage,
    additionalShareUserSharedFolderConversations,
    additionalShareUserSharedWithMeFolderDropdownMenu,
    additionalShareUserSharedWithMeConversationDropdownMenu,
    additionalShareUserConfirmationDialog,
    conversationData,
    dataInjector,
    mainUserShareApiHelper,
    additionalShareUserLocalStorageManager,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1828', 'EPMRTC-2767', 'EPMRTC-1833');
    let nestedFolders: FolderInterface[];
    let nestedConversations: Conversation[];
    let shareByLinkResponse: ShareByLinkResponseModel;

    await dialSharedWithMeTest.step(
      'Prepare conversations inside nested folder structure',
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
          [nestedConversations[0]],
          true,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Open share link by another user and verify whole nested structure is displayed under Shared with section',
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
        for (let i = 0; i <= nestedLevel; i++) {
          await additionalShareUserSharedFolderConversations
            .getFolderEntity(nestedFolders[i].name, nestedConversations[i].name)
            .waitFor();
        }
      },
    );

    await dialSharedWithMeTest.step(
      'Verify no context menu available for folders and chats under root',
      async () => {
        const isNestedFolderMenuAvailable =
          await additionalShareUserSharedFolderConversations.isFolderDropdownMenuAvailable(
            nestedFolders[1].name,
          );
        expect
          .soft(
            isNestedFolderMenuAvailable,
            ExpectedMessages.contextMenuIsNotAvailable,
          )
          .toBeFalsy();

        await additionalShareUserSharedFolderConversations.openFolderEntityDropdownMenu(
          nestedFolders[nestedLevel].name,
          nestedConversations[nestedLevel].name,
        );
        const nestedConversationMenuOptions =
          await additionalShareUserSharedWithMeConversationDropdownMenu.getAllMenuOptions();
        expect
          .soft(
            nestedConversationMenuOptions,
            ExpectedMessages.contextMenuOptionsValid,
          )
          .toEqual(expect.not.arrayContaining([MenuOptions.delete]));
      },
    );

    await dialSharedWithMeTest.step(
      'Try to delete root folder and cancel the process',
      async () => {
        await additionalShareUserSharedFolderConversations.openFolderDropdownMenu(
          nestedFolders[0].name,
        );
        await additionalShareUserSharedWithMeFolderDropdownMenu.selectMenuOption(
          MenuOptions.delete,
        );
        await additionalShareUserConfirmationDialog.cancelDialog();
        await additionalShareUserSharedFolderConversations
          .getFolderEntity(nestedFolders[0].name, nestedConversations[0].name)
          .waitFor();
      },
    );

    await dialSharedWithMeTest.step(
      'Delete root folder and verify all nested structure is deleted',
      async () => {
        await additionalShareUserSharedFolderConversations.openFolderDropdownMenu(
          nestedFolders[0].name,
        );
        await additionalShareUserSharedWithMeFolderDropdownMenu.selectMenuOption(
          MenuOptions.delete,
        );
        await additionalShareUserConfirmationDialog.confirm({
          triggeredHttpMethod: 'POST',
        });
        for (let i = 0; i <= nestedLevel; i++) {
          await additionalShareUserSharedFolderConversations
            .getFolderEntity(nestedFolders[i].name, nestedConversations[i].name)
            .waitFor({ state: 'hidden' });
        }
      },
    );

    await dialSharedWithMeTest.step(
      'Reload page and verify deleted structure is not restored',
      async () => {
        await additionalShareUserDialHomePage.reloadPage();
        await await additionalShareUserDialHomePage.waitForPageLoaded();
        for (let i = 0; i <= nestedLevel; i++) {
          await additionalShareUserSharedFolderConversations
            .getFolderEntity(nestedFolders[i].name, nestedConversations[i].name)
            .waitFor({ state: 'hidden' });
        }
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
  'Share with me. Chats with different context.\n' +
    'Shared chat history is updated in Shared with me if to generate new picture',
  async ({
    conversationData,
    fileApiHelper,
    dataInjector,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    additionalShareUserDialHomePage,
    additionalShareUserLocalStorageManager,
    additionalShareUserChatMessages,
    additionalShareUserSharedWithMeConversations,
    additionalShareUserRequestContext,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1933', 'EPMRTC-2896');
    let dalleConversation: Conversation;
    let gptVisionConversation: Conversation;
    let addonConversation: Conversation;
    let codeConversation: Conversation;
    let sharedConversations: Conversation[];

    let dalleImageUrl: string;
    let secondDalleImageUrl: string;
    let gptProVisionImageUrl: string;

    await dialSharedWithMeTest.step(
      'Upload images to DALL-E-3 path and root folder and prepare conversations with request and response containing this images, conversations with stage and code in response',
      async () => {
        dalleImageUrl = await fileApiHelper.putFile(
          Attachment.sunImageName,
          API.modelFilePath(ModelIds.DALLE),
        );

        secondDalleImageUrl = await fileApiHelper.putFile(
          Attachment.cloudImageName,
          API.modelFilePath(ModelIds.DALLE),
        );

        gptProVisionImageUrl = await fileApiHelper.putFile(
          Attachment.heartImageName,
        );

        dalleConversation =
          conversationData.prepareConversationWithAttachmentInResponse(
            dalleImageUrl,
            ModelIds.DALLE,
          );
        conversationData.resetData();

        gptVisionConversation =
          conversationData.prepareConversationWithAttachmentInRequest(
            gptProVisionImageUrl,
            ModelIds.GPT_4_VISION_PREVIEW,
            true,
          );
        conversationData.resetData();

        addonConversation = conversationData.prepareAddonsConversation(
          ModelsUtil.getModel(ModelIds.GPT_4)!,
          [AddonIds.XWEATHER],
        );
        conversationData.resetData();

        codeConversation =
          conversationData.prepareConversationWithCodeContent();
        conversationData.resetData();

        sharedConversations = [
          dalleConversation,
          gptVisionConversation,
          addonConversation,
          codeConversation,
        ];
        await dataInjector.createConversations(sharedConversations);
      },
    );

    await dialSharedWithMeTest.step(
      'Share all conversation and accept invites by user',
      async () => {
        for (const conversation of sharedConversations) {
          const shareByLinkResponse =
            await mainUserShareApiHelper.shareEntityByLink([conversation]);
          await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);
        }
      },
    );

    await dialSharedWithMeTest.step(
      'Open shared conversations one by one and verify attachments, stages and code style are displayed correctly',
      async () => {
        await additionalShareUserLocalStorageManager.setSelectedConversation(
          dalleConversation,
        );
        await additionalShareUserDialHomePage.openHomePage();
        await additionalShareUserDialHomePage.waitForPageLoaded();

        await additionalShareUserChatMessages.getChatMessage(2).waitFor();
        await additionalShareUserChatMessages.openChatMessageAttachment(
          2,
          Attachment.sunImageName,
        );
        const dalleActualAttachmentUrl =
          await additionalShareUserChatMessages.getChatMessageAttachmentUrl(2);
        if (dalleActualAttachmentUrl) {
          const imageDownloadResponse =
            await additionalShareUserRequestContext.get(
              dalleActualAttachmentUrl,
            );
          expect
            .soft(
              imageDownloadResponse.status(),
              ExpectedMessages.attachmentIsSuccessfullyDownloaded,
            )
            .toBe(200);
        }

        await additionalShareUserSharedWithMeConversations.selectConversation(
          gptVisionConversation.name,
        );
        await additionalShareUserChatMessages.getChatMessage(2).waitFor();
        const gptVisionAttachmentPath =
          gptVisionConversation.messages[0]!.custom_content!.attachments![0]
            .url;
        const gptVisionActualDownloadUrl =
          await additionalShareUserChatMessages.getChatMessageDownloadUrl(1);
        expect
          .soft(
            gptVisionActualDownloadUrl,
            ExpectedMessages.attachmentUrlIsValid,
          )
          .toContain(gptVisionAttachmentPath);
        if (gptVisionActualDownloadUrl) {
          const imageDownloadResponse =
            await additionalShareUserRequestContext.get(
              gptVisionActualDownloadUrl,
            );
          expect
            .soft(
              imageDownloadResponse.status(),
              ExpectedMessages.attachmentIsSuccessfullyDownloaded,
            )
            .toBe(200);
        }

        await additionalShareUserSharedWithMeConversations.selectConversation(
          addonConversation.name,
        );
        await additionalShareUserChatMessages.getChatMessage(2).waitFor();
        const isStageVisible =
          await additionalShareUserChatMessages.isMessageStageReceived(2, 1);
        expect
          .soft(isStageVisible, ExpectedMessages.stageIsVisibleInResponse)
          .toBeTruthy();

        await additionalShareUserSharedWithMeConversations.selectConversation(
          codeConversation.name,
        );
        await additionalShareUserChatMessages.getChatMessage(2).waitFor();
        const isCodeContentVisible =
          await additionalShareUserChatMessages.isChatMessageCodeVisible(2);
        expect
          .soft(isCodeContentVisible, ExpectedMessages.codeIsVisibleInResponse)
          .toBeTruthy();
      },
    );

    //TODO: uncomment when issue https://github.com/epam/ai-dial-chat/issues/1111 is fixed
    // await dialSharedWithMeTest.step(
    //   'Add one more attachment to Dalle conversation',
    //   async () => {
    //     const secondAttachment =
    //       conversationData.getAttachmentData(secondDalleImageUrl);
    //     const secondUserMessage = dalleConversation.messages[0];
    //     const secondAssistantMessage = JSON.parse(
    //       JSON.stringify(dalleConversation.messages[1]),
    //     );
    //     secondAssistantMessage!.custom_content!.attachments![0] =
    //       secondAttachment;
    //     dalleConversation.messages.push(
    //       secondUserMessage,
    //       secondAssistantMessage,
    //     );
    //     await dataInjector.updateConversations([dalleConversation]);
    //   },
    // );
    //
    // await dialSharedWithMeTest.step(
    //   'Verify new attachment is shared with user',
    //   async () => {
    //     await additionalShareUserDialHomePage.reloadPage();
    //     await additionalShareUserDialHomePage.waitForPageLoaded();
    //
    //     await additionalShareUserChatMessages.getChatMessage(4).waitFor();
    //     const dalleAttachmentPath =
    //       dalleConversation.messages[3]!.custom_content!.attachments![0].url;
    //     await additionalShareUserChatMessages.openChatMessageAttachment(
    //       4,
    //       Attachment.cloudImageName,
    //     );
    //     const dalleActualAttachmentUrl =
    //       await additionalShareUserChatMessages.getChatMessageAttachmentUrl(4);
    //     const dalleActualDownloadUrl =
    //       await additionalShareUserChatMessages.getChatMessageDownloadUrl(4);
    //     expect
    //       .soft(dalleActualAttachmentUrl, ExpectedMessages.attachmentUrlIsValid)
    //       .toContain(dalleAttachmentPath);
    //     expect
    //       .soft(dalleActualDownloadUrl, ExpectedMessages.attachmentUrlIsValid)
    //       .toContain(dalleAttachmentPath);
    //
    //     if (dalleActualAttachmentUrl) {
    //       const imageDownloadResponse =
    //         await additionalShareUserRequestContext.get(
    //           dalleActualAttachmentUrl,
    //         );
    //       expect
    //         .soft(
    //           imageDownloadResponse.status(),
    //           ExpectedMessages.attachmentIsSuccessfullyDownloaded,
    //         )
    //         .toBe(200);
    //     }
    //   },
    // );
  },
);

dialSharedWithMeTest(
  'Share with me. Folder with chats with different context',
  async ({
    conversationData,
    dialHomePage,
    folderConversations,
    fileApiHelper,
    dataInjector,
    additionalUserShareApiHelper,
    additionalShareUserDialHomePage,
    additionalShareUserChatMessages,
    additionalShareUserSharedFolderConversations,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-2860');
    let dalleConversation: Conversation;
    let gptVisionConversation: Conversation;
    let addonConversation: Conversation;
    let codeConversation: Conversation;
    let sharedConversations: Conversation[];
    let conversationsInFolder: FolderConversation;
    let dalleImageUrl: string;
    let gptProVisionImageUrl: string;
    let dalleAttachmentPath: string;
    let gptVisionAttachmentPath: string;

    await dialSharedWithMeTest.step(
      'Upload images to DALL-E-3 path and root folder and prepare conversations with request and response containing this images, conversations with stage and code in response and move them into folder',
      async () => {
        dalleImageUrl = await fileApiHelper.putFile(
          Attachment.sunImageName,
          API.modelFilePath(ModelIds.DALLE),
        );

        gptProVisionImageUrl = await fileApiHelper.putFile(
          Attachment.heartImageName,
        );

        dalleConversation =
          conversationData.prepareConversationWithAttachmentInResponse(
            dalleImageUrl,
            ModelIds.DALLE,
          );
        conversationData.resetData();

        gptVisionConversation =
          conversationData.prepareConversationWithAttachmentInRequest(
            gptProVisionImageUrl,
            ModelIds.GPT_4_VISION_PREVIEW,
            true,
          );
        conversationData.resetData();

        addonConversation = conversationData.prepareAddonsConversation(
          ModelsUtil.getModel(ModelIds.GPT_4)!,
          [AddonIds.XWEATHER],
        );
        conversationData.resetData();

        codeConversation =
          conversationData.prepareConversationWithCodeContent();
        conversationData.resetData();

        sharedConversations = [
          dalleConversation,
          gptVisionConversation,
          addonConversation,
          codeConversation,
        ];
        conversationsInFolder =
          conversationData.prepareConversationsInFolder(sharedConversations);
        await dataInjector.createConversations(sharedConversations);

        dalleAttachmentPath =
          dalleConversation.messages[1]!.custom_content!.attachments![0].url!;
        gptVisionAttachmentPath =
          gptVisionConversation.messages[0]!.custom_content!.attachments![0]
            .url!;
      },
    );

    await dialSharedWithMeTest.step(
      'Share folder with conversations by main user and accept invite by another user',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await folderConversations.openFolderDropdownMenu(
          conversationsInFolder.folders.name,
        );
        const requestResponse =
          await folderConversations.selectShareMenuOption();
        const request = requestResponse.request;
        expect
          .soft(
            request.resources.length,
            ExpectedMessages.sharedResourcesCountIsValid,
          )
          .toBe(3);
        expect
          .soft(
            request.resources.find(
              (r) =>
                r.url === `${conversationsInFolder.conversations[0].folderId}/`,
            ),
            ExpectedMessages.folderUrlIsValid,
          )
          .toBeDefined();
        expect
          .soft(
            request.resources.find((r) => r.url === dalleAttachmentPath),
            ExpectedMessages.attachmentUrlIsValid,
          )
          .toBeDefined();
        expect
          .soft(
            request.resources.find((r) => r.url === gptVisionAttachmentPath),
            ExpectedMessages.attachmentUrlIsValid,
          )
          .toBeDefined();

        await additionalUserShareApiHelper.acceptInvite(
          requestResponse.response,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Open shared conversations one by one and verify attachments, stages and code style are displayed correctly',
      async () => {
        await additionalShareUserDialHomePage.openHomePage();
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await additionalShareUserSharedFolderConversations.expandCollapseFolder(
          conversationsInFolder.folders.name,
        );
        await additionalShareUserSharedFolderConversations.selectFolderEntity(
          conversationsInFolder.folders.name,
          dalleConversation.name,
        );
        await additionalShareUserChatMessages.getChatMessage(2).waitFor();
        await additionalShareUserChatMessages.openChatMessageAttachment(
          2,
          Attachment.sunImageName,
        );
        const dalleActualAttachmentUrl =
          await additionalShareUserChatMessages.getChatMessageAttachmentUrl(2);
        const dalleActualDownloadUrl =
          await additionalShareUserChatMessages.getChatMessageDownloadUrl(2);
        expect
          .soft(dalleActualAttachmentUrl, ExpectedMessages.attachmentUrlIsValid)
          .toContain(dalleAttachmentPath);
        expect
          .soft(dalleActualDownloadUrl, ExpectedMessages.attachmentUrlIsValid)
          .toContain(dalleAttachmentPath);

        await additionalShareUserSharedFolderConversations.selectFolderEntity(
          conversationsInFolder.folders.name,
          gptVisionConversation.name,
        );
        await additionalShareUserChatMessages.getChatMessage(2).waitFor();
        const gptVisionActualDownloadUrl =
          await additionalShareUserChatMessages.getChatMessageDownloadUrl(1);
        expect
          .soft(
            gptVisionActualDownloadUrl,
            ExpectedMessages.attachmentUrlIsValid,
          )
          .toContain(gptVisionAttachmentPath);

        await additionalShareUserSharedFolderConversations.selectFolderEntity(
          conversationsInFolder.folders.name,
          addonConversation.name,
        );
        await additionalShareUserChatMessages.getChatMessage(2).waitFor();
        const isStageVisible =
          await additionalShareUserChatMessages.isMessageStageReceived(2, 1);
        expect
          .soft(isStageVisible, ExpectedMessages.stageIsVisibleInResponse)
          .toBeTruthy();

        await additionalShareUserSharedFolderConversations.selectFolderEntity(
          conversationsInFolder.folders.name,
          codeConversation.name,
        );
        await additionalShareUserChatMessages.getChatMessage(2).waitFor();
        const isCodeContentVisible =
          await additionalShareUserChatMessages.isChatMessageCodeVisible(2);
        expect
          .soft(isCodeContentVisible, ExpectedMessages.codeIsVisibleInResponse)
          .toBeTruthy();
      },
    );
  },
);

dialSharedWithMeTest(
  'Shared with me. Chat is deleted when another one is focused',
  async ({
    additionalShareUserDialHomePage,
    additionalShareUserSharedWithMeConversations,
    conversationData,
    dataInjector,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    additionalShareUserSharedWithMeConversationDropdownMenu,
    additionalShareUserConfirmationDialog,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1834');
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
        shareByLinkResponse = await mainUserShareApiHelper.shareEntityByLink([
          conversation,
        ]);
        await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);
      },
    );

    await dialSharedWithMeTest.step(
      'Open app by another user and delete shared conversation',
      async () => {
        await additionalShareUserDialHomePage.openHomePage({
          iconsToBeLoaded: [defaultModel!.iconUrl],
        });
        await additionalShareUserDialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await additionalShareUserSharedWithMeConversations.openConversationDropdownMenu(
          conversation.name,
        );
        await additionalShareUserSharedWithMeConversationDropdownMenu.selectMenuOption(
          MenuOptions.delete,
        );
        await additionalShareUserConfirmationDialog.confirm({
          triggeredHttpMethod: 'POST',
        });

        await additionalShareUserSharedWithMeConversations
          .getConversationByName(conversation.name)
          .waitFor({ state: 'hidden' });
      },
    );
  },
);

dialSharedWithMeTest(
  'Shared with me. Structure creates again if it was deleted if to open the same link',
  async ({
    conversationData,
    dataInjector,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1855');
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
        shareByLinkResponse = await mainUserShareApiHelper.shareEntityByLink(
          [conversation],
          true,
        );
        await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);
      },
    );

    await dialSharedWithMeTest.step(
      'Delete shared folder from "Shared with me" section',
      async () => {
        let sharedEntities =
          await additionalUserShareApiHelper.listSharedWithMeEntities();
        await additionalUserShareApiHelper.deleteSharedWithMeEntities(
          sharedEntities.resources,
        );
        sharedEntities =
          await additionalUserShareApiHelper.listSharedWithMeEntities();

        expect
          .soft(
            sharedEntities.resources.find(
              (f) => f.name === conversationInFolder.folders.name,
            ),
            ExpectedMessages.folderIsNotShared,
          )
          .toBeUndefined();
      },
    );

    await dialSharedWithMeTest.step(
      'Accept the same share invite again and verify folder with chat shown in "Shared with me" section',
      async () => {
        await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);
        const sharedEntities =
          await additionalUserShareApiHelper.listSharedWithMeEntities();
        expect
          .soft(
            sharedEntities.resources.find(
              (f) => f.name === conversationInFolder.folders.name,
            ),
            ExpectedMessages.folderIsNotShared,
          )
          .toBeDefined();
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
