import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
} from '@/src/testData';
import { Overflow, Styles } from '@/src/ui/domData';
import { GeneratorUtil } from '@/src/utils';
import { expect } from '@playwright/test';

dialTest(
  `Rename chat folder when it's empty using Enter.\n` +
    'Rename folders on nested levels',
  async ({
    dialHomePage,
    folderConversations,
    folderDropdownMenu,
    chatBar,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-571', 'EPMRTC-1371');
    const newName = 'updated folder name';
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
    await folderConversations.editFolderNameWithEnter(
      ExpectedConstants.newFolderWithIndexTitle(randomFolderIndex),
      newName,
    );
    expect
      .soft(
        await folderConversations.getFolderByName(newName).isVisible(),
        ExpectedMessages.folderNameUpdated,
      )
      .toBeTruthy();

    for (let i = 1; i <= 3; i++) {
      if (i !== randomFolderIndex) {
        expect
          .soft(
            await folderConversations
              .getFolderByName(ExpectedConstants.newFolderWithIndexTitle(i))
              .isVisible(),
            ExpectedMessages.folderNameNotUpdated,
          )
          .toBeTruthy();
      }
    }
  },
);

dialTest(
  `Cancel folder renaming on "x"`,
  async ({
    dialHomePage,
    folderConversations,
    conversationDropdownMenu,
    chatBar,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-572');
    const newName = 'updated folder name';
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await chatBar.createNewFolder();
    await folderConversations.openFolderDropdownMenu(
      ExpectedConstants.newFolderWithIndexTitle(1),
    );
    await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
    const folderInput = await folderConversations.editFolderName(
      ExpectedConstants.newFolderWithIndexTitle(1),
      newName,
    );
    await folderInput.clickCancelButton();
    expect
      .soft(
        await folderConversations
          .getFolderByName(ExpectedConstants.newFolderWithIndexTitle(1))
          .isVisible(),
        ExpectedMessages.folderNameNotUpdated,
      )
      .toBeTruthy();
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
          .getFolderInput(folderName)
          .getComputedStyleProperty(Styles.text_overflow);
        expect
          .soft(folderInputOverflow[0], ExpectedMessages.folderNameIsTruncated)
          .toBe(Overflow.ellipsis);
      },
    );

    await dialTest.step(
      'Edit folder name using tick button and verify it is renamed',
      async () => {
        await folderConversations.editFolderNameWithTick(
          folderName,
          newConversationName,
        );
        expect
          .soft(
            await folderConversations
              .getFolderByName(newConversationName)
              .isVisible(),
            ExpectedMessages.folderNameUpdated,
          )
          .toBeTruthy();
      },
    );
  },
);
