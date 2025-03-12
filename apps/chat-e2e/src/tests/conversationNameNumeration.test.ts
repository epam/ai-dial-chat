import { Conversation } from '@/chat/types/chat';
import { FolderInterface } from '@/chat/types/folder';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  CollapsedSections,
  ExpectedConstants,
  ExpectedMessages,
  FolderConversation,
  MenuOptions,
  MockedChatApiResponseBodies,
} from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

let defaultModel: DialAIEntityModel;
dialTest.beforeAll(async () => {
  defaultModel = ModelsUtil.getDefaultModel()!;
});

dialTest.skip(
  'Default chat numeration.\n' + 'Chat numeration continues after 999',
  async ({
    dialHomePage,
    conversations,
    header,
    conversationData,
    dataInjector,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1624', 'EPMRTC-2955');
    let conversation: Conversation;
    const initConversationIndex = 999;
    const initialConversationName =
      ExpectedConstants.newConversationWithIndexTitle(initConversationIndex);

    await dialTest.step(
      'Prepare new conversation with index 999 in name',
      async () => {
        conversation = conversationData.prepareDefaultConversation(
          defaultModel,
          initialConversationName,
        );
        await dataInjector.createConversations([conversation]);
      },
    );

    await dialTest.step(
      'Create several new conversations and verify name is incremented',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(conversation.name);
        for (let i = 1; i <= 2; i++) {
          await header.createNewConversation();
          await expect
            .soft(
              conversations.getEntityByName(
                ExpectedConstants.newConversationWithIndexTitle(
                  initConversationIndex + i,
                ),
              ),
              ExpectedMessages.conversationIsVisible,
            )
            .toBeVisible();
        }
      },
    );
  },
);

dialTest.skip(
  'Renamed chats are not counted into default chat numeration',
  async ({
    dialHomePage,
    conversations,
    header,
    conversationData,
    dataInjector,
    conversationDropdownMenu,
    setTestIds,
    renameConversationModal,
  }) => {
    setTestIds('EPMRTC-1625');
    let firstConversation: Conversation;
    let secondConversation: Conversation;
    const thirdConversationName =
      ExpectedConstants.newConversationWithIndexTitle(3);
    const fourthConversationName =
      ExpectedConstants.newConversationWithIndexTitle(4);

    await dialTest.step(
      'Prepare new conversations with index 2 in the name and random name',
      async () => {
        firstConversation = conversationData.prepareDefaultConversation(
          defaultModel,
          GeneratorUtil.randomString(7),
        );
        conversationData.resetData();
        secondConversation = conversationData.prepareDefaultConversation(
          defaultModel,
          ExpectedConstants.newConversationWithIndexTitle(2),
        );
        await dataInjector.createConversations([
          firstConversation,
          secondConversation,
        ]);
      },
    );

    await dialTest.step(
      'Create new conversation and verify it has index 3',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(secondConversation.name);
        await header.createNewConversation();
        await expect
          .soft(
            conversations.getEntityByName(thirdConversationName),
            ExpectedMessages.conversationIsVisible,
          )
          .toBeVisible();
        //Now we have to check for the third and fourth conversation
        // because of the changes to the initial behavior of the page loading
        await expect
          .soft(
            conversations.getEntityByName(fourthConversationName),
            ExpectedMessages.conversationIsVisible,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Rename created conversation, create a new one and verify it is re-created with the same index',
      async () => {
        await conversations.openEntityDropdownMenu(thirdConversationName);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
        await renameConversationModal.editConversationNameWithSaveButton(
          GeneratorUtil.randomString(7),
          { isHttpMethodTriggered: false },
        );
        await header.createNewConversation();
        await expect
          .soft(
            conversations.getEntityByName(fourthConversationName),
            ExpectedMessages.conversationIsVisible,
          )
          .toBeVisible();
      },
    );
  },
);

dialTest.skip(
  'Deleted chats are not counted into default chat numeration',
  async ({
    dialHomePage,
    conversations,
    header,
    conversationData,
    dataInjector,
    conversationDropdownMenu,
    confirmationDialog,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1626');
    const latestIndex = 3;
    const conversationsArray: Conversation[] = [];

    await dialTest.step(
      'Prepare new conversations with indexes 1-3 in the name',
      async () => {
        for (let i = 1; i <= latestIndex; i++) {
          const conversation = conversationData.prepareDefaultConversation(
            defaultModel,
            ExpectedConstants.newConversationWithIndexTitle(i),
          );
          conversationsArray.push(conversation);
          conversationData.resetData();
        }
        await dataInjector.createConversations(conversationsArray);
      },
    );

    await dialTest.step(
      'Delete conversation with index 1, create a new one and verify name is incremented with latest index',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(conversationsArray[0].name);
        await conversations.openEntityDropdownMenu(
          ExpectedConstants.newConversationWithIndexTitle(1),
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        await header.createNewConversation();
        await expect
          .soft(
            conversations.getEntityByName(
              ExpectedConstants.newConversationWithIndexTitle(latestIndex + 2),
            ),
            ExpectedMessages.conversationIsVisible,
          )
          .toBeVisible();
      },
    );
  },
);

dialTest(
  'Chat names can be equal on different levels',
  async ({
    dialHomePage,
    conversations,
    chat,
    header,
    chatBar,
    conversationData,
    dataInjector,
    folderConversations,
    localStorageManager,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-2947');
    const initConversationName = GeneratorUtil.randomString(7);
    let nestedFolders: FolderInterface[];
    let secondLevelFolderConversation: Conversation;

    await dialTest.step(
      'Prepare new conversation and place it into the child folder',
      async () => {
        nestedFolders = conversationData.prepareNestedFolder(2);
        conversationData.resetData();
        secondLevelFolderConversation =
          conversationData.prepareDefaultConversation(
            defaultModel,
            initConversationName,
          );
        secondLevelFolderConversation.folderId = nestedFolders[1].id;
        secondLevelFolderConversation.id = `${nestedFolders[1].id}/${secondLevelFolderConversation.id}`;
        await dataInjector.createConversations(
          [secondLevelFolderConversation],
          ...nestedFolders,
        );
        await localStorageManager.setChatCollapsedSection(
          CollapsedSections.Organization,
          CollapsedSections.SharedWithMe,
        );
      },
    );

    await dialTest.step(
      'Create new conversations with the same name and move to the root folder',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequestWithButton(initConversationName);
        await chatBar.dragAndDropEntityToFolder(
          conversations.getEntityByName(initConversationName),
          folderConversations.getFolderByName(nestedFolders[0].name),
        );
        await expect
          .soft(
            folderConversations.getFolderEntity(
              nestedFolders[0].name,
              initConversationName,
            ),
            ExpectedMessages.conversationIsVisible,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Verify one more conversation with the same name can be created',
      async () => {
        await header.createNewConversation();
        await chat.sendRequestWithButton(initConversationName);
        await expect
          .soft(
            conversations.getEntityByName(initConversationName),
            ExpectedMessages.conversationIsVisible,
          )
          .toBeVisible();
      },
    );
  },
);

dialTest(
  'Postfix is added to chat name if the same name is already used and chat is named automatically',
  async ({
    dialHomePage,
    conversations,
    conversationData,
    dataInjector,
    chat,
    chatHeader,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-2798');
    const requestBasedConversationName = 'test';
    let conversation: Conversation;

    await dialTest.step(
      'Prepare new conversation with name "test"',
      async () => {
        conversation = conversationData.prepareDefaultConversation(
          defaultModel,
          requestBasedConversationName,
        );
        await dataInjector.createConversations([conversation]);
      },
    );

    await dialTest.step(
      'Create new conversation, send request with content "test" and verify conversation is renamed to "test 1"',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequestWithButton(requestBasedConversationName);
        await expect
          .soft(
            conversations.getEntityByName(`${requestBasedConversationName} 1`),
            ExpectedMessages.conversationIsVisible,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Send one more request to "test" conversation and verify name is not changed',
      async () => {
        await conversations.selectConversation(
          requestBasedConversationName,
          { isHttpMethodTriggered: false },
          2,
        );
        await chat.sendRequestWithButton('1+2', false);
        expect
          .soft(
            await chatHeader.chatTitle.getElementContent(),
            ExpectedMessages.headerTitleIsValid,
          )
          .toBe(requestBasedConversationName);
      },
    );
  },
);

dialTest(
  'Error message is shown if to rename chat manually to already existed chat name when chats are located in the same folder.\n' +
    'Error message is shown if to drag & drop chat from folder to root where the chat with the same name exists.\n' +
    'Error message is shown if to "Move to" chat to folder where the chat with the same name exists',
  async ({
    dialHomePage,
    conversations,
    chatBar,
    conversationData,
    dataInjector,
    folderConversations,
    conversationDropdownMenu,
    localStorageManager,
    toast,
    setTestIds,
    renameConversationModal,
  }) => {
    setTestIds('EPMRTC-2915', 'EPMRTC-2956', 'EPMRTC-2931');
    const duplicatedName = GeneratorUtil.randomString(7);
    let folderConversation: FolderConversation;
    let firstFolderConversation: Conversation;
    let secondFolderConversation: Conversation;
    let rootConversation: Conversation;

    await dialTest.step(
      'Prepare two conversations inside folder and one in the root with equal name',
      async () => {
        firstFolderConversation = conversationData.prepareDefaultConversation(
          defaultModel,
          duplicatedName,
        );
        conversationData.resetData();
        secondFolderConversation =
          conversationData.prepareDefaultConversation();
        conversationData.resetData();
        folderConversation = conversationData.prepareConversationsInFolder([
          firstFolderConversation,
          secondFolderConversation,
        ]);
        conversationData.resetData();
        rootConversation = conversationData.prepareDefaultConversation(
          defaultModel,
          duplicatedName,
        );

        await dataInjector.createConversations(
          [...folderConversation.conversations, rootConversation],
          folderConversation.folders,
        );
        await localStorageManager.setChatCollapsedSection(
          CollapsedSections.Organization,
          CollapsedSections.SharedWithMe,
        );
      },
    );

    await dialTest.step(
      'Try to rename folder conversation to the same name as another conversation inside folder and verify error is shown',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await folderConversations.expandFolder(folderConversation.folders.name);
        await folderConversations.selectFolderEntity(
          folderConversation.folders.name,
          secondFolderConversation.name,
        );
        await folderConversations.openFolderEntityDropdownMenu(
          folderConversation.folders.name,
          secondFolderConversation.name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
        await renameConversationModal.editInputValue(duplicatedName);
        await renameConversationModal.saveButton.click();

        await expect
          .soft(toast.getElementLocator(), ExpectedMessages.errorToastIsShown)
          .toBeVisible();
        const errorMessage = await toast.getElementContent();
        expect
          .soft(errorMessage, ExpectedMessages.notAllowedNameErrorShown)
          .toBe(
            ExpectedConstants.duplicatedConversationNameErrorMessage(
              duplicatedName,
            ),
          );
        await toast.closeToast();
        await renameConversationModal.cancelButton.click();
      },
    );

    await dialTest.step(
      'Drag&drop folder conversation with equal name to the root and verify error is shown',
      async () => {
        const firstFolderConversationLocator =
          folderConversations.getFolderEntity(
            folderConversation.folders.name,
            firstFolderConversation.name,
          );
        await chatBar.dragAndDropEntityFromFolder(
          firstFolderConversationLocator,
        );

        await expect
          .soft(toast.getElementLocator(), ExpectedMessages.errorToastIsShown)
          .toBeVisible();
        const errorMessage = await toast.getElementContent();
        expect
          .soft(errorMessage, ExpectedMessages.notAllowedNameErrorShown)
          .toBe(
            ExpectedConstants.duplicatedConversationRootNameErrorMessage(
              duplicatedName,
            ),
          );
        await expect
          .soft(
            firstFolderConversationLocator,
            ExpectedMessages.conversationIsVisible,
          )
          .toBeVisible();
        await toast.closeToast();
      },
    );

    await dialTest.step(
      'Try to move root conversation with equal name to the folder and verify error is shown',
      async () => {
        await conversations.openEntityDropdownMenu(rootConversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.moveTo);
        await conversationDropdownMenu.selectMenuOption(
          folderConversation.folders.name,
        );

        await expect
          .soft(toast.getElementLocator(), ExpectedMessages.errorToastIsShown)
          .toBeVisible();
        const errorMessage = await toast.getElementContent();
        expect
          .soft(errorMessage, ExpectedMessages.notAllowedNameErrorShown)
          .toBe(
            ExpectedConstants.duplicatedConversationNameErrorMessage(
              duplicatedName,
            ),
          );
        await expect
          .soft(
            conversations.getEntityByName(rootConversation.name),
            ExpectedMessages.conversationIsVisible,
          )
          .toBeVisible();
      },
    );
  },
);

dialTest(
  'Error message is shown if to rename chat manually to already existed chat name when chats are located in root',
  async ({
    dialHomePage,
    conversations,
    conversationData,
    dataInjector,
    toast,
    conversationDropdownMenu,
    setTestIds,
    renameConversationModal,
  }) => {
    setTestIds('EPMRTC-2933');
    let firstConversation: Conversation;
    let secondConversation: Conversation;

    await dialTest.step('Prepare two conversations', async () => {
      firstConversation = conversationData.prepareDefaultConversation();
      conversationData.resetData();
      secondConversation = conversationData.prepareDefaultConversation();
      await dataInjector.createConversations([
        firstConversation,
        secondConversation,
      ]);
    });

    await dialTest.step(
      'Try to rename one conversation to the same name as already existing conversation and verify error toast is shown',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.openEntityDropdownMenu(secondConversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
        await renameConversationModal.editInputValue(firstConversation.name);
        await renameConversationModal.saveButton.click();

        await expect
          .soft(toast.getElementLocator(), ExpectedMessages.errorToastIsShown)
          .toBeVisible();
        const errorMessage = await toast.getElementContent();
        expect
          .soft(errorMessage, ExpectedMessages.notAllowedNameErrorShown)
          .toBe(
            ExpectedConstants.duplicatedConversationNameErrorMessage(
              firstConversation.name,
            ),
          );
      },
    );
  },
);

dialTest(
  'Error message is shown if to drag & drop chat from the folder to another folder where the chat with the same name exists',
  async ({
    dialHomePage,
    conversationData,
    dataInjector,
    folderConversations,
    chatBar,
    toast,
    setTestIds,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-2932');
    let nestedFolders: FolderInterface[];
    let nestedConversations: Conversation[];
    const nestedFolderLevel = 2;
    const duplicatedConversationName = GeneratorUtil.randomString(7);

    await dialTest.step(
      'Create nested folder hierarchy containing conversations with equal names',
      async () => {
        nestedFolders = conversationData.prepareNestedFolder(nestedFolderLevel);
        nestedConversations =
          conversationData.prepareConversationsForNestedFolders(nestedFolders, {
            1: duplicatedConversationName,
            2: duplicatedConversationName,
          });

        await dataInjector.createConversations(
          nestedConversations,
          ...nestedFolders,
        );
        await localStorageManager.setChatCollapsedSection(
          CollapsedSections.Organization,
        );
      },
    );

    await dialTest.step(
      'Drag & drop conversation from top level folder to low level folder and verify error message is displayed',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await folderConversations.expandFolder(nestedFolders[0].name);
        const conversationToMove = folderConversations.getFolderEntity(
          nestedFolders[0].name,
          nestedConversations[0].name,
        );
        const targetFolder = folderConversations.getFolderByName(
          nestedFolders[nestedFolderLevel - 1].name,
        );

        await chatBar.dragAndDropEntityToFolder(
          conversationToMove,
          targetFolder,
        );
        await expect
          .soft(toast.getElementLocator(), ExpectedMessages.errorToastIsShown)
          .toBeVisible();
        const errorMessage = await toast.getElementContent();
        expect
          .soft(errorMessage, ExpectedMessages.notAllowedNameErrorShown)
          .toBe(
            ExpectedConstants.duplicatedConversationNameErrorMessage(
              nestedConversations[0].name,
            ),
          );
      },
    );
  },
);
