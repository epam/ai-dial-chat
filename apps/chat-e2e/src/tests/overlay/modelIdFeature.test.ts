import dialOverlayTest from '@/src/core/dialOverlayFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MockedChatApiResponseBodies,
  Rate,
  ThemeId,
} from '@/src/testData';
import { OverlaySandboxUrls } from '@/src/testData/overlay/overlaySandboxUrls';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

const expectedModelId = 'gpt-4o';

dialOverlayTest(
  `[Overlay] Defaults set in the code: modelID is used for new conversation.\n` +
    '[Overlay] Defaults set in the code: modelID is NOT used for old conversation. Used model is used in the chat with history.\n' +
    '[Overlay] Display likes in model response - Feature.Likes.\n' +
    '[Overlay] Message template feature toggle - Feature.MessageTemplates.\n' +
    '[Overlay] Defaults set in the code: theme' +
    '[Overlay] Display clear conversations button in chat header - Feature.TopClearConversation.\n' +
    '[Overlay] Display conversation info in chat header - Feature.TopChatInfo.\n' +
    '[Overlay] Display change model settings button in chat header - Feature.TopChatModelSettings.\n' +
    '[Overlay] Display chat menu in chat header - Feature.HideTopContextMenu.\n' +
    '[Overlay][Select an agent for conversation] Cursor is set into Search field automatically when user opens the window',
  async ({
    overlayHomePage,
    overlayAgentInfo,
    overlayChat,
    overlayChatMessages,
    overlayChatHeader,
    overlayModelInfoTooltip,
    overlayTalkToAgentDialog,
    overlayHeader,
    overlayConversations,
    overlayIconApiHelper,
    overlayBaseAssertion,
    overlayApiAssertion,
    overlayAgentInfoAssertion,
    overlayTalkToAgentDialogAssertion,
    overlayAssertion,
    setTestIds,
  }) => {
    setTestIds(
      'EPMDIAL-2289',
      'EPMDIAL-2290',
      'EPMDIAL-2284',
      'EPMDIAL-2292',
      'EPMDIAL-2281',
      'EPMDIAL-2261',
      'EPMDIAL-2262',
      'EPMDIAL-2266',
      'EPMDIAL-2268',
      'EPMDIAL-2242',
    );
    const randomAgentRequest = 'test';
    const randomModelId = GeneratorUtil.randomArrayElement(
      ModelsUtil.getRecentModelIds().filter((m) => m !== expectedModelId),
    );
    const randomModel = ModelsUtil.getOpenAIEntity(randomModelId)!;

    const expectedModel = ModelsUtil.getModel(expectedModelId)!;
    const expectedModelIcon = overlayIconApiHelper.getEntityIcon(expectedModel);
    await overlayHomePage.mockChatTextResponse(
      MockedChatApiResponseBodies.simpleTextBody,
      { isOverlay: true },
    );

    await dialOverlayTest.step(
      'Verify configured model is pre-set for a new conversation',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.modelIdSetSandboxUrl,
        );
        await overlayBaseAssertion.assertElementState(
          overlayAgentInfo,
          'visible',
        );
        await overlayBaseAssertion.assertElementText(
          overlayAgentInfo.agentName,
          expectedModel.name,
        );
        await overlayAgentInfoAssertion.assertShortDescription(expectedModel);
        await overlayAgentInfoAssertion.assertAgentIcon(expectedModelIcon);
      },
    );

    await dialOverlayTest.step(
      'Click on "Change agent" btn and verify the cursor is set on the search field',
      async () => {
        await overlayChat.changeAgentButton.click();
        await overlayTalkToAgentDialogAssertion.assertIsElementFocused(
          overlayTalkToAgentDialog.getSearch().inputField,
          true,
        );
      },
    );

    await dialOverlayTest.step(
      'Select a new agent and send the request',
      async () => {
        await overlayTalkToAgentDialog.selectAgent(randomModel, {
          isHttpMethodTriggered: false,
        });
        const request =
          await overlayChat.sendRequestWithButton(randomAgentRequest);
        overlayApiAssertion.assertRequestModelId(request, randomModel);
      },
    );

    await dialOverlayTest.step(
      'Verify dots menu, "Clear conversation messages", model name, model and gear icons are available in the chat header',
      async () => {
        await overlayBaseAssertion.assertElementState(
          overlayChatHeader.dotsMenu,
          'visible',
        );
        await overlayBaseAssertion.assertElementState(
          overlayChatHeader.chatTitle,
          'visible',
        );
        await overlayBaseAssertion.assertElementState(
          overlayChatHeader.chatModelIcon,
          'visible',
        );
        await overlayBaseAssertion.assertElementState(
          overlayChatHeader.conversationSettings,
          'visible',
        );
        await overlayBaseAssertion.assertElementState(
          overlayChatHeader.clearConversation,
          'visible',
        );
      },
    );

    await dialOverlayTest.step(
      'Hover over model icon and verify tooltip content',
      async () => {
        await overlayChatHeader.chatModelIcon.hoverOver();
        await overlayBaseAssertion.assertElementText(
          overlayModelInfoTooltip.title,
          ExpectedConstants.modelInfoTooltipChangeTitle,
        );
      },
    );

    await dialOverlayTest.step(
      'Create new conversation and verify configured model is pre-set',
      async () => {
        await overlayHeader.createNewConversation();
        await overlayBaseAssertion.assertElementText(
          overlayAgentInfo.agentName,
          expectedModel.name,
        );
      },
    );

    await dialOverlayTest.step(
      'Open "Select an agent" modal and verify configured model is selected and is on top',
      async () => {
        await overlayChat.changeAgentButton.click();
        await overlayTalkToAgentDialogAssertion.assertAgentIsSelected(
          expectedModel,
        );
        const agents = await overlayTalkToAgentDialog
          .getAgents()
          .getEntityNames();
        expect
          .soft(agents[0], ExpectedMessages.recentEntitiesIsOnTop)
          .toBe(expectedModel.name);
        await overlayTalkToAgentDialog.getCloseButton().click();
      },
    );

    await dialOverlayTest.step(
      'Send the request and verify configured model is sent in the request',
      async () => {
        const request =
          await overlayChat.sendRequestWithButton('second request');
        overlayApiAssertion.assertRequestModelId(request, expectedModel);
      },
    );

    await dialOverlayTest.step(
      'Verify like/dislike button is available for the response',
      async () => {
        for (const rate of Object.values(Rate)) {
          await overlayBaseAssertion.assertElementActionabilityState(
            overlayChatMessages.getChatMessageRate(2, rate),
            'enabled',
          );
        }
      },
    );

    await dialOverlayTest.step(
      'Verify "Set message template" button is not available for the request',
      async () => {
        const request = await overlayChatMessages.hoverOverMessage(1);
        await overlayBaseAssertion.assertElementState(
          overlayChatMessages.setMessageTemplateIcon(request),
          'hidden',
        );
      },
    );

    await dialOverlayTest.step(
      'Open "Select an agent" modal for the previous conversation and verify random model is selected',
      async () => {
        await overlayHeader.leftPanelToggle.click();
        await overlayConversations.selectEntity(randomAgentRequest);
        await overlayChatHeader.chatModelIcon.click();
        await overlayTalkToAgentDialogAssertion.assertAgentIsSelected(
          randomModel.name,
        );
      },
    );

    await dialOverlayTest.step('Verify Dark theme is set', async () => {
      await overlayAssertion.assertOverlayTheme(overlayHomePage, ThemeId.dark);
    });
  },
);
