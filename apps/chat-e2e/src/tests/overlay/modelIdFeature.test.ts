import dialTest from '@/src/core/dialFixtures';
import dialOverlayTest from '@/src/core/dialOverlayFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MockedChatApiResponseBodies,
  Rate,
  Theme,
} from '@/src/testData';
import { OverlaySandboxUrls } from '@/src/testData/overlay/overlaySandboxUrls';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

const expectedModelId = 'gpt-4';

dialOverlayTest(
  `[Overlay] Defaults set in the code: modelID is used for new conversation.\n` +
    '[Overlay] Defaults set in the code: modelID is NOT used for old conversation. Used model is used in the chat with history.\n' +
    '[Overlay] Display likes in model response - Feature.Likes.\n' +
    '[Overlay] Message template feature toggle - Feature.MessageTemplates.\n' +
    '[Overlay] Defaults set in the code: theme' +
    '[Overlay] Display clear conversations button in chat header - Feature.TopClearConversation.\n' +
    '[Overlay] Display conversation info in chat header - Feature.TopChatInfo.\n' +
    '[Overlay] Display change model settings button in chat header - Feature.TopChatModelSettings.\n' +
    '[Overlay] Display chat menu in chat header - Feature.HideTopContextMenu',
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
    overlayMarketplacePage,
    overlayIconApiHelper,
    overlayBaseAssertion,
    overlayApiAssertion,
    overlayAgentInfoAssertion,
    overlayTalkToAgentDialogAssertion,
    overlayAssertion,
    setTestIds,
  }) => {
    setTestIds(
      'EPMRTC-3781',
      'EPMRTC-4693',
      'EPMRTC-3770',
      'EPMRTC-4438',
      'EPMRTC-3782',
      'EPMRTC-3762',
      'EPMRTC-3763',
      'EPMRTC-3764',
      'EPMRTC-4873',
    );
    const randomAgentRequest = 'test';
    const randomModelId = GeneratorUtil.randomArrayElement(
      ModelsUtil.getRecentModelIds().filter((m) => m !== expectedModelId),
    );
    const randomModel = ModelsUtil.getOpenAIEntity(randomModelId)!;

    const expectedModel = ModelsUtil.getModel(expectedModelId)!;
    const expectedModelIcon = overlayIconApiHelper.getEntityIcon(expectedModel);
    const expectedShortDescription =
      expectedModel.description?.split(/\s*\n\s*\n\s*/g)[0];
    await overlayHomePage.mockChatTextResponse(
      MockedChatApiResponseBodies.simpleTextBody,
      { isOverlay: true },
    );

    await dialTest.step(
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
        await overlayAgentInfoAssertion.assertDescription(
          expectedShortDescription,
        );
        await overlayAgentInfoAssertion.assertAgentIcon(expectedModelIcon);
      },
    );

    await dialTest.step(
      'Change conversation model and send the request',
      async () => {
        await overlayChat.changeAgentButton.click();
        await overlayTalkToAgentDialog.selectAgent(
          randomModel,
          overlayMarketplacePage,
        );
        const request =
          await overlayChat.sendRequestWithButton(randomAgentRequest);
        await overlayApiAssertion.assertRequestModelId(request, randomModel);
      },
    );

    await dialTest.step(
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

    await dialTest.step(
      'Hover over model icon and verify tooltip content',
      async () => {
        await overlayChatHeader.chatModelIcon.hoverOver();
        await overlayBaseAssertion.assertElementText(
          overlayModelInfoTooltip.title,
          ExpectedConstants.modelInfoTooltipChangeTitle,
        );
      },
    );

    await dialTest.step(
      'Create new conversation and verify configured model is pre-set',
      async () => {
        await overlayHeader.createNewConversation();
        await overlayBaseAssertion.assertElementText(
          overlayAgentInfo.agentName,
          expectedModel.name,
        );
      },
    );

    await dialTest.step(
      'Open "Select an agent" modal and verify configured model is selected and is on top',
      async () => {
        await overlayChat.changeAgentButton.click();
        await overlayTalkToAgentDialogAssertion.assertAgentIsSelected(
          expectedModel,
        );
        const agents = await overlayTalkToAgentDialog
          .getAgents()
          .getAgentNames();
        expect
          .soft(agents[0], ExpectedMessages.recentEntitiesIsOnTop)
          .toBe(expectedModel.name);
        await overlayTalkToAgentDialog.cancelButton.click();
      },
    );

    await dialTest.step(
      'Send the request and verify configured model is sent in the request',
      async () => {
        const request =
          await overlayChat.sendRequestWithButton('second request');
        await overlayApiAssertion.assertRequestModelId(request, expectedModel);
      },
    );

    await dialTest.step(
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

    await dialTest.step(
      'Verify "Set message template" button is not available for the request',
      async () => {
        const request = await overlayChatMessages.hoverOverMessage(1);
        await overlayBaseAssertion.assertElementState(
          overlayChatMessages.setMessageTemplateIcon(request),
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Open "Select an agent" modal for the previous conversation and verify random model is selected',
      async () => {
        await overlayHeader.leftPanelToggle.click();
        await overlayConversations.selectConversation(randomAgentRequest);
        await overlayChatHeader.chatModelIcon.click();
        await overlayTalkToAgentDialogAssertion.assertAgentIsSelected(
          randomModel.name,
        );
      },
    );

    await dialTest.step('Verify Dark theme is set', async () => {
      await overlayAssertion.assertOverlayTheme(overlayHomePage, Theme.dark);
    });
  },
);
