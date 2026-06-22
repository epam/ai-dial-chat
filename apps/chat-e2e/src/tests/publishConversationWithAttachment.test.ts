import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import { Publication, PublicationRequestModel } from '@/chat/types/publication';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import {
  API,
  Attachment,
  CheckboxState,
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  MockedChatApiResponseBodies,
} from '@/src/testData';
import {
  DateUtil,
  FileUtil,
  GeneratorUtil,
  ItemUtil,
  ModelsUtil,
} from '@/src/utils';
import { PublishActions } from '@epam/ai-dial-shared';
import { expect } from '@playwright/test';

let modelWithInputAttachments: DialAIEntityModel;

dialTest.beforeAll(async () => {
  modelWithInputAttachments = GeneratorUtil.randomArrayElement(
    ModelsUtil.getLatestModelsWithAttachment(),
  );
});

dialAdminTest(
  'Publish chat with file.\n' +
    'Publish chat with attachments: download files.\n' +
    'Admin area: Publish request details.\n' +
    'Publish admin : request for chat with files: files are available for admin.\n' +
    `Link 'Go to a review' change to 'Continue review" when admin started review with click on chat .\n` +
    'Publish request for chat with already published file.\n' +
    'Publish chat with file, file is from Organization section.\n' +
    'Publish request toooltips.\n' +
    `Author's public name displayed in metadata for chats from Organization\n` +
    'Error message appears if to Publish the conversation with an attachment from Organization\n' +
    'Organization: Search: No results found',
  async ({
    dialHomePage,
    conversationData,
    dataInjector,
    conversations,
    organizationConversations,
    chatMessagesAssertion,
    conversationDropdownMenu,
    renameConversationModal,
    publishingRequestDialog,
    toast,
    filesToPublishTree,
    publishConversationAssertion,
    publishFileTreeAssertion,
    adminDialHomePage,
    adminApproveRequiredConversations,
    navigationPanel,
    fileManagerToolbar,
    fileManager,
    fileManagerGridAssertion,
    adminPublishingApprovalModal,
    adminPublicationReviewControl,
    adminFilesToApproveTree,
    adminChatMessages,
    informationModal,
    downloadAssertion,
    adminApproveRequiredConversationsAssertion,
    adminOrganizationConversationAssertion,
    adminPublishingApprovalModalAssertion,
    adminPublishConversationsTreeAssertion,
    adminPublishFilesAssertion,
    baseAssertion,
    fileApiHelper,
    setTestIds,
    localStorageManager,
    adminLocalStorageManager,
    informationModalAssertion,
    fileManagerNavigationPanel,
  }) => {
    dialAdminTest.slow();
    setTestIds(
      'EPMRTC-3463',
      'EPMRTC-3213',
      'EPMRTC-4189',
      'EPMRTC-3421',
      'EPMRTC-3793',
      'EPMRTC-4080',
      'EPMRTC-4704',
      'EPMRTC-3457',
      'EPMRTC-5652',
      'EPMRTC-4124',
      'EPMRTC-4169',
    );
    let imageUrl: string;
    const filePath = API.modelFilePath(modelWithInputAttachments.id);
    let conversation: Conversation;
    let secondConversation: Conversation;
    const requestName = GeneratorUtil.randomPublicationRequestName();
    let publishApiModels: {
      request: PublicationRequestModel;
      response: Publication;
    };
    const updatedConversationName = GeneratorUtil.randomConversationName();
    const author = GeneratorUtil.randomString(10);

    await dialSharedWithMeTest.step(
      'Prepare conversation with attachment in the request',
      async () => {
        imageUrl = await fileApiHelper.putFile(Attachment.cloudImageName, {
          parentPath: filePath,
        });
        conversation =
          conversationData.prepareConversationWithAttachmentsInRequest(
            modelWithInputAttachments,
            true,
            undefined,
            imageUrl,
          );
        conversationData.resetData();
        await dataInjector.createConversations([conversation]);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Select "Publish" conversation dropdown menu option and verify publishing modal is opened, file is available for publishing and downloading',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(conversation.name);
        await conversations.openEntityDropdownMenu(conversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.publish);
        await baseAssertion.assertElementState(
          publishingRequestDialog,
          'visible',
        );
        await publishConversationAssertion.assertEntityState(
          { name: conversation.name },
          'visible',
        );
        await publishFileTreeAssertion.assertFileToPublish(
          { name: Attachment.cloudImageName },
          {
            expectedState: 'visible',
            expectedCheckboxState: CheckboxState.checked,
            expectedDownloadUrl: ItemUtil.getEncodedItemId(`/api/${imageUrl}`),
          },
        );
      },
    );

    await dialTest.step(
      'Verify file checkbox state can be changed',
      async () => {
        for (const state of [CheckboxState.unchecked, CheckboxState.checked]) {
          await filesToPublishTree
            .getEntityCheckbox(Attachment.cloudImageName)
            .click();
          await publishFileTreeAssertion.assertEntityCheckboxState(
            { name: Attachment.cloudImageName },
            state,
          );
        }
      },
    );

    await dialTest.step(
      'Set publication request name, update author and submit the request',
      async () => {
        await publishingRequestDialog.requestName.fillInInput(requestName);
        await publishingRequestDialog.author.fillInInput(author);
        await baseAssertion.assertElementActionabilityState(
          publishingRequestDialog.sendRequestButton,
          'enabled',
        );
        publishApiModels =
          await publishingRequestDialog.sendPublicationRequest();
        await baseAssertion.assertElementState(
          publishingRequestDialog,
          'hidden',
        );
      },
    );

    await dialAdminTest.step(
      'Login as admin and verify publishing request is displayed under "Approve required" section',
      async () => {
        await adminLocalStorageManager.setShowSideBarPanels();
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredConversationsAssertion.assertFolderState(
          { name: requestName },
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Expand request folder and verify "Publication approval" modal is displayed',
      async () => {
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          requestName,
        );
        await adminApproveRequiredConversationsAssertion.assertFolderEntityState(
          { name: requestName },
          { name: conversation.name },
          'visible',
        );
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal,
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Verify file is displayed under "Files" tree and has download icon',
      async () => {
        await adminPublishConversationsTreeAssertion.assertEntityState(
          { name: conversation.name },
          'visible',
        );
        await adminPublishFilesAssertion.assertEntityState(
          { name: Attachment.cloudImageName },
          'visible',
        );
        await adminPublishFilesAssertion.assertElementState(
          adminFilesToApproveTree.getFileDownloadIcon(
            Attachment.cloudImageName,
          ),
          'visible',
        );
        const downloadedData = await adminDialHomePage.downloadData(() =>
          adminFilesToApproveTree
            .getFileDownloadIcon(Attachment.cloudImageName)
            .click(),
        );
        const exportedFiles = FileUtil.getExportedFiles();
        expect
          .soft(
            exportedFiles?.find((f) => f.includes(Attachment.cloudImageName)),
            ExpectedMessages.dataIsExported,
          )
          .toBeDefined();
        await downloadAssertion.assertJpgFileIsDownloaded(
          downloadedData,
          Attachment.cloudImageName,
        );
      },
    );

    await dialAdminTest.step(
      'Admin approves the request and verifies publication disappears from "Approve required" and displayed under "Organization" section',
      async () => {
        await adminApproveRequiredConversations.selectFolderEntity(
          requestName,
          conversation.name,
        );
        await baseAssertion.assertElementState(adminChatMessages, 'visible');
        await adminApproveRequiredConversations.expandCollapseFolder(
          requestName,
        );
        await adminPublishingApprovalModalAssertion.assertReviewButtonTitle(
          ExpectedConstants.continueReviewButtonTitle,
        );
        await adminPublishingApprovalModal.goToEntityReview({
          isHttpMethodTriggered: false,
        });
        await baseAssertion.assertElementState(adminChatMessages, 'visible');
        await adminPublicationReviewControl.backToPublicationRequest();
        await adminPublishingApprovalModal.approveRequest();
        await adminApproveRequiredConversationsAssertion.assertFolderState(
          { name: requestName },
          'hidden',
        );
        await adminOrganizationConversationAssertion.assertEntityState(
          { name: conversation.name },
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Create a conversation with published file',
      async () => {
        const fileResource = publishApiModels.response.resources.find((r) =>
          r.targetUrl.includes(Attachment.cloudImageName),
        )!;
        secondConversation =
          conversationData.prepareConversationWithAttachmentsInRequest(
            modelWithInputAttachments,
            true,
            undefined,
            fileResource.targetUrl,
          );
        await dataInjector.createConversations([secondConversation]);
      },
    );

    await dialAdminTest.step(
      'Select published conversation and verify it contains attachment',
      async () => {
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await organizationConversations.selectEntity(conversation.name);
        await chatMessagesAssertion.assertMessageDownloadUrl(
          1,
          ExpectedConstants.publishedAttachmentDownloadPath(
            Attachment.cloudImageName,
          ),
        );
      },
    );

    await dialAdminTest.step(
      'Open conversation dropdown menu, select "Info" option and verify modal data',
      async () => {
        const currentDate = DateUtil.getCurrentLocalDate();
        await organizationConversations.openEntityDropdownMenu(
          conversation.name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.info, {
          triggeredHttpMethod: 'GET',
        });
        await informationModalAssertion.assertFields({
          createdDate: currentDate,
          author: author,
        });
        await informationModal.getCloseButton().click();
      },
    );

    await dialAdminTest.step(
      'Verify attachment is displayed under "Organization" section in File Manager',
      async () => {
        await navigationPanel.goToFileManager();
        await fileManagerToolbar.organizationTab.click();
        await fileManagerGridAssertion.assertGridRowByNameState(
          Attachment.cloudImageName,
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'EPMRTC-4169: search non-existent term in Organization tab and verify "No results found" is shown',
      async () => {
        await fileManagerNavigationPanel
          .getSearch()
          .inputField.fillInInput(GeneratorUtil.randomString(10));
        await baseAssertion.assertElementState(
          fileManager.getNoDataContent(),
          'visible',
        );
        await fileManagerNavigationPanel.getSearch().inputField.fillInInput('');
        await navigationPanel.backToChat();
      },
    );

    await dialAdminTest.step(
      'Rename initial conversation and verify one more publication request can be submitted',
      async () => {
        await conversations.openEntityDropdownMenu(conversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
        await renameConversationModal.editConversationNameWithSaveButton(
          updatedConversationName,
        );

        await conversations.openEntityDropdownMenu(updatedConversationName);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.publish);
        await publishingRequestDialog.requestName.fillInInput(
          GeneratorUtil.randomPublicationRequestName(),
        );
        const publishApiModels =
          await publishingRequestDialog.sendPublicationRequest();
        baseAssertion.assertValue(
          publishApiModels.response.resources.filter(
            (r) =>
              r.sourceUrl ===
              ItemUtil.getEncodedItemId(conversation.id).replace(
                conversation.name,
                updatedConversationName,
              ),
          ).length,
          1,
        );
        baseAssertion.assertValue(
          publishApiModels.response.resources.filter(
            (r) => r.sourceUrl === ItemUtil.getEncodedItemId(imageUrl),
          ).length,
          1,
        );
        await toast.closeToast();
      },
    );

    await dialAdminTest.step(
      'Verify error toast is displayed on attempt to create publication request for conversation with already published file',
      async () => {
        await conversations.openEntityDropdownMenu(secondConversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.publish);
        await publishingRequestDialog.requestName.fillInInput(
          GeneratorUtil.randomPublicationRequestName(),
        );
        await publishingRequestDialog.sendRequestButton.click();
        await baseAssertion.assertElementState(toast, 'visible');
        await baseAssertion.assertElementText(
          toast,
          ExpectedConstants.attachmentPublishErrorMessage,
        );
        await baseAssertion.assertElementState(
          publishingRequestDialog,
          'hidden',
        );
      },
    );
  },
);

dialAdminTest(
  'Publish chat with plotly.\n' +
    'Header context menu options for chats from publication request from Approve required section.\n' +
    'Error message appears if to Share the conversation with an attachment from Organization',
  async ({
    conversationData,
    fileApiHelper,
    dataInjector,
    dialHomePage,
    conversations,
    conversationDropdownMenu,
    baseAssertion,
    apiAssertion,
    publishingRequestDialog,
    adminDialHomePage,
    adminPublishingApprovalModal,
    adminChatHeader,
    adminApproveRequiredConversationDropdownMenuAssertion,
    adminPublicationReviewControl,
    adminOrganizationConversations,
    adminConversationDropdownMenu,
    adminChat,
    adminChatMessages,
    adminToast,
    adminShareModal,
    adminConversations,
    adminConversationAssertion,
    publishFileTreeAssertion,
    adminApproveRequiredConversationsAssertion,
    adminOrganizationConversationAssertion,
    adminPublishingApprovalModalAssertion,
    adminApproveRequiredConversations,
    adminPublishFilesAssertion,
    setTestIds,
    localStorageManager,
    adminLocalStorageManager,
  }) => {
    dialAdminTest.slow();
    setTestIds('EPMRTC-3625', 'EPMRTC-4740', 'EPMRTC-4125');
    let plotlyConversation: Conversation;
    let plotlyImageUrl: string;
    const requestName = GeneratorUtil.randomPublicationRequestName();
    const chatResponseIndex = 2;

    await dialTest.step(
      'Prepare conversation with plotly graph in the response',
      async () => {
        plotlyImageUrl = await fileApiHelper.putFile(Attachment.plotlyName, {
          parentPath: API.modelFilePath(modelWithInputAttachments.id),
        });
        plotlyConversation =
          conversationData.prepareConversationWithAttachmentInResponse(
            plotlyImageUrl,
            modelWithInputAttachments,
          );
        await dataInjector.createConversations([plotlyConversation]);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Select "Publish" conversation dropdown menu option and verify publishing modal is opened, plotly is available for publishing',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(plotlyConversation.name);
        await conversations.openEntityDropdownMenu(plotlyConversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.publish);
        await baseAssertion.assertElementState(
          publishingRequestDialog,
          'visible',
        );
        await publishFileTreeAssertion.assertEntityState(
          { name: Attachment.plotlyName },
          'visible',
        );
      },
    );

    await dialTest.step(
      'Set publication request name and submit the request',
      async () => {
        await publishingRequestDialog.requestName.fillInInput(requestName);
        await publishingRequestDialog.sendPublicationRequest();
        await baseAssertion.assertElementState(
          publishingRequestDialog,
          'hidden',
        );
      },
    );

    await dialAdminTest.step(
      'Login as admin and verify publishing request is displayed under "Approve required" section',
      async () => {
        await adminLocalStorageManager.setShowSideBarPanels();
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredConversationsAssertion.assertFolderState(
          { name: requestName },
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Expand request folder and verify "Publication approval" modal is displayed',
      async () => {
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          requestName,
        );
        await adminApproveRequiredConversationsAssertion.assertFolderEntityState(
          { name: requestName },
          { name: plotlyConversation.name },
          'visible',
        );
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal,
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Verify plotly is displayed under "Files" tree',
      async () => {
        await adminPublishFilesAssertion.assertEntityState(
          { name: Attachment.plotlyName },
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Admin reviews the conversation and verifies chat header dots menu option',
      async () => {
        await adminPublishingApprovalModal.goToEntityReview({
          isHttpMethodTriggered: false,
        });
        await adminChatHeader.dotsMenu.click();
        await adminApproveRequiredConversationDropdownMenuAssertion.assertMenuIncludesOptions(
          MenuOptions.compare,
          MenuOptions.duplicate,
          MenuOptions.replay,
          MenuOptions.playback,
          MenuOptions.export,
        );
      },
    );

    await dialAdminTest.step(
      'Admin approves the request and verifies publication disappears from "Approve required" and displayed under "Organization" section',
      async () => {
        await adminPublicationReviewControl.backToPublicationRequest();
        await adminPublishingApprovalModal.approveRequest();
        await adminApproveRequiredConversationsAssertion.assertFolderState(
          { name: requestName },
          'hidden',
        );
        await adminOrganizationConversationAssertion.assertEntityState(
          { name: plotlyConversation.name },
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Open published conversation and verify plotly graph is shown on expand attachment',
      async () => {
        await adminOrganizationConversations.selectEntity(
          plotlyConversation.name,
        );
        await adminChatMessages
          .getChatMessageAttachment(chatResponseIndex, Attachment.plotlyName)
          .waitForState({ state: 'visible' });
        const expandAttachmentResponse =
          await adminChatMessages.expandChatMessageAttachment(
            chatResponseIndex,
            Attachment.plotlyName,
          );
        baseAssertion.assertValue(
          expandAttachmentResponse
            ? expandAttachmentResponse.status()
            : undefined,
          200,
          ExpectedMessages.attachmentIsExpanded,
        );
        await baseAssertion.assertElementState(
          adminChatMessages.getMessagePlotlyAttachment(chatResponseIndex),
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Duplicate published conversation and verify plotly graph is shown on expand attachment',
      async () => {
        await adminChat.duplicateConversation();
        await adminConversationAssertion.assertEntityState(
          { name: plotlyConversation.name },
          'visible',
        );
        await adminConversationAssertion.assertSelectedEntity(
          plotlyConversation.name,
        );
        await adminChatMessages
          .getChatMessageAttachment(chatResponseIndex, Attachment.plotlyName)
          .waitForState({ state: 'visible' });
        await adminChatMessages.expandChatMessageAttachment(
          chatResponseIndex,
          Attachment.plotlyName,
          { isHttpMethodTriggered: false },
        );
        await baseAssertion.assertElementState(
          adminChatMessages.getMessagePlotlyAttachment(chatResponseIndex),
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Verify error toast is shown on attempt to share conversation with published file',
      async () => {
        await adminConversations.openEntityDropdownMenu(
          plotlyConversation.name,
        );
        await adminConversationDropdownMenu.selectMenuOption(MenuOptions.share);
        await baseAssertion.assertElementState(adminToast, 'visible');
        await baseAssertion.assertElementText(
          adminToast,
          ExpectedConstants.sharingWithAttachmentNotFromAllFilesErrorMessage,
        );
        await baseAssertion.assertElementState(adminShareModal, 'hidden');
        await adminToast.closeToast();
      },
    );

    await dialAdminTest.step(
      'Create playback of published conversation and verify plotly graph is shown on expand attachment',
      async () => {
        const playbackName = ExpectedConstants.playbackConversation.concat(
          plotlyConversation.name,
        );
        await adminOrganizationConversations.openEntityDropdownMenu(
          plotlyConversation.name,
        );
        await adminConversationDropdownMenu.selectMenuOption(
          MenuOptions.playback,
        );
        await adminConversationAssertion.assertEntityState(
          { name: playbackName },
          'visible',
        );
        await adminConversationAssertion.assertSelectedEntity(playbackName);
        for (let i = 1; i <= chatResponseIndex; i++) {
          await adminChat.playNextChatMessage();
        }
        await adminChatMessages
          .getChatMessageAttachment(chatResponseIndex, Attachment.plotlyName)
          .waitForState({ state: 'visible' });
        await adminChatMessages.expandChatMessageAttachment(
          chatResponseIndex,
          Attachment.plotlyName,
          { isHttpMethodTriggered: false },
        );
        await baseAssertion.assertElementState(
          adminChatMessages.getMessagePlotlyAttachment(chatResponseIndex),
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Verify replay conversation can be created based on published one',
      async () => {
        const replayName = ExpectedConstants.replayConversation.concat(
          plotlyConversation.name,
        );
        await adminOrganizationConversations.openEntityDropdownMenu(
          plotlyConversation.name,
        );
        await adminConversationDropdownMenu.selectMenuOption(
          MenuOptions.replay,
        );
        await adminConversationAssertion.assertEntityState(
          { name: replayName },
          'visible',
        );
        await adminConversationAssertion.assertSelectedEntity(replayName);
        await adminDialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        const replayRequest = await adminChat.startReplay();
        apiAssertion.assertRequestMessage(
          replayRequest.messages[0],
          plotlyConversation.messages[0].content,
        );
      },
    );
  },
);

dialAdminTest(
  'File Manager: Organization: the files appear in Organization root if user publishes the chat with attachment.\n' +
    "Organization: it's forbidden to delete single or multiple files.",
  async ({
    setTestIds,
    conversationData,
    dataInjector,
    publishRequestBuilder,
    publicationApiHelper,
    adminPublicationApiHelper,
    fileApiHelper,
    adminFileManagerPage,
    adminFileManagerToolbar,
    adminFileManagerGrid,
    adminFileManagerGridAssertion,
    baseAssertion,
    adminLocalStorageManager,
  }) => {
    dialAdminTest.slow();
    setTestIds('EPMRTC-4195', 'EPMRTC-4177');

    const folderPath = GeneratorUtil.randomString(5);
    let imageInRootUrl: string;
    let imageInFolderUrl: string;

    await dialAdminTest.step(
      'Upload files, create conversation with both attachments, publish and admin-approve via API',
      async () => {
        imageInRootUrl = await fileApiHelper.putFile(Attachment.sunImageName);
        imageInFolderUrl = await fileApiHelper.putFile(
          Attachment.flowerImageName,
          { parentPath: folderPath },
        );

        const conversation =
          conversationData.prepareConversationWithAttachmentsInRequest(
            modelWithInputAttachments,
            true,
            undefined,
            imageInRootUrl,
            imageInFolderUrl,
          );
        conversationData.resetData();
        await dataInjector.createConversations([conversation]);

        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withConversationInFolderResource(conversation, PublishActions.ADD)
          .withFileResource(imageInRootUrl, PublishActions.ADD_IF_ABSENT)
          .withFileResource(imageInFolderUrl, PublishActions.ADD_IF_ABSENT)
          .build();

        const publication =
          await publicationApiHelper.createPublishRequest(publishRequest);
        await adminPublicationApiHelper.approveRequest(publication);
        await adminLocalStorageManager.setShowSideBarPanels();
      },
    );

    await dialAdminTest.step(
      'Open File Manager Organization tab and verify both files appear in root',
      async () => {
        await adminFileManagerPage.openFileManagerPage({
          updateInstalledDeployments: false,
          getInstalledDeployments: true,
          updateInstalledToolsets: false,
          getInstalledToolsets: true,
          getStyles: false,
        });
        await adminFileManagerPage.waitForPageLoaded({
          isGridVisible: undefined,
        });
        await adminFileManagerToolbar.organizationTab.click();
        await adminFileManagerGridAssertion.assertGridRowByNameState(
          Attachment.sunImageName,
          'visible',
        );
        await adminFileManagerGridAssertion.assertGridRowByNameState(
          Attachment.flowerImageName,
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Select both Organization files and verify no Delete button in header',
      async () => {
        const checkbox1 = await adminFileManagerGrid.gridCheckboxByNameCell(
          Attachment.sunImageName,
        );
        await checkbox1.click();
        const checkbox2 = await adminFileManagerGrid.gridCheckboxByNameCell(
          Attachment.flowerImageName,
        );
        await checkbox2.click();

        await baseAssertion.assertElementState(
          adminFileManagerToolbar.getSelectedIconsButton(2),
          'visible',
        );
        await baseAssertion.assertElementState(
          adminFileManagerToolbar.getDeleteButton(),
          'hidden',
        );
      },
    );

    await dialAdminTest.step(
      'Deselect items using the counter button in header',
      async () => {
        await adminFileManagerToolbar.getSelectedIconsButton(2).click();
        await baseAssertion.assertElementState(
          adminFileManagerToolbar.getSelectedIconsButton(2),
          'hidden',
        );
      },
    );

    await dialAdminTest.step(
      'Open context menu for Organization file and verify Delete option is absent',
      async () => {
        const dotsMenu = await adminFileManagerGrid.gridDotsMenuByNameCell(
          Attachment.sunImageName,
        );
        await adminFileManagerGrid
          .gridRowByNameCell(Attachment.sunImageName)
          .hover();
        await dotsMenu.click();
        const rowDropdownMenu = adminFileManagerGrid.getRowDropdownMenu();
        await baseAssertion.assertElementState(
          rowDropdownMenu.dropdownItemByName(MenuOptions.delete),
          'hidden',
        );
      },
    );
  },
);

dialTest(
  'Publication request: the file appears in the Files section only once if the same file is used twice in the chat',
  async ({
    setTestIds,
    fileApiHelper,
    dataInjector,
    conversationData,
    localStorageManager,
    dialHomePage,
    conversations,
    conversationDropdownMenu,
    publishingRequestDialog,
    filesToPublishTree,
    publishFileTreeAssertion,
    baseAssertion,
  }) => {
    setTestIds('EPMRTC-4183');
    let imageUrl: string;
    let conversation: Conversation;
    const filePath = API.modelFilePath(modelWithInputAttachments.id);

    await dialTest.step(
      'Upload an image and create conversation with same attachment used twice',
      async () => {
        imageUrl = await fileApiHelper.putFile(Attachment.sunImageName, {
          parentPath: filePath,
        });
        conversation =
          conversationData.prepareConversationWithAttachmentsInRequest(
            modelWithInputAttachments,
            true,
            undefined,
            imageUrl,
            imageUrl,
          );
        await dataInjector.createConversations([conversation]);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Open Publish dialog and verify the file appears only once in Files section',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(conversation.name);
        await conversations.openEntityDropdownMenu(conversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.publish);
        await baseAssertion.assertElementState(
          publishingRequestDialog,
          'visible',
        );
        await publishFileTreeAssertion.assertEntityState(
          { name: Attachment.sunImageName },
          'visible',
        );
        await baseAssertion.assertElementsCount(
          filesToPublishTree.getEntityByName(Attachment.sunImageName),
          1,
        );
      },
    );
  },
);

dialAdminTest(
  'File Manager: Organization: the files do not appear if Administrator Rejects the publication request.\n' +
    'File Manager: Organization: the files stay if Administrator Rejects the un-publication request',
  async ({
    setTestIds,
    fileApiHelper,
    dataInjector,
    conversationData,
    localStorageManager,
    fileManagerPage,
    fileManagerToolbar,
    fileManagerGridAssertion,
    publicationApiHelper,
    adminPublicationApiHelper,
    publishRequestBuilder,
  }) => {
    setTestIds('EPMRTC-4199', 'EPMRTC-4200');

    const imageInRoot = GeneratorUtil.randomFilename('jpg');
    const imageInFolder = GeneratorUtil.randomFilename('jpg');
    const folderName = GeneratorUtil.randomString(7);

    let imageInRootUrl: string;
    let imageInFolderUrl: string;
    let publication: Publication;

    await dialAdminTest.step(
      'Upload images and create conversation with both attachments',
      async () => {
        imageInRootUrl = await fileApiHelper.putFileWithCustomName(
          imageInRoot,
          Attachment.sunImageName,
        );
        imageInFolderUrl = await fileApiHelper.putFileWithCustomName(
          imageInFolder,
          Attachment.flowerImageName,
          { parentPath: folderName },
        );
        const conversation =
          conversationData.prepareConversationWithAttachmentsInRequest(
            modelWithInputAttachments,
            true,
            undefined,
            imageInRootUrl,
            imageInFolderUrl,
          );
        await dataInjector.createConversations([conversation]);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialAdminTest.step(
      'EPMRTC-4199: create publication request and admin rejects it',
      async () => {
        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withFileResource(imageInRootUrl, PublishActions.ADD)
          .withFileResource(imageInFolderUrl, PublishActions.ADD)
          .build();
        const pendingPublication =
          await publicationApiHelper.createPublishRequest(publishRequest);
        await adminPublicationApiHelper.rejectRequest(pendingPublication);
      },
    );

    await dialAdminTest.step(
      'EPMRTC-4199: open File Manager Organization tab and verify specific files are not present',
      async () => {
        await fileManagerPage.openFileManagerPage();
        await fileManagerPage.waitForPageLoaded({ isGridVisible: undefined });
        await fileManagerToolbar.organizationTab.click();
        for (const file of [imageInRoot, imageInFolder]) {
          await fileManagerGridAssertion.assertGridRowByNameState(
            file,
            'hidden',
          );
        }
      },
    );

    await dialAdminTest.step(
      'EPMRTC-4200: publish images and approve, then create unpublish request and admin rejects it',
      async () => {
        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withFileResource(imageInRootUrl, PublishActions.ADD)
          .withFileResource(imageInFolderUrl, PublishActions.ADD)
          .build();
        publication =
          await publicationApiHelper.createPublishRequest(publishRequest);
        await adminPublicationApiHelper.approveRequest(publication);
        const unpublishRequest =
          await publicationApiHelper.createUnpublishRequest(publication);
        await adminPublicationApiHelper.rejectRequest(unpublishRequest);
      },
    );

    await dialAdminTest.step(
      'EPMRTC-4200: reload File Manager Organization tab and verify files are still present',
      async () => {
        await fileManagerPage.reloadPage();
        await fileManagerPage.waitForPageLoaded();
        await fileManagerToolbar.organizationTab.click();
        for (const file of [imageInRoot, imageInFolder]) {
          await fileManagerGridAssertion.assertGridRowByNameState(
            file,
            'visible',
          );
        }
      },
    );
  },
);
