import dialTest from '@/src/core/dialFixtures';
import {ExpectedConstants, ExpectedMessages, MenuOptions} from '@/src/testData';
import {Colors} from '@/src/ui/domData';
import {Conversation} from "@/chat/types/chat";
import { expect } from '@playwright/test';

dialTest.only(
  '[UI] Check highlight of chat1 when chat2 is opened.\n' +
  'Rename of chat1 when chat2 is opened.\n' +
  'Compare mode is opened if to click on Compare for not selected chat.\n' +
  'Replay chat1 when chat2 is opened.\n' +
  'Playback chat1 when chat2 is opened',
  async ({
           dialHomePage,
           conversationData,
           dataInjector,
           conversations,
           conversationAssertion,
           setTestIds,
           localStorageManager,
           compareConversation,
         }) => {
    setTestIds('EPMRTC-934', 'EPMRTC-935', 'EPMRTC-936', 'EPMRTC-937', 'EPMRTC-3058');
    let firstConversation: Conversation;
    let secondConversation: Conversation;
    let replayConversation: string;
    let playbackConversation: string;

    await dialTest.step('Create chat1 and chat2', async () => {
      firstConversation = conversationData.prepareDefaultConversation();
      conversationData.resetData();
      secondConversation = conversationData.prepareDefaultConversation();
      await dataInjector.createConversations([
        firstConversation,
        secondConversation,
      ]);
      await localStorageManager.setSelectedConversation(
        secondConversation
      );
    });

    await dialTest.step(
      'Click on chat2 -> its history is opened on the central part of the screen',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
      },
    );

    await dialTest.step('Hover over chat1', async () => {
      await conversations.getEntityByName(firstConversation.name).hover();
      await conversationAssertion.assertEntityBackgroundColor(
        {name: firstConversation.name},
        Colors.backgroundAccentSecondary,
      );
      await conversationAssertion.assertEntityDotsMenuState(
        {name: firstConversation.name},
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
          {name: firstConversation.name},
          Colors.backgroundAccentSecondary,
        );
        await conversationAssertion.assertEntityBackgroundColor(
          {name: secondConversation.name},
          Colors.backgroundAccentSecondary,
        );
        await conversationAssertion.assertEntityDotsMenuState(
          {name: secondConversation.name},
          'hidden',
        );
      },
    );

    await dialTest.step('Click on Rename, rename and confirm', async () => {
      await conversations
        .getDropdownMenu()
        .selectMenuOption(MenuOptions.rename);
      firstConversation.name = 'Renamed chat';
      await conversations.editConversationNameWithTick(firstConversation.name);
      await conversations.getEntityByName(firstConversation.name).waitFor();
      await conversationAssertion.assertSelectedConversation(
        secondConversation.name,
      );
      await conversationAssertion.assertEntityState(
        {name: firstConversation.name},
        'visible',
      );
    });

    await dialTest.step('Click on Compare', async () => {
      await conversations.openEntityDropdownMenu(firstConversation.name);
      await conversations
        .getDropdownMenu()
        .selectMenuOption(MenuOptions.compare);
      await conversationAssertion.assertSelectedConversation(
        firstConversation.name,
      );
      await expect
        .soft(
          compareConversation.getElementLocator(),
          ExpectedMessages.conversationToCompareVisible,
        )
        .toBeVisible();
    });

    await dialTest.step('Click on Replay', async () => {
      replayConversation = ExpectedConstants.replayConversation + secondConversation.name;
      await conversations.openEntityDropdownMenu(secondConversation.name);
      await conversations
        .getDropdownMenu()
        .selectMenuOption(MenuOptions.replay);
      await conversations.getEntityByName(replayConversation).waitFor();
      await conversationAssertion.assertSelectedConversation(
        replayConversation,
      );
    });

    await dialTest.step('Click on Playback', async () => {
      playbackConversation = ExpectedConstants.playbackConversation + firstConversation.name;
      await conversations.openEntityDropdownMenu(firstConversation.name);
      await conversations
        .getDropdownMenu()
        .selectMenuOption(MenuOptions.playback);
      await conversations.getEntityByName(playbackConversation).waitFor();
      await conversationAssertion.assertSelectedConversation(
        playbackConversation,
      );
    });
  },
);
