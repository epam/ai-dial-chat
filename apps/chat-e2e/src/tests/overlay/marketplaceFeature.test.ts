import { Conversation } from '@/chat/types/chat';
import dialTest from '@/src/core/dialFixtures';
import dialOverlayTest from '@/src/core/dialOverlayFixtures';
import { OverlaySandboxUrls } from '@/src/testData';

dialOverlayTest(
  '[Overlay] Navigation panel. There is no text-names for buttons. The hight of the panel is 36px.\n' +
    '[Overlay] DIAL Marketplace feature is enabled - Feature.Marketplace.\n' +
    '[Overlay] Add app button is not available in Overlay (Mobile view).\n' +
    '[Overlay] Add app button on My workspace is unavailable even though all the features for apps creation is on',
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
    overlayNavigationPanel,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-6031', 'EPMRTC-4447', 'EPMRTC-4712', 'EPMRTC-5782');

    let conversation: Conversation;

    await dialTest.step('Create simple conversation', async () => {
      conversation = conversationData.prepareDefaultConversation();
      await overlayDataInjector.createConversations([conversation]);
    });

    await dialTest.step(
      'Verify "Dial Marketplace" buttons are available at the bottom panel, buttons do not have titles',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.enableMarketplaceUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        for (const button of [
          overlayNavigationPanel.marketplaceHomeButton,
          overlayNavigationPanel.myWorkspaceButton,
          overlayNavigationPanel.backToChatButton,
        ]) {
          await overlayBaseAssertion.assertElementState(button, 'visible');
          await overlayBaseAssertion.assertElementState(
            overlayNavigationPanel.buttonLabel(button),
            'hidden',
          );
        }
      },
    );

    await dialTest.step(
      'Click on "Change agent" and verify there is "Search" field available',
      async () => {
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
      'Click on "Go to my workspace" link and verify workspace page is opened, "Add app" button is visible',
      async () => {
        await overlayTalkToAgentDialog.goToMyWorkspace();
        const marketplace = overlayMarketplacePage
          .getMarketplaceContainer()
          .getMarketplace();
        await overlayBaseAssertion.assertElementState(marketplace, 'visible');
        await overlayBaseAssertion.assertElementState(
          marketplace.getMarketplaceHeader().addAppButton,
          'visible',
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
    overlayTalkToAgentDialogAssertion,
    overlayDataInjector,
    overlayNavigationPanel,
    overlayBaseAssertion,
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
        await overlayBaseAssertion.assertElementState(
          overlayNavigationPanel.marketplaceHomeButton,
          'hidden',
        );
        await overlayBaseAssertion.assertElementState(
          overlayNavigationPanel.myWorkspaceButton,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Click on "Change agent" and verify there is no "Go to My workspace" button',
      async () => {
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
