import {Conversation} from '@/chat/types/chat';
import {FolderInterface} from '@/chat/types/folder';
import {DialAIEntityModel} from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  CollapsedSections,
  ExpectedConstants,
  ExpectedMessages,
  FolderConversation,
  MenuOptions,
  MockedChatApiResponseBodies,
} from '@/src/testData';
import {GeneratorUtil, ModelsUtil} from '@/src/utils';
import {expect} from '@playwright/test';

let defaultModel: DialAIEntityModel;
dialTest.beforeAll(async () => {
  defaultModel = ModelsUtil.getDefaultModel()!;
});

dialTest(
  'Default chat numeration.\n' + 'Chat numeration continues after 999',
  async ({
    dialHomePage,
    conversations,
    chatBar,
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
          await chatBar.createNewConversation();
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

dialTest(
  'Renamed chats are not counted into default chat numeration',
  async ({
    dialHomePage,
    conversations,
    chatBar,
    conversationData,
    dataInjector,
    conversationDropdownMenu,
    setTestIds,
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
        await chatBar.createNewConversation();
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
        await conversations.editConversationNameWithTick(
          GeneratorUtil.randomString(7),
        );
        await chatBar.createNewConversation();
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

dialTest(
  'Deleted chats are not counted into default chat numeration',
  async ({
    dialHomePage,
    conversations,
    chatBar,
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
        await chatBar.createNewConversation();
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
    chatBar,
    conversationData,
    dataInjector,
    folderConversations,
    setTestIds,
           conversationDropdownMenu,
           confirmationDialog,
  }) => {
    setTestIds('EPMRTC-2947');
    const initConversationName =
      ExpectedConstants.newConversationWithIndexTitle(1);
    let folderConversation: FolderConversation;

    await dialTest.step(
      'Prepare new conversation with name "New conversation 1" in folder',
      async () => {
        folderConversation =
          conversationData.prepareDefaultConversationInFolder(
            GeneratorUtil.randomString(7),
            defaultModel,
            initConversationName,
          );
        await dataInjector.createConversations(
          folderConversation.conversations,
          folderConversation.folders,
        );
      },
    );

    await dialTest.step(
      'Create new conversations with name "New conversation 1" and move to a new folder',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.openEntityDropdownMenu(ExpectedConstants.newConversationWithIndexTitle(1));
        await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });

        await folderConversations.expandFolder(folderConversation.folders.name);
        await folderConversations.selectFolderEntity(folderConversation.folders.name,
          folderConversation.conversations[0].name);
        await chatBar.createNewFolder();
        await chatBar.createNewConversation();

        await chatBar.dragAndDropEntityToFolder(
          conversations.getEntityByName(initConversationName),
          folderConversations.getFolderByName(
            ExpectedConstants.newFolderWithIndexTitle(1),
          ),
        );

        await expect
          .soft(
            folderConversations.getFolderEntity(
              ExpectedConstants.newFolderWithIndexTitle(1),
              initConversationName,
            ),
            ExpectedMessages.conversationIsVisible,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Verify one more conversation with name "New conversation 1" can be created',
      async () => {
        await chatBar.createNewConversation();
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
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
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
        await conversations.selectConversation(requestBasedConversationName, 2);
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
    errorToast,
    setTestIds,
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
      },
    );

    await dialTest.step(
      'Try to rename folder conversation to the same name as another conversation inside folder and verify error is shown',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await folderConversations.expandFolder(folderConversation.folders.name);
        await folderConversations.selectFolderEntity(folderConversation.folders.name,
          secondFolderConversation.name);
        await folderConversations.openFolderEntityDropdownMenu(
          folderConversation.folders.name,
          secondFolderConversation.name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
        const editFolderConversationInputActions =
          folderConversations.getEditFolderEntityInputActions();
        await folderConversations
          .getEditFolderEntityInput()
          .editValue(duplicatedName);
        await editFolderConversationInputActions.clickTickButton();

        await expect
          .soft(
            errorToast.getElementLocator(),
            ExpectedMessages.errorToastIsShown,
          )
          .toBeVisible();
        const errorMessage = await errorToast.getElementContent();
        expect
          .soft(errorMessage, ExpectedMessages.notAllowedNameErrorShown)
          .toBe(
            ExpectedConstants.duplicatedConversationNameErrorMessage(
              duplicatedName,
            ),
          );
        await errorToast.closeToast();
        await editFolderConversationInputActions.clickCancelButton();
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
          .soft(
            errorToast.getElementLocator(),
            ExpectedMessages.errorToastIsShown,
          )
          .toBeVisible();
        const errorMessage = await errorToast.getElementContent();
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
        await errorToast.closeToast();
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
          .soft(
            errorToast.getElementLocator(),
            ExpectedMessages.errorToastIsShown,
          )
          .toBeVisible();
        const errorMessage = await errorToast.getElementContent();
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
    errorToast,
    conversationDropdownMenu,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-2933');
    let conversation: Conversation;

    await dialTest.step('Prepare new conversation', async () => {
      conversation = conversationData.prepareDefaultConversation();
      await dataInjector.createConversations([conversation]);
    });

    await dialTest.step(
      'Try to rename new conversation to the same name as already existing conversation and verify error toast is shown',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await conversations.openEntityDropdownMenu(
          ExpectedConstants.newConversationWithIndexTitle(1),
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
        await conversations.openEditEntityNameMode(conversation.name);
        await conversations.getEditInputActions().clickTickButton();

        await expect
          .soft(
            errorToast.getElementLocator(),
            ExpectedMessages.errorToastIsShown,
          )
          .toBeVisible();
        const errorMessage = await errorToast.getElementContent();
        expect
          .soft(errorMessage, ExpectedMessages.notAllowedNameErrorShown)
          .toBe(
            ExpectedConstants.duplicatedConversationNameErrorMessage(
              conversation.name,
            ),
          );
      },
    );
  },
);

dialTest.only(
  'Error message is shown if to drag & drop chat from the folder to another folder where the chat with the same name exists',
  async ({
    dialHomePage,
    conversationData,
    dataInjector,
    folderConversations,
    chatBar,
    errorToast,
    conversations,
    setTestIds,
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
        await localStorageManager.setChatCollapsedSection(CollapsedSections.Organization);
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
          nestedFolders[nestedFolderLevel - 1].name,);

        await chatBar.dragAndDropEntityToFolder(
          conversationToMove,
          targetFolder,
        );
        await expect
          .soft(
            errorToast.getElementLocator(),
            ExpectedMessages.errorToastIsShown,
          )
          .toBeVisible();
        const errorMessage = await errorToast.getElementContent();
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
