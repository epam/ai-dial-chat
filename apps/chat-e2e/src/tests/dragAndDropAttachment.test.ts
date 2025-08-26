import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import { Attachment, ExpectedConstants } from '@/src/testData';
import { DateUtil } from '@/src/utils';
import { Conversation } from '@epam/ai-dial-shared';

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
    setTestIds('EPMRTC-6334', 'EPMRTC-6358', 'EPMRTC-6247');
    let yearMonthSubfolder: string;

    await dialTest.step(
      'Create a custom app with set of allowed attachment types via API',
      async () => {
        const appData = await customApplicationPublishingUtil.createCustomApp(
          undefined,
          [Attachment.imageTypesExtension],
        );
        appEntity = {
          name: appData.name,
          version: appData.version,
          reference: appData.reference,
        } as DialAIEntityModel;
      },
    );

    await dialTest.step(
      'Drag the file on the central part of the page and verify drag attachment icon and messages are displayed',
      async () => {
        await localStorageManager.setRecentModelsIdsAndUseLastModel(appEntity);
        await localStorageManager.setShowSideBarPanels();
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
        const fileMetadata = await dialHomePage.getAttachmentFileMetadata(
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
            await dialHomePage.getAttachmentFileMetadata(fileToDrop),
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
    customApplicationPublishingUtil,
  }) => {
    setTestIds('EPMRTC-6247', 'EPMRTC-6360');
    let conversation: Conversation;
    let replayConversation: Conversation;

    await dialTest.step(
      'Create a custom app with set of allowed attachment types via API',
      async () => {
        const appData = await customApplicationPublishingUtil.createCustomApp(
          undefined,
          [Attachment.imageTypesExtension],
        );
        appEntity = {
          name: appData.name,
          version: appData.version,
          reference: appData.reference,
        } as DialAIEntityModel;
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
        await localStorageManager.setRecentModelsIdsAndUseLastModel(appEntity);
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(replayConversation.name);
        const fileMetadata = await dialHomePage.getAttachmentFileMetadata(
          Attachment.sunImageName,
        );
        await fileDropArea.dragAndDropFiles([fileMetadata], {
          implementation: dialHomePage.executeReactOnDrop,
        });
        await sendMessageInputAttachmentsAssertions.assertFileIsAttached(
          Attachment.sunImageName,
          'visible',
        );
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
        const fileMetadata = await dialHomePage.getAttachmentFileMetadata(
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
