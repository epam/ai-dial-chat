import { ShareByLinkResponseModel } from '@/chat/types/share';
import { FileType } from '@/src/assertions';
import dialTest from '@/src/core/dialFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import {
  API,
  CheckboxState,
  ExpectedConstants,
  ExpectedMessages,
  MarketplaceExpectedMessages,
  MarketplaceFilterTypes,
  MenuOptions,
  SourcesFilterOptions,
} from '@/src/testData';
import { BaseElement } from '@/src/ui/webElements';
import { GeneratorUtil, UserUtil } from '@/src/utils';
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
      marketplaceEntitiesSection,
      marketplaceEntities,
      entityDetailsModal,
      entityDetailsModalAssertion,
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
      additionalShareUserMarketplace,
      additionalShareUserEntityDetailsModal,
      additionalShareUserEntityDetailsModalAssertion,
      additionalShareUserPage,
      additionalShareUserMarketplaceHeader,
      additionalShareUserMarketplaceEntitiesSection,
      additionalShareUserMarketplaceEntities,
      additionalShareUserNavigationPanel,
      additionalShareUserFileManagerPage,
      additionalShareUserFileManagerToolbar,
      additionalShareUserFileManagerGridAssertion,
      additionalShareUserFileManagerGrid,
      additionalShareUserFileManagerGridRowDropdownMenu,
      baseAssertion,
      downloadAssertion,
    },
    testInfo,
  ) => {
    setTestIds(
      'EPMDIAL-4354',
      'EPMDIAL-4371',
      'EPMDIAL-4343',
      'EPMDIAL-4362',
      'EPMDIAL-4342',
      'EPMDIAL-4350',
      'EPMDIAL-4340',
      'EPMDIAL-4341',
      'EPMDIAL-4378',
      'EPMDIAL-4387',
      'EPMDIAL-4383',
      'EPMDIAL-4357',
      'EPMDIAL-4344',
      'EPMDIAL-4380',
    );
    let agentElement: BaseElement;
    let iconName: string;
    let shareLinkResponse: ShareByLinkResponseModel;
    let searchInput: BaseElement;

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
        await marketplaceHeader
          .getSearch()
          .inputField.fillInInput(appData.name);
        agentElement = await marketplaceEntitiesSection.findEntityElement(
          appData,
          { isWorkspaceEntity: true, isEditable: true },
        );
        await agentElement.hoverOver();
        await marketplaceEntities
          .getEntityElementDotsMenu(agentElement)
          .click();
        const shareLinkRequestResponse = await marketplaceEntities
          .getEntityDropdownMenu()
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
        const shareLink = await marketplacePage.captureNextClipboardWrite(() =>
          shareAppModal.copyLinkButton.click(),
        );
        await shareAppModal.closeButton.click();
        await additionalShareUserMarketplacePage.navigateToUrl(shareLink);
        await additionalShareUserMarketplacePage.waitForPageLoaded();
        await additionalShareUserEntityDetailsModalAssertion.assertElementState(
          additionalShareUserEntityDetailsModal,
          'visible',
        );
        const expectedUrl = marketplaceUrlBuilder
          .withModel(appData.reference)
          .build();
        baseAssertion.assertValue(additionalShareUserPage.url(), expectedUrl);
      },
    );

    await dialSharedWithMeTest.step('Verify app card attributes', async () => {
      await additionalShareUserEntityDetailsModalAssertion.assertEntityName(
        appData.name,
      );
      await additionalShareUserEntityDetailsModalAssertion.assertEntityIcon(
        additionalShareUserEntityDetailsModal.icon,
        `${API.api}/${appData.iconUrl}`,
      );
      await additionalShareUserEntityDetailsModalAssertion.assertElementState(
        additionalShareUserEntityDetailsModal.entityDescription,
        'hidden',
      );
      await additionalShareUserEntityDetailsModalAssertion.assertEntityAuthor(
        UserUtil.getE2EUser(testInfo.parallelIndex),
      );
      //TODO: enable when fixed https://github.com/epam/ai-dial-chat/issues/3218
      // const configApp = await modelApiHelper.getAgentByNameAndVersion({
      //   name: appData.name,
      //   version: appData.version,
      // });
      // await additionalShareUserEntityDetailsModalAssertion.assertEntityReleaseDate(
      //   configApp.createdAt!,
      // );
      await additionalShareUserEntityDetailsModalAssertion.assertEntityVersion(
        appData.version!,
      );
      await additionalShareUserEntityDetailsModalAssertion.assertElementState(
        additionalShareUserEntityDetailsModal.shareButton,
        'hidden',
      );
      await additionalShareUserEntityDetailsModalAssertion.assertElementState(
        additionalShareUserEntityDetailsModal.unshareButton,
        'visible',
      );
    });

    await dialSharedWithMeTest.step(
      'Close the modal and verify app is listed, no bookmark icon is available on the card',
      async () => {
        await additionalShareUserEntityDetailsModal.closeButton.click();
        searchInput =
          additionalShareUserMarketplaceHeader.getSearch().inputField;
        await searchInput.fillInInput(appData.name);
        const sharedAgentElement =
          await additionalShareUserMarketplaceEntitiesSection.findEntityElement(
            appData,
            { isWorkspaceEntity: true, isEditable: false },
          );
        await baseAssertion.assertElementState(sharedAgentElement, 'visible');
        await baseAssertion.assertElementState(
          additionalShareUserMarketplaceEntities.getEntityElementAddBookmarkIcon(
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
          await additionalShareUserMarketplaceEntitiesSection.findEntityElement(
            appData,
            { isWorkspaceEntity: true, isEditable: false },
          );
        await baseAssertion.assertElementState(sharedAgentElement, 'visible');
      },
    );

    await dialSharedWithMeTest.step(
      'Open File manager and verify app icon is displayed on "Shared with me" tab',
      async () => {
        await additionalShareUserNavigationPanel.goToFileManager();
        await additionalShareUserFileManagerToolbar.sharedWithMeTab.click();
        await additionalShareUserFileManagerGridAssertion.assertGridRowByNameState(
          iconName,
          'visible',
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Verify app icon can be downloaded via row dropdown menu',
      async () => {
        await additionalShareUserFileManagerGrid
          .gridRowByNameCell(iconName)
          .hover();
        const dotsMenu =
          await additionalShareUserFileManagerGrid.gridDotsMenuByNameCell(
            iconName,
          );
        await dotsMenu.click();
        const downloadedData =
          await additionalShareUserFileManagerPage.downloadData(() =>
            additionalShareUserFileManagerGridRowDropdownMenu.selectItem(
              MenuOptions.download,
              {
                isHttpMethodTriggered: false,
              },
            ),
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
        agentElement = await marketplaceEntitiesSection.findEntityElement(
          appData,
          { isWorkspaceEntity: true, isEditable: false },
        );
        const agentArrowIconElement =
          marketplaceEntities.getEntityArrowIcon(agentElement);
        await baseAssertion.assertElementState(
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
        await entityDetailsModalAssertion.assertElementState(
          entityDetailsModal.arrowIcon,
          'visible',
        );
        await entityDetailsModal.arrowIcon.hoverOver();
        await tooltipAssertion.assertElementText(
          tooltip,
          ExpectedConstants.sharedEntityTooltip,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Open Share modal again, click on "Remove access for all users" btn and verify confirmation popup is displayed',
      async () => {
        await entityDetailsModal.clickShareButton();
        await shareAppModalAssertion.assertModalState('visible');
        await shareAppModal.removeAccessBtn.click();
        await confirmationDialogAssertion.assertElementState(
          confirmationDialog,
          'visible',
        );
        //TODO: unblock when fixed https://github.com/epam/ai-dial-chat/issues/6073
        // await confirmationDialogAssertion.assertConfirmationDialogTitle(
        //   ExpectedConstants.removeAccessTitle,
        // );
        // await confirmationDialogAssertion.assertConfirmationMessage(
        //   ExpectedConstants.removeAccessForAllMessage(appData.name),
        // );
      },
    );

    await dialSharedWithMeTest.step(
      'Confirm access removing and verify arrow icon disappears from the card',
      async () => {
        await confirmationDialog.confirm({ triggeredHttpMethod: 'POST' });
        await baseAssertion.assertElementState(
          marketplaceEntities.getEntityArrowIcon(agentElement),
          'hidden',
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Open Share modal again and verify bottom label',
      async () => {
        await entityDetailsModal.clickShareButton();
        await shareAppModalAssertion.assertModalState('visible');
        await shareAppModalAssertion.assertGeneralInfo({
          notSharedEntityLabel: ExpectedConstants.notSharedAppText,
        });
      },
    );

    await dialSharedWithMeTest.step(
      'Open File manager page by additional user and verify app icon is still displayed on "Shared with me" tab',
      async () => {
        await additionalShareUserFileManagerPage.reloadPage();
        await additionalShareUserFileManagerPage.waitForPageLoaded({
          isGridVisible: false,
        });
        await additionalShareUserFileManagerToolbar.sharedWithMeTab.click();
        await additionalShareUserFileManagerGridAssertion.assertGridRowByNameState(
          iconName,
          'visible',
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Go to the Marketplace and verify the app is not found',
      async () => {
        await additionalShareUserNavigationPanel.goToMarketplaceHome();
        await additionalShareUserMarketplacePage.waitForPageLoaded();
        await searchInput.fillInInput(appData.name);
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
    'Icon located in folder used in shared app is displayed in Shared with me root in File Manager.\n' +
    'Error message for chat when unshare custom app used in chat.\n' +
    'Icon file stay in Manage attachments if recipient Unshare app',
  async ({
    marketplacePage,
    additionalShareUserDialHomePage,
    marketplaceHeader,
    marketplaceEntitiesSection,
    entityDetailsModal,
    shareAppModal,
    shareModalAssertion,
    marketplaceUrlBuilder,
    setTestIds,
    customApplicationPublishingUtil,
    additionalShareUserFileManagerPage,
    additionalShareUserFileManagerToolbar,
    additionalShareUserFileManagerGridAssertion,
    additionalShareUserMarketplacePage,
    additionalShareUserNavigationPanel,
    additionalShareUserEntityDetailsModal,
    additionalShareUserEntityDetailsModalAssertion,
    additionalShareUserPage,
    additionalShareUserMarketplaceHeader,
    additionalShareUserMarketplaceEntitiesSection,
    additionalShareUserMarketplaceEntities,
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
      'EPMDIAL-4356',
      'EPMDIAL-4372',
      'EPMDIAL-4355',
      'EPMDIAL-4362',
      'EPMDIAL-4360',
      'EPMDIAL-4384',
      'EPMDIAL-4385',
      'EPMDIAL-4361',
      'EPMDIAL-4379',
    );
    let agentElement: BaseElement;
    let conversation: Conversation;
    let notAvailableAgentElement: BaseElement;
    let iconName: string;
    const iconFolder1 = GeneratorUtil.randomString(7);
    const iconFolder2 = GeneratorUtil.randomString(7);

    await dialSharedWithMeTest.step(
      'Create a custom app with icon via API',
      async () => {
        appData = await customApplicationPublishingUtil.createCustomApp({
          hasIcon: true,
          iconParentPath: `${iconFolder1}/${iconFolder2}`,
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
        await marketplaceHeader
          .getSearch()
          .inputField.fillInInput(appData.name);
        agentElement = await marketplaceEntitiesSection.findEntityElement(
          appData,
          { isWorkspaceEntity: true, isEditable: true },
        );
        await agentElement.click();
        await entityDetailsModal.clickShareButton();
        await shareModalAssertion.assertModalState('visible');
      },
    );

    await dialSharedWithMeTest.step(
      'Check "Allow editing by other users" checkbox and verify QR code link is changed, click on Copy icon, navigate to the copied url by another user and verify the app card is opened',
      async () => {
        const initShareLink =
          await shareAppModal.shareLinkInput.getElementContent();
        const shareLinkResponse =
          await shareAppModal.checkAllowEditingByOtherUsers();
        await shareModalAssertion.assertGeneralInfo({
          qrCodeState: 'visible',
          qrCodeLink: ExpectedConstants.sharedAppUrl(
            shareLinkResponse.invitationLink,
          ),
        });
        shareModalAssertion.assertBooleanCondition(
          initShareLink !== shareLinkResponse.invitationLink,
          true,
          ExpectedMessages.shareLinkIsUpdated,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Click on Copy icon, navigate to the copied url by another user and verify the app card is opened',
      async () => {
        const shareLink = await marketplacePage.captureNextClipboardWrite(() =>
          shareAppModal.copyLinkButton.click(),
        );
        await additionalShareUserMarketplacePage.navigateToUrl(shareLink);
        await additionalShareUserMarketplacePage.waitForPageLoaded();
        await additionalShareUserEntityDetailsModalAssertion.assertElementState(
          additionalShareUserEntityDetailsModal,
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
        await additionalShareUserEntityDetailsModalAssertion.assertElementState(
          additionalShareUserEntityDetailsModal.unshareButton,
          'visible',
        );
        await additionalShareUserEntityDetailsModalAssertion.assertElementState(
          additionalShareUserEntityDetailsModal.editButton,
          'visible',
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Close the agent details modal and verify app card dropdown menu options',
      async () => {
        await additionalShareUserEntityDetailsModal.closeButton.click();
        await additionalShareUserMarketplaceHeader
          .getSearch()
          .inputField.fillInInput(appData.name);
        const sharedAgentElement =
          await additionalShareUserMarketplaceEntitiesSection.findEntityElement(
            appData,
            { isWorkspaceEntity: true, isEditable: true },
          );
        await sharedAgentElement.hoverOver();
        await additionalShareUserMarketplaceEntities
          .getEntityElementDotsMenu(sharedAgentElement)
          .click();
        baseAssertion.assertArrayIncludesAll(
          await additionalShareUserMarketplaceEntities
            .getEntityDropdownMenu()
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
      'Open "File manager" page and verify app icon is displayed in "Shared with me" root, no icon folders are displayed',
      async () => {
        await additionalShareUserNavigationPanel.goToFileManager({
          isFilesListingTriggered: false,
        });
        await additionalShareUserFileManagerToolbar.sharedWithMeTab.click();
        await additionalShareUserFileManagerGridAssertion.assertGridRowByNameState(
          iconName,
          'visible',
        );
        await additionalShareUserFileManagerGridAssertion.assertGridRowByNameState(
          iconFolder1,
          'hidden',
        );
        await additionalShareUserFileManagerGridAssertion.assertGridRowByNameState(
          iconFolder2,
          'hidden',
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Select created conversation and click on app icon in the chat header',
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
          additionalShareUserTalkToAgents.getNotAvailableEntityElement(
            appData.reference,
          );
        await additionalShareUserTalkToAgentDialogAssertion.assertElementText(
          additionalShareUserTalkToAgents.getEntityDescription(
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
      'Open "File manager" and verify app icon is still displayed on "Shared with me" tab',
      async () => {
        await additionalShareUserFileManagerPage.openFileManagerPage({
          updateInstalledDeployments: false,
          getInstalledDeployments: true,
          updateInstalledToolsets: false,
          getInstalledToolsets: true,
          getStyles: false,
        });
        await additionalShareUserFileManagerToolbar.sharedWithMeTab.click();
        await additionalShareUserFileManagerGridAssertion.assertGridRowByNameState(
          iconName,
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
    additionalShareUserFileManagerPage,
    additionalShareUserFileManagerGrid,
    additionalShareUserFileManagerGridAssertion,
    additionalShareUserFileManagerGridRowDropdownMenu,
    additionalShareUserMarketplacePage,
    additionalShareUserNavigationPanel,
    additionalShareUserMarketplaceHeader,
    additionalShareUserMarketplaceEntitiesSection,
    additionalShareUserMarketplaceEntities,
    baseAssertion,
    additionalShareUserConfirmationDialog,
    additionalShareUserConfirmationDialogAssertion,
    additionalShareUserEntityDetailsModal,
    additionalShareUserFileManagerToolbar,
    shareApiAssertion,
  }) => {
    setTestIds('EPMDIAL-4386', 'EPMDIAL-4381', 'EPMDIAL-4359');
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
      },
    );

    await dialSharedWithMeTest.step(
      'Open "File manager" page, select "Unshare" row menu option for the app icon and verify confirmation popup is displayed',
      async () => {
        await additionalShareUserFileManagerPage.openFileManagerPage({
          updateInstalledDeployments: false,
          updateInstalledToolsets: false,
        });
        await additionalShareUserFileManagerToolbar.sharedWithMeTab.click();
        const rowLocator =
          await additionalShareUserFileManagerGrid.goToGridRowByNameCell(
            iconName,
          );
        await rowLocator.hover();
        const rowDotsMenu =
          await additionalShareUserFileManagerGrid.gridDotsMenuByNameCell(
            iconName,
          );
        await rowDotsMenu.click();
        await additionalShareUserFileManagerGridRowDropdownMenu.selectItem(
          MenuOptions.unshare,
          {
            isHttpMethodTriggered: false,
          },
        );
        await additionalShareUserConfirmationDialogAssertion.assertElementState(
          additionalShareUserConfirmationDialog,
          'visible',
        );
        await additionalShareUserConfirmationDialogAssertion.assertConfirmationDialogTitle(
          ExpectedConstants.removeAccessTitle,
        );
        await additionalShareUserConfirmationDialogAssertion.assertConfirmationMessage(
          ExpectedConstants.removeYourAccessMessage(iconName),
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Confirm unsharing and verify the icon is removed from "Shared with me" tab',
      async () => {
        await additionalShareUserConfirmationDialog.confirm({
          triggeredHttpMethod: 'POST',
          triggeredHttpHost: API.discardShareWithMeItem,
        });
        await additionalShareUserFileManagerGridAssertion.assertGridRowByNameState(
          iconName,
          'hidden',
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Go to "My Workspace", find shared agent and verify it has a default icon',
      async () => {
        await additionalShareUserNavigationPanel.goToMyWorkspace();
        await additionalShareUserMarketplacePage.waitForPageLoaded();
        await additionalShareUserMarketplaceHeader
          .getSearch()
          .inputField.fillInInput(appData.name);
        sharedAppElement =
          await additionalShareUserMarketplaceEntitiesSection.findEntityElement(
            appData,
          );
        const sharedAppIcon =
          await additionalShareUserMarketplaceEntities.getEntityIcon(
            sharedAppElement,
          );
        await baseAssertion.assertEntityIcon(
          sharedAppIcon,
          API.defaultModelIconHost(),
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Open agent card, click on Unshare btn and verify confirmation popup is displayed',
      async () => {
        await sharedAppElement.click();
        await additionalShareUserEntityDetailsModal.unshareButton.click();
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
    additionalShareUserMarketplaceEntitiesSection,
    additionalShareUserMarketplaceEntities,
    additionalShareUserConfirmationDialog,
    additionalShareUserConfirmationDialogAssertion,
    shareApiAssertion,
  }) => {
    setTestIds('EPMDIAL-4358');

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
        await additionalShareUserMarketplacePage.openMarketplacePage({
          updateInstalledToolsets: false,
        });
        await additionalShareUserMarketplacePage.waitForPageLoaded();
        await additionalShareUserMarketplaceHeader
          .getSearch()
          .inputField.fillInInput(appData.name);
        const agentElement =
          await additionalShareUserMarketplaceEntitiesSection.findEntityElement(
            appData,
          );
        await agentElement.hoverOver();
        await additionalShareUserMarketplaceEntities
          .getEntityElementDotsMenu(agentElement)
          .click();
        await additionalShareUserMarketplaceEntities
          .getEntityDropdownMenu()
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

dialTest(
  'The application is opened if the owner clicks on the link',
  async ({
    mainUserShareApiHelper,
    setTestIds,
    customApplicationPublishingUtil,
    marketplacePage,
    entityDetailsModal,
    entityDetailsModalAssertion,
    marketplaceFilter,
    baseAssertion,
  }) => {
    setTestIds('EPMDIAL-4365');

    let shareByLinkResponse: ShareByLinkResponseModel;

    await dialTest.step('Share custom app via API', async () => {
      appData = await customApplicationPublishingUtil.createCustomApp();
      shareByLinkResponse = await mainUserShareApiHelper.shareAppByLink(
        appData.backendEntity,
      );
    });

    await dialTest.step(
      'Navigate to shared link by the owner and verify app card is opened without arrow icon, "Shared with me" filter is not available',
      async () => {
        await marketplacePage.navigateToUrl(
          ExpectedConstants.sharedAppUrl(shareByLinkResponse.invitationLink),
        );
        await marketplacePage.waitForPageLoaded();
        await entityDetailsModalAssertion.assertElementState(
          entityDetailsModal,
          'visible',
        );
        await entityDetailsModalAssertion.assertEntityCommonAttributes({
          expectedName: appData.name,
          expectedVersion: appData.version,
        });
        await entityDetailsModalAssertion.assertElementState(
          entityDetailsModal.arrowIcon,
          'hidden',
        );
        const sourceFilterOptions =
          await marketplaceFilter.filterByPropertyOptionLabels(
            MarketplaceFilterTypes.sources,
          );
        baseAssertion.assertArrayExcludesAll(
          sourceFilterOptions,
          [SourcesFilterOptions.sharedWithMe],
          MarketplaceExpectedMessages.filterOptionsAreValid,
        );
      },
    );
  },
);
