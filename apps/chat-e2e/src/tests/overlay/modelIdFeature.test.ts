import dialTest from '@/src/core/dialFixtures';
import dialOverlayTest from '@/src/core/dialOverlayFixtures';
import { ExpectedMessages, MockedChatApiResponseBodies } from '@/src/testData';
import { OverlaySandboxUrls } from '@/src/testData/overlay/overlaySandboxUrls';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

const expectedModelId = 'gpt-4';
const fallbackModelId = 'gpt-35-turbo';

dialOverlayTest(
  `[Overlay] Defaults set in the code: modelID is used for new conversation.\n` +
    '[Overlay] Defaults set in the code: modelID is NOT used for old conversation. Used model is used in the chat with history',
  async ({
    overlayHomePage,
    overlayAgentInfo,
    overlayChat,
    overlayChatHeader,
    overlayTalkToAgentDialog,
    overlayHeader,
    overlayConversations,
    overlayMarketplacePage,
    overlayIconApiHelper,
    overlayBaseAssertion,
    overlayApiAssertion,
    overlayAgentInfoAssertion,
    talkToAgentDialogAssertion,
    setTestIds,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-3781', 'EPMRTC-4693');
    const randomAgentRequest = 'test';
    const recentModelIds = ModelsUtil.getRecentModelIds().filter(
      (m) => m !== expectedModelId,
    );
    if (!recentModelIds.length) {
      // recentModelIds can be empty
      await localStorageManager.setRecentModelsIds(
        ModelsUtil.getModel(fallbackModelId)!,
      );
    }
    const randomModelId = recentModelIds.length
      ? GeneratorUtil.randomArrayElement(recentModelIds)
      : fallbackModelId;
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
        await talkToAgentDialogAssertion.assertAgentIsSelected(expectedModel);
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
      'Open "Select an agent" modal for the previous conversation and verify random model is selected',
      async () => {
        await overlayHeader.leftPanelToggle.click();
        await overlayConversations.selectConversation(randomAgentRequest);
        await overlayChatHeader.chatModelIcon.click();
        await talkToAgentDialogAssertion.assertAgentIsSelected(
          randomModel.name,
        );
      },
    );
  },
);
