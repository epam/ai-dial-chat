import { ApiApplicationModelRegular } from '@/chat/types/applications';
import { DialAIEntityModel } from '@/chat/types/models';
import { Publication, PublicationRequestModel } from '@/chat/types/publication';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import { API, Attachment, MenuOptions, PublishPath } from '@/src/testData';
import { BaseElement } from '@/src/ui/webElements';
import { GeneratorUtil, UserUtil } from '@/src/utils';
import { Conversation } from '@epam/ai-dial-shared';

dialAdminTest(
  'Publish custom app from Application pop-up form on DIAL Marketplace page.\n' +
    'Publish custom application to new folder in Change path.\n' +
    '[Admin view]: "Author" field is displayed on publish request form.\n' +
    'Folder where was published app is available in Change path form for publish requests',
  async (
    {
      marketplacePage,
      marketplaceHeader,
      marketplaceAgentsSection,
      agentDetailsModal,
      agentDetailsModalAssertion,
      customApplicationBuilder,
      applicationApiHelper,
      adminMarketplaceAgentsAssertion,
      publishingRequestModal,
      selectFolderModal,
      selectFolders,
      publishingRequestModalAssertion,
      fileApiHelper,
      dialHomePage,
      adminDialHomePage,
      adminApproveRequiredPrompts,
      adminPublishingApprovalModal,
      adminPublishedApplicationReviewModal,
      adminPublishedAppReviewModalAssertion,
      adminApproveRequiredConversationsAssertion,
      adminApproveRequiredPromptsAssertion,
      adminPublishingApprovalModalAssertion,
      navigationPanel,
      organizationFoldersAssertion,
      chatBar,
      attachFilesModal,
      setTestIds,
      localStorageManager,
      adminLocalStorageManager,
      adminDataInjector,
      conversationData,
      adminConversations,
      adminConversationDropdownMenu,
      adminPublishingRequestModal,
      adminSelectFolderModal,
      adminSelectFoldersAssertion,
    },
    testInfo,
  ) => {
    setTestIds('EPMRTC-4450', 'EPMRTC-4496', 'EPMRTC-5858', 'EPMRTC-5736');
    const appName = GeneratorUtil.randomApplicationName();
    const appVersion = GeneratorUtil.randomApplicationVersion();
    const orgFolder = GeneratorUtil.randomString(7);
    const publicationPath = `${PublishPath.Organization}/${orgFolder}`;

    const requestName = GeneratorUtil.randomPublicationRequestName();
    let encodedFileUrl: string;
    let applicationModel: ApiApplicationModelRegular;
    let appEntity: DialAIEntityModel;
    let publishApiModels: {
      request: PublicationRequestModel;
      response: Publication;
    };
    let expectedPublishedIconUrl: string;
    let appElement: BaseElement;
    const defaultAuthor = UserUtil.getE2EUsername(testInfo.parallelIndex);
    const filename = `${GeneratorUtil.randomString(7)}.svg`;

    let conversation: Conversation;

    await dialTest.step(
      'Create a simple conversation by admin via API',
      async () => {
        conversation = conversationData.prepareDefaultConversation();
        await adminDataInjector.createConversations([conversation]);
      },
    );

    await dialTest.step(
      'Upload a svg file with custom name via API',
      async () => {
        const iconUrl = await fileApiHelper.putFileWithCustomName(
          filename,
          Attachment.appIconSvg,
        );
        encodedFileUrl =
          iconUrl.substring(0, iconUrl.lastIndexOf('/') + 1) +
          encodeURIComponent(filename);
      },
    );

    await dialTest.step('Create a custom app via API', async () => {
      applicationModel = customApplicationBuilder
        .withDisplayName(appName)
        .withDisplayVersion(appVersion)
        .withIconUrl(encodedFileUrl)
        .build();
      await applicationApiHelper.createApplication(applicationModel);
      appEntity = {
        name: appName,
        version: appVersion,
        iconUrl: encodedFileUrl,
      } as DialAIEntityModel;
    });

    await dialTest.step(
      'Find created app, open it and click on "Publish" button',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await adminLocalStorageManager.setShowSideBarPanels();
        await marketplacePage.openMyWorkspacePage();
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.searchInput.fillInInput(appName);
        appElement = await marketplaceAgentsSection.findAgentElement(appEntity);
        await appElement.click();
        await agentDetailsModalAssertion.assertElementState(
          agentDetailsModal,
          'visible',
        );
        await agentDetailsModal.clickPublishButton();
        await publishingRequestModalAssertion.assertElementState(
          publishingRequestModal,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Click on "Change" link, create a new folder, rename it and select',
      async () => {
        await publishingRequestModal
          .getChangePublishToPath()
          .changeButton.click();
        await selectFolderModal.newFolderButton.click();
        await selectFolders.renameEmptyFolderWithEnter(orgFolder);
        await selectFolderModal.clickSelectFolderButton({
          triggeredApiHost: API.publicationRulesList,
        });
        await publishingRequestModalAssertion.assertElementText(
          publishingRequestModal.getChangePublishToPath().path,
          publicationPath,
        );
      },
    );

    await dialTest.step(
      'Set publication request name and send the request',
      async () => {
        await publishingRequestModal.requestName.fillInInput(requestName);
        publishApiModels =
          await publishingRequestModal.sendPublicationRequest();

        const fileResource = publishApiModels.response.resources.find((r) =>
          r.reviewUrl.endsWith(filename),
        );
        const iconTargetUrl = fileResource?.targetUrl;
        expectedPublishedIconUrl = iconTargetUrl
          ? `${API.api}/${iconTargetUrl}`
          : '';
      },
    );

    await dialAdminTest.step(
      'Login as admin, open publish request and verify the details',
      async () => {
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredPromptsAssertion.assertFolderState(
          { name: requestName },
          'visible',
        );
        await adminApproveRequiredPrompts.selectRequest(requestName);
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal,
          'visible',
        );
        await adminPublishingApprovalModalAssertion.assertGeneralInfo({
          publishTo: publicationPath,
          author: defaultAuthor,
          publicAuthor: defaultAuthor,
        });
      },
    );

    await dialAdminTest.step('Review the request and approve', async () => {
      await adminPublishingApprovalModal.goToEntityReview();
      await adminPublishedAppReviewModalAssertion.assertElementState(
        adminPublishedApplicationReviewModal,
        'visible',
      );
      await adminPublishedApplicationReviewModal
        .getPublicationReviewControl()
        .backToPublicationRequest();
      await adminPublishingApprovalModal.approveRequest();
      await adminApproveRequiredConversationsAssertion.assertFolderState(
        { name: requestName },
        'hidden',
      );
      await adminApproveRequiredPromptsAssertion.assertFolderState(
        { name: requestName },
        'hidden',
      );
    });

    await dialAdminTest.step(
      'Go to the Marketplace page by the main user and verify published app is available in the list',
      async () => {
        await marketplacePage.openMarketplacePage({
          updateInstalledDeployments: false,
          getInstalledDeployments: true,
        });
        await marketplacePage.waitForPageLoaded();
        await marketplaceHeader.searchInput.fillInInput(appEntity.name);
        appElement = await marketplaceAgentsSection.findAgentElement(
          appEntity,
          { isWorkspaceAgent: false, isEditable: false },
        );
        await adminMarketplaceAgentsAssertion.assertElementState(
          appElement,
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Click on the found card and verify the details',
      async () => {
        await appElement.click();
        await agentDetailsModalAssertion.assertElementState(
          agentDetailsModal,
          'visible',
        );
        await agentDetailsModalAssertion.assertEntityIcon(
          agentDetailsModal.icon,
          expectedPublishedIconUrl,
        );
        await agentDetailsModalAssertion.assertApplicationAuthor(defaultAuthor);
        await agentDetailsModal.closeButton.click();
      },
    );

    await dialAdminTest.step(
      'Open "Manage Attachments" modal and verify app icon appears under "Organization" in the corresponding folder',
      async () => {
        await navigationPanel.backToChat();
        await dialHomePage.waitForPageLoaded();
        await chatBar.openManageAttachmentsModal();
        await organizationFoldersAssertion.assertFolderState(
          { name: orgFolder },
          'visible',
        );
        await attachFilesModal
          .getOrganizationFoldersTree()
          .expandFolder(orgFolder);
        await organizationFoldersAssertion.assertFolderEntityState(
          { name: orgFolder },
          { name: filename },
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Verify a new publication request can be created to published Organization folder',
      async () => {
        await adminConversations.openEntityDropdownMenu(conversation.name);
        await adminConversationDropdownMenu.selectMenuOption(
          MenuOptions.publish,
        );
        await adminPublishingRequestModal.waitForState();
        await adminPublishingRequestModal
          .getChangePublishToPath()
          .changeButton.click();
        await adminSelectFoldersAssertion.assertFolderState(
          { name: orgFolder },
          'visible',
        );
        await adminSelectFolderModal.selectFolder(orgFolder);
        await adminSelectFolderModal.clickSelectFolderButton({
          triggeredApiHost: API.publicationRulesList,
        });
        await adminPublishingRequestModal.requestName.fillInInput(requestName);
        await adminPublishingRequestModal.sendPublicationRequest();
        await adminPublishingRequestModal.waitForState({ state: 'hidden' });
      },
    );
  },
);
