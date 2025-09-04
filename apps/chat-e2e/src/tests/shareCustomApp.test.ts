import { DialAIEntityModel } from '@/chat/types/models';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import {
  API,
  CheckboxState,
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
} from '@/src/testData';
import { BaseElement } from '@/src/ui/webElements';
import { UserUtil } from '@/src/utils';
import { Conversation } from '@epam/ai-dial-shared';

let appEntity: DialAIEntityModel;

dialSharedWithMeTest(
  'Sharing custom app without editing permissions via context menu in DIAL Marketplace.\n' +
    'Share pop up: Message about not shared yet app for not shared app.\n' +
    `[Custom app] App's card pop-up open when receive sharing link for app.\n` +
    'Shared with me apps displayed on My workspace page by default.\n' +
    '[Sharing app]: Shared with me apps do not have bookmark icon.\n' +
    'Icon for shared apps on card list view.\n' +
    'Icon for shared apps on card pop-up.\n' +
    'Remove access for custom app by author via link on Share pop-up',
  async (
    {
      marketplacePage,
      marketplaceHeader,
      marketplaceAgentsSection,
      marketplaceAgents,
      marketplaceAgentsAssertion,
      agentDetailsModal,
      agentDetailsModalAssertion,
      shareAppModal,
      confirmationDialog,
      confirmationDialogAssertion,
      tooltip,
      tooltipAssertion,
      shareModalAssertion,
      marketplaceUrlBuilder,
      setTestIds,
      customApplicationPublishingUtil,
      additionalShareUserMarketplacePage,
      additionalShareUserMarketplace,
      additionalShareUserAgentDetailsModal,
      additionalShareUserAgentDetailsModalAssertion,
      additionalShareUserPage,
      additionalShareUserMarketplaceHeader,
      additionalShareUserMarketplaceAgentsSection,
      additionalShareUserMarketplaceAgents,
      additionalShareUserNavigationPanel,
      additionalShareUserMarketplaceAgentsAssertion,
      baseAssertion,
      modelApiHelper,
    },
    testInfo,
  ) => {
    setTestIds(
      'EPMRTC-5170',
      'EPMRTC-5197',
      'EPMRTC-5316',
      'EPMRTC-5192',
      'EPMRTC-5229',
      'EPMRTC-5180',
      'EPMRTC-5181',
      'EPMRTC-5190',
    );
    let agentElement: BaseElement;

    await dialSharedWithMeTest.step('Create a custom app via API', async () => {
      const appData = await customApplicationPublishingUtil.createCustomApp();
      appEntity = {
        name: appData.name,
        version: appData.version,
        reference: appData.reference,
      } as DialAIEntityModel;
    });

    await dialSharedWithMeTest.step(
      'Find created app on "DIAL Marketplace", open card dropdown menu and select "Share" option',
      async () => {
        await marketplacePage.openMarketplacePage();
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.searchInput.fillInInput(appEntity.name);
        agentElement = await marketplaceAgentsSection.findAgentElement(
          appEntity,
          { isWorkspaceAgent: true, isEditable: true },
        );
        await agentElement.hoverOver();
        await marketplaceAgents.getAgentElementDotsMenu(agentElement).click();
        await marketplaceAgents.getAgentDropdownMenu().selectShareMenuOption();
      },
    );

    await dialSharedWithMeTest.step(
      'Verify Share modal with valid attributes is opened',
      async () => {
        await shareModalAssertion.assertModalState('visible');
        await shareModalAssertion.assertElementText(
          shareAppModal.entityName,
          ExpectedConstants.sharedEntityName(appEntity.name),
        );
        await shareModalAssertion.assertElementText(
          shareAppModal.appVersion,
          ExpectedConstants.versionPrefix + appEntity.version!,
        );
        await shareModalAssertion.assertMessageContent([
          ExpectedConstants.shareLinkText,
          ExpectedConstants.shareAppText,
        ]);
        await shareModalAssertion.assertCheckboxState(
          shareAppModal.shareOptionCheckbox,
          CheckboxState.unchecked,
        );
        await shareModalAssertion.assertElementText(
          shareAppModal.shareOption,
          ExpectedConstants.allowEditingSharedEntityText,
        );
        await shareModalAssertion.assertElementState(
          shareAppModal.shareQrCode,
          'visible',
        );
        await shareModalAssertion.assertElementState(
          shareAppModal.shareLinkInput,
          'visible',
        );
        await shareModalAssertion.assertElementState(
          shareAppModal.copyLinkButton,
          'visible',
        );
        await shareModalAssertion.assertElementText(
          shareAppModal.notSharedEntityLabel,
          ExpectedConstants.notSharedAppText,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Click on Copy icon, navigate to the copied url by another user and verify Marketplace page with opened app card is opened',
      async () => {
        await shareAppModal.copyLinkButton.click();
        await shareAppModal.closeButton.click();
        const shareLink = await marketplacePage.readTextFromClipboard();
        await additionalShareUserMarketplacePage.navigateToUrl(shareLink);
        await additionalShareUserMarketplacePage.waitForPageLoaded();
        await additionalShareUserAgentDetailsModalAssertion.assertElementState(
          additionalShareUserAgentDetailsModal,
          'visible',
        );
        const expectedUrl = marketplaceUrlBuilder
          .withModel(appEntity.reference)
          .build();
        baseAssertion.assertValue(additionalShareUserPage.url(), expectedUrl);
      },
    );

    await dialSharedWithMeTest.step('Verify app card attributes', async () => {
      await additionalShareUserAgentDetailsModalAssertion.assertApplicationName(
        appEntity.name,
      );
      await additionalShareUserAgentDetailsModalAssertion.assertEntityIcon(
        additionalShareUserAgentDetailsModal.icon,
        API.defaultModelIconHost(),
      );
      await additionalShareUserAgentDetailsModalAssertion.assertElementState(
        additionalShareUserAgentDetailsModal.applicationDescription,
        'hidden',
      );
      await additionalShareUserAgentDetailsModalAssertion.assertApplicationAuthor(
        UserUtil.getE2EUser(testInfo.parallelIndex),
      );
      const configApp = await modelApiHelper.getAgentByNameAndVersion({
        name: appEntity.name,
        version: appEntity.version,
      });
      await additionalShareUserAgentDetailsModalAssertion.assertApplicationReleaseDate(
        configApp.createdAt!,
      );
      await additionalShareUserAgentDetailsModalAssertion.assertApplicationVersion(
        appEntity.version!,
      );
      await additionalShareUserAgentDetailsModalAssertion.assertElementState(
        additionalShareUserAgentDetailsModal.shareButton,
        'hidden',
      );
      await additionalShareUserAgentDetailsModalAssertion.assertElementState(
        additionalShareUserAgentDetailsModal.unshareButton,
        'visible',
      );
    });

    await dialSharedWithMeTest.step(
      'Close the modal and verify app is listed, no bookmark icon is available on the card',
      async () => {
        await additionalShareUserAgentDetailsModal.closeButton.click();
        await additionalShareUserMarketplaceHeader.searchInput.fillInInput(
          appEntity.name,
        );
        const sharedAgentElement =
          await additionalShareUserMarketplaceAgentsSection.findAgentElement(
            appEntity,
            { isWorkspaceAgent: true, isEditable: false },
          );
        await additionalShareUserMarketplaceAgentsAssertion.assertElementState(
          sharedAgentElement,
          'visible',
        );
        await additionalShareUserMarketplaceAgentsAssertion.assertElementState(
          additionalShareUserMarketplaceAgents.getAgentElementAddBookmarkIcon(
            sharedAgentElement,
          ),
          'hidden',
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Open "My Workspace" tab and verify the app card is listed',
      async () => {
        await additionalShareUserNavigationPanel.goToMyWorkspace();
        await additionalShareUserMarketplacePage.waitForPageLoaded();
        const sharedAgentElement =
          await additionalShareUserMarketplaceAgentsSection.findAgentElement(
            appEntity,
            { isWorkspaceAgent: true, isEditable: false },
          );
        await baseAssertion.assertElementState(sharedAgentElement, 'visible');
      },
    );

    await dialSharedWithMeTest.step(
      'Refresh the page by the main user and verify the arrow icon is displayed on the app card',
      async () => {
        await marketplacePage.reloadPage();
        await marketplacePage.waitForPageLoaded();
        agentElement = await marketplaceAgentsSection.findAgentElement(
          appEntity,
          { isWorkspaceAgent: true, isEditable: false },
        );
        const agentArrowIconElement =
          marketplaceAgents.getAgentArrowIcon(agentElement);
        await marketplaceAgentsAssertion.assertElementState(
          agentArrowIconElement,
          'visible',
        );
        await agentArrowIconElement.hoverOver();
        await tooltipAssertion.assertElementText(
          tooltip,
          ExpectedConstants.sharedEntityTooltip,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Open app details modal and verify the arrow icon is displayed',
      async () => {
        await agentElement.click();
        await agentDetailsModalAssertion.assertElementState(
          agentDetailsModal.arrowIcon,
          'visible',
        );
        await agentDetailsModal.arrowIcon.hoverOver();
        await tooltipAssertion.assertElementText(
          tooltip,
          ExpectedConstants.sharedEntityTooltip,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Open Share modal again, click on "Remove access for all users" btn and verify confirmation popup is displayed',
      async () => {
        await agentDetailsModal.clickShareButton();
        await shareModalAssertion.assertModalState('visible');
        await shareAppModal.removeAccessBtn.click();
        await confirmationDialogAssertion.assertElementState(
          confirmationDialog,
          'visible',
        );
        await confirmationDialogAssertion.assertConfirmationDialogTitle(
          ExpectedConstants.removeAccessTitle,
        );
        await confirmationDialogAssertion.assertConfirmationMessage(
          ExpectedConstants.removeAccessForAllMessage(appEntity.name),
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Confirm access removing and verify arrow icon disappears from the card',
      async () => {
        await confirmationDialog.confirm({ triggeredHttpMethod: 'POST' });
        await marketplaceAgentsAssertion.assertElementState(
          marketplaceAgents.getAgentArrowIcon(agentElement),
          'hidden',
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Refresh the page by additional user and the app is not found',
      async () => {
        await additionalShareUserMarketplacePage.reloadPage();
        await additionalShareUserMarketplacePage.waitForPageLoaded();
        await baseAssertion.assertElementState(
          additionalShareUserMarketplace.noResultsFound,
          'visible',
        );
      },
    );
  },
);

dialSharedWithMeTest(
  'Sharing custom app with editing permissions for other users.\n' +
    `Sharing custom app without editing permissions via share icon on app's card pop-up in DIAL Marketplace.\n` +
    `[Custom app] App's card pop-up open when receive sharing link for app.\n` +
    '[Custom app]:Context menu for shared with me app with edit option.\n' +
    'Error message for chat when unshare custom app used in chat',
  async ({
    marketplacePage,
    marketplaceHeader,
    marketplaceAgentsSection,
    agentDetailsModal,
    shareAppModal,
    shareModalAssertion,
    marketplaceUrlBuilder,
    setTestIds,
    customApplicationPublishingUtil,
    additionalShareUserDialHomePage,
    additionalShareUserMarketplacePage,
    additionalShareUserNavigationPanel,
    additionalShareUserAgentDetailsModal,
    additionalShareUserAgentDetailsModalAssertion,
    additionalShareUserPage,
    additionalShareUserMarketplaceHeader,
    additionalShareUserMarketplaceAgentsSection,
    additionalShareUserMarketplaceAgents,
    additionalShareUserMarketplaceAgentsAssertion,
    baseAssertion,
    conversationData,
    additionalShareUserDataInjector,
    additionalShareUserLocalStorageManager,
    additionalShareUserConversations,
    additionalShareUserChatHeader,
    additionalShareUserTalkToAgentDialog,
    additionalShareUserConfirmationDialog,
    additionalShareUserConfirmationDialogAssertion,
    additionalShareUserTalkToAgents,
    additionalShareUserTalkToAgentDialogAssertion,
    additionalShareUserChatAssertion,
  }) => {
    setTestIds(
      'EPMRTC-5171',
      'EPMRTC-5184',
      'EPMRTC-5316',
      'EPMRTC-5198',
      'EPMRTC-5280',
    );
    let agentElement: BaseElement;
    let conversation: Conversation;
    let notAvailableAgentElement: BaseElement;

    await dialSharedWithMeTest.step('Create a custom app via API', async () => {
      const appData = await customApplicationPublishingUtil.createCustomApp();
      appEntity = {
        name: appData.name,
        version: appData.version,
        reference: appData.reference,
      } as DialAIEntityModel;
    });

    await dialSharedWithMeTest.step(
      'Find created app on "DIAL Marketplace", open the card, click on "Share" btn and verify Share modal is displayed',
      async () => {
        await marketplacePage.openMarketplacePage();
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.searchInput.fillInInput(appEntity.name);
        agentElement = await marketplaceAgentsSection.findAgentElement(
          appEntity,
          { isWorkspaceAgent: true, isEditable: true },
        );
        await agentElement.click();
        await agentDetailsModal.clickShareButton();
        await shareModalAssertion.assertModalState('visible');
      },
    );

    await dialSharedWithMeTest.step(
      'Check "Allow editing by other users" checkbox, click on Copy icon, navigate to the copied url by another user and verify the app card is opened',
      async () => {
        await shareAppModal.checkAllowEditingByOtherUsers();
        await shareAppModal.copyLinkButton.click();
        const shareLink = await marketplacePage.readTextFromClipboard();

        await additionalShareUserLocalStorageManager.setShowSideBarPanels();
        await additionalShareUserLocalStorageManager.setRecentModelsIdsAndUseLastModel(
          appEntity,
        );
        await additionalShareUserMarketplacePage.navigateToUrl(shareLink);
        await additionalShareUserMarketplacePage.waitForPageLoaded();
        await additionalShareUserAgentDetailsModalAssertion.assertElementState(
          additionalShareUserAgentDetailsModal,
          'visible',
        );
        const expectedUrl = marketplaceUrlBuilder
          .withModel(appEntity.reference)
          .build();
        baseAssertion.assertValue(additionalShareUserPage.url(), expectedUrl);
      },
    );

    await dialSharedWithMeTest.step(
      'Verify Unshare and Edit icons are available on the app card',
      async () => {
        await additionalShareUserAgentDetailsModalAssertion.assertElementState(
          additionalShareUserAgentDetailsModal.unshareButton,
          'visible',
        );
        await additionalShareUserAgentDetailsModalAssertion.assertElementState(
          additionalShareUserAgentDetailsModal.editButton,
          'visible',
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Close the agent details modal and verify app card dropdown menu options',
      async () => {
        await additionalShareUserAgentDetailsModal.closeButton.click();
        await additionalShareUserMarketplaceHeader.searchInput.fillInInput(
          appEntity.name,
        );
        const sharedAgentElement =
          await additionalShareUserMarketplaceAgentsSection.findAgentElement(
            appEntity,
            { isWorkspaceAgent: true, isEditable: true },
          );
        await sharedAgentElement.hoverOver();
        await additionalShareUserMarketplaceAgents
          .getAgentElementDotsMenu(sharedAgentElement)
          .click();
        additionalShareUserMarketplaceAgentsAssertion.assertArrayIncludesAll(
          await additionalShareUserMarketplaceAgents
            .getAgentDropdownMenu()
            .getAllMenuOptions(),
          [MenuOptions.edit, MenuOptions.unshare],
          ExpectedMessages.contextMenuOptionsValid,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Create conversation with shared app via API',
      async () => {
        conversation = conversationData.prepareDefaultConversation(appEntity);
        await additionalShareUserDataInjector.createConversations([
          conversation,
        ]);
      },
    );

    await dialSharedWithMeTest.step(
      'Navigate to the chat screen, select created conversation and click on app icon in the chat header',
      async () => {
        await additionalShareUserNavigationPanel.backToChat();
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await additionalShareUserConversations.selectEntity(conversation.name);
        await additionalShareUserChatHeader.chatModelIcon.click();
      },
    );

    await dialSharedWithMeTest.step(
      'Find shared agent, select Unshare option from the dropdown menu and verify confirmation popup is displayed',
      async () => {
        const sharedAppElement =
          await additionalShareUserTalkToAgentDialog.findAgent(appEntity);
        const agentDropdownMenu =
          await additionalShareUserTalkToAgentDialog.openAgentDotsMenu(
            sharedAppElement!,
          );
        await agentDropdownMenu.selectMenuOption(MenuOptions.unshare);
        await additionalShareUserConfirmationDialogAssertion.assertElementState(
          additionalShareUserConfirmationDialog,
          'visible',
        );
        await additionalShareUserConfirmationDialogAssertion.assertConfirmationDialogTitle(
          ExpectedConstants.removeAccessTitle,
        );
        await additionalShareUserConfirmationDialogAssertion.assertConfirmationMessage(
          ExpectedConstants.removeYourAccessMessage(appEntity.name),
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Confirm unsharing and verify unshared app is displayed with reference and error description',
      async () => {
        await additionalShareUserConfirmationDialog.confirm({
          triggeredHttpMethod: 'PUT',
        });
        await additionalShareUserConfirmationDialogAssertion.assertElementState(
          additionalShareUserConfirmationDialog,
          'hidden',
        );
        notAvailableAgentElement =
          additionalShareUserTalkToAgents.getNotAvailableAgentElement(
            appEntity.reference,
          );
        await additionalShareUserTalkToAgentDialogAssertion.assertElementText(
          additionalShareUserTalkToAgents.getAgentDescription(
            notAvailableAgentElement,
          ),
          ExpectedConstants.notAllowedModelError,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Click on not available app card and verify error message is displayed instead of send message input',
      async () => {
        await notAvailableAgentElement.click();
        await additionalShareUserChatAssertion.assertNotAllowedModelLabelContent(
          appEntity.reference,
        );
      },
    );
  },
);
