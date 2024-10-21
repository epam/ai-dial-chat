import { Conversation } from '@/chat/types/chat';
import { FolderInterface } from '@/chat/types/folder';
import dialTest from '@/src/core/dialFixtures';
import {
  Chronology,
  CollapsedSections,
  ExpectedConstants,
  ExpectedMessages,
  FolderConversation,
  MenuOptions,
} from '@/src/testData';
import { Overflow, Styles } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
import { EditInput } from '@/src/ui/webElements';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
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
        folderConversations.getFolderByName(
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
      .toEqual([MenuOptions.select, MenuOptions.rename, MenuOptions.delete]);
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
        folderConversations.getFolderByName(newNameWithSpaces.trim()),
        ExpectedMessages.folderNameUpdated,
      )
      .toBeVisible();

    for (let i = 1; i <= 3; i++) {
      if (i !== randomFolderIndex) {
        await expect
          .soft(
            folderConversations.getFolderByName(
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
        await editFolderInput.editValue(ExpectedConstants.restrictedNameChars);
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
          ExpectedConstants.restrictedNameChars,
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
    'Long Folder name is cut.\n' +
    'Rename chat folder with 161 symbols with dot in the end',
  async ({
    dialHomePage,
    conversationData,
    folderConversations,
    dataInjector,
    folderDropdownMenu,
    errorToast,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-573', 'EPMRTC-574', 'EPMRTC-3190');
    const folderName = GeneratorUtil.randomString(70);
    const newFolderNameToSet = `${GeneratorUtil.randomString(ExpectedConstants.maxEntityNameLength)}.`;
    const expectedNewFolderName = newFolderNameToSet.substring(
      0,
      ExpectedConstants.maxEntityNameLength,
    );

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
        await folderConversations.editFolderNameWithTick(newFolderNameToSet);
        await expect
          .soft(
            errorToast.getElementLocator(),
            ExpectedMessages.noErrorToastIsShown,
          )
          .toBeHidden();
        expect
          .soft(
            await folderConversations
              .getFolderName(expectedNewFolderName)
              .getElementInnerContent(),
            ExpectedMessages.folderNameUpdated,
          )
          .toBe(expectedNewFolderName);
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
          .soft(isFolderCaretExpanded, ExpectedMessages.caretIsExpanded)
          .toBeFalsy();

        await folderConversations.expandCollapseFolder(
          conversationInFolder.folders.name,
        );
        isFolderCaretExpanded = await folderConversations.isFolderCaretExpanded(
          conversationInFolder.folders.name,
        );
        expect
          .soft(isFolderCaretExpanded, ExpectedMessages.caretIsExpanded)
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
            folderConversations.getFolderByName(
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
        folderConversations.getFolderByName(conversationInFolder.folders.name),
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
    const levelsCount = 4;
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

        for (let i = levelToDelete; i < levelsCount; i++) {
          await expect
            .soft(
              folderConversations.getFolderByName(nestedFolders[i].name),
              ExpectedMessages.folderDeleted,
            )
            .toBeHidden();
          await expect
            .soft(
              conversations.getEntityByName(nestedConversations[i].name),
              ExpectedMessages.conversationDeleted,
            )
            .toBeHidden();
        }

        for (let i = 0; i < levelsCount - levelToDelete; i++) {
          await expect
            .soft(
              folderConversations.getFolderByName(nestedFolders[i].name),
              ExpectedMessages.folderNotDeleted,
            )
            .toBeVisible();
          await expect
            .soft(
              folderConversations.getFolderEntity(
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
        await folderConversations.editFolderName(
          ExpectedConstants.allowedSpecialChars,
        );
        await folderConversations.getEditFolderInputActions().clickTickButton();
        await expect
          .soft(
            folderConversations.getFolderByName(
              ExpectedConstants.allowedSpecialChars,
            ),
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
        const simpleRequestModel = ModelsUtil.getModelForSimpleRequest();
        if (simpleRequestModel !== undefined) {
          await chat.sendRequestWithButton('1+2');
          const messagesCount =
            await chatMessages.chatMessages.getElementsCount();
          expect
            .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
            .toBe(folderConversation.conversations[0].messages.length + 2);
        }
      },
    );
  },
);

dialTest(
  'Error message appears that no nested chat folders are allowed\n' +
    'Error message appears if to drag&drop chat Folder_parent to Folder_child\n' +
    "It's forbidden to drag&drop chat folder to Today\n" +
    'Context menu appears if to click on chat name or folder name using right mouse button',
  async ({
    dialHomePage,
    chatBar,
    folderConversations,
    errorToast,
    setTestIds,
    conversations,
    chatBarFolderAssertion,
    conversationData,
    dataInjector,
    localStorageManager,
    errorToastAssertion,
    conversationDropdownMenuAssertion,
  }) => {
    setTestIds('EPMRTC-1367', 'EPMRTC-1917', 'EPMRTC-1923, EPMRTC-1763');
    let firstConversation: Conversation;

    await dialTest.step('Prepare folders hierarchy', async () => {
      firstConversation = conversationData.prepareDefaultConversation();
      await dataInjector.createConversations([firstConversation]);
      await localStorageManager.setSelectedConversation(firstConversation);
      await localStorageManager.setChatCollapsedSection(
        CollapsedSections.Organization,
      );

      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      // Create folders
      for (let i = 1; i <= 4; i++) {
        await chatBar.createNewFolder();
        await chatBarFolderAssertion.assertFolderState(
          { name: ExpectedConstants.newFolderWithIndexTitle(i) },
          'visible',
        );
      }

      // Create nested structure
      for (let i = 4; i > 1; i--) {
        await chatBar.dragAndDropEntityToFolder(
          folderConversations.getFolderByName(
            ExpectedConstants.newFolderWithIndexTitle(i),
          ),
          folderConversations.getFolderByName(
            ExpectedConstants.newFolderWithIndexTitle(i - 1),
          ),
        );
        if (i !== 4) {
          await folderConversations.expandFolder(
            ExpectedConstants.newFolderWithIndexTitle(i),
          );
        }
      }
    });

    await dialTest.step(
      'Create New folder and move it into Folder4 folder',
      async () => {
        await chatBar.createNewFolder();
        await chatBarFolderAssertion.assertFolderState(
          { name: ExpectedConstants.newFolderWithIndexTitle(2) },
          'visible',
        );
        await chatBar.dragAndDropEntityToFolder(
          folderConversations.getFolderByName(
            ExpectedConstants.newFolderWithIndexTitle(2),
            2,
          ),
          folderConversations.getFolderByName(
            ExpectedConstants.newFolderWithIndexTitle(4),
          ),
        );

        await errorToastAssertion.assertToastMessage(
          ExpectedConstants.tooManyNestedFolders,
          ExpectedMessages.tooManyNestedFolders,
        );

        await chatBarFolderAssertion.assertRootFolderState(
          { name: ExpectedConstants.newFolderWithIndexTitle(2) },
          'visible',
        );
        await errorToast.closeToast();
      },
    );

    // blocked by the issue https://github.com/epam/ai-dial-chat/issues/1925
    // await dialTest.step('Drag & drop Folder1 to Folder2 -> error appears', async () => {
    //   await chatBar.dragAndDropEntityToFolder(
    //     folderConversations.getFolderByName(ExpectedConstants.newFolderWithIndexTitle(3)),
    //     folderConversations.getFolderByName(ExpectedConstants.newFolderWithIndexTitle(4))
    //   );
    //
    //   const errorMessage = await errorToast.getElementContent();
    //   expect
    //     .soft(errorMessage, ExpectedMessages.notAllowedToMoveParentToChild)
    //     .toBe(ExpectedConstants.notAllowedToMoveParentToChild);
    //
    //   await expect
    //     .soft(
    //       chatBar.getChildElementBySelector(ChatBarSelectors.pinnedChats()).getElementLocator()
    //         .locator('div').locator(FolderSelectors.folderGroup).locator(FolderSelectors.folder)
    //         .locator('div').locator(FolderSelectors.folderName).locator('span')
    //         .getByText(ExpectedConstants.newFolderWithIndexTitle(4), {exact: true}),
    //       ExpectedMessages.folderIsVisible
    //     )
    //     .toBeVisible();
    // });

    await dialTest.step(
      'Drag & drop Folder to Today -> error appears',
      async () => {
        await chatBar.dragAndDropEntityToFolder(
          folderConversations.getFolderByName(
            ExpectedConstants.newFolderWithIndexTitle(2),
            2,
          ),
          conversations.chronologyByTitle(Chronology.today),
        );

        await chatBarFolderAssertion.assertRootFolderState(
          { name: ExpectedConstants.newFolderWithIndexTitle(2) },
          'visible',
        );
      },
    );

    await dialTest.step(
      'Context menu appears if to click on chat name or folder name using right mouse button',
      async () => {
        // Chat context menu
        await conversations
          .getEntityByName(firstConversation.name)
          .click({ button: 'right' });
        await conversationDropdownMenuAssertion.assertMenuState('visible');
        await conversations.getEntityName(firstConversation.name).click();

        // Folder context menu
        await folderConversations
          .getFolderByName(ExpectedConstants.newFolderWithIndexTitle(1))
          .click({ button: 'right' });
        await folderConversations
          .getDropdownMenu()
          .waitForState({ state: 'visible' });
      },
    );
  },
);

dialTest(
  'Menu for conversation in Replay mode\n' +
    'Single chat can not be stored in Pinned chats section',
  async ({
    dialHomePage,
    conversationData,
    dataInjector,
    conversations,
    setTestIds,
    localStorageManager,
    conversationAssertion,
    chatBar,
    chatBarFolderAssertion,
    conversationDropdownMenuAssertion,
  }) => {
    setTestIds('EPMRTC-1138', 'EPMRTC-1598');
    const conversation = conversationData.prepareDefaultConversation();
    conversationData.resetData();
    const replayConversation =
      conversationData.prepareDefaultReplayConversation(conversation);
    await dataInjector.createConversations([conversation, replayConversation]);
    await localStorageManager.setSelectedConversation(conversation);

    await dialTest.step(
      'Create New conversation and send any message there',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
      },
    );

    await dialTest.step('Open menu for the conversation', async () => {
      await conversations.openEntityDropdownMenu(
        ExpectedConstants.replayConversation + conversation.name,
      );
      const expectedMenuOptions = [
        MenuOptions.select,
        MenuOptions.rename,
        MenuOptions.duplicate,
        MenuOptions.export,
        MenuOptions.moveTo,
        MenuOptions.delete,
      ];
      await conversationDropdownMenuAssertion.assertMenuIncludesOptions(
        ...expectedMenuOptions,
      );

      const excludedMenuOptions = [
        MenuOptions.playback,
        MenuOptions.replay,
        MenuOptions.share,
        MenuOptions.publish,
      ];

      await conversationDropdownMenuAssertion.assertMenuExcludesOptions(
        ...excludedMenuOptions,
      );
    });

    await dialTest.step(
      'Create a folder -> Pinned chats section appears with New folder inside',
      async () => {
        await chatBar.createNewFolder();
        await chatBarFolderAssertion.assertFolderState(
          { name: ExpectedConstants.newFolderWithIndexTitle(1) },
          'visible',
        );
      },
    );

    await dialTest.step(
      'Move (drag& drop) chat in Pinned chats section but out of New folder -> green line appears but nothing happens',
      async () => {
        await chatBar.dragAndDropEntityToRoot(
          conversations.getEntityByName(conversation.name),
        );
        await conversationAssertion.assertEntityState(
          { name: conversation.name },
          'visible',
        );
        await conversationAssertion.assertConversationInToday(
          conversation.name,
        );
      },
    );
  },
);
