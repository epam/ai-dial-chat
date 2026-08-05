import { Conversation } from '@/chat/types/chat';
import { Publication } from '@/chat/types/publication';
import dialOverlayTest from '@/src/core/dialOverlayFixtures';
import {
  API,
  Attachment,
  ExpectedConstants,
  ExpectedMessages,
  OverlaySandboxUrls,
  PseudoModel,
} from '@/src/testData';
import { keys } from '@/src/ui/keyboard';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { PublishActions } from '@epam/ai-dial-shared';

const publicationsToUnpublish: Publication[] = [];
const conversationName = 'overlayConversationName';
const expectedPlaybackConversationName =
  ExpectedConstants.playbackConversation.concat(conversationName);
const expectedConversationId = `conversations/public/${PseudoModel.playback}__${expectedPlaybackConversationName}__${ExpectedConstants.defaultEntityVersion}`;

dialOverlayTest(
  '[Overlay] Exact conversation is set in Overlay. Playback chat with Plotly graph',
  async ({
    overlayHomePage,
    page,
    overlayPlaybackControl,
    overlayChatMessages,
    overlayHeader,
    conversationData,
    overlayBaseAssertion,
    localStorageManager,
    overlayDataInjector,
    setTestIds,
    overlayFileApiHelper,
    overlayPublicationApiHelper,
    adminPublicationApiHelper,
    publishRequestBuilder,
    overlayChatBar,
    overlayOrganizationConversations,
  }) => {
    setTestIds('EPMDIAL-2302');
    let plotlyConversation: Conversation;
    let playbackConversation: Conversation;
    let plotlyImageUrl: string;

    await dialOverlayTest.step(
      'Prepare playback conversation with plotly graph in the response',
      async () => {
        const defaultModel = ModelsUtil.getDefaultAgent()!;
        plotlyImageUrl = await overlayFileApiHelper.putFile(
          Attachment.plotlyName,
          { parentPath: API.modelFilePath(defaultModel.id) },
        );
        plotlyConversation =
          conversationData.prepareConversationWithAttachmentInResponse(
            plotlyImageUrl,
            defaultModel,
            undefined,
            conversationName,
          );
        playbackConversation =
          conversationData.prepareDefaultPlaybackConversation(
            plotlyConversation,
          );
        await overlayDataInjector.createConversations([
          plotlyConversation,
          playbackConversation,
        ]);
      },
    );

    await dialOverlayTest.step('Publish playback conversation', async () => {
      const assistantMessage = plotlyConversation.messages.find(
        (m) => m.role === 'assistant',
      );
      let attachment;
      if (assistantMessage !== undefined) {
        attachment = assistantMessage.custom_content!.attachments![0];
      }
      const publishRequest = publishRequestBuilder
        .withName(GeneratorUtil.randomPublicationRequestName())
        .withConversationInFolderResource(
          playbackConversation,
          PublishActions.ADD,
        )
        .withFileResource(attachment!, PublishActions.ADD_IF_ABSENT)
        .build();
      const publication =
        await overlayPublicationApiHelper.createPublishRequest(publishRequest);
      await adminPublicationApiHelper.approveRequest(publication);
      publicationsToUnpublish.push(publication);
    });

    await dialOverlayTest.step(
      'Open overlay sandbox and verify playback conversation is preselected',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.overlayConversationIdSetUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        await overlayBaseAssertion.assertElementState(
          overlayPlaybackControl,
          'visible',
        );
        const selectedConversationIds =
          await localStorageManager.getSelectedConversationIds(
            process.env.NEXT_PUBLIC_OVERLAY_HOST,
          );
        overlayBaseAssertion.assertValue(
          selectedConversationIds[0],
          expectedConversationId,
          ExpectedMessages.conversationIsSelected,
        );

        await overlayHeader.leftPanelToggle.click();
        await overlayBaseAssertion.assertElementState(
          overlayOrganizationConversations.selectedEntity(
            expectedPlaybackConversationName,
          ),
          'visible',
        );
        await overlayChatBar.closeButton.click();
      },
    );

    await dialOverlayTest.step(
      'Play the conversation forward and verify the graph is displayed',
      async () => {
        await overlayPlaybackControl.playbackNextButton.click();
        await page.keyboard.press(keys.arrowRight);
        await overlayChatMessages
          .getChatMessageAttachment(2, Attachment.plotlyName)
          .waitForState();
        const expandAttachmentResponse =
          await overlayChatMessages.expandChatMessageAttachment(
            2,
            Attachment.plotlyName,
          );
        overlayBaseAssertion.assertValue(
          expandAttachmentResponse?.status(),
          200,
          ExpectedMessages.attachmentIsExpanded,
        );
        await overlayBaseAssertion.assertElementState(
          overlayChatMessages.getMessagePlotlyAttachment(2),
          'visible',
        );
      },
    );

    await dialOverlayTest.step(
      'Create a new conversation, refresh the page and verify playback conversation is preselected',
      async () => {
        await overlayHeader.createNewConversation();
        await overlayHomePage.reloadPage();
        await overlayBaseAssertion.assertElementState(
          overlayPlaybackControl,
          'visible',
        );
        const selectedConversationIds =
          await localStorageManager.getSelectedConversationIds(
            process.env.NEXT_PUBLIC_OVERLAY_HOST,
          );
        overlayBaseAssertion.assertValue(
          selectedConversationIds[0],
          expectedConversationId,
          ExpectedMessages.conversationIsSelected,
        );

        await overlayHeader.leftPanelToggle.click();
        await overlayBaseAssertion.assertElementState(
          overlayOrganizationConversations.selectedEntity(
            expectedPlaybackConversationName,
          ),
          'visible',
        );
      },
    );
  },
);

dialOverlayTest.afterAll(
  async ({ overlayPublicationApiHelper, adminPublicationApiHelper }) => {
    for (const publication of publicationsToUnpublish) {
      const unpublishResponse =
        await overlayPublicationApiHelper.createUnpublishRequest(publication);
      await adminPublicationApiHelper.approveRequest(unpublishResponse);
    }
  },
);
