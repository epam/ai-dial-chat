import { DialAIEntityModel } from '@/chat/types/models';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import { Attachment, ExpectedConstants } from '@/src/testData';
import { SideBarEntitiesTree } from '@/src/ui/webElements/entityTree';
import { DateUtil, GeneratorUtil } from '@/src/utils';
import { Conversation, PublishActions } from '@epam/ai-dial-shared';

let appEntity: DialAIEntityModel;

dialTest(
  'Drag & Drop a file into input.\n' + 'Drag & Drop 10 files into input.\n',
  async ({
    dialHomePage,
    setTestIds,
    dragFile,
    sendMessageInputAttachmentsAssertions,
    toast,
    toastAssertion,
    localStorageManager,
    baseAssertion,
    fileDropArea,
    customApplicationPublishingUtil,
  }) => {
    setTestIds('EPMDIAL-6830', 'EPMDIAL-6831', 'EPMDIAL-6834');
    let yearMonthSubfolder: string;

    await dialTest.step(
      'Create a custom app with set of allowed attachment types via API',
      async () => {
        const appData = await customApplicationPublishingUtil.createCustomApp({
          inputAttachmentTypes: [Attachment.imageTypesExtension],
        });
        appEntity = {
          name: appData.name,
          version: appData.version,
          reference: appData.reference,
        } as DialAIEntityModel;

        await localStorageManager.setRecentModelsIdsAndUseLastModel(appEntity);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Drag the file on the central part of the page and verify drag attachment icon and messages are displayed',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await dialHomePage.executeReactOnDragOver(fileDropArea);
        await baseAssertion.assertElementState(
          dragFile.dragFileIcon,
          'visible',
        );
        await baseAssertion.assertElementText(
          dragFile.dragFileTitle,
          ExpectedConstants.dragFileTitle,
        );
        await baseAssertion.assertElementText(
          dragFile.dragFileDescription,
          ExpectedConstants.dragFileDescription,
        );
      },
    );

    await dialTest.step(
      'Drop the file on the central part of the page and verify it appears in the send input and placed under uploads folder',
      async () => {
        yearMonthSubfolder = DateUtil.getCurrentYearMonth();
        const fileMetadata =
          await dialHomePage.getAttachmentFileMetadataAndContent(
            Attachment.sunImageName,
          );
        const responses = await fileDropArea.dragAndDropFiles([fileMetadata], {
          implementation: dialHomePage.executeReactOnDrop,
        });
        await sendMessageInputAttachmentsAssertions.assertFileIsAttached(
          Attachment.sunImageName,
          'visible',
        );
        await toastAssertion.assertToastMessage(
          ExpectedConstants.fileUploadedToastMessage(yearMonthSubfolder),
        );
        await toast.closeToast();
        await toast.waitForState({ state: 'hidden' });
        baseAssertion.assertValue(
          responses![0].parentPath,
          `${ExpectedConstants.fileUploadFolder}/${yearMonthSubfolder}`,
        );
      },
    );

    await dialTest.step(
      'Drop several files at once and verify they are displayed in the input field',
      async () => {
        const filesToDrop = [
          Attachment.cloudImageName,
          Attachment.flowerImageName,
          Attachment.heartImageName,
        ];
        const filesMetadata = [];
        for (const fileToDrop of filesToDrop) {
          filesMetadata.push(
            await dialHomePage.getAttachmentFileMetadataAndContent(fileToDrop),
          );
        }
        await fileDropArea.dragAndDropFiles(filesMetadata, {
          implementation: dialHomePage.executeReactOnDrop,
        });
        for (const fileToDrop of filesToDrop) {
          await sendMessageInputAttachmentsAssertions.assertFileIsAttached(
            fileToDrop,
            'visible',
          );
        }
        await toast.closeToast();
        await toast.waitForState({ state: 'hidden' });
      },
    );
  },
);

dialTest(
  'Drag&Drop a file in the chat in Replay mode when input is available.\n' +
    'A file appears in input message box at the bottom if to Drag&Drop the file when user-prompt is opened in edit mode',
  async ({
    dialHomePage,
    setTestIds,
    sendMessageInputAttachmentsAssertions,
    localStorageManager,
    conversationData,
    dataInjector,
    conversations,
    chatMessages,
    editMessageInputAttachmentsAssertions,
    fileDropArea,
    toast,
    customApplicationPublishingUtil,
  }) => {
    setTestIds('EPMDIAL-6834', 'EPMDIAL-6848');
    let conversation: Conversation;
    let replayConversation: Conversation;

    await dialTest.step(
      'Create a custom app with set of allowed attachment types via API',
      async () => {
        const appData = await customApplicationPublishingUtil.createCustomApp({
          inputAttachmentTypes: [Attachment.imageTypesExtension],
        });
        appEntity = {
          name: appData.name,
          version: appData.version,
          reference: appData.reference,
        } as DialAIEntityModel;

        await localStorageManager.setRecentModelsIdsAndUseLastModel(appEntity);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Create a partially replayed conversation with custom app via API',
      async () => {
        conversation = conversationData.prepareDefaultConversation(appEntity);
        replayConversation =
          conversationData.preparePartiallyReplayedConversation(
            conversation,
            0,
          );
        await dataInjector.createConversations([
          conversation,
          replayConversation,
        ]);
      },
    );

    await dialTest.step(
      'Select replay conversation, drop the file and verify it is displayed in the field, conversation remains in the replay mode',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(replayConversation.name);
        const fileMetadata =
          await dialHomePage.getAttachmentFileMetadataAndContent(
            Attachment.sunImageName,
          );
        await fileDropArea.dragAndDropFiles([fileMetadata], {
          implementation: dialHomePage.executeReactOnDrop,
        });
        await sendMessageInputAttachmentsAssertions.assertFileIsAttached(
          Attachment.sunImageName,
          'visible',
        );
        await toast.closeToast();
      },
    );

    await dialTest.step(
      'Select created conversation, open the first message in edit mode, drop the file and verify it is displayed in the send message input only',
      async () => {
        await conversations.selectEntity(
          conversation.name,
          { isHttpMethodTriggered: false },
          { exactMatch: true },
        );
        await chatMessages.openEditMessageMode(1);
        const fileMetadata =
          await dialHomePage.getAttachmentFileMetadataAndContent(
            Attachment.flowerImageName,
          );
        await fileDropArea.dragAndDropFiles([fileMetadata], {
          implementation: dialHomePage.executeReactOnDrop,
        });
        await sendMessageInputAttachmentsAssertions.assertFileIsAttached(
          Attachment.flowerImageName,
          'visible',
        );
        await editMessageInputAttachmentsAssertions.assertFileIsAttached(
          Attachment.flowerImageName,
          'hidden',
        );
      },
    );
  },
);

dialTest(
  `'No attachments allowed' if to drag a file over the chat based on agent which doesn't work with attachments`,
  async ({
    dialHomePage,
    setTestIds,
    dragFile,
    localStorageManager,
    baseAssertion,
    fileDropArea,
    customApplicationPublishingUtil,
  }) => {
    setTestIds('EPMDIAL-6839');

    await dialTest.step(
      'Create a custom app with not allowed attachments via API',
      async () => {
        const appData = await customApplicationPublishingUtil.createCustomApp();
        appEntity = {
          name: appData.name,
          version: appData.version,
          reference: appData.reference,
        } as DialAIEntityModel;

        await localStorageManager.setRecentModelsIdsAndUseLastModel(appEntity);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Drag the file on the central part of the page and verify error attachment messages is displayed',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await dialHomePage.executeReactOnDragOver(fileDropArea);
        await baseAssertion.assertElementState(
          dragFile.dragFileNotAllowedIcon,
          'visible',
        );
        await baseAssertion.assertElementText(
          dragFile.dragFileTitle,
          ExpectedConstants.dragFileNotAllowedTitle,
        );
        await baseAssertion.assertElementText(
          dragFile.dragFileDescription,
          ExpectedConstants.dragFileNotAllowedDescription,
        );
      },
    );
  },
);

dialAdminTest(
  'Forbid icon is shown if a prompt is moved over input area, central part.\n' +
    'Nothing happens if to drag a file over the chat when chat setting/select agent/other modals are opened.\n' +
    `'No attachments allowed' if to drag a file over the chat in Replay mode first screen.\n` +
    `'No attachments allowed' if to drag a file over the chat in Playback mode.\n` +
    `'No attachments allowed' if to drag a file over the chat in Shared with me.\n` +
    `'No attachments allowed' if to drag a file over the chat in Organizations.\n` +
    `'No attachments allowed' if to drag a file over the chat in Approve required`,
  async ({
    dialHomePage,
    setTestIds,
    conversationData,
    dataInjector,
    dragFile,
    localStorageManager,
    adminLocalStorageManager,
    adminDialHomePage,
    adminApproveRequiredConversations,
    conversations,
    sharedWithMeConversations,
    organizationConversations,
    chatHeader,
    conversationSettingsModal,
    baseAssertion,
    toastAssertion,
    sendMessageInputAttachmentsAssertions,
    sendMessageAssertion,
    fileDropArea,
    mainUserShareApiHelper,
    adminDataInjector,
    publishRequestBuilder,
    adminPublicationApiHelper,
    adminShareApiHelper,
    adminCustomApplicationPublishingUtil,
    modelApiHelper,
  }) => {
    setTestIds(
      'EPMDIAL-6837',
      'EPMDIAL-6845',
      'EPMDIAL-6840',
      'EPMDIAL-6841',
      'EPMDIAL-6842',
      'EPMDIAL-6843',
      'EPMDIAL-6844',
    );
    let conversation: Conversation;
    let replayConversation: Conversation;
    let playbackConversation: Conversation;
    let sharedConversation: Conversation;
    let publishedConversation: Conversation;
    let publicationRequestToApprove: string;

    await dialTest.step(
      'Create a public custom app with set of allowed attachment types via API',
      async () => {
        const appData =
          await adminCustomApplicationPublishingUtil.publishApplicationWithVersion();
        appEntity = await modelApiHelper.getAgentByNameAndVersion({
          name: appData.name,
          version: appData.version,
        });

        await localStorageManager.setRecentModelsIdsAndUseLastModel(appEntity);
        await localStorageManager.setShowSideBarPanels();
        await adminLocalStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Create a simple conversation, replay and playback conversation based on it via API',
      async () => {
        conversation = conversationData.prepareDefaultConversation(appEntity);
        conversationData.resetData();
        replayConversation =
          conversationData.prepareDefaultReplayConversation(conversation);
        conversationData.resetData();
        playbackConversation =
          conversationData.prepareDefaultPlaybackConversation(conversation);
        conversationData.resetData();
        await dataInjector.createConversations([
          conversation,
          replayConversation,
          playbackConversation,
        ]);
      },
    );

    await dialTest.step(
      'By admin create two simple conversations, share and publish them via API',
      async () => {
        sharedConversation =
          conversationData.prepareDefaultConversation(appEntity);
        conversationData.resetData();
        publishedConversation =
          conversationData.prepareDefaultConversation(appEntity);
        await adminDataInjector.createConversations([
          sharedConversation,
          publishedConversation,
        ]);
        //create 2 publish requests by admin
        for (let i = 1; i <= 2; i++) {
          const publishRequest = publishRequestBuilder
            .withName(GeneratorUtil.randomPublicationRequestName())
            .withConversationInFolderResource(
              publishedConversation,
              PublishActions.ADD,
              `0.0.${i}`,
            )
            .build();
          const publication =
            await adminPublicationApiHelper.createPublishRequest(
              publishRequest,
            );
          //publish the 1st version
          if (i === 1) {
            await adminPublicationApiHelper.approveRequest(publication);
          } else {
            publicationRequestToApprove = publication.name!;
          }
        }
        //share conversation by admin
        const shareByLinkResponse = await adminShareApiHelper.shareEntityByLink(
          [sharedConversation],
        );
        await mainUserShareApiHelper.acceptInvite(shareByLinkResponse);
      },
    );

    await dialTest.step(
      'Drag not a file dataTransfer type on the central part of the page and verify nothing happens',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await dialHomePage.executeReactOnDragOver(fileDropArea, 'onDragOver', [
          'text/plain',
        ]);
        await toastAssertion.assertToastIsHidden();
        await baseAssertion.assertElementState(dragFile, 'hidden');
        await sendMessageAssertion.assertMessageValue('');
      },
    );

    await dialTest.step(
      'Select a simple conversation, open Conversation setting modal, drag the file over the central part and verify nothing happens',
      async () => {
        await conversations.selectEntity(
          conversation.name,
          { isHttpMethodTriggered: false },
          { exactMatch: true },
        );
        await chatHeader.conversationSettings.click();
        await conversationSettingsModal.waitForState();
        await dialHomePage.executeReactOnDragOver(fileDropArea);
        await toastAssertion.assertToastIsHidden();
        await sendMessageInputAttachmentsAssertions.assertFileIsAttached(
          Attachment.sunImageName,
          'hidden',
        );
        await conversationSettingsModal.cancelButton.click();
      },
    );

    await dialTest.step(
      `Select a conversation, drag the file over the central part and verify no attachments allowed is displayed`,
      async () => {
        const conversationPairs: [Conversation, SideBarEntitiesTree][] = [
          [replayConversation, conversations],
          [playbackConversation, conversations],
          [sharedConversation, sharedWithMeConversations],
          [publishedConversation, organizationConversations],
        ];

        for (const [conversation, sidebarEntityTree] of conversationPairs) {
          await sidebarEntityTree!.selectEntity(conversation.name);
          await dialHomePage.executeReactOnDragOver(fileDropArea);
          await baseAssertion.assertElementState(
            dragFile.dragFileNotAllowedIcon,
            'visible',
          );
          await baseAssertion.assertElementText(
            dragFile.dragFileTitle,
            ExpectedConstants.dragFileNotAllowedTitle,
          );
          await baseAssertion.assertElementText(
            dragFile.dragFileDescription,
            ExpectedConstants.dragFileNotAllowedDescription,
          );
        }
      },
    );

    await dialAdminTest.step(
      `By admin select conversation from "Approve required" section, drag the file over the central part and verify no attachments allowed is displayed`,
      async () => {
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          publicationRequestToApprove,
        );
        await adminApproveRequiredConversations.selectRequestEntity(
          publicationRequestToApprove,
          publishedConversation.name,
        );
        await dialHomePage.executeReactOnDragOver(fileDropArea);
        await baseAssertion.assertElementState(
          dragFile.dragFileNotAllowedIcon,
          'visible',
        );
        await baseAssertion.assertElementText(
          dragFile.dragFileTitle,
          ExpectedConstants.dragFileNotAllowedTitle,
        );
        await baseAssertion.assertElementText(
          dragFile.dragFileDescription,
          ExpectedConstants.dragFileNotAllowedDescription,
        );
      },
    );
  },
);
