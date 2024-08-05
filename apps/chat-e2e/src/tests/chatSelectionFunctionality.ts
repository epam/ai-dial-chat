import dialTest from '@/src/core/dialFixtures';
import {ExpectedMessages, MenuOptions} from '@/src/testData';
import {Colors} from '@/src/ui/domData';
import {Conversation} from "@/chat/types/chat";

dialTest.only(
  '[UI] Check highlight of chat1 when chat2 is opened',
  async ({
           dialHomePage,
           conversationData,
           dataInjector,
           conversations,
           conversationAssertion,
           setTestIds,
           localStorageManager,
         }) => {
    setTestIds('EPMRTC-934');
    let firstConversation: Conversation;
    let secondConversation: Conversation;

    await dialTest.step('Create chat1 and chat2', async () => {
      firstConversation = conversationData.prepareDefaultConversation();
      conversationData.resetData();
      secondConversation = conversationData.prepareDefaultConversation();
      await dataInjector.createConversations([
        firstConversation,
        secondConversation,
      ]);
      await localStorageManager.setSelectedConversation(
        firstConversation
      );
    });

    await dialTest.step(
      'Click on chat2 -> its history is opened on the central part of the screen',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(secondConversation.name);
        await conversationAssertion.assertSelectedConversation(
          secondConversation.name,
        );
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
  },
);
