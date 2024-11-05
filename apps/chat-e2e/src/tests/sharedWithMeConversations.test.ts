import { Conversation } from '@/chat/types/chat';
import { FolderInterface } from '@/chat/types/folder';
import { DialAIEntityModel } from '@/chat/types/models';
import { ShareByLinkResponseModel } from '@/chat/types/share';
import config from '@/config/chat.playwright.config';
import dialTest from '@/src/core/dialFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import {
  CollapsedSections,
  ExpectedConstants,
  ExpectedMessages,
  FolderConversation,
  MenuOptions,
} from '@/src/testData';
import { Colors } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
import { DialHomePage } from '@/src/ui/pages';
import { GeneratorUtil, ItemUtil, ModelsUtil } from '@/src/utils';
import { Role } from '@epam/ai-dial-shared';
import { expect } from '@playwright/test';

let defaultModel: DialAIEntityModel;
const nestedLevel = 4;

dialTest.beforeAll(async () => {
  defaultModel = ModelsUtil.getDefaultModel()!;
});

dialSharedWithMeTest(
  'Shared with me. Share single chat in Today section.\n' +
    'Shared chat history is updated in Shared with me.\n' +
    'Shared chat history is shown if to refresh browser when shared chat history is on the screen.\n' +
    'Shared with me. Chat is deleted when it was focused.\n' +
    'Shared with me. Shared chat is automatically opened if to click on the link.\n' +
    'Error appears if shared chat link does not exist',
  async ({
    additionalShareUserDialHomePage,
    additionalShareUserSharedWithMeConversations,
    additionalShareUserChatHeader,
    conversationData,
    dataInjector,
    mainUserShareApiHelper,
    additionalShareUserChatMessages,
    additionalShareUserChatInfoTooltip,
    additionalShareUserNotFound,
    additionalShareUserSharedWithMeConversationDropdownMenu,
    additionalShareUserConfirmationDialog,
    additionalShareUserErrorToast,
    setTestIds,
  }) => {
    dialSharedWithMeTest.slow();
    setTestIds(
      'EPMRTC-1826',
      'EPMRTC-1875',
      'EPMRTC-2766',
      'EPMRTC-2881',
      'EPMRTC-2722',
      'EPMRTC-1877',
    );
    let conversation: Conversation;
    let shareByLinkResponse: ShareByLinkResponseModel;

    await dialSharedWithMeTest.step('Prepare shared conversation', async () => {
      conversation = conversationData.prepareDefaultConversation();
      conversationData.resetData();
      await dataInjector.createConversations([conversation]);
      shareByLinkResponse = await mainUserShareApiHelper.shareEntityByLink([
        conversation,
      ]);
    });

    await dialSharedWithMeTest.step(
      'Change share link, open it by another user and verify error message is shown',
      async () => {
        await additionalShareUserDialHomePage.navigateToUrl(
          ExpectedConstants.sharedConversationUrl(
            shareByLinkResponse.invitationLink + 'abc',
          ),
        );
        const errorMessage =
          await additionalShareUserErrorToast.getElementContent();
        expect
          .soft(errorMessage, ExpectedMessages.shareInviteAcceptanceErrorShown)
          .toBe(ExpectedConstants.shareInviteDoesNotExist);
      },
    );

    await dialSharedWithMeTest.step(
      'Open share link by another user and verify chat stays under Shared with me and is selected automatically',
      async () => {
        await additionalShareUserDialHomePage.navigateToUrl(
          ExpectedConstants.sharedConversationUrl(
            shareByLinkResponse.invitationLink,
          ),
        );
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await expect
          .soft(
            additionalShareUserSharedWithMeConversations.selectedConversation(
              conversation.name,
            ),
            ExpectedMessages.conversationIsVisible,
          )
          .toBeVisible();
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
            model: { id: defaultModel.id },
          },
          {
            role: Role.Assistant,
            content: '3',
            model: { id: defaultModel.id },
          },
        );
        await dataInjector.updateConversations([conversation]);

        await additionalShareUserDialHomePage.reloadPage();
        await additionalShareUserSharedWithMeConversations.selectConversation(
          conversation.name,
        );
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
        await additionalShareUserSharedWithMeConversations.openEntityDropdownMenu(
          conversation.name,
        );
        await additionalShareUserSharedWithMeConversationDropdownMenu.selectMenuOption(
          MenuOptions.delete,
        );
        await additionalShareUserConfirmationDialog.confirm({
          triggeredHttpMethod: 'POST',
        });
        await expect
          .soft(
            additionalShareUserSharedWithMeConversations.getEntityByName(
              conversation.name,
            ),
            ExpectedMessages.conversationIsNotVisible,
          )
          .toBeHidden();
        await expect
          .soft(
            additionalShareUserNotFound.getElementLocator(),
            ExpectedMessages.conversationIsSelected,
          )
          .toBeHidden();
      },
    );
  },
);

dialSharedWithMeTest(
  'Shared with me. Share single chat in Folder.\n' +
    'Shared with me. Structure appears only once if to open the same link several times',
  async ({
    additionalShareUserDialHomePage,
    additionalShareUserSharedWithMeConversations,
    conversationData,
    dataInjector,
    mainUserShareApiHelper,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1827', 'EPMRTC-1854');
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
          await expect
            .soft(
              additionalShareUserSharedWithMeConversations.getEntityByName(
                conversation.name,
                1,
              ),
              ExpectedMessages.entityIsShared,
            )
            .toBeVisible();
          await expect
            .soft(
              additionalShareUserSharedWithMeConversations.getEntityByName(
                conversation.name,
                2,
              ),
              ExpectedMessages.entityIsNotShared,
            )
            .toBeHidden();
        }
      },
    );
  },
);

dialSharedWithMeTest(
  'Shared with me. Share root Folder.\n' +
    'Shared with me. Folder with folder/chat inside is deleted.\n' +
    'Shared with me. No delete option in context menu for chat/folder in shared folder.\n' +
    'Shared with me. Chat in shared folder is automatically opened if to click on the link',
  async ({
    additionalShareUserDialHomePage,
    additionalShareUserSharedFolderConversations,
    additionalShareUserSharedWithMeFolderDropdownMenu,
    additionalShareUserSharedWithMeConversationDropdownMenu,
    additionalShareUserConfirmationDialog,
    conversationData,
    dataInjector,
    mainUserShareApiHelper,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1828', 'EPMRTC-2767', 'EPMRTC-1833', 'EPMRTC-2869');
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
        conversationData.resetData();
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
      'Open share link by another user and verify whole nested structure is displayed under Shared with me section and root folder conversation is selected',
      async () => {
        await additionalShareUserDialHomePage.openHomePage(
          { iconsToBeLoaded: [defaultModel!.iconUrl] },
          ExpectedConstants.sharedConversationUrl(
            shareByLinkResponse.invitationLink,
          ),
        );
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await expect
          .soft(
            additionalShareUserSharedFolderConversations.getSelectedFolderEntity(
              nestedFolders[0].name,
              nestedConversations[0].name,
            ),
            ExpectedMessages.conversationIsSelected,
          )
          .toBeVisible();
      },
    );

    await dialSharedWithMeTest.step(
      'Verify no context menu available for folders and chats under root',
      async () => {
        await expect
          .soft(
            await additionalShareUserSharedFolderConversations.getFolderDropdownMenu(
              nestedFolders[1].name,
            ),
            ExpectedMessages.contextMenuIsNotAvailable,
          )
          .toBeHidden();

        await additionalShareUserSharedFolderConversations.openFolderEntityDropdownMenu(
          nestedFolders[nestedLevel - 1].name,
          nestedConversations[nestedLevel - 1].name,
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
        for (let i = 0; i < nestedLevel; i++) {
          await expect
            .soft(
              additionalShareUserSharedFolderConversations.getFolderEntity(
                nestedFolders[i].name,
                nestedConversations[i].name,
              ),
              ExpectedMessages.conversationIsNotVisible,
            )
            .toBeHidden();
        }
      },
    );

    await dialSharedWithMeTest.step(
      'Reload page and verify deleted structure is not restored',
      async () => {
        await additionalShareUserDialHomePage.reloadPage();
        await additionalShareUserDialHomePage.waitForPageLoaded();
        for (let i = 0; i < nestedLevel; i++) {
          await expect
            .soft(
              additionalShareUserSharedFolderConversations.getFolderEntity(
                nestedFolders[i].name,
                nestedConversations[i].name,
              ),
              ExpectedMessages.conversationIsNotVisible,
            )
            .toBeHidden();
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
    additionalShareUserDialHomePage,
    additionalShareUserSharedFolderConversations,
    conversationData,
    dataInjector,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    setTestIds,
    localStorageManager,
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
          [nestedConversations[nestedLevel - 2]],
          true,
        );
        await localStorageManager.setChatCollapsedSection(
          CollapsedSections.Organization,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Open share link by another user and verify the structure below shared folder is displayed under Shared with section',
      async () => {
        await additionalShareUserDialHomePage.openHomePage(
          { iconsToBeLoaded: [defaultModel!.iconUrl] },
          ExpectedConstants.sharedConversationUrl(
            shareByLinkResponse.invitationLink,
          ),
        );
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await additionalShareUserSharedFolderConversations.selectFolderEntity(
          nestedFolders[nestedLevel - 1].name,
          nestedConversations[nestedLevel - 1].name,
        );
        for (let i = nestedLevel - 2; i < nestedLevel; i++) {
          await additionalShareUserSharedFolderConversations.expandFolder(
            nestedFolders[i].name,
          );
          await expect
            .soft(
              additionalShareUserSharedFolderConversations.getFolderEntity(
                nestedFolders[i].name,
                nestedConversations[i].name,
              ),
              ExpectedMessages.conversationIsVisible,
            )
            .toBeVisible();
        }
        for (let i = 0; i < nestedLevel - 2; i++) {
          await expect
            .soft(
              additionalShareUserSharedFolderConversations.getFolderEntity(
                nestedFolders[i].name,
                nestedConversations[i].name,
              ),
              ExpectedMessages.conversationIsNotVisible,
            )
            .toBeHidden();
        }
      },
    );

    await dialSharedWithMeTest.step(
      'Rename shared folder and verify it is not displayed under Shared with section',
      async () => {
        const updatedFolderName = GeneratorUtil.randomString(7);
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        for (const nestedFolder of nestedFolders) {
          await folderConversations.expandFolder(nestedFolder.name);
        }
        await folderConversations.selectFolderEntity(
          nestedFolders[nestedLevel - 1].name,
          nestedConversations[nestedLevel - 1].name,
        );
        await folderConversations.openFolderDropdownMenu(
          nestedFolders[nestedLevel - 2].name,
        );
        await folderDropdownMenu.selectMenuOption(MenuOptions.rename);

        await folderConversations.editFolderName(updatedFolderName);
        await page.keyboard.press(keys.enter);
        if (await confirmationDialog.isVisible()) {
          await confirmationDialog.confirm({ triggeredHttpMethod: 'POST' });
        }

        const sharedEntities =
          await additionalUserShareApiHelper.listSharedWithMeConversations();
        expect
          .soft(
            sharedEntities.resources.find(
              (e) =>
                e.name === updatedFolderName ||
                e.name === nestedConversations[nestedLevel - 2].name,
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
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await folderConversations.expandFolder(sharedFolderName);
        await folderConversations.selectFolderEntity(
          sharedFolderName,
          sharedConversation.name,
        );
        await expect
          .soft(
            folderConversations.getFolderArrowIcon(folderName),
            ExpectedMessages.sharedFolderIconIsNotVisible,
          )
          .toBeHidden();
      },
    );

    await dialSharedWithMeTest.step(
      'Verify moved folder with content and single conversation are shared for the user',
      async () => {
        const sharedEntities =
          await additionalUserShareApiHelper.listSharedWithMeConversations();
        const sharedFolderEntity = sharedEntities.resources.find(
          (e) => e.name === sharedFolderName,
        );
        expect
          .soft(sharedFolderEntity, ExpectedMessages.folderIsShared)
          .toBeDefined();

        const sharedItems = await additionalUserItemApiHelper.listItem(
          sharedFolderEntity!.url,
        );

        for (const conversation of [
          sharedConversation,
          singleConversation,
          conversationInFolder.conversations[0],
        ]) {
          expect
            .soft(
              sharedItems.find((i) => i.url === conversation.id),
              ExpectedMessages.conversationIsShared,
            )
            .toBeDefined();
        }
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
    itemApiHelper,
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
        const sharedConversationToDelete = JSON.parse(
          JSON.stringify(sharedConversation),
        );
        sharedConversation.id = sharedConversation.id.replace(
          `/${sharedFolderName}`,
          '',
        );
        sharedConversation.folderId = sharedConversation.folderId.replace(
          `/${sharedFolderName}`,
          '',
        );
        await dataInjector.updateConversations([sharedConversation]);
        await itemApiHelper.deleteEntity(sharedConversationToDelete);
      },
    );

    await dialSharedWithMeTest.step(
      'Verify only folder is shared with user',
      async () => {
        const sharedEntities =
          await additionalUserShareApiHelper.listSharedWithMeConversations();
        const sharedFolderEntity = sharedEntities.resources.find(
          (e) => e.name === sharedFolderName,
        );
        expect
          .soft(sharedFolderEntity, ExpectedMessages.folderIsShared)
          .toBeDefined();

        const sharedItems = await additionalUserItemApiHelper.listItem(
          sharedFolderEntity!.url,
        );
        expect
          .soft(sharedItems.length, ExpectedMessages.conversationIsNotShared)
          .toBe(0);
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
      'Open app by another user and verify possibility to delete shared conversation',
      async () => {
        await additionalShareUserDialHomePage.openHomePage({
          iconsToBeLoaded: [defaultModel!.iconUrl],
        });
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await additionalShareUserSharedWithMeConversations.openEntityDropdownMenu(
          conversation.name,
        );
        await additionalShareUserSharedWithMeConversationDropdownMenu.selectMenuOption(
          MenuOptions.delete,
        );
        await additionalShareUserConfirmationDialog.confirm({
          triggeredHttpMethod: 'POST',
        });

        await expect
          .soft(
            additionalShareUserSharedWithMeConversations.getEntityByName(
              conversation.name,
            ),
            ExpectedMessages.conversationIsNotShared,
          )
          .toBeHidden();
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
          await additionalUserShareApiHelper.listSharedWithMeConversations();
        await additionalUserShareApiHelper.deleteSharedWithMeEntities(
          sharedEntities.resources.filter(
            (r) => r.name === conversationInFolder.folders.name,
          ),
        );
        sharedEntities =
          await additionalUserShareApiHelper.listSharedWithMeConversations();

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
          await additionalUserShareApiHelper.listSharedWithMeConversations();
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
    'Shared chat disappears from Shared with me if the original was deleted.\n' +
    'Error appears if chat was deleted, but user clicks on shared link',
  async ({
    conversationData,
    dataInjector,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    dialHomePage,
    folderConversations,
    itemApiHelper,
    folderDropdownMenu,
    confirmationDialog,
    additionalShareUserDialHomePage,
    additionalShareUserErrorToast,
    shareApiAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-2770', 'EPMRTC-2772', 'EPMRTC-2726');
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
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await folderConversations.openFolderDropdownMenu(
          conversationInFolder.folders.name,
        );
        await folderDropdownMenu.selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'POST' });
        await itemApiHelper.deleteEntity(conversation);
      },
    );

    await dialSharedWithMeTest.step(
      'Verify folder and conversation are not shared with user any more',
      async () => {
        const sharedEntities =
          await additionalUserShareApiHelper.listSharedWithMeConversations();
        conversationInFolder.folders.id =
          conversationInFolder.conversations[0].folderId +
          ItemUtil.urlSeparator;
        await shareApiAssertion.assertSharedWithMeEntityState(
          sharedEntities,
          conversationInFolder.folders,
          'hidden',
        );
        await shareApiAssertion.assertSharedWithMeEntityState(
          sharedEntities,
          conversationInFolder.conversations[0],
          'hidden',
        );
        await shareApiAssertion.assertSharedWithMeEntityState(
          sharedEntities,
          conversation,
          'hidden',
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Open again share conversation link by another user and verify error message is shown',
      async () => {
        await additionalShareUserDialHomePage.navigateToUrl(
          ExpectedConstants.sharedConversationUrl(
            shareByLinkConversationResponse.invitationLink,
          ),
        );
        const errorMessage =
          await additionalShareUserErrorToast.getElementContent();
        expect
          .soft(errorMessage, ExpectedMessages.shareInviteAcceptanceErrorShown)
          .toBe(ExpectedConstants.shareInviteDoesNotExist);
      },
    );
  },
);

dialSharedWithMeTest(
  'Shared with me. Replay chat',
  async ({
    conversationData,
    dataInjector,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    additionalShareUserDialHomePage,
    additionalShareUserSharedWithMeConversations,
    additionalShareUserSharedWithMeConversationDropdownMenu,
    additionalShareUserConversations,
    additionalShareUserChat,
    setTestIds,
    additionalShareUserSharedFolderConversations,
  }) => {
    setTestIds('EPMRTC-1846');
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
      'Open app by another user and verify Replay conversation creation for shared chat via dropdown menu',
      async () => {
        await additionalShareUserDialHomePage.openHomePage({
          iconsToBeLoaded: [defaultModel!.iconUrl],
        });
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await additionalShareUserSharedFolderConversations.expandFolder(
          conversationInFolder.folders.name,
        );
        await additionalShareUserSharedFolderConversations.selectFolderEntity(
          conversationInFolder.folders.name,
          conversation.name,
        );
        await additionalShareUserSharedWithMeConversations.openEntityDropdownMenu(
          conversation.name,
        );
        await additionalShareUserSharedWithMeConversationDropdownMenu.selectMenuOption(
          MenuOptions.replay,
          { triggeredHttpMethod: 'POST' },
        );
        await expect
          .soft(
            additionalShareUserConversations.getEntityByName(
              ExpectedConstants.replayConversation + conversation.name,
            ),
            ExpectedMessages.conversationIsVisible,
          )
          .toBeVisible();
        await expect
          .soft(
            additionalShareUserChat.replay.getElementLocator(),
            ExpectedMessages.replayConversationCreated,
          )
          .toBeVisible();
      },
    );

    await dialSharedWithMeTest.step(
      'Click on Replay button and verify request is sent',
      async () => {
        const replayRequest = await additionalShareUserChat.startReplay();
        expect
          .soft(replayRequest, ExpectedMessages.chatRequestIsSent)
          .toBeDefined();
      },
    );
  },
);

dialSharedWithMeTest(
  'Shared with me. Playback chat',
  async ({
    conversationData,
    dataInjector,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    additionalShareUserDialHomePage,
    additionalShareUserSharedWithMeConversations,
    additionalShareUserSharedWithMeConversationDropdownMenu,
    additionalShareUserConversations,
    additionalShareUserPlaybackControl,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1847');
    let conversation: Conversation;
    let shareByLinkResponse: ShareByLinkResponseModel;

    await dialSharedWithMeTest.step('Prepare shared conversation', async () => {
      conversation = conversationData.prepareDefaultConversation();
      await dataInjector.createConversations([conversation]);
      shareByLinkResponse = await mainUserShareApiHelper.shareEntityByLink([
        conversation,
      ]);
      await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);
    });

    await dialSharedWithMeTest.step(
      'Open app by another user and verify Playback conversation creation for shared chat via dropdown menu',
      async () => {
        await additionalShareUserDialHomePage.openHomePage({
          iconsToBeLoaded: [defaultModel!.iconUrl],
        });
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await additionalShareUserSharedWithMeConversations.selectConversation(
          conversation.name,
        );
        await additionalShareUserSharedWithMeConversations.openEntityDropdownMenu(
          conversation.name,
        );
        await additionalShareUserSharedWithMeConversationDropdownMenu.selectMenuOption(
          MenuOptions.playback,
          { triggeredHttpMethod: 'POST' },
        );
        await expect
          .soft(
            additionalShareUserConversations.getEntityByName(
              ExpectedConstants.playbackConversation + conversation.name,
            ),
            ExpectedMessages.conversationIsShared,
          )
          .toBeVisible();
        await expect
          .soft(
            additionalShareUserPlaybackControl.getElementLocator(),
            ExpectedMessages.playbackMessageIsInViewport,
          )
          .toBeVisible();
      },
    );
  },
);

dialSharedWithMeTest(
  'Share Folder parent when there is no chat inside. The chat is in Folder child only',
  async ({
    additionalShareUserDialHomePage,
    additionalShareUserSharedFolderConversations,
    conversationData,
    dataInjector,
    mainUserShareApiHelper,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-2807');
    let nestedFolders: FolderInterface[];
    let nestedConversation: Conversation;
    let shareByLinkResponse: ShareByLinkResponseModel;
    const nestedFolder = 2;

    await dialSharedWithMeTest.step(
      'Prepare conversation inside nested folder structure and share the root folder',
      async () => {
        nestedFolders = conversationData.prepareNestedFolder(nestedFolder);
        conversationData.resetData();
        nestedConversation = conversationData.prepareDefaultConversation();
        nestedConversation.folderId = nestedFolders[nestedFolder - 1].id;
        nestedConversation.id = `${nestedFolders[nestedFolder - 1].id}/${nestedConversation.id}`;

        await dataInjector.createConversations(
          [nestedConversation],
          ...nestedFolders,
        );
        shareByLinkResponse = await mainUserShareApiHelper.shareEntityByLink(
          [nestedConversation],
          true,
          nestedFolders[nestedFolder - 2].name,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Open share link by another user and verify whole nested structure is displayed under Shared with section',
      async () => {
        await additionalShareUserDialHomePage.openHomePage(
          { iconsToBeLoaded: [defaultModel!.iconUrl] },
          ExpectedConstants.sharedConversationUrl(
            shareByLinkResponse.invitationLink,
          ),
        );
        await additionalShareUserDialHomePage.waitForPageLoaded();
        for (const nestedFolder of nestedFolders) {
          await expect
            .soft(
              additionalShareUserSharedFolderConversations.getFolderEntity(
                nestedFolder.name,
                nestedConversation.name,
              ),
              ExpectedMessages.folderIsShared,
            )
            .toBeVisible();
        }
      },
    );
  },
);

dialTest(
  'Shared with me. Shared chat appears in "Shared with me" structure if the link was clicked by user, who is logged out',
  async (
    {
      conversationData,
      dataInjector,
      mainUserShareApiHelper,
      incognitoPage,
      incognitoProviderLogin,
      setTestIds,
    },
    testInfo,
  ) => {
    setTestIds('EPMRTC-2753');
    let conversation: Conversation;
    let shareByLinkResponse: ShareByLinkResponseModel;

    await dialTest.step('Prepare shared conversation', async () => {
      conversation = conversationData.prepareDefaultConversation();
      await dataInjector.createConversations([conversation]);
      shareByLinkResponse = await mainUserShareApiHelper.shareEntityByLink([
        conversation,
      ]);
    });

    await dialTest.step(
      'Open share link by another logged out user and verify conversation is shared and selected ',
      async () => {
        const username = process.env.E2E_USERNAME!.split(',')[+config.workers!];
        await incognitoProviderLogin.login(
          testInfo,
          username,
          process.env.E2E_PASSWORD!,
          false,
          ExpectedConstants.sharedConversationUrl(
            shareByLinkResponse.invitationLink,
          ),
        );

        const dialHomePage = new DialHomePage(incognitoPage);
        await dialHomePage.waitForPageLoaded();
        const conversationBackgroundColor = await dialHomePage
          .getAppContainer()
          .getChatBar()
          .getSharedWithMeConversationsTree()
          .getEntityBackgroundColor(conversation.name);
        expect
          .soft(
            conversationBackgroundColor,
            ExpectedMessages.conversationIsSelected,
          )
          .toBe(Colors.backgroundAccentSecondary);
      },
    );
  },
);
