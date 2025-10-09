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
import { FileModalSection } from '@/src/ui/webElements';
import {
  DateUtil,
  FileUtil,
  GeneratorUtil,
  ItemUtil,
  ModelsUtil,
} from '@/src/utils';
import { expect } from '@playwright/test';

let modelWithInputAttachments: DialAIEntityModel;
const publicationsToUnpublish: Publication[] = [];

dialTest.beforeAll(async () => {
  modelWithInputAttachments = ModelsUtil.getModel(
    'claude-3-7-sonnet@20250219',
  )!;
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
    `Author's public name displayed in metadata for chats from Organization`,
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
    publishFileAssertion,
    adminDialHomePage,
    adminApproveRequiredConversations,
    chatBar,
    attachFilesModal,
    manageAttachmentsAssertion,
    adminPublishingApprovalModal,
    adminPublicationReviewControl,
    adminFilesToApprove,
    adminChatMessages,
    informationModal,
    downloadAssertion,
    adminApproveRequiredConversationsAssertion,
    adminOrganizationConversationAssertion,
    adminPublishingApprovalModalAssertion,
    adminPublishConversationsTreeAssertion,
    adminFilesToApproveAssertion,
    baseAssertion,
    fileApiHelper,
    setTestIds,
    localStorageManager,
    adminLocalStorageManager,
    informationModalAssertion,
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
        await publishFileAssertion.assertFileToPublish(
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
          await publishFileAssertion.assertEntityCheckboxState(
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
        publishApiModels =
          await publishingRequestDialog.sendPublicationRequest();
        await baseAssertion.assertElementState(
          publishingRequestDialog,
          'hidden',
        );
        publicationsToUnpublish.push(publishApiModels.response);
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
        await adminFilesToApproveAssertion.assertEntityState(
          { name: Attachment.cloudImageName },
          'visible',
        );
        await adminFilesToApproveAssertion.assertElementState(
          adminFilesToApprove.getFileDownloadIcon(Attachment.cloudImageName),
          'visible',
        );
        const downloadedData = await adminDialHomePage.downloadData(() =>
          adminFilesToApprove
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
        await informationModal.cancelButton.click();
      },
    );

    await dialAdminTest.step(
      'Verify attachment is displayed under "Organization" section in "Manage attachments" modal',
      async () => {
        await chatBar.openManageAttachmentsModal();
        await manageAttachmentsAssertion.assertEntityState(
          { name: Attachment.cloudImageName },
          FileModalSection.Organization,
          'visible',
        );
        await attachFilesModal.closeButton.click();
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
    publishFileAssertion,
    adminApproveRequiredConversationsAssertion,
    adminOrganizationConversationAssertion,
    adminPublishingApprovalModalAssertion,
    adminApproveRequiredConversations,
    adminFilesToApproveAssertion,
    setTestIds,
    localStorageManager,
    adminLocalStorageManager,
  }) => {
    dialAdminTest.slow();
    setTestIds('EPMRTC-3625', 'EPMRTC-4740', 'EPMRTC-4125');
    let plotlyConversation: Conversation;
    let plotlyImageUrl: string;
    const requestName = GeneratorUtil.randomPublicationRequestName();
    let publishApiModels: {
      request: PublicationRequestModel;
      response: Publication;
    };
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
        await publishFileAssertion.assertEntityState(
          { name: Attachment.plotlyName },
          'visible',
        );
      },
    );

    await dialTest.step(
      'Set publication request name and submit the request',
      async () => {
        await publishingRequestDialog.requestName.fillInInput(requestName);
        publishApiModels =
          await publishingRequestDialog.sendPublicationRequest();
        await baseAssertion.assertElementState(
          publishingRequestDialog,
          'hidden',
        );
        publicationsToUnpublish.push(publishApiModels.response);
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
        await adminFilesToApproveAssertion.assertEntityState(
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

dialTest.afterAll(
  async ({ publicationApiHelper, adminPublicationApiHelper }) => {
    for (const publication of publicationsToUnpublish) {
      const unpublishResponse =
        await publicationApiHelper.createUnpublishRequest(publication);
      await adminPublicationApiHelper.approveRequest(unpublishResponse);
    }
  },
);
