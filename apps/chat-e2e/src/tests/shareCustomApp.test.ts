import { ShareByLinkResponseModel } from '@/chat/types/share';
import { FileType } from '@/src/assertions';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import {
  API,
  CheckboxState,
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
} from '@/src/testData';
import { BaseElement, FileModalSection } from '@/src/ui/webElements';
import { UserUtil } from '@/src/utils';
import { CustomAppAttributes } from '@/src/utils/customApplicationPublishingUtil';
import { Conversation } from '@epam/ai-dial-shared';

let appData: CustomAppAttributes;
const getIconName = (iconUrl: string) =>
  iconUrl.substring(iconUrl.lastIndexOf('/') + 1);

dialSharedWithMeTest(
  'Sharing custom app without editing permissions via context menu in DIAL Marketplace.\n' +
    'Share custom application via QR code without edit rights.\n' +
    'Share pop up: Message about not shared yet app for not shared app.\n' +
    `[Custom app] App's card pop-up open when receive sharing link for app.\n` +
    'Shared with me apps displayed on My workspace page by default.\n' +
    '[Sharing app]: Shared with me apps do not have bookmark icon.\n' +
    'Icon for shared apps on card list view.\n' +
    'Icon for shared apps on card pop-up.\n' +
    'Icon files for shared applications displayed in Manage Attachments.\n' +
    'Download option for Icon file from shared apps in Shared with me section in Manage attachments.\n' +
    'Icons from shared app displayed in Manage attachments (sharing without edit permissions).\n' +
    'Remove access for custom app by author via link on Share pop-up.\n' +
    'Share pop up: Message about not shared yet app for app unshared by author.\n' +
    'Icon file stay in Manage attachments if author revoke sharing access to app',
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
      shareAppModalAssertion,
      marketplaceUrlBuilder,
      setTestIds,
      customApplicationPublishingUtil,
      additionalShareUserLocalStorageManager,
      additionalShareUserMarketplacePage,
      additionalShareUserDialHomePage,
      additionalShareUserMarketplace,
      additionalShareUserAgentDetailsModal,
      additionalShareUserAgentDetailsModalAssertion,
      additionalShareUserPage,
      additionalShareUserMarketplaceHeader,
      additionalShareUserMarketplaceAgentsSection,
      additionalShareUserMarketplaceAgents,
      additionalShareUserNavigationPanel,
      additionalShareUserChatBar,
      additionalShareUserAttachFilesModal,
      additionalShareUserManageAttachmentsAssertion,
      additionalShareUserMarketplaceAgentsAssertion,
      baseAssertion,
      downloadAssertion,
      modelApiHelper,
    },
    testInfo,
  ) => {
    setTestIds(
      'EPMRTC-5170',
      'EPMRTC-6057',
      'EPMRTC-5197',
      'EPMRTC-5316',
      'EPMRTC-5192',
      'EPMRTC-5229',
      'EPMRTC-5180',
      'EPMRTC-5181',
      'EPMRTC-5364',
      'EPMRTC-6025',
      'EPMRTC-5329',
      'EPMRTC-5190',
      'EPMRTC-5201',
      'EPMRTC-5366',
    );
    let agentElement: BaseElement;
    let iconName: string;
    let shareLinkResponse: ShareByLinkResponseModel;

    await dialSharedWithMeTest.step(
      'Create a custom app with icon via API',
      async () => {
        appData = await customApplicationPublishingUtil.createCustomApp({
          hasIcon: true,
        });
        iconName = getIconName(appData.iconUrl!);
        await additionalShareUserLocalStorageManager.setShowSideBarPanels();
      },
    );

    await dialSharedWithMeTest.step(
      'Find created app on "DIAL Marketplace", open card dropdown menu and select "Share" option',
      async () => {
        await marketplacePage.openMarketplacePage();
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.searchInput.fillInInput(appData.name);
        agentElement = await marketplaceAgentsSection.findAgentElement(
          appData,
          { isWorkspaceAgent: true, isEditable: true },
        );
        await agentElement.hoverOver();
        await marketplaceAgents.getAgentElementDotsMenu(agentElement).click();
        const shareLinkRequestResponse = await marketplaceAgents
          .getAgentDropdownMenu()
          .selectShareMenuOption();
        shareLinkResponse = shareLinkRequestResponse!.response;
      },
    );

    await dialSharedWithMeTest.step(
      'Verify Share modal with valid attributes is opened',
      async () => {
        await shareAppModalAssertion.assertModalState('visible');
        await shareAppModalAssertion.assertGeneralInfo({
          entityName: appData.name,
          expectedMessages: [
            ExpectedConstants.shareLinkText,
            ExpectedConstants.shareAppText,
          ],
          qrCodeState: 'visible',
          qrCodeLink: ExpectedConstants.sharedAppUrl(
            shareLinkResponse.invitationLink,
          ),
          shareLinkInput: 'visible',
          copyLinkButton: 'visible',
          notSharedEntityLabel: ExpectedConstants.notSharedAppText,
        });
        await shareAppModalAssertion.assertShareAppInfo({
          appVersion: appData.version!,
          shareOptionCheckboxState: CheckboxState.unchecked,
          shareOptionLabelState: 'visible',
        });
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
          .withModel(appData.reference)
          .build();
        baseAssertion.assertValue(additionalShareUserPage.url(), expectedUrl);
      },
    );

    await dialSharedWithMeTest.step('Verify app card attributes', async () => {
      await additionalShareUserAgentDetailsModalAssertion.assertApplicationName(
        appData.name,
      );
      await additionalShareUserAgentDetailsModalAssertion.assertEntityIcon(
        additionalShareUserAgentDetailsModal.icon,
        `${API.api}/${appData.iconUrl}`,
      );
      await additionalShareUserAgentDetailsModalAssertion.assertElementState(
        additionalShareUserAgentDetailsModal.applicationDescription,
        'hidden',
      );
      await additionalShareUserAgentDetailsModalAssertion.assertApplicationAuthor(
        UserUtil.getE2EUser(testInfo.parallelIndex),
      );
      const configApp = await modelApiHelper.getAgentByNameAndVersion({
        name: appData.name,
        version: appData.version,
      });
      await additionalShareUserAgentDetailsModalAssertion.assertApplicationReleaseDate(
        configApp.createdAt!,
      );
      await additionalShareUserAgentDetailsModalAssertion.assertApplicationVersion(
        appData.version!,
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
          appData.name,
        );
        const sharedAgentElement =
          await additionalShareUserMarketplaceAgentsSection.findAgentElement(
            appData,
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
            appData,
            { isWorkspaceAgent: true, isEditable: false },
          );
        await baseAssertion.assertElementState(sharedAgentElement, 'visible');
      },
    );

    await dialSharedWithMeTest.step(
      'Open "Manage attachments" modal and verify app icon is displayed under "Shared with me" section',
      async () => {
        await additionalShareUserNavigationPanel.backToChat();
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await additionalShareUserChatBar.openManageAttachmentsModal();
        await additionalShareUserManageAttachmentsAssertion.assertElementState(
          additionalShareUserAttachFilesModal,
          'visible',
        );
        await additionalShareUserManageAttachmentsAssertion.assertEntityState(
          { name: iconName },
          FileModalSection.SharedWithMe,
          'visible',
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Verify app icon can be downloaded via dropdown menu',
      async () => {
        await additionalShareUserAttachFilesModal.openFileDropdownMenu(
          iconName,
          FileModalSection.SharedWithMe,
        );
        const downloadedData =
          await additionalShareUserDialHomePage.downloadData(() =>
            additionalShareUserAttachFilesModal
              .getFileDropdownMenu()
              .selectMenuOption(MenuOptions.download),
          );
        await downloadAssertion.assertFileIsDownloaded(
          downloadedData,
          FileType.SVG,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Refresh the page by the main user and verify the arrow icon is displayed on the app card',
      async () => {
        await marketplacePage.reloadPage();
        await marketplacePage.waitForPageLoaded();
        agentElement = await marketplaceAgentsSection.findAgentElement(
          appData,
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
        await shareAppModalAssertion.assertModalState('visible');
        await shareAppModal.removeAccessBtn.click();
        await confirmationDialogAssertion.assertElementState(
          confirmationDialog,
          'visible',
        );
        await confirmationDialogAssertion.assertConfirmationDialogTitle(
          ExpectedConstants.removeAccessTitle,
        );
        await confirmationDialogAssertion.assertConfirmationMessage(
          ExpectedConstants.removeAccessForAllMessage(appData.name),
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
      'Open Share modal again and verify bottom label',
      async () => {
        await agentDetailsModal.clickShareButton();
        await shareAppModalAssertion.assertModalState('visible');
        await shareAppModalAssertion.assertGeneralInfo({
          notSharedEntityLabel: ExpectedConstants.notSharedAppText,
        });
      },
    );

    await dialSharedWithMeTest.step(
      'Refresh the page by additional user and verify app icon is still displayed under "Shared with me" section',
      async () => {
        await additionalShareUserDialHomePage.reloadPage();
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await additionalShareUserChatBar.openManageAttachmentsModal();
        await additionalShareUserManageAttachmentsAssertion.assertElementState(
          additionalShareUserAttachFilesModal,
          'visible',
        );
        await additionalShareUserManageAttachmentsAssertion.assertEntityState(
          { name: iconName },
          FileModalSection.SharedWithMe,
          'visible',
        );
        await additionalShareUserAttachFilesModal.closeButton.click();
      },
    );

    await dialSharedWithMeTest.step(
      'Go to the Marketplace and verify the app is not found',
      async () => {
        await additionalShareUserNavigationPanel.goToMarketplaceHome();
        await additionalShareUserMarketplacePage.waitForPageLoaded();
        await additionalShareUserMarketplaceHeader.searchInput.fillInInput(
          appData.name,
        );
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
    'Share custom application via QR code with edit rights.\n' +
    `Sharing custom app without editing permissions via share icon on app's card pop-up in DIAL Marketplace.\n` +
    `[Custom app] App's card pop-up open when receive sharing link for app.\n` +
    '[Custom app]:Context menu for shared with me app with edit option.\n' +
    'Icons from shared app displayed in Manage attachments (sharing with edit permissions).\n' +
    'Error message for chat when unshare custom app used in chat.\n' +
    'Icon file stay in Manage attachments if recipient Unshare app',
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
    additionalShareUserChatBar,
    additionalShareUserAttachFilesModal,
    additionalShareUserManageAttachmentsAssertion,
    additionalShareUserTalkToAgentDialogAssertion,
    additionalShareUserChatAssertion,
  }) => {
    setTestIds(
      'EPMRTC-5171',
      'EPMRTC-6058',
      'EPMRTC-5184',
      'EPMRTC-5316',
      'EPMRTC-5198',
      'EPMRTC-5421',
      'EPMRTC-5280',
      'EPMRTC-5365',
    );
    let agentElement: BaseElement;
    let conversation: Conversation;
    let notAvailableAgentElement: BaseElement;
    let iconName: string;

    await dialSharedWithMeTest.step(
      'Create a custom app with icon via API',
      async () => {
        appData = await customApplicationPublishingUtil.createCustomApp({
          hasIcon: true,
        });
        iconName = getIconName(appData.iconUrl!);
        await additionalShareUserLocalStorageManager.setShowSideBarPanels();
        await additionalShareUserLocalStorageManager.setRecentModelsIdsAndUseLastModel(
          appData,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Find created app on "DIAL Marketplace", open the card, click on "Share" btn and verify Share modal is displayed',
      async () => {
        await marketplacePage.openMarketplacePage();
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.searchInput.fillInInput(appData.name);
        agentElement = await marketplaceAgentsSection.findAgentElement(
          appData,
          { isWorkspaceAgent: true, isEditable: true },
        );
        await agentElement.click();
        await agentDetailsModal.clickShareButton();
        await shareModalAssertion.assertModalState('visible');
      },
    );

    await dialSharedWithMeTest.step(
      'Check "Allow editing by other users" checkbox and verify QR code link is changed, click on Copy icon, navigate to the copied url by another user and verify the app card is opened',
      async () => {
        const shareLinkResponse =
          await shareAppModal.checkAllowEditingByOtherUsers();
        await shareModalAssertion.assertGeneralInfo({
          qrCodeState: 'visible',
          qrCodeLink: ExpectedConstants.sharedAppUrl(
            shareLinkResponse.invitationLink,
          ),
        });
      },
    );

    await dialSharedWithMeTest.step(
      'Click on Copy icon, navigate to the copied url by another user and verify the app card is opened',
      async () => {
        await shareAppModal.copyLinkButton.click();
        const shareLink = await marketplacePage.readTextFromClipboard();
        await additionalShareUserMarketplacePage.navigateToUrl(shareLink);
        await additionalShareUserMarketplacePage.waitForPageLoaded();
        await additionalShareUserAgentDetailsModalAssertion.assertElementState(
          additionalShareUserAgentDetailsModal,
          'visible',
        );
        const expectedUrl = marketplaceUrlBuilder
          .withModel(appData.reference)
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
          appData.name,
        );
        const sharedAgentElement =
          await additionalShareUserMarketplaceAgentsSection.findAgentElement(
            appData,
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
        conversation = conversationData.prepareDefaultConversation(appData);
        await additionalShareUserDataInjector.createConversations([
          conversation,
        ]);
      },
    );

    await dialSharedWithMeTest.step(
      'Navigate to the chat screen, open "Manage attachments" modal and verify app icon is displayed under "Shared with me" section',
      async () => {
        await additionalShareUserNavigationPanel.backToChat();
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await additionalShareUserChatBar.openManageAttachmentsModal();
        await additionalShareUserManageAttachmentsAssertion.assertElementState(
          additionalShareUserAttachFilesModal,
          'visible',
        );
        await additionalShareUserManageAttachmentsAssertion.assertEntityState(
          { name: iconName },
          FileModalSection.SharedWithMe,
          'visible',
        );
        await additionalShareUserAttachFilesModal.closeButton.click();
      },
    );

    await dialSharedWithMeTest.step(
      'Select created conversation and click on app icon in the chat header',
      async () => {
        await additionalShareUserConversations.selectEntity(conversation.name);
        await additionalShareUserChatHeader.chatModelIcon.click();
      },
    );

    await dialSharedWithMeTest.step(
      'Find shared agent, select Unshare option from the dropdown menu and verify confirmation popup is displayed',
      async () => {
        const sharedAppElement =
          await additionalShareUserTalkToAgentDialog.findAgent(appData);
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
          ExpectedConstants.removeYourAccessMessage(appData.name),
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
            appData.reference,
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
          appData.reference,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Open "Manage attachments" modal and verify app icon is still displayed under "Shared with me" section',
      async () => {
        await additionalShareUserChatBar.openManageAttachmentsModal();
        await additionalShareUserManageAttachmentsAssertion.assertElementState(
          additionalShareUserAttachFilesModal,
          'visible',
        );
        await additionalShareUserManageAttachmentsAssertion.assertEntityState(
          { name: iconName },
          FileModalSection.SharedWithMe,
          'visible',
        );
      },
    );
  },
);

dialSharedWithMeTest(
  'Unshare option for Icon file from shared apps in Shared with me section in Manage attachments.\n' +
    'Default icon displayed for recipient of shared app if unshare icon file for app via Manage attachments.\n' +
    `Unshare custom app by user who received shared link via button on app's card in Marketplace`,
  async ({
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    setTestIds,
    customApplicationPublishingUtil,
    additionalShareUserDialHomePage,
    additionalShareUserMarketplacePage,
    additionalShareUserNavigationPanel,
    additionalShareUserMarketplaceHeader,
    additionalShareUserMarketplaceAgentsSection,
    additionalShareUserMarketplaceAgents,
    additionalShareUserMarketplaceAgentsAssertion,
    additionalShareUserLocalStorageManager,
    additionalShareUserConfirmationDialog,
    additionalShareUserConfirmationDialogAssertion,
    additionalShareUserChatBar,
    additionalShareUserAttachFilesModal,
    additionalShareUserManageAttachmentsAssertion,
    additionalShareUserAgentDetailsModal,
    shareApiAssertion,
  }) => {
    setTestIds('EPMRTC-5328', 'EPMRTC-5385', 'EPMRTC-5465');
    let iconName: string;
    let sharedAppElement: BaseElement;

    await dialSharedWithMeTest.step(
      'Share custom app with icon via API',
      async () => {
        appData = await customApplicationPublishingUtil.createCustomApp({
          hasIcon: true,
        });
        iconName = getIconName(appData.iconUrl!);
        const shareByLinkResponse = await mainUserShareApiHelper.shareAppByLink(
          appData.backendEntity,
          appData.iconUrl,
        );
        await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);
        await additionalShareUserLocalStorageManager.setShowSideBarPanels();
      },
    );

    await dialSharedWithMeTest.step(
      'Open "Manage attachments" modal, select "Unshare" menu option for the app icon and verify confirmation popup is displayed',
      async () => {
        await additionalShareUserDialHomePage.openHomePage();
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await additionalShareUserChatBar.openManageAttachmentsModal();
        await additionalShareUserManageAttachmentsAssertion.assertElementState(
          additionalShareUserAttachFilesModal,
          'visible',
        );
        await additionalShareUserAttachFilesModal.openFileDropdownMenu(
          iconName,
          FileModalSection.SharedWithMe,
        );
        await additionalShareUserAttachFilesModal
          .getFileDropdownMenu()
          .selectMenuOption(MenuOptions.unshare);
        await additionalShareUserConfirmationDialogAssertion.assertElementState(
          additionalShareUserConfirmationDialog,
          'visible',
        );
        await additionalShareUserConfirmationDialogAssertion.assertConfirmationDialogTitle(
          ExpectedConstants.unshareFileTitle,
        );
        await additionalShareUserConfirmationDialogAssertion.assertConfirmationMessage(
          ExpectedConstants.unshareFileMessage,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Confirm unsharing and verify the icon is removed from "Shared with me" section',
      async () => {
        await additionalShareUserConfirmationDialog.confirm({
          triggeredHttpMethod: 'POST',
        });
        await additionalShareUserManageAttachmentsAssertion.assertEntityState(
          { name: iconName },
          FileModalSection.SharedWithMe,
          'hidden',
        );
        await additionalShareUserAttachFilesModal.closeButton.click();
      },
    );

    await dialSharedWithMeTest.step(
      'Go to "My Workspace", find shared agent and verify it has a default icon',
      async () => {
        await additionalShareUserNavigationPanel.goToMyWorkspace();
        await additionalShareUserMarketplacePage.waitForPageLoaded();
        await additionalShareUserMarketplaceHeader.searchInput.fillInInput(
          appData.name,
        );
        sharedAppElement =
          await additionalShareUserMarketplaceAgentsSection.findAgentElement(
            appData,
          );
        const sharedAppIcon =
          await additionalShareUserMarketplaceAgents.getAgentIcon(
            sharedAppElement,
          );
        await additionalShareUserMarketplaceAgentsAssertion.assertEntityIcon(
          sharedAppIcon,
          API.defaultModelIconHost(),
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Open agent card, click on Unshare btn and verify confirmation popup is displayed',
      async () => {
        await sharedAppElement.click();
        await additionalShareUserAgentDetailsModal.unshareButton.click();
        await additionalShareUserConfirmationDialogAssertion.assertElementState(
          additionalShareUserConfirmationDialog,
          'visible',
        );
        await additionalShareUserConfirmationDialogAssertion.assertConfirmationDialogTitle(
          ExpectedConstants.removeAccessTitle,
        );
        await additionalShareUserConfirmationDialogAssertion.assertConfirmationMessage(
          ExpectedConstants.removeYourAccessMessage(appData.name),
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Confirm unsharing and verify app is not available for the user',
      async () => {
        await additionalShareUserConfirmationDialog.confirm({
          triggeredHttpMethod: 'POST',
        });
        await additionalShareUserConfirmationDialogAssertion.assertElementState(
          additionalShareUserConfirmationDialog,
          'hidden',
        );
        const sharedWithMeApps =
          await additionalUserShareApiHelper.listSharedWithMeApps();
        shareApiAssertion.assertSharedWithMeEntityState(
          sharedWithMeApps,
          appData.backendEntity.url,
          'hidden',
        );
      },
    );
  },
);

dialSharedWithMeTest(
  'Unshare custom app by user who received shared link via context menu option in Marketplace',
  async ({
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    setTestIds,
    customApplicationPublishingUtil,
    additionalShareUserMarketplacePage,
    additionalShareUserMarketplaceHeader,
    additionalShareUserMarketplaceAgentsSection,
    additionalShareUserMarketplaceAgents,
    additionalShareUserConfirmationDialog,
    additionalShareUserConfirmationDialogAssertion,
    shareApiAssertion,
  }) => {
    setTestIds('EPMRTC-5173');

    await dialSharedWithMeTest.step('Share custom app via API', async () => {
      appData = await customApplicationPublishingUtil.createCustomApp();
      const shareByLinkResponse = await mainUserShareApiHelper.shareAppByLink(
        appData.backendEntity,
      );
      await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);
    });

    await dialSharedWithMeTest.step(
      'Find shared app on "DIAL Marketplace", open card dropdown menu and select "Unshare" option',
      async () => {
        await additionalShareUserMarketplacePage.openMarketplacePage();
        await additionalShareUserMarketplacePage.waitForPageLoaded();
        await additionalShareUserMarketplaceHeader.searchInput.fillInInput(
          appData.name,
        );
        const agentElement =
          await additionalShareUserMarketplaceAgentsSection.findAgentElement(
            appData,
          );
        await agentElement.hoverOver();
        await additionalShareUserMarketplaceAgents
          .getAgentElementDotsMenu(agentElement)
          .click();
        await additionalShareUserMarketplaceAgents
          .getAgentDropdownMenu()
          .selectMenuOption(MenuOptions.unshare);
      },
    );

    await dialSharedWithMeTest.step(
      'Verify confirmation popup is displayed',
      async () => {
        await additionalShareUserConfirmationDialogAssertion.assertElementState(
          additionalShareUserConfirmationDialog,
          'visible',
        );
        await additionalShareUserConfirmationDialogAssertion.assertConfirmationDialogTitle(
          ExpectedConstants.removeAccessTitle,
        );
        await additionalShareUserConfirmationDialogAssertion.assertConfirmationMessage(
          ExpectedConstants.removeYourAccessMessage(appData.name),
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Confirm unsharing and verify app is not available for the user',
      async () => {
        await additionalShareUserConfirmationDialog.confirm({
          triggeredHttpMethod: 'POST',
        });
        await additionalShareUserConfirmationDialogAssertion.assertElementState(
          additionalShareUserConfirmationDialog,
          'hidden',
        );
        const sharedWithMeApps =
          await additionalUserShareApiHelper.listSharedWithMeApps();
        shareApiAssertion.assertSharedWithMeEntityState(
          sharedWithMeApps,
          appData.backendEntity.url,
          'hidden',
        );
      },
    );
  },
);
