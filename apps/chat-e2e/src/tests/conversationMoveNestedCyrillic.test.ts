import { Conversation } from '@/chat/types/chat';
import { FolderInterface } from '@/chat/types/folder';
import dialTest from '@/src/core/dialFixtures';
import { API, CollapsedSections, MenuOptions } from '@/src/testData';

const nestedLevels = 4;
const cyrillicFolderNames: Record<number, string> = {
  1: 'Кириллица Уровень 1',
  2: 'Кириллица Уровень 2',
  3: 'Кириллица Уровень 3',
  4: 'Кириллица Уровень 4',
};

dialTest(
  'Move to: conversation can be moved into 4-level nested folder with Cyrillic names',
  async ({
    page,
    dialHomePage,
    conversationData,
    dataInjector,
    localStorageManager,
    conversations,
    conversationDropdownMenu,
    selectFolderModal,
    selectFolderModalAssertion,
    selectFolders,
    folderConversations,
    chatBarFolderAssertion,
    conversationAssertion,
  }) => {
    let nestedFolders: FolderInterface[];
    let conversationToMove: Conversation;

    await dialTest.step(
      'Prepare root conversation and 4-level Cyrillic folder hierarchy',
      async () => {
        nestedFolders = conversationData.prepareNestedFolder(
          nestedLevels,
          cyrillicFolderNames,
        );
        conversationToMove = conversationData.prepareDefaultConversation(
          undefined,
          'Move to Cyrillic nested folder',
        );

        await dataInjector.createConversations(
          [conversationToMove],
          ...nestedFolders,
        );
        await localStorageManager.setChatCollapsedSection(
          CollapsedSections.Organization,
          CollapsedSections.SharedWithMe,
        );
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step('Move conversation via Move to modal', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();

      await conversations.openEntityDropdownMenu(conversationToMove.name);
      await conversationDropdownMenu.selectMenuOption(MenuOptions.moveTo);
      await selectFolderModalAssertion.assertElementState(
        selectFolderModal,
        'visible',
      );

      for (const nestedFolder of nestedFolders.slice(0, -1)) {
        await selectFolders.expandFolder(nestedFolder.name);
      }

      const destinationFolder = nestedFolders[nestedFolders.length - 1];
      await selectFolderModal.selectFolder(destinationFolder.name);

      const moveResponse = page.waitForResponse(
        (resp) =>
          resp.url().includes(API.moveHost) &&
          resp.request().method() === 'POST' &&
          resp.status() === 200,
      );
      await selectFolderModal.clickSelectFolderButton();
      await moveResponse;
      await selectFolderModalAssertion.assertElementState(
        selectFolderModal,
        'hidden',
      );
    });

    await dialTest.step(
      'Verify conversation is no longer in root and appears in level 4 folder',
      async () => {
        await conversationAssertion.assertEntityState(
          { name: conversationToMove.name },
          'hidden',
        );

        for (const nestedFolder of nestedFolders.slice(0, -1)) {
          await folderConversations.expandFolder(nestedFolder.name);
        }

        await chatBarFolderAssertion.assertFolderEntityState(
          { name: nestedFolders[nestedFolders.length - 1].name },
          { name: conversationToMove.name },
          'visible',
        );
      },
    );
  },
);
