import { Conversation } from '@/chat/types/chat';
import dialOverlayTest from '@/src/core/dialOverlayFixtures';
import {
  ExpectedMessages,
  MenuOptions,
  OverlaySandboxUrls,
} from '@/src/testData';

dialOverlayTest(
  '[Overlay] enable Feature.CompareModeDisabled',
  async ({
    overlayHomePage,
    overlayHeader,
    overlayConversations,
    overlayChatHeader,
    overlayChatBar,
    overlayConversationDropdownMenu,
    overlayConversationDropdownMenuAssertion,
    overlayBaseAssertion,
    overlayDataInjector,
    conversationData,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-2329');
    let conversation: Conversation;

    await dialOverlayTest.step('Prepare a conversation via API', async () => {
      conversation = conversationData.prepareDefaultConversation();
      await overlayDataInjector.createConversations([conversation]);
    });

    await dialOverlayTest.step(
      'Open the sandbox with Feature.CompareModeDisabled enabled and select the conversation',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.enableCompareModeDisabledUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        await overlayHeader.leftPanelToggle.click();
        await overlayConversations.selectEntity(conversation.name);
      },
    );

    await dialOverlayTest.step(
      'Verify Compare icon is not available at the bottom of the Conversations panel',
      async () => {
        await overlayHeader.leftPanelToggle.click();
        await overlayBaseAssertion.assertElementState(
          overlayChatBar.compareButton,
          'hidden',
        );
      },
    );

    await dialOverlayTest.step(
      'Open the context menu for the chat on the Conversations panel and verify Compare option is not available',
      async () => {
        const conversationEntity = overlayConversations.getTreeEntity(
          conversation.name,
        );
        await conversationEntity.hover({ force: true });
        await overlayConversations
          .entityDotsMenu(conversation.name)
          .click({ force: true });
        await overlayConversationDropdownMenu.waitForState();
        await overlayConversationDropdownMenuAssertion.assertMenuExcludesOptions(
          MenuOptions.compare,
        );
        await overlayChatBar.closeButton.click();
      },
    );

    await dialOverlayTest.step(
      'Open the context menu for the chat from the chat header and verify Compare option is not available',
      async () => {
        await overlayChatHeader.dotsMenu.click();
        const chatHeaderMenuOptions =
          await overlayConversationDropdownMenu.getAllMenuOptions();
        overlayBaseAssertion.assertArrayExcludesAll(
          chatHeaderMenuOptions,
          [MenuOptions.compare],
          ExpectedMessages.contextMenuOptionsValid,
        );
      },
    );
  },
);
