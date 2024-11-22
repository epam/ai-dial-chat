import { Conversation } from '@/chat/types/chat';
import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
} from '@/src/testData';
import { Colors } from '@/src/ui/domData';
import { expect } from '@playwright/test';

dialTest(
  '[UI] Check highlight of chat1 when chat2 is opened.\n' +
    'Rename of chat1 when chat2 is opened.\n' +
    'Compare mode is opened if to click on Compare for not selected chat.\n' +
    'Replay chat1 when chat2 is opened.\n' +
    'Playback chat1 when chat2 is opened.\n' +
    'Export of chat1 when chat2 is opened.\n' +
    'Delete of chat1 when chat2 is opened.\n' +
    'Move to a folder of chat1 when chat2 is opened.\n' +
    'Duplicate of chat1 when chat2 is opened.\n' +
    'Share of chat1 when chat2 is opened',
  async ({
    dialHomePage,
    conversationData,
    dataInjector,
    conversations,
    conversationAssertion,
    setTestIds,
    compareConversation,
    confirmationDialog,
    folderConversations,
    chatBarFolderAssertion,
    shareModal,
    conversationDropdownMenu,
    downloadAssertion,
  }) => {
    setTestIds(
      'EPMRTC-934',
      'EPMRTC-935',
      'EPMRTC-936',
      'EPMRTC-937',
      'EPMRTC-3058',
      'EPMRTC-938',
      'EPMRTC-939',
      'EPMRTC-940',
      'EPMRTC-3059',
      'EPMRTC-3060',
    );
    let firstConversation: Conversation;
    let secondConversation: Conversation;
    let replayConversation: string;
    let playbackConversation: string;
    let clonedConversation: string;

    await dialTest.step('Create chat1 and chat2', async () => {
      firstConversation = conversationData.prepareDefaultConversation();
      conversationData.resetData();
      secondConversation = conversationData.prepareDefaultConversation();
      await dataInjector.createConversations([
        firstConversation,
        secondConversation,
      ]);
    });

    await dialTest.step('Open start page', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await conversations.selectConversation(secondConversation.name);
    });

    await dialTest.step('Hover over chat1', async () => {
      await conversations.getEntityByName(firstConversation.name).hover();
      await conversationAssertion.assertEntityBackgroundColor(
        { name: firstConversation.name },
        Colors.backgroundAccentSecondary,
      );
      await conversationAssertion.assertEntityDotsMenuState(
        { name: firstConversation.name },
        'visible',
      );
    });

    await dialTest.step(
      'Click on the menu and hover over any item at the bottom (e.g. Delete)',
      async () => {
        await conversations.openEntityDropdownMenu(firstConversation.name);
        await conversations
          .getDropdownMenu()
          .menuOption(MenuOptions.delete)
          .hover();
        await conversationAssertion.assertEntityBackgroundColor(
          { name: firstConversation.name },
          Colors.backgroundAccentSecondary,
        );
        await conversationAssertion.assertEntityBackgroundColor(
          { name: secondConversation.name },
          Colors.backgroundAccentSecondary,
        );
        await conversationAssertion.assertEntityDotsMenuState(
          { name: secondConversation.name },
          'hidden',
        );
      },
    );

    await dialTest.step('Click on Rename, rename and confirm', async () => {
      await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
      firstConversation.name = 'Renamed chat';
      await conversations.editConversationNameWithTick(firstConversation.name);
      await conversations.getEntityByName(firstConversation.name).waitFor();
      await conversationAssertion.assertSelectedConversation(
        secondConversation.name,
      );
      await conversationAssertion.assertEntityState(
        { name: firstConversation.name },
        'visible',
      );
    });

    await dialTest.step('Click on Compare', async () => {
      await conversations.openEntityDropdownMenu(firstConversation.name);
      await conversationDropdownMenu.selectMenuOption(MenuOptions.compare);
      await expect
        .soft(
          compareConversation.getElementLocator(),
          ExpectedMessages.conversationToCompareVisible,
        )
        .toBeVisible();
      await conversationAssertion.assertSelectedConversation(
        firstConversation.name,
      );
    });

    await dialTest.step('Click on Replay', async () => {
      replayConversation =
        ExpectedConstants.replayConversation + secondConversation.name;
      await conversations.openEntityDropdownMenu(secondConversation.name);
      await conversationDropdownMenu.selectMenuOption(MenuOptions.replay);
      await conversations.getEntityByName(replayConversation).waitFor();
      await conversationAssertion.assertSelectedConversation(
        replayConversation,
      );
    });

    await dialTest.step('Click on Playback', async () => {
      playbackConversation =
        ExpectedConstants.playbackConversation + firstConversation.name;
      await conversations.openEntityDropdownMenu(firstConversation.name);
      await conversationDropdownMenu.selectMenuOption(MenuOptions.playback);
      await conversations.getEntityByName(playbackConversation).waitFor();
      await conversationAssertion.assertSelectedConversation(
        playbackConversation,
      );
    });

    await dialTest.step('Click on Export', async () => {
      await conversations.openEntityDropdownMenu(replayConversation);
      await conversationDropdownMenu.selectMenuOption(MenuOptions.export);
      const downloadedData = await dialHomePage.downloadData(() =>
        conversationDropdownMenu.selectMenuOption(
          MenuOptions.withoutAttachments,
        ),
      );
      await downloadAssertion.assertDownloadFileExtension(
        downloadedData,
        ExpectedConstants.exportedFileExtension,
      );
      await conversationAssertion.assertSelectedConversation(
        playbackConversation,
      );
    });

    await dialTest.step(
      'Click on Delete while another chat is selected',
      async () => {
        await conversations.openEntityDropdownMenu(replayConversation);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        await conversationAssertion.assertSelectedConversation(
          playbackConversation,
        );
        await conversationAssertion.assertEntityState(
          { name: replayConversation },
          'hidden',
        );
      },
    );

    await dialTest.step('Click on "Move to -> New folder"', async () => {
      await conversations.openEntityDropdownMenu(secondConversation.name);
      await conversationDropdownMenu.selectMenuOption(MenuOptions.moveTo);
      await conversations
        .getDropdownMenu()
        .selectMenuOption(MenuOptions.newFolder);
      await conversationAssertion.assertSelectedConversation(
        playbackConversation,
      );
      await folderConversations.expandFolder(
        ExpectedConstants.newFolderWithIndexTitle(1),
      );
      await chatBarFolderAssertion.assertFolderState(
        { name: ExpectedConstants.newFolderWithIndexTitle(1) },
        'visible',
      );
      await chatBarFolderAssertion.assertFolderEntityState(
        { name: ExpectedConstants.newFolderWithIndexTitle(1) },
        { name: secondConversation.name },
        'visible',
      );
      secondConversation.folderId = `${secondConversation.folderId}/${ExpectedConstants.newFolderWithIndexTitle(1)}`;
    });

    await dialTest.step('Click on Duplicate', async () => {
      await conversations.openEntityDropdownMenu(firstConversation.name, 2);
      await conversationDropdownMenu.selectMenuOption(MenuOptions.duplicate, {
        triggeredHttpMethod: 'POST',
      });
      clonedConversation = `${firstConversation.name} 1`;
      await conversations.getEntityByName(clonedConversation).waitFor();
      await conversationAssertion.assertSelectedConversation(
        clonedConversation,
      );
    });

    await dialTest.step('Click on Share', async () => {
      await conversations.openEntityDropdownMenu(playbackConversation);
      await conversationDropdownMenu.selectMenuOption(MenuOptions.share);
      await expect
        .soft(
          shareModal.getElementLocator(),
          ExpectedMessages.modalWindowIsOpened,
        )
        .toBeVisible();
      await shareModal.closeButton.click();
      await conversationAssertion.assertSelectedConversation(
        clonedConversation,
      );
    });
  },
);
