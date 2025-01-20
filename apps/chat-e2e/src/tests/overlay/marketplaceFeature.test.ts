import { Conversation } from '@/chat/types/chat';
import dialTest from '@/src/core/dialFixtures';
import dialOverlayTest from '@/src/core/dialOverlayFixtures';
import { OverlaySandboxUrls } from '@/src/testData';

dialOverlayTest(
  '[Overlay] DIAL Marketplace feature is enabled - Feature.Marketplace.\n' +
    '[Overlay] Add app button is not available in Overlay (Mobile view)',
  async ({
    overlayHomePage,
    overlayChat,
    overlayChatHeader,
    overlayTalkToAgentDialog,
    overlayHeader,
    overlayConversations,
    overlayMarketplacePage,
    conversationData,
    overlayBaseAssertion,
    overlayTalkToAgentDialogAssertion,
    overlayDataInjector,
    overlayChatBar,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-4447', 'EPMRTC-4712');

    let conversation: Conversation;

    await dialTest.step('Create simple conversation', async () => {
      conversation = conversationData.prepareDefaultConversation();
      await overlayDataInjector.createConversations([conversation]);
    });

    await dialTest.step(
      'Verify "Dial Marketplace" button is available on the left side panel',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.enableMarketplaceUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        await overlayHeader.leftPanelToggle.click();
        await overlayBaseAssertion.assertElementState(
          overlayChatBar.dialMarketplaceLink,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Click on "Change agent" and verify there is "Search" field available',
      async () => {
        await overlayHeader.leftPanelToggle.click();
        await overlayChat.changeAgentButton.click();
        await overlayTalkToAgentDialogAssertion.assertElementState(
          overlayTalkToAgentDialog.searchAgentInput,
          'visible',
        );
        await overlayTalkToAgentDialog.cancelButton.click();
      },
    );

    await dialTest.step(
      'Select created conversation, click on model icon in the header and verify there is "Search" field available',
      async () => {
        await overlayHeader.leftPanelToggle.click();
        await overlayConversations.selectConversation(conversation.name);
        await overlayChatHeader.chatModelIcon.click();
        await overlayTalkToAgentDialogAssertion.assertElementState(
          overlayTalkToAgentDialog.searchAgentInput,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Click on "Go to my workspace" link and verify workspace page is opened, "Add app" button is not visible',
      async () => {
        await overlayTalkToAgentDialog.goToMyWorkspace();
        const marketplace = overlayMarketplacePage
          .getMarketplaceContainer()
          .getMarketplace();
        await overlayBaseAssertion.assertElementState(marketplace, 'visible');
        await overlayBaseAssertion.assertElementState(
          marketplace.getMarketplaceHeader().addAppButton,
          'hidden',
        );
      },
    );
  },
);

dialOverlayTest(
  '[Overlay] DIAL Marketplace feature is disabled - Feature.Marketplace',
  async ({
    overlayHomePage,
    overlayChat,
    overlayChatHeader,
    overlayTalkToAgentDialog,
    overlayHeader,
    overlayConversations,
    conversationData,
    overlayBaseAssertion,
    overlayTalkToAgentDialogAssertion,
    overlayDataInjector,
    overlayChatBar,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-4867');

    let conversation: Conversation;

    await dialTest.step('Create simple conversation', async () => {
      conversation = conversationData.prepareDefaultConversation();
      await overlayDataInjector.createConversations([conversation]);
    });

    await dialTest.step(
      'Verify "Dial Marketplace" button is not available on the right side panel',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.disableMarketplaceUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        await overlayHeader.leftPanelToggle.click();
        await overlayBaseAssertion.assertElementState(
          overlayChatBar.dialMarketplaceLink,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Click on "Change agent" and verify there is no "Go to My workspace" button',
      async () => {
        await overlayHeader.leftPanelToggle.click();
        await overlayChat.changeAgentButton.click();
        await overlayTalkToAgentDialogAssertion.assertElementState(
          overlayTalkToAgentDialog.goToMyWorkspaceButton,
          'hidden',
        );
        await overlayTalkToAgentDialog.cancelButton.click();
      },
    );

    await dialTest.step(
      'Select created conversation, click on model icon in the header and verify there is no "Go to My workspace" button',
      async () => {
        await overlayHeader.leftPanelToggle.click();
        await overlayConversations.selectConversation(conversation.name);
        await overlayChatHeader.chatModelIcon.click();
        await overlayTalkToAgentDialogAssertion.assertElementState(
          overlayTalkToAgentDialog.goToMyWorkspaceButton,
          'hidden',
        );
      },
    );
  },
);
