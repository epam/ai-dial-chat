import { Conversation } from '@/chat/types/chat';
import dialTest from '@/src/core/dialFixtures';
import { MenuOptions } from '@/src/testData';
import { UploadDownloadData } from '@/src/ui/pages';

dialTest(
  'Export and import a conversation',
  async ({
    dialHomePage,
    conversations,
    conversationData,
    localStorageManager,
    dataInjector,
    chatBar,
    conversationDropdownMenu,
    confirmationDialog,
    conversationAssertion,
  }) => {
    let exportedData: UploadDownloadData;
    let conversationOutsideFolder: Conversation;

    await dialTest.step('Prepare conversation', async () => {
      conversationOutsideFolder = conversationData.prepareDefaultConversation();

      await dataInjector.createConversations([conversationOutsideFolder]);
      await localStorageManager.setSelectedConversation(
        conversationOutsideFolder,
      );
    });

    await dialTest.step(
      'Export conversation using chat bar conversation menu',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.openEntityDropdownMenu(
          conversationOutsideFolder.name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.export);
        exportedData = await dialHomePage.downloadData(() =>
          conversationDropdownMenu.selectMenuOption(
            MenuOptions.withoutAttachments,
          ),
        );
      },
    );

    await dialTest.step(
      'Delete conversation, re-import it again and verify it displayed',
      async () => {
        await conversations.openEntityDropdownMenu(
          conversationOutsideFolder.name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });

        await dialHomePage.importFile(exportedData, () =>
          chatBar.importButton.click(),
        );
        await conversationAssertion.assertEntityState(
          { name: conversationOutsideFolder.name },
          'visible',
        );
      },
    );
  },
);
