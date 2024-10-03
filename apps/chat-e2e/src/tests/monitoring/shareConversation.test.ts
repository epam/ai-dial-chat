import { Conversation } from '@/chat/types/chat';
import { ShareByLinkResponseModel } from '@/chat/types/share';
import dialTest from '@/src/core/dialFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import { ExpectedConstants, ExpectedMessages } from '@/src/testData';
import { expect } from '@playwright/test';

dialSharedWithMeTest(
  'Share single chat in Today section',
  async ({
    additionalShareUserDialHomePage,
    additionalShareUserSharedWithMeConversations,
    conversationData,
    dataInjector,
    localStorageManager,
    dialHomePage,
    conversations,
    conversationDropdownMenu,
    shareModal,
    shareModalAssertion,
  }) => {
    let conversation: Conversation;
    let shareByLinkResponse: ShareByLinkResponseModel;

    await dialTest.step('Prepare default conversation', async () => {
      conversation = conversationData.prepareDefaultConversation();
      await dataInjector.createConversations([conversation]);
      await localStorageManager.setSelectedConversation(conversation);
    });

    await dialTest.step(
      'Open conversation dropdown menu and choose "Share" option and verify modal window text',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.openEntityDropdownMenu(conversation.name);
        const firstShareRequestResponse =
          await conversationDropdownMenu.selectShareMenuOption();
        shareByLinkResponse = firstShareRequestResponse!.response;
        await shareModal.linkInputLoader.waitForState({ state: 'hidden' });
        await shareModalAssertion.assertMessageContent(
          ExpectedConstants.shareConversationText,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Open share link by another user and verify chat stays under Shared with me and is selected automatically',
      async () => {
        await additionalShareUserDialHomePage.navigateToUrl(
          ExpectedConstants.sharedConversationUrl(
            shareByLinkResponse.invitationLink,
          ),
        );
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await expect
          .soft(
            additionalShareUserSharedWithMeConversations.selectedConversation(
              conversation.name,
            ),
            ExpectedMessages.conversationIsVisible,
          )
          .toBeVisible();
      },
    );
  },
);
