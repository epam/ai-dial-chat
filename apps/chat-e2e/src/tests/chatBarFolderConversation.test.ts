import { Conversation } from '@/chat/types/chat';
import { FolderInterface } from '@/chat/types/folder';
import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  FolderConversation,
  MenuOptions,
} from '@/src/testData';
import { Overflow, Styles } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
import { EditInput } from '@/src/ui/webElements';
import { GeneratorUtil } from '@/src/utils';
import { expect } from '@playwright/test';

dialTest(
  'Create new chat folder.\n' +
    'Share option is unavailable in chat folder if there is no any chat inside',
  async ({
    dialHomePage,
    chatBar,
    folderConversations,
    folderDropdownMenu,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-569', 'EPMRTC-2005');
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    await chatBar.createNewFolder();
    await expect
      .soft(
        await folderConversations.getFolderByName(
          ExpectedConstants.newFolderWithIndexTitle(1),
        ),
        ExpectedMessages.newFolderCreated,
      )
      .toBeVisible();

    await folderConversations.openFolderDropdownMenu(
      ExpectedConstants.newFolderWithIndexTitle(1),
    );
    const actualMenuOptions = await folderDropdownMenu.getAllMenuOptions();
    expect
      .soft(actualMenuOptions, ExpectedMessages.contextMenuOptionsValid)
      .toEqual([MenuOptions.rename, MenuOptions.delete]);
  },
);

dialTest(
  `Rename chat folder when it's empty using Enter.\n` +
    'Rename folders on nested levels.\n' +
    'Chat folder: default numeration.\n' +
    'Chat folder: spaces in the middle of folder name stay.\n' +
    'Chat folder: spaces at the beginning or end of folder name are removed',
  async ({
    dialHomePage,
    folderConversations,
    folderDropdownMenu,
    chatBar,
    setTestIds,
  }) => {
    setTestIds(
      'EPMRTC-571',
      'EPMRTC-1371',
      'EPMRTC-1627',
      'EPMRTC-2891',
      'EPMRTC-2893',
    );
    const newNameWithSpaces = '  updated    folder name  ';
    const randomFolderIndex = GeneratorUtil.randomNumberInRange(2) + 1;

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();

    for (let i = 1; i <= 3; i++) {
      await chatBar.createNewFolder();
    }
    for (let i = 3; i >= 2; i--) {
      await chatBar.dragAndDropEntityToFolder(
        folderConversations.getFolderByName(
          ExpectedConstants.newFolderWithIndexTitle(i),
        ),
        folderConversations.getFolderByName(
          ExpectedConstants.newFolderWithIndexTitle(i - 1),
        ),
      );
    }
    await folderConversations.expandFolder(
      ExpectedConstants.newFolderWithIndexTitle(2),
    );

    await folderConversations.openFolderDropdownMenu(
      ExpectedConstants.newFolderWithIndexTitle(randomFolderIndex),
    );
    await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
    await folderConversations.editFolderNameWithEnter(newNameWithSpaces);
    await expect
      .soft(
        await folderConversations.getFolderByName(newNameWithSpaces.trim()),
        ExpectedMessages.folderNameUpdated,
      )
      .toBeVisible();

    for (let i = 1; i <= 3; i++) {
      if (i !== randomFolderIndex) {
        await expect
          .soft(
            await folderConversations.getFolderByName(
              ExpectedConstants.newFolderWithIndexTitle(i),
            ),
            ExpectedMessages.folderNameNotUpdated,
          )
          .toBeVisible();
      }
    }
  },
);

dialTest(
  `Cancel folder renaming on "x".\n` +
    'Chat folder: Error message appears if there is a dot is at the end of folder name.\n' +
    'Chat folder: restricted special characters are not entered.\n' +
    'Chat folder: restricted special characters are removed if to copy-paste.\n' +
    'Chat folder: name can not be blank or with spaces only',
  async ({
    dialHomePage,
    folderConversations,
    conversationDropdownMenu,
    chatBar,
    errorToast,
    sendMessage,
    page,
    setTestIds,
  }) => {
    setTestIds(
      'EPMRTC-572',
      'EPMRTC-587',
      'EPMRTC-2889',
      'EPMRTC-2890',
      'EPMRTC-575',
    );
    const newNameWithEndDot = 'updated folder name.';
    let editFolderInput: EditInput;

    await dialTest.step('Start editing folder and cancel', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await chatBar.createNewFolder();
      await folderConversations.openFolderDropdownMenu(
        ExpectedConstants.newFolderWithIndexTitle(1),
      );
      await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
      await folderConversations.editFolderName(newNameWithEndDot);
      await folderConversations.getEditFolderInputActions().clickCancelButton();
      await expect
        .soft(
          folderConversations.getFolderByName(
            ExpectedConstants.newFolderWithIndexTitle(1),
          ),
          ExpectedMessages.folderNameNotUpdated,
        )
        .toBeVisible();
    });

    await dialTest.step(
      'Start editing folder to name with dot at the end and verify error message shown',
      async () => {
        await folderConversations.openFolderDropdownMenu(
          ExpectedConstants.newFolderWithIndexTitle(1),
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
        editFolderInput =
          await folderConversations.editFolderName(newNameWithEndDot);
        await folderConversations.getEditFolderInputActions().clickTickButton();

        const errorMessage = await errorToast.getElementContent();
        expect
          .soft(errorMessage, ExpectedMessages.notAllowedNameErrorShown)
          .toBe(ExpectedConstants.nameWithDotErrorMessage);
      },
    );

    await dialTest.step(
      'Start typing prohibited symbols and verify they are not displayed in text input',
      async () => {
        await editFolderInput.click();
        await editFolderInput.editValue(
          ExpectedConstants.prohibitedNameSymbols,
        );
        const inputContent = await editFolderInput.getElementContent();
        expect
          .soft(inputContent, ExpectedMessages.charactersAreNotDisplayed)
          .toBe('');
      },
    );

    await dialTest.step(
      'Paste prohibited symbols and verify they are not displayed in text input',
      async () => {
        await sendMessage.fillRequestData(
          ExpectedConstants.prohibitedNameSymbols,
        );
        await page.keyboard.press(keys.ctrlPlusA);
        await page.keyboard.press(keys.ctrlPlusC);
        await editFolderInput.click();
        await page.keyboard.press(keys.ctrlPlusV);
        const inputContent = await editFolderInput.getElementContent();
        expect
          .soft(inputContent, ExpectedMessages.charactersAreNotDisplayed)
          .toBe('');
      },
    );

    await dialTest.step(
      'Set empty folder name or spaces and verify initial name is preserved',
      async () => {
        const name = GeneratorUtil.randomArrayElement(['', '   ']);
        await folderConversations.editFolderName(name);
        await folderConversations.getEditFolderInputActions().clickTickButton();
        await expect
          .soft(
            folderConversations.getFolderByName(
              ExpectedConstants.newFolderWithIndexTitle(1),
            ),
            ExpectedMessages.folderNameNotUpdated,
          )
          .toBeVisible();
      },
    );
  },
);

dialTest(
  'Rename chat folder when chats are inside using check button\n' +
    'Long Folder name is cut',
  async ({
    dialHomePage,
    conversationData,
    folderConversations,
    dataInjector,
    folderDropdownMenu,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-573', 'EPMRTC-574');
    const folderName = GeneratorUtil.randomString(70);
    const newConversationName = 'updated folder name';

    await dialTest.step(
      'Prepare folder with long name and conversation inside folder',
      async () => {
        const conversationInFolder =
          conversationData.prepareDefaultConversationInFolder(folderName);
        await dataInjector.createConversations(
          conversationInFolder.conversations,
          conversationInFolder.folders,
        );
      },
    );

    await dialTest.step(
      'Open app and verify folder name is truncated in the side panel',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        const folderNameOverflow = await folderConversations
          .getFolderName(folderName)
          .getComputedStyleProperty(Styles.text_overflow);
        expect
          .soft(folderNameOverflow[0], ExpectedMessages.folderNameIsTruncated)
          .toBe(Overflow.ellipsis);
      },
    );

    await dialTest.step(
      'Hover over folder name and verify it is truncated when menu dots appear',
      async () => {
        await folderConversations.getFolderByName(folderName).hover();
        const folderNameOverflow = await folderConversations
          .getFolderName(folderName)
          .getComputedStyleProperty(Styles.text_overflow);
        expect
          .soft(folderNameOverflow[0], ExpectedMessages.folderNameIsTruncated)
          .toBe(Overflow.ellipsis);
      },
    );

    await dialTest.step(
      'Open edit folder name mode and verify it is truncated',
      async () => {
        await folderConversations.openFolderDropdownMenu(folderName);
        await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
        const folderInputOverflow = await folderConversations
          .getEditFolderInput()
          .editInput.getComputedStyleProperty(Styles.text_overflow);
        expect
          .soft(folderInputOverflow[0], ExpectedMessages.folderNameIsTruncated)
          .toBe(Overflow.ellipsis);
      },
    );

    await dialTest.step(
      'Edit folder name using tick button and verify it is renamed',
      async () => {
        await folderConversations.editFolderNameWithTick(newConversationName);
        await expect
          .soft(
            await folderConversations.getFolderByName(newConversationName),
            ExpectedMessages.folderNameUpdated,
          )
          .toBeVisible();
      },
    );
  },
);

dialTest(
  'Folders can expand and collapse',
  async ({
    dialHomePage,
    conversationData,
    folderConversations,
    dataInjector,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-579');
    let conversationInFolder: FolderConversation;

    await dialTest.step('Prepare conversation inside folder', async () => {
      conversationInFolder = conversationData.prepareFolderWithConversations(1);
      await dataInjector.createConversations(
        conversationInFolder.conversations,
        conversationInFolder.folders,
      );
    });
    await dialTest.step(
      'Verify folder arrow icon is changes on expand/collapse folder',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        let isFolderCaretExpanded =
          await folderConversations.isFolderCaretExpanded(
            conversationInFolder.folders.name,
          );
        expect
          .soft(isFolderCaretExpanded, ExpectedMessages.folderCaretIsExpanded)
          .toBeFalsy();

        await folderConversations.expandCollapseFolder(
          conversationInFolder.folders.name,
        );
        isFolderCaretExpanded = await folderConversations.isFolderCaretExpanded(
          conversationInFolder.folders.name,
        );
        expect
          .soft(isFolderCaretExpanded, ExpectedMessages.folderCaretIsExpanded)
          .toBeTruthy();
      },
    );
  },
);

dialTest(
  'Delete folder. Cancel.\n' + 'Delete root folder with nested folders',
  async ({
    dialHomePage,
    folderConversations,
    conversationDropdownMenu,
    confirmationDialog,
    chatBar,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-606', 'EPMRTC-1373');

    await dialTest.step('Create max nested folders structure', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();

      for (let i = 1; i <= 3; i++) {
        await chatBar.createNewFolder();
      }
      for (let i = 3; i >= 2; i--) {
        await chatBar.dragAndDropEntityToFolder(
          folderConversations.getFolderByName(
            ExpectedConstants.newFolderWithIndexTitle(i),
          ),
          folderConversations.getFolderByName(
            ExpectedConstants.newFolderWithIndexTitle(i - 1),
          ),
        );
      }
    });

    await dialTest.step(
      'For root folder open dropdown menu, select "Delete" option, cancel delete and verify folder remains',
      async () => {
        await folderConversations.openFolderDropdownMenu(
          ExpectedConstants.newFolderWithIndexTitle(1),
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
        expect
          .soft(
            await confirmationDialog.getConfirmationMessage(),
            ExpectedMessages.confirmationMessageIsValid,
          )
          .toBe(ExpectedConstants.deleteFolderMessage);

        await confirmationDialog.cancelDialog();
        await expect
          .soft(
            await folderConversations.getFolderByName(
              ExpectedConstants.newFolderWithIndexTitle(1),
            ),
            ExpectedMessages.folderNotDeleted,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'For root folder open dropdown menu, select "Delete" option, confirm delete and verify folder with all nested elements are deleted',
      async () => {
        await folderConversations.openFolderDropdownMenu(
          ExpectedConstants.newFolderWithIndexTitle(1),
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm();
        for (let i = 2; i <= 3; i++) {
          await folderConversations
            .getFolderByName(ExpectedConstants.newFolderWithIndexTitle(i))
            .waitFor({ state: 'hidden' });
        }
      },
    );

    await dialTest.step(
      'Create again root folder, expand and verify no nested elements available inside',
      async () => {
        await chatBar.createNewFolder();
        const foldersCount = await folderConversations.getFoldersCount();
        expect.soft(foldersCount, ExpectedMessages.foldersCountIsValid).toBe(1);
      },
    );
  },
);

dialTest(
  'Delete folder when there are some chats inside',
  async ({
    dialHomePage,
    conversationData,
    folderConversations,
    dataInjector,
    conversationDropdownMenu,
    conversations,
    confirmationDialog,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-605');
    const conversationInFolder =
      conversationData.prepareDefaultConversationInFolder();
    await dataInjector.createConversations(
      conversationInFolder.conversations,
      conversationInFolder.folders,
    );

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    await folderConversations.openFolderDropdownMenu(
      conversationInFolder.folders.name,
    );
    await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
    await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
    await expect
      .soft(
        await folderConversations.getFolderByName(
          conversationInFolder.folders.name,
        ),
        ExpectedMessages.folderDeleted,
      )
      .toBeHidden();

    const todayConversations = await conversations.getTodayConversations();
    expect
      .soft(
        todayConversations.includes(conversationInFolder.conversations[0].name),
        ExpectedMessages.conversationOfToday,
      )
      .toBeFalsy();
  },
);

dialTest(
  'Delete nested folder with chat',
  async ({
    dialHomePage,
    conversationData,
    folderConversations,
    dataInjector,
    conversationDropdownMenu,
    conversations,
    confirmationDialog,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1372');
    const levelsCount = 3;
    const levelToDelete = 2;
    let nestedFolders: FolderInterface[];
    let nestedConversations: Conversation[] = [];

    await dialTest.step(
      'Prepare nested folders with conversations inside each one',
      async () => {
        nestedFolders = conversationData.prepareNestedFolder(levelsCount);
        nestedConversations =
          conversationData.prepareConversationsForNestedFolders(nestedFolders);
        await dataInjector.createConversations(
          nestedConversations,
          ...nestedFolders,
        );
      },
    );

    await dialTest.step(
      'Delete 2nd level folder and verify all nested content is deleted as well',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        for (const nestedFolder of nestedFolders) {
          await folderConversations.expandFolder(nestedFolder.name);
        }
        await folderConversations.openFolderDropdownMenu(
          nestedFolders[levelToDelete].name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });

        for (let i = levelToDelete; i <= levelsCount; i++) {
          await expect
            .soft(
              await folderConversations.getFolderByName(nestedFolders[i].name),
              ExpectedMessages.folderDeleted,
            )
            .toBeHidden();
          await expect
            .soft(
              await conversations.getConversationByName(
                nestedConversations[i].name,
              ),
              ExpectedMessages.conversationDeleted,
            )
            .toBeHidden();
        }

        for (let i = 0; i <= levelsCount - levelToDelete; i++) {
          await expect
            .soft(
              await folderConversations.getFolderByName(nestedFolders[i].name),
              ExpectedMessages.folderNotDeleted,
            )
            .toBeVisible();
          await expect
            .soft(
              await folderConversations.getFolderEntity(
                nestedFolders[i].name,
                nestedConversations[i].name,
              ),
              ExpectedMessages.conversationNotDeleted,
            )
            .toBeVisible();
        }
      },
    );
  },
);

dialTest(
  `Chat folder: allowed special characters`,
  async ({
    dialHomePage,
    folderConversations,
    conversationDropdownMenu,
    chatBar,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1277');
    const specialSymbols = `(\`~!@#$^*-_+[]'|<>.?)`;

    await dialTest.step(
      'Create a new folder and rename to name with special symbols',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await chatBar.createNewFolder();
        await folderConversations.openFolderDropdownMenu(
          ExpectedConstants.newFolderWithIndexTitle(1),
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
        await folderConversations.editFolderName(specialSymbols);
        await folderConversations.getEditFolderInputActions().clickTickButton();
        await expect
          .soft(
            folderConversations.getFolderByName(specialSymbols),
            ExpectedMessages.folderNameUpdated,
          )
          .toBeVisible();
      },
    );
  },
);

dialTest(
  'Chat folder: smiles, hieroglyph, specific letters in name',
  async ({
    dialHomePage,
    folderConversations,
    conversationDropdownMenu,
    conversationData,
    dataInjector,
    chatMessages,
    chat,
    localStorageManager,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-2954');
    const updatedFolderName = `😂👍🥳 😷 🤧 🤠 🥴😇 😈 ⭐あおㅁㄹñ¿äß`;
    let folderConversation: FolderConversation;

    await dialTest.step('Prepare conversation inside folder', async () => {
      folderConversation =
        conversationData.prepareDefaultConversationInFolder();
      await dataInjector.createConversations(
        folderConversation.conversations,
        folderConversation.folders,
      );
      await localStorageManager.setSelectedConversation(
        folderConversation.conversations[0],
      );
    });

    await dialTest.step(
      'Rename folder to name with special symbols',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await folderConversations.openFolderDropdownMenu(
          folderConversation.folders.name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
        await folderConversations.editFolderName(updatedFolderName);
        await folderConversations.getEditFolderInputActions().clickTickButton();
        await expect
          .soft(
            folderConversations.getFolderByName(updatedFolderName),
            ExpectedMessages.folderNameUpdated,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Send request to folder chat and verify response received',
      async () => {
        await chat.sendRequestWithButton('1+2');
        const messagesCount =
          await chatMessages.chatMessages.getElementsCount();
        expect
          .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
          .toBe(folderConversation.conversations[0].messages.length + 2);
      },
    );
  },
);
