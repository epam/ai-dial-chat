import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import { Attachment, PdfViewerZoom } from '@/src/testData';
import { ThemeColorAttributes } from '@/src/ui/domData';
import { ModelsUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';

let defaultModel: DialAIEntityModel;

dialTest.beforeAll(async () => {
  defaultModel = ModelsUtil.getDefaultAgent()!;
});

dialTest(
  'PDF viewer: the doc is opened in the viewer. PDF doc is sent',
  async ({
    dialHomePage,
    conversationData,
    dataInjector,
    fileApiHelper,
    localStorageManager,
    conversations,
    chatMessages,
    pdfPreviewModal,
    pdfPreviewModalAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-8981');
    const requestMessageIndex = 1;
    let conversationWithPdfAttachment: Conversation;

    await dialTest.step(
      'Create conversation with a pdf attachment in the request via API',
      async () => {
        const pdfUrl = await fileApiHelper.putFile(Attachment.pdfName);
        conversationWithPdfAttachment =
          conversationData.prepareConversationWithAttachmentsInRequest(
            defaultModel,
            'analyze the attached document',
            undefined,
            pdfUrl,
          );
        await dataInjector.createConversations([conversationWithPdfAttachment]);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Open conversation with the pdf attachment',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(conversationWithPdfAttachment.name);
      },
    );

    await dialTest.step(
      'Click on the pdf document in the chat history and verify the PDF viewer is opened with the document name left-aligned at the top',
      async () => {
        await chatMessages.expandChatMessageAttachment(
          requestMessageIndex,
          Attachment.pdfName,
        );
        await pdfPreviewModalAssertion.assertPdfPreviewModalState('visible');
        await pdfPreviewModal.pdfViewerSpinner.waitForState({
          state: 'hidden',
        });
        await pdfPreviewModalAssertion.assertPdfPreviewModalTitle(
          Attachment.pdfName,
        );
      },
    );

    await dialTest.step(
      'Verify the close ("x") button is on the right side and has a hover effect',
      async () => {
        await pdfPreviewModalAssertion.assertCloseButtonAlignment();
        await pdfPreviewModalAssertion.assertTitleAlignment();

        await pdfPreviewModal.getCloseButton().hoverOver();
        await pdfPreviewModalAssertion.assertElementBackgroundColors(
          pdfPreviewModal.getCloseButton(),
          ThemesUtil.getRgbColorByKey(
            ThemeColorAttributes.bgAccentPrimaryAlpha,
          ),
        );
      },
    );

    await dialTest.step(
      'Verify the scrollable "Pages" thumbnail sidebar is visible on the left',
      async () => {
        await pdfPreviewModalAssertion.assertPagesSidebarState('visible');
        await pdfPreviewModalAssertion.assertPagesSidebarIsScrollable();
        await pdfPreviewModalAssertion.assertPageThumbnailState(1, 'visible');
      },
    );
  },
);

dialTest(
  'PDF viewer: the exact page is opened in attachments in DIAL RAG response.\n' +
    'PDF viewer: long name is cut, tooltip is not available',
  async ({
    dialHomePage,
    conversationData,
    dataInjector,
    fileApiHelper,
    localStorageManager,
    conversations,
    chatMessages,
    pdfPreviewModal,
    chatMessagesAssertion,
    pdfPreviewModalAssertion,
    toastAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-8986', 'EPMRTC-8988');
    const requestMessageIndex = 2;
    const pdfAnswerPageIndex = 2;
    let responseAttachmentConversation: Conversation;

    await dialTest.step(
      'Create conversation with a pdf attachment in the response via API',
      async () => {
        const pdfUrl = await fileApiHelper.putFile(Attachment.multipagePdfName);
        responseAttachmentConversation =
          conversationData.prepareConversationWithAttachmentLinkInResponse(
            defaultModel,
            pdfUrl,
            pdfAnswerPageIndex,
          );
        await dataInjector.createConversations([
          responseAttachmentConversation,
        ]);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Open conversation with the pdf attachment response',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(responseAttachmentConversation.name);
      },
    );

    await dialTest.step(
      'Expand the pdf document in the chat history, click on Reference btn and verify the PDF viewer is opened',
      async () => {
        const expectedAttachTitle =
          responseAttachmentConversation.messages[1].custom_content!
            .attachments![0].title;
        await chatMessagesAssertion.assertElementState(
          chatMessages.getChatMessageAttachmentTitle(
            requestMessageIndex,
            expectedAttachTitle,
          ),
          'visible',
        );
        await chatMessages.expandChatMessageAttachment(
          requestMessageIndex,
          Attachment.multipagePdfName,
          { isHttpMethodTriggered: false },
        );
        await chatMessages.referenceButton.click();
        await pdfPreviewModalAssertion.assertPdfPreviewModalState('visible');
        await pdfPreviewModal.pdfViewerSpinner.waitForState({
          state: 'hidden',
        });
      },
    );

    await dialTest.step(
      'Verify the pdf is opened on the exact page where the response was found',
      async () => {
        await pdfPreviewModalAssertion.assertElementTextIsTruncated(
          pdfPreviewModal.title,
        );
        await pdfPreviewModalAssertion.assertPagesSidebarState('visible');
        await pdfPreviewModalAssertion.assertPageThumbnailSelectedState(
          pdfAnswerPageIndex,
        );
      },
    );

    await dialTest.step(
      'Hover over pdf title and verify no tooltip is shown',
      async () => {
        await pdfPreviewModal.titleContainer.hoverOver();
        await toastAssertion.assertToastIsHidden();
      },
    );
  },
);

dialTest(
  'PDF viewer: default Auto and change to another percentage and then to Page Fit',
  async ({
    dialHomePage,
    conversationData,
    dataInjector,
    fileApiHelper,
    localStorageManager,
    conversations,
    chatMessages,
    pdfPreviewModal,
    pdfPreviewModalAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-8983');
    const requestMessageIndex = 1;
    const firstPage = 1;
    let conversationWithPdfAttachment: Conversation;
    let initWidth: number;

    await dialTest.step(
      'Create conversation with a pdf attachment in the request via API',
      async () => {
        const pdfUrl = await fileApiHelper.putFile(Attachment.pdfName);
        conversationWithPdfAttachment =
          conversationData.prepareConversationWithAttachmentsInRequest(
            defaultModel,
            'analyze the attached document',
            undefined,
            pdfUrl,
          );
        await dataInjector.createConversations([conversationWithPdfAttachment]);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Open conversation with the pdf attachment',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(conversationWithPdfAttachment.name);
      },
    );

    await dialTest.step(
      'Click on the pdf document in the chat history and verify Auto zoom is set by default with no horizontal scroll',
      async () => {
        await chatMessages.expandChatMessageAttachment(
          requestMessageIndex,
          Attachment.pdfName,
        );
        await pdfPreviewModalAssertion.assertPdfPreviewModalState('visible');
        await pdfPreviewModal.pdfViewerSpinner.waitForState({
          state: 'hidden',
        });
        await pdfPreviewModalAssertion.assertZoomSelectValue(
          PdfViewerZoom.auto,
        );
        await pdfPreviewModalAssertion.assertViewerHorizontalScrollState(
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Select a zoom level from the dropdown (50%-200%) and verify the doc is zoomed accordingly',
      async () => {
        const initScaleValue = 100;
        const initScale = PdfViewerZoom.percent(initScaleValue);
        await pdfPreviewModal.zoomSelect.click();
        await pdfPreviewModal.selectZoomOption(initScale);
        await pdfPreviewModalAssertion.assertZoomSelectValue(initScale);
        const pageBoxAtHundredPercent = await pdfPreviewModal
          .getPdfPage(firstPage)
          .getElementBoundingBox();
        initWidth = pageBoxAtHundredPercent!.width;

        const updatedScaleValue = 50;
        const updatedScale = PdfViewerZoom.percent(updatedScaleValue);
        await pdfPreviewModal.zoomSelect.click();
        await pdfPreviewModal.selectZoomOption(updatedScale);
        await pdfPreviewModalAssertion.assertZoomSelectValue(updatedScale);
        await pdfPreviewModalAssertion.assertPageZoomedProportionally(
          firstPage,
          initWidth,
          initScaleValue / 100,
          updatedScaleValue / 100,
        );
      },
    );

    await dialTest.step(
      'Select Page Fit zoom level and verify the doc fits the entire page into the viewport',
      async () => {
        await pdfPreviewModal.zoomSelect.click();
        await pdfPreviewModal.selectZoomOption(PdfViewerZoom.pageFit);
        await pdfPreviewModalAssertion.assertZoomSelectValue(
          PdfViewerZoom.pageFit,
        );
        await pdfPreviewModalAssertion.assertViewerHorizontalScrollState(
          'hidden',
        );
      },
    );
  },
);
