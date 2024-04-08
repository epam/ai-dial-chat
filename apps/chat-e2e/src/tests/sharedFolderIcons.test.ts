import { Conversation } from '@/chat/types/chat';
import { FolderInterface } from '@/chat/types/folder';
import { ShareByLinkResponseModel } from '@/chat/types/share';
import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  FolderConversation,
  MenuOptions,
} from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

dialTest(
  'Shared icon appears in chat folder and does not for other items in the structure.\n' +
    `Shared icon appears in chat if it's located in shared folder.\n` +
    'Shared icon appears in chat in not shared folder.\n' +
    'Shared icon disappears from the folder if it was renamed.\n' +
    'Confirmation message if to rename shared chat folder',
  async ({
    dialHomePage,
    conversationData,
    localStorageManager,
    dataInjector,
    folderConversations,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    folderDropdownMenu,
    confirmationDialog,
    setTestIds,
  }) => {
    setTestIds(
      'EPMRTC-1810',
      'EPMRTC-2754',
      'EPMRTC-2752',
      'EPMRTC-2756',
      'EPMRTC-2815',
    );
    let nestedFolders: FolderInterface[];
    let nestedConversations: Conversation[] = [];

    await dialTest.step(
      'Prepare conversations inside nested folders, share middle level folder and low level conversation',
      async () => {
        nestedFolders = conversationData.prepareNestedFolder(2);
        nestedConversations =
          conversationData.prepareConversationsForNestedFolders(nestedFolders);
        await dataInjector.createConversations(nestedConversations);
        await localStorageManager.setSelectedConversation(
          nestedConversations[2],
        );

        const shareFolderByLinkResponse =
          await mainUserShareApiHelper.shareEntityByLink(
            [nestedConversations[1]],
            true,
          );
        await additionalUserShareApiHelper.acceptInvite(
          shareFolderByLinkResponse,
        );
        const shareConversationByLinkResponse =
          await mainUserShareApiHelper.shareEntityByLink([
            nestedConversations[2],
          ]);
        await additionalUserShareApiHelper.acceptInvite(
          shareConversationByLinkResponse,
        );
      },
    );

    await dialTest.step(
      'Open Compare mode for shared conversation and verify shared folder and conversation have blue arrow in Compare dropdown list',
      async () => {
        await dialHomePage.openHomePage({
          iconsToBeLoaded: [ModelsUtil.getDefaultModel()!.iconUrl],
        });
        await dialHomePage.waitForPageLoaded();
        await folderConversations
          .getFolderArrowIcon(nestedFolders[1].name)
          .waitFor();
        await folderConversations
          .getFolderEntityArrowIcon(
            nestedFolders[2].name,
            nestedConversations[2].name,
          )
          .waitFor();

        for (let i = 0; i < nestedFolders.length; i = i + 2) {
          const isFolderHasArrowIcon = await folderConversations
            .getFolderArrowIcon(nestedFolders[i].name)
            .isVisible();
          expect
            .soft(
              isFolderHasArrowIcon,
              ExpectedMessages.sharedFolderIconIsNotVisible,
            )
            .toBeFalsy();
        }

        for (let i = 0; i < nestedFolders.length - 1; i++) {
          const isConversationHasArrowIcon = await folderConversations
            .getFolderEntityArrowIcon(
              nestedFolders[i].name,
              nestedConversations[i].name,
            )
            .isVisible();
          expect
            .soft(
              isConversationHasArrowIcon,
              ExpectedMessages.sharedConversationIconIsNotVisible,
            )
            .toBeFalsy();
        }
      },
    );

    await dialTest.step(
      'Rename shared folder and verify no arrow icon is displayed for it',
      async () => {
        const newFolderName = GeneratorUtil.randomString(7);
        await folderConversations.openFolderDropdownMenu(nestedFolders[1].name);
        await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
        await folderConversations.editFolderNameWithEnter(
          nestedFolders[1].name,
          newFolderName,
        );

        expect
          .soft(
            await confirmationDialog.getConfirmationMessage(),
            ExpectedMessages.confirmationMessageIsValid,
          )
          .toBe(ExpectedConstants.renameSharedFolderMessage);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'POST' });
        await folderConversations
          .getFolderArrowIcon(newFolderName)
          .waitFor({ state: 'hidden' });
      },
    );
  },
);

dialTest(
  `Share option appears in context menu for chat folder if there is any chat inside.\n` +
    'Share form text differs for chat and folder.\n' +
    'Confirmation message if to delete shared chat folder.\n' +
    'Shared icon disappears from the folder if to use Unshare.\n' +
    'Share form text differs for chat and folder.\n' +
    'Shared folder disappears from Shared with me if the original was unshared',
  async ({
    dialHomePage,
    conversationData,
    localStorageManager,
    dataInjector,
    folderConversations,
    additionalUserShareApiHelper,
    folderDropdownMenu,
    confirmationDialog,
    shareModal,
    setTestIds,
  }) => {
    setTestIds(
      'EPMRTC-2729',
      'EPMRTC-1811',
      'EPMRTC-2811',
      'EPMRTC-2757',
      'EPMRTC-1811',
      'EPMRTC-2763',
    );
    let folderConversation: FolderConversation;
    let shareLinkResponse: ShareByLinkResponseModel;

    await dialTest.step('Prepare conversation inside folder', async () => {
      folderConversation =
        conversationData.prepareDefaultConversationInFolder();
      await dataInjector.createConversations(folderConversation.conversations);
      await localStorageManager.setSelectedConversation(
        folderConversation.conversations[0],
      );
    });

    await dialTest.step(
      'Open app, select "Share" menu option for folder with conversation inside and verify modal window text',
      async () => {
        await dialHomePage.openHomePage({
          iconsToBeLoaded: [ModelsUtil.getDefaultModel()!.iconUrl],
        });
        await dialHomePage.waitForPageLoaded();
        await folderConversations.openFolderDropdownMenu(
          folderConversation.folders.name,
        );

        shareLinkResponse = (await folderConversations.selectShareMenuOption())
          .response;
        await shareModal.linkInputLoader.waitForState({ state: 'hidden' });
        expect
          .soft(
            await shareModal.getShareTextContent(),
            ExpectedMessages.sharedModalTextIsValid,
          )
          .toBe(ExpectedConstants.shareFolderText);
      },
    );

    await dialTest.step(
      'Accept folder sharing by another user, try to delete shared folder and verify confirmation message is shown',
      async () => {
        await additionalUserShareApiHelper.acceptInvite(shareLinkResponse);
        await dialHomePage.reloadPage();
        await folderConversations
          .getFolderArrowIcon(folderConversation.folders.name)
          .waitFor();
        await folderConversations.openFolderDropdownMenu(
          folderConversation.folders.name,
        );
        await folderDropdownMenu.selectMenuOption(MenuOptions.delete);
        expect
          .soft(
            await confirmationDialog.getConfirmationMessage(),
            ExpectedMessages.confirmationMessageIsValid,
          )
          .toBe(ExpectedConstants.deleteSharedFolderMessage);

        await confirmationDialog.cancelDialog();
      },
    );

    await dialTest.step(
      'Select Unshare option from menu for shared folder, click Cancel and verify arrow icon is displayed',
      async () => {
        await folderConversations.openFolderDropdownMenu(
          folderConversation.folders.name,
        );
        await folderDropdownMenu.selectMenuOption(MenuOptions.unshare);
        await confirmationDialog.cancelDialog();
        await folderConversations
          .getFolderArrowIcon(folderConversation.folders.name)
          .waitFor();
      },
    );

    await dialTest.step(
      'Select Unshare option from menu for shared folder, click Revoke and verify arrow icon disappears',
      async () => {
        await folderConversations.openFolderDropdownMenu(
          folderConversation.folders.name,
        );
        await folderDropdownMenu.selectMenuOption(MenuOptions.unshare);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'POST' });
        await folderConversations
          .getFolderArrowIcon(folderConversation.folders.name)
          .waitFor({ state: 'hidden' });
      },
    );

    await dialTest.step(
      'Verify folder is not shared with another user',
      async () => {
        const sharedEntities =
          await additionalUserShareApiHelper.listSharedWithMeEntities();
        expect
          .soft(
            sharedEntities.resources.find(
              (f) => f.name === folderConversation.folders.name,
            ),
            ExpectedMessages.folderIsNotShared,
          )
          .toBeUndefined();
      },
    );
  },
);
