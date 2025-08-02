import { Conversation } from '@/chat/types/chat';
import { ShareByLinkResponseModel } from '@/chat/types/share';
import dialTest from '@/src/core/dialFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import { ExpectedConstants } from '@/src/testData';

dialSharedWithMeTest(
  'Share single chat in Today section',
  async ({
    additionalShareUserDialHomePage,
    additionalShareUserSharedWithMeConversationAssertion,
    conversationData,
    dataInjector,
    dialHomePage,
    conversations,
    conversationDropdownMenu,
    shareModal,
    shareModalAssertion,
    localStorageManager,
    additionalShareUserLocalStorageManager,
  }) => {
    let conversation: Conversation;
    let shareByLinkResponse: ShareByLinkResponseModel;

    await dialTest.step('Prepare default conversation', async () => {
      conversation = conversationData.prepareDefaultConversation();
      await dataInjector.createConversations([conversation]);
      await localStorageManager.setShowSideBarPanels();
    });

    await dialTest.step(
      'Open conversation dropdown menu and choose "Share" option and verify modal window text',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(conversation.name);
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
        await additionalShareUserLocalStorageManager.setShowSideBarPanels();
        await additionalShareUserDialHomePage.navigateToUrl(
          ExpectedConstants.sharedConversationUrl(
            shareByLinkResponse.invitationLink,
          ),
        );
        await additionalShareUserDialHomePage.waitForPageLoaded({
          selectedSharedConversationName: conversation.name,
        });
        await additionalShareUserSharedWithMeConversationAssertion.assertEntityState(
          { name: conversation.name },
          'visible',
        );
        await additionalShareUserSharedWithMeConversationAssertion.assertSelectedEntity(
          conversation.name,
        );
      },
    );
  },
);
